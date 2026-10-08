use chrono::{DateTime, Datelike, Days, Local, NaiveDate, NaiveTime, TimeDelta};
use rusqlite::Connection;
use serde::Serialize;
use tauri::State;

use crate::{db::Db, error::Result};

/// One task's logged time: this week, and all time for the long-term total. Tasks with no
/// sessions ever are omitted.
#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct TaskProgress {
    task_id: i64,
    /// This week. Includes the partial minutes of discarded blocks.
    minutes: i64,
    /// This week. Completed focus blocks only.
    pomodoros: i64,
    all_time_minutes: i64,
}

#[tauri::command]
pub fn weekly_progress(db: State<Db>) -> Result<Vec<TaskProgress>> {
    let (start, end) = week_bounds(Local::now());
    progress_between(&db.0.lock().unwrap(), start.timestamp(), end.timestamp())
}

/// Sessions count toward the week they started in, so checking `started_at` alone is enough.
/// One pass over all sessions: the week's sums are conditional, the all-time sum isn't.
fn progress_between(conn: &Connection, start: i64, end: i64) -> Result<Vec<TaskProgress>> {
    let mut stmt = conn.prepare(
        "SELECT task_id,
                SUM(CASE WHEN started_at >= ?1 AND started_at < ?2 THEN duration_minutes ELSE 0 END),
                SUM(CASE WHEN started_at >= ?1 AND started_at < ?2 THEN completed ELSE 0 END),
                SUM(duration_minutes)
         FROM sessions
         GROUP BY task_id",
    )?;
    let rows = stmt
        .query_map([start, end], |row| {
            Ok(TaskProgress {
                task_id: row.get(0)?,
                minutes: row.get(1)?,
                pomodoros: row.get(2)?,
                all_time_minutes: row.get(3)?,
            })
        })?
        .collect::<rusqlite::Result<Vec<_>>>()?;
    Ok(rows)
}

/// Local Monday 00:00 of `now`'s week, and the following Monday 00:00.
pub(crate) fn week_bounds(now: DateTime<Local>) -> (DateTime<Local>, DateTime<Local>) {
    let monday = now.date_naive() - Days::new(now.weekday().num_days_from_monday().into());
    (local_midnight(monday), local_midnight(monday + Days::new(7)))
}

/// Computed per date rather than as start + 7 days, so a DST change mid-week doesn't shift the
/// boundary by an hour.
fn local_midnight(date: NaiveDate) -> DateTime<Local> {
    let midnight = date.and_time(NaiveTime::MIN);
    midnight
        .and_local_timezone(Local)
        .earliest()
        // Some zones skip midnight on DST day; the first valid moment is an hour later.
        .unwrap_or_else(|| (midnight + TimeDelta::hours(1)).and_local_timezone(Local).unwrap())
}

#[cfg(test)]
mod tests {
    use super::*;
    use chrono::TimeZone;

    fn at(d: u32, h: u32, m: u32) -> DateTime<Local> {
        // October 2026: the 5th is a Monday.
        Local.with_ymd_and_hms(2026, 10, d, h, m, 0).unwrap()
    }

    #[test]
    fn midweek_belongs_to_the_monday_before() {
        assert_eq!(week_bounds(at(7, 15, 30)), (at(5, 0, 0), at(12, 0, 0)));
    }

    #[test]
    fn monday_midnight_starts_a_new_week() {
        assert_eq!(week_bounds(at(12, 0, 0)).0, at(12, 0, 0));
    }

    #[test]
    fn sunday_night_is_still_the_old_week() {
        assert_eq!(week_bounds(at(11, 23, 59)).0, at(5, 0, 0));
    }

    #[test]
    fn query_sums_this_week_and_all_time() {
        let mut conn = Connection::open_in_memory().unwrap();
        crate::db::migrate(&mut conn).unwrap();
        let (start, end) = (1_000, 2_000);
        conn.execute_batch(
            "INSERT INTO sessions (task_id, started_at, duration_minutes, completed) VALUES
                (1, 1000, 25, 1), (1, 1500, 10, 0), (2, 1999, 25, 1),
                (1,  999, 25, 1), (1, 2000, 25, 1);",
        )
        .unwrap();
        let mut rows = progress_between(&conn, start, end).unwrap();
        rows.sort_by_key(|r| r.task_id);
        let got: Vec<_> = rows.iter().map(|r| (r.task_id, r.minutes, r.pomodoros, r.all_time_minutes)).collect();
        assert_eq!(got, [(1, 35, 1, 85), (2, 25, 1, 25)]);
    }
}
