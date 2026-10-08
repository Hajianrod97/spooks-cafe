use chrono::{DateTime, Days, Local};
use rusqlite::{params, Connection};
use serde::Serialize;
use tauri::State;

use crate::db::Db;
use crate::error::Result;
use crate::progress::{local_midnight, week_bounds};

pub(crate) mod trends;

/// One task's week: logged time against the target it had that week.
#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct TaskWeek {
    task_id: i64,
    name: String,
    color: String,
    archived: bool,
    /// Includes the partial minutes of discarded blocks, like the progress bars.
    minutes: i64,
    /// The target recorded for that week, else the task's current one.
    target_minutes: i64,
}

/// A daily to-do's week: which days (Mon..Sun) it was ticked.
#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct DailyWeek {
    id: i64,
    text: String,
    days: [bool; 7],
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct WeekReport {
    /// Local Monday 00:00, Unix seconds.
    week_start: i64,
    /// Whether any session is older than this week, i.e. whether ◀ leads anywhere.
    has_earlier: bool,
    tasks: Vec<TaskWeek>,
    /// One-time to-dos ticked this week.
    todos_done: i64,
    dailies: Vec<DailyWeek>,
}

/// `weeks_ago` = 0 is this week. Read-only apart from recording this week's targets.
#[tauri::command]
pub fn report_week(db: State<Db>, weeks_ago: u32) -> Result<WeekReport> {
    let now = Local::now();
    let conn = db.0.lock().unwrap();
    record_week_targets(&conn, week_bounds(now).0.timestamp())?;
    // Stepping back by days and re-deriving the bounds keeps every Monday at local midnight across DST.
    let day = now - Days::new(7 * u64::from(weeks_ago));
    week_report(&conn, week_bounds(day))
}

/// Records every active task's current target for the week starting `week_start`, unless the
/// week already has one. The first look at a week fixes its targets.
pub(crate) fn record_week_targets(conn: &Connection, week_start: i64) -> Result<()> {
    conn.execute(
        "INSERT OR IGNORE INTO week_targets (week_start, task_id, target_minutes)
         SELECT ?1, id, weekly_target_minutes FROM tasks WHERE archived = 0",
        [week_start],
    )?;
    Ok(())
}

/// After a task is created or edited, this week's target follows its new one.
pub(crate) fn update_week_target(conn: &Connection, task_id: i64) -> Result<()> {
    conn.execute(
        "INSERT INTO week_targets (week_start, task_id, target_minutes)
         SELECT ?1, id, weekly_target_minutes FROM tasks WHERE id = ?2
         ON CONFLICT (week_start, task_id) DO UPDATE SET target_minutes = excluded.target_minutes",
        params![week_bounds(Local::now()).0.timestamp(), task_id],
    )?;
    Ok(())
}

fn week_report(conn: &Connection, (start, end): (DateTime<Local>, DateTime<Local>)) -> Result<WeekReport> {
    let (s, e) = (start.timestamp(), end.timestamp());
    let has_earlier = conn.query_row("SELECT EXISTS (SELECT 1 FROM sessions WHERE started_at < ?1)", [s], |r| r.get(0))?;
    let todos_done = conn.query_row(
        "SELECT COUNT(*) FROM todo_ticks k JOIN todos d ON d.id = k.todo_id
         WHERE d.daily = 0 AND k.done_at >= ?1 AND k.done_at < ?2",
        [s, e],
        |r| r.get(0),
    )?;
    Ok(WeekReport {
        week_start: s,
        has_earlier,
        tasks: task_weeks(conn, s, e)?,
        todos_done,
        dailies: daily_weeks(conn, start, e)?,
    })
}

/// Tasks that existed that week and are still active, plus archived ones with time that week.
fn task_weeks(conn: &Connection, start: i64, end: i64) -> Result<Vec<TaskWeek>> {
    let mut stmt = conn.prepare(
        "SELECT t.id, t.name, t.color, t.archived,
                COALESCE((SELECT SUM(duration_minutes) FROM sessions
                          WHERE task_id = t.id AND started_at >= ?1 AND started_at < ?2), 0) AS minutes,
                COALESCE(w.target_minutes, t.weekly_target_minutes)
         FROM tasks t
         LEFT JOIN week_targets w ON w.task_id = t.id AND w.week_start = ?1
         WHERE (t.archived = 0 AND t.created_at < ?2) OR minutes > 0
         ORDER BY t.sort_order, t.id",
    )?;
    let rows = stmt
        .query_map([start, end], |row| {
            Ok(TaskWeek {
                task_id: row.get(0)?,
                name: row.get(1)?,
                color: row.get(2)?,
                archived: row.get(3)?,
                minutes: row.get(4)?,
                target_minutes: row.get(5)?,
            })
        })?
        .collect::<rusqlite::Result<Vec<_>>>()?;
    Ok(rows)
}

