use std::collections::{BTreeMap, BTreeSet};

use chrono::{DateTime, Datelike, Days, Local, NaiveDate, TimeZone, Timelike};
use rusqlite::Connection;
use serde::Serialize;
use tauri::State;

use super::{record_week_targets, task_weeks};
use crate::db::Db;
use crate::error::Result;
use crate::progress::{local_midnight, week_bounds};

/// Weeks of days in the heatmap, and weeks of bars per task.
const HEATMAP_WEEKS: u64 = 16;
const TREND_WEEKS: u64 = 8;

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct TrendWeek {
    minutes: i64,
    /// `None` for weeks before the task existed.
    target_minutes: Option<i64>,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct TaskTrend {
    task_id: i64,
    name: String,
    color: String,
    archived: bool,
    /// Oldest first; the last one is this week so far.
    weeks: Vec<TrendWeek>,
}

#[derive(Serialize, Debug, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct Streak {
    current: u32,
    longest: u32,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct DailyStreak {
    id: i64,
    text: String,
    streak: Streak,
}

/// From all history. Each is `None` until there's anything to say.
#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct Insights {
    /// 0 = Monday. Highest average minutes per such day since the first session.
    best_weekday: Option<u32>,
    /// 0–23, by when blocks started.
    best_hour: Option<u32>,
    /// Completed blocks ÷ all logged blocks (completed and discarded).
    completion_rate: Option<f64>,
    /// Average minutes on days with any session.
    average_active_day: Option<i64>,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct TrendsReport {
    /// Local midnight of the heatmap's first day (a Monday, Unix seconds).
    first_day: i64,
    /// Minutes per day from `first_day` up to today; days after today aren't included.
    days: Vec<i64>,
    tasks: Vec<TaskTrend>,
    /// Days with at least one completed block.
    focus_streak: Streak,
    dailies: Vec<DailyStreak>,
    insights: Insights,
}

#[tauri::command]
pub fn report_trends(db: State<Db>) -> Result<TrendsReport> {
    let now = Local::now();
    let conn = db.0.lock().unwrap();
    record_week_targets(&conn, week_bounds(now).0.timestamp())?;
    trends_report(&conn, now)
}

fn trends_report(conn: &Connection, now: DateTime<Local>) -> Result<TrendsReport> {
    let today = now.date_naive();
    let sessions = all_sessions(conn)?;

    let completed: BTreeSet<NaiveDate> = sessions.iter().filter(|s| s.completed).map(|s| s.date).collect();

    let first_monday = week_bounds(now).0.date_naive() - Days::new(7 * (HEATMAP_WEEKS - 1));
    let mut days = vec![0; (today - first_monday).num_days() as usize + 1];
    for s in &sessions {
        if let Ok(i) = usize::try_from((s.date - first_monday).num_days()) {
            if let Some(day) = days.get_mut(i) {
                *day += s.minutes;
            }
        }
    }

    Ok(TrendsReport {
        first_day: local_midnight(first_monday).timestamp(),
        days,
        tasks: task_trends(conn, now)?,
        focus_streak: streak(&completed, today),
        dailies: daily_streaks(conn, today)?,
        insights: insights(&sessions, today),
    })
}

struct Logged {
    date: NaiveDate,
    hour: u32,
    minutes: i64,
    completed: bool,
}

fn local(ts: i64) -> DateTime<Local> {
    Local.timestamp_opt(ts, 0).single().unwrap_or_else(Local::now)
}

fn all_sessions(conn: &Connection) -> Result<Vec<Logged>> {
    let mut stmt = conn.prepare("SELECT started_at, duration_minutes, completed FROM sessions")?;
    let rows = stmt
        .query_map([], |row| {
            let at = local(row.get(0)?);
            Ok(Logged { date: at.date_naive(), hour: at.hour(), minutes: row.get(1)?, completed: row.get(2)? })
        })?
        .collect::<rusqlite::Result<Vec<_>>>()?;
    Ok(rows)
}

/// The current run of consecutive days ending today, or yesterday while today is still open,
/// and the longest run ever.
fn streak(days: &BTreeSet<NaiveDate>, today: NaiveDate) -> Streak {
    let mut longest = 0;
    let mut run = 0;
    let mut previous: Option<NaiveDate> = None;
    for &day in days {
        run = if previous.and_then(|p| p.succ_opt()) == Some(day) { run + 1 } else { 1 };
        longest = longest.max(run);
        previous = Some(day);
    }

    let mut day = if days.contains(&today) { today } else { today.pred_opt().unwrap_or(today) };
    let mut current = 0;
    while days.contains(&day) {
        current += 1;
        match day.pred_opt() {
            Some(d) => day = d,
            None => break,
        }
    }
    Streak { current, longest }
}

/// Each active daily's streak of ticked days.
fn daily_streaks(conn: &Connection, today: NaiveDate) -> Result<Vec<DailyStreak>> {
    let mut stmt = conn.prepare("SELECT id, text FROM todos WHERE daily = 1 AND deleted_at IS NULL ORDER BY id")?;
    let mut ticks = conn.prepare("SELECT done_at FROM todo_ticks WHERE todo_id = ?1")?;
    let dailies = stmt
        .query_map([], |row| Ok((row.get::<_, i64>(0)?, row.get::<_, String>(1)?)))?
        .collect::<rusqlite::Result<Vec<_>>>()?;
    dailies
        .into_iter()
        .map(|(id, text)| {
            let days = ticks
                .query_map([id], |r| r.get::<_, i64>(0))?
                .map(|t| t.map(|t| local(t).date_naive()))
                .collect::<rusqlite::Result<BTreeSet<_>>>()?;
            Ok(DailyStreak { id, text, streak: streak(&days, today) })
        })
        .collect()
}

fn insights(sessions: &[Logged], today: NaiveDate) -> Insights {
    let Some(first) = sessions.iter().map(|s| s.date).min() else {
        return Insights { best_weekday: None, best_hour: None, completion_rate: None, average_active_day: None };
    };

    // Average per weekday: minutes on that weekday ÷ how many of that weekday have passed since the first session.
    let mut weekday_minutes = [0i64; 7];
    let mut hour_minutes = [0i64; 24];
    let mut by_day: BTreeMap<NaiveDate, i64> = BTreeMap::new();
    for s in sessions {
        weekday_minutes[s.date.weekday().num_days_from_monday() as usize] += s.minutes;
        hour_minutes[s.hour as usize] += s.minutes;
        *by_day.entry(s.date).or_default() += s.minutes;
    }
    let mut weekday_count = [0i64; 7];
    for day in first.iter_days().take_while(|d| *d <= today) {
        weekday_count[day.weekday().num_days_from_monday() as usize] += 1;
    }
    let best_weekday = (0..7)
        .filter(|&d| weekday_minutes[d] > 0)
        .max_by(|&a, &b| {
            let avg = |d: usize| weekday_minutes[d] as f64 / weekday_count[d].max(1) as f64;
            avg(a).total_cmp(&avg(b))
        })
        .map(|d| d as u32);
    let best_hour = (0..24).filter(|&h| hour_minutes[h] > 0).max_by_key(|&h| hour_minutes[h]).map(|h| h as u32);

    let completed = sessions.iter().filter(|s| s.completed).count();
    let total: i64 = by_day.values().sum();
    Insights {
        best_weekday,
        best_hour,
        completion_rate: Some(completed as f64 / sessions.len() as f64),
        average_active_day: Some(total / by_day.len() as i64),
    }
}

/// Eight weeks per task, oldest first, each with the target recorded for that week. Active
/// tasks always; archived ones only with time in those weeks.
fn task_trends(conn: &Connection, now: DateTime<Local>) -> Result<Vec<TaskTrend>> {
    let n = TREND_WEEKS as usize;
    let mut trends: BTreeMap<i64, TaskTrend> = BTreeMap::new();
    for (i, back) in (0..TREND_WEEKS).rev().enumerate() {
        let (start, end) = week_bounds(now - Days::new(7 * back));
        for t in task_weeks(conn, start.timestamp(), end.timestamp())? {
            let trend = trends.entry(t.task_id).or_insert_with(|| TaskTrend {
                task_id: t.task_id,
                name: t.name.clone(),
                color: t.color.clone(),
                archived: t.archived,
                weeks: (0..n).map(|_| TrendWeek { minutes: 0, target_minutes: None }).collect(),
            });
            trend.weeks[i] = TrendWeek { minutes: t.minutes, target_minutes: Some(t.target_minutes) };
        }
    }

    let mut order = conn.prepare("SELECT id FROM tasks ORDER BY sort_order, id")?;
    let ids = order.query_map([], |r| r.get::<_, i64>(0))?.collect::<rusqlite::Result<Vec<_>>>()?;
    Ok(ids
        .into_iter()
        .filter_map(|id| trends.remove(&id))
        .filter(|t| !t.archived || t.weeks.iter().any(|w| w.minutes > 0))
        .collect())
}

#[cfg(test)]
mod tests {
    use super::*;

    fn d(day: u32) -> NaiveDate {
        NaiveDate::from_ymd_opt(2026, 10, day).unwrap()
    }
    fn set(days: &[u32]) -> BTreeSet<NaiveDate> {
        days.iter().map(|&x| d(x)).collect()
    }

    #[test]
    fn today_doesnt_break_a_streak_until_it_ends() {
        assert_eq!(streak(&set(&[5, 6, 7]), d(8)), Streak { current: 3, longest: 3 });
        assert_eq!(streak(&set(&[5, 6, 7, 8]), d(8)), Streak { current: 4, longest: 4 });
        assert_eq!(streak(&set(&[5, 6]), d(8)), Streak { current: 0, longest: 2 }, "yesterday missed");
    }

    #[test]
    fn longest_survives_a_gap() {
        assert_eq!(streak(&set(&[1, 2, 3, 4, 6, 7]), d(7)), Streak { current: 2, longest: 4 });
        assert_eq!(streak(&BTreeSet::new(), d(7)), Streak { current: 0, longest: 0 });
    }

    fn conn() -> Connection {
        let mut conn = Connection::open_in_memory().unwrap();
        crate::db::migrate(&mut conn).unwrap();
        // The seeds are created "now"; backdate them so the fixed October 2026 weeks below see them whenever the tests run.
        conn.execute("UPDATE tasks SET created_at = 0", []).unwrap();
        conn
    }
    fn at(day: u32, hour: u32) -> i64 {
        Local.with_ymd_and_hms(2026, 10, day, hour, 0, 0).unwrap().timestamp()
    }

    #[test]
    fn heatmap_and_insights_from_sessions() {
        let conn = conn();
        // Mon 5th: 25 at 9:00 and a discarded 10 at 9:00; Wed 7th: 50 at 14:00.
        conn.execute_batch(&format!(
            "INSERT INTO sessions (task_id, started_at, duration_minutes, completed) VALUES
                (1, {}, 25, 1), (1, {}, 10, 0), (2, {}, 25, 1), (2, {}, 25, 1);",
            at(5, 9),
            at(5, 9),
            at(7, 14),
            at(7, 14),
        ))
        .unwrap();
        let now = Local.with_ymd_and_hms(2026, 10, 8, 12, 0, 0).unwrap();
        let report = trends_report(&conn, now).unwrap();

        // 16 weeks back to a Monday, through Thursday the 8th.
        assert_eq!(report.days.len(), 15 * 7 + 4);
        let n = report.days.len();
        assert_eq!(&report.days[n - 4..], [35, 0, 50, 0]);
        assert_eq!(report.focus_streak, Streak { current: 1, longest: 1 }, "Wednesday counts while Thursday is still open");

        let i = &report.insights;
        assert_eq!(i.best_weekday, Some(2), "Wednesday's 50 beats Monday's 35");
        assert_eq!(i.best_hour, Some(14));
        assert_eq!(i.completion_rate, Some(0.75));
        assert_eq!(i.average_active_day, Some(42));
    }

    #[test]
    fn task_trends_have_eight_weeks_with_their_targets() {
        let conn = conn();
        conn.execute("INSERT INTO sessions (task_id, started_at, duration_minutes, completed) VALUES (1, ?1, 25, 1)", [at(7, 9)])
            .unwrap();
        let now = Local.with_ymd_and_hms(2026, 10, 8, 12, 0, 0).unwrap();
        let tasks = task_trends(&conn, now).unwrap();
        assert_eq!(tasks.len(), 7, "the seven seeded tasks");
        let leetcode = &tasks[0];
        assert_eq!(leetcode.weeks.len(), 8);
        assert_eq!(leetcode.weeks[7].minutes, 25);
        assert_eq!(leetcode.weeks[7].target_minutes, Some(480));
    }
}