/// Dailies that existed at some point that week, each with the days it was ticked.
fn daily_weeks(conn: &Connection, start: DateTime<Local>, end: i64) -> Result<Vec<DailyWeek>> {
    // Each day's own local midnight, so a DST change mid-week doesn't shift a tick into the wrong day.
    let monday = start.date_naive();
    let midnights: Vec<i64> = (0..=7).map(|i| local_midnight(monday + Days::new(i)).timestamp()).collect();
    let day_of = |t: i64| midnights.windows(2).position(|w| t >= w[0] && t < w[1]);

    let mut stmt = conn.prepare(
        "SELECT id, text FROM todos
         WHERE daily = 1 AND created_at < ?2 AND (deleted_at IS NULL OR deleted_at >= ?1)
         ORDER BY id",
    )?;
    let mut ticks = conn.prepare("SELECT done_at FROM todo_ticks WHERE todo_id = ?1 AND done_at >= ?2 AND done_at < ?3")?;
    let todos = stmt
        .query_map([start.timestamp(), end], |row| Ok((row.get::<_, i64>(0)?, row.get::<_, String>(1)?)))?
        .collect::<rusqlite::Result<Vec<_>>>()?;
    todos
        .into_iter()
        .map(|(id, text)| {
            let mut days = [false; 7];
            for t in ticks.query_map(params![id, start.timestamp(), end], |r| r.get::<_, i64>(0))? {
                if let Some(d) = day_of(t?) {
                    days[d] = true;
                }
            }
            Ok(DailyWeek { id, text, days })
        })
        .collect()
}

#[cfg(test)]
mod tests {
    use super::*;
    use chrono::TimeZone;

    fn conn() -> Connection {
        let mut conn = Connection::open_in_memory().unwrap();
        crate::db::migrate(&mut conn).unwrap();
        // The seeds are created "now"; backdate them so the fixed October 2026 weeks below see them whenever the tests run.
        conn.execute("UPDATE tasks SET created_at = 0", []).unwrap();
        conn
    }

    // October 2026: Monday the 5th to Monday the 12th.
    fn at(d: u32, h: u32) -> i64 {
        Local.with_ymd_and_hms(2026, 10, d, h, 0, 0).unwrap().timestamp()
    }
    fn week() -> (DateTime<Local>, DateTime<Local>) {
        week_bounds(Local.with_ymd_and_hms(2026, 10, 7, 12, 0, 0).unwrap())
    }

    #[test]
    fn sums_the_week_and_uses_the_recorded_target() {
        let conn = conn();
        conn.execute_batch(&format!(
            "INSERT INTO sessions (task_id, started_at, duration_minutes, completed) VALUES
                (1, {}, 25, 1), (1, {}, 10, 0), (1, {}, 25, 1);",
            at(5, 9),
            at(11, 23),
            at(12, 9), // next week
        ))
        .unwrap();
        // LeetCode's target was 2 h that week; it's 8 h now.
        conn.execute("INSERT INTO week_targets VALUES (?1, 1, 120)", [at(5, 0)]).unwrap();

        let report = week_report(&conn, week()).unwrap();
        let leetcode = report.tasks.iter().find(|t| t.task_id == 1).unwrap();
        assert_eq!((leetcode.minutes, leetcode.target_minutes), (35, 120));
        let job_search = report.tasks.iter().find(|t| t.task_id == 2).unwrap();
        assert_eq!((job_search.minutes, job_search.target_minutes), (0, 420), "no record: current target");
        assert!(!report.has_earlier);
    }

    #[test]
    fn archived_tasks_show_only_with_time_and_new_tasks_not_before_they_existed() {
        let conn = conn();
        conn.execute("UPDATE tasks SET archived = 1 WHERE id IN (1, 2)", []).unwrap();
        conn.execute("UPDATE tasks SET created_at = ?1 WHERE id = 3", [at(20, 0)]).unwrap();
        conn.execute("INSERT INTO sessions (task_id, started_at, duration_minutes, completed) VALUES (1, ?1, 25, 1)", [at(6, 9)])
            .unwrap();
        let ids: Vec<i64> = week_report(&conn, week()).unwrap().tasks.iter().map(|t| t.task_id).collect();
        assert!(ids.contains(&1) && !ids.contains(&2) && !ids.contains(&3));
    }

    #[test]
    fn todos_count_one_time_ticks_and_dailies_get_their_days() {
        let conn = conn();
        conn.execute_batch(&format!(
            "INSERT INTO todos (id, text, daily, created_at) VALUES (1, 'email', 0, {c}), (2, 'stretch', 1, {c}), (3, 'old', 1, {c});
             UPDATE todos SET deleted_at = {gone} WHERE id = 3;
             INSERT INTO todo_ticks VALUES (1, {mon}), (2, {mon}), (2, {wed}), (2, {next});",
            c = at(1, 9),
            gone = at(4, 9),
            mon = at(5, 8),
            wed = at(7, 22),
            next = at(12, 8),
        ))
        .unwrap();
        let report = week_report(&conn, week()).unwrap();
        assert_eq!(report.todos_done, 1);
        assert_eq!(report.dailies.len(), 1, "a daily deleted before the week isn't shown");
        assert_eq!(report.dailies[0].days, [true, false, true, false, false, false, false]);
    }

    #[test]
    fn recording_keeps_the_first_target_and_edits_update_this_week() {
        let conn = conn();
        let this_week = week_bounds(Local::now()).0.timestamp();
        record_week_targets(&conn, this_week).unwrap();
        conn.execute("UPDATE tasks SET weekly_target_minutes = 60 WHERE id = 1", []).unwrap();
        record_week_targets(&conn, this_week).unwrap();
        let target = |conn: &Connection| -> i64 {
            conn.query_row("SELECT target_minutes FROM week_targets WHERE task_id = 1 AND week_start = ?1", [this_week], |r| r.get(0))
                .unwrap()
        };
        assert_eq!(target(&conn), 480, "a second look doesn't overwrite");
        update_week_target(&conn, 1).unwrap();
        assert_eq!(target(&conn), 60, "an edit does");
    }
}
