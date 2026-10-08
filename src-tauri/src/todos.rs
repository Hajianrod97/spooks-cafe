use chrono::Local;
use rusqlite::{params, Connection, OptionalExtension};
use serde::Serialize;
use tauri::State;

use crate::db::Db;
use crate::error::{Error, Result};
use crate::progress::local_midnight;

const TEXT_MAX_CHARS: usize = 200;

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct Todo {
    id: i64,
    text: String,
    task_id: Option<i64>,
    /// Joined in, so a to-do keeps showing its tag after the task is archived.
    task_name: Option<String>,
    task_color: Option<String>,
    /// Comes back unticked every day.
    daily: bool,
    /// Unix seconds of the tick that makes it done: a one-time to-do's only tick, a daily's
    /// tick today. `None` while open.
    done_at: Option<i64>,
}

/// One line, trimmed, like session notes.
fn clean_text(text: &str) -> Result<String> {
    let text = text.split_whitespace().collect::<Vec<_>>().join(" ");
    if text.is_empty() {
        return Err(Error::InvalidInput("a to-do needs some text"));
    }
    if text.chars().count() > TEXT_MAX_CHARS {
        return Err(Error::InvalidInput("to-do is too long (200 characters max)"));
    }
    Ok(text)
}

/// "Today" starts at local midnight: dailies reset and ticked one-time to-dos drop off.
fn today_start() -> i64 {
    local_midnight(Local::now().date_naive()).timestamp()
}

// Every command answers with the whole list, so the window never needs a second round trip
// and can't show a list that's half a change behind.

#[tauri::command]
pub fn list_todos(db: State<Db>) -> Result<Vec<Todo>> {
    visible_todos(&db.0.lock().unwrap(), today_start())
}

#[tauri::command]
pub fn add_todo(db: State<Db>, text: String, task_id: Option<i64>, daily: bool) -> Result<Vec<Todo>> {
    let text = clean_text(&text)?;
    let conn = db.0.lock().unwrap();
    insert_todo(&conn, &text, task_id, daily)?;
    visible_todos(&conn, today_start())
}

#[tauri::command]
pub fn set_todo_done(db: State<Db>, id: i64, done: bool) -> Result<Vec<Todo>> {
    let conn = db.0.lock().unwrap();
    let today = today_start();
    set_done(&conn, id, done, Local::now().timestamp(), today)?;
    visible_todos(&conn, today)
}

/// Hides the to-do for good (a daily stops coming back) but keeps its ticks.
#[tauri::command]
pub fn delete_todo(db: State<Db>, id: i64) -> Result<Vec<Todo>> {
    let conn = db.0.lock().unwrap();
    let hidden = conn.execute(
        "UPDATE todos SET deleted_at = unixepoch() WHERE id = ?1 AND deleted_at IS NULL",
        [id],
    )?;
    if hidden == 0 {
        return Err(Error::InvalidInput("to-do not found"));
    }
    visible_todos(&conn, today_start())
}

/// A new to-do can only be tagged with an active task; the insert checks that in the same statement.
fn insert_todo(conn: &Connection, text: &str, task_id: Option<i64>, daily: bool) -> Result<()> {
    let inserted = conn.execute(
        "INSERT INTO todos (text, task_id, daily)
         SELECT ?1, ?2, ?3
         WHERE ?2 IS NULL OR EXISTS (SELECT 1 FROM tasks WHERE id = ?2 AND archived = 0)",
        params![text, task_id, daily],
    )?;
    if inserted == 0 {
        return Err(Error::InvalidInput("task not found"));
    }
    Ok(())
}

/// Ticks or unticks. A one-time to-do has at most one tick ever; a daily at most one per day.
/// Ticking something already done keeps the first tick, so it's never counted twice.
fn set_done(conn: &Connection, id: i64, done: bool, now: i64, today: i64) -> Result<()> {
    let daily: bool = conn
        .query_row("SELECT daily FROM todos WHERE id = ?1 AND deleted_at IS NULL", [id], |row| row.get(0))
        .optional()?
        .ok_or(Error::InvalidInput("to-do not found"))?;
    // The ticks that count as "done": all of a one-time to-do's, only today's for a daily.
    let since = if daily { today } else { i64::MIN };
    if done {
        conn.execute(
            "INSERT INTO todo_ticks (todo_id, done_at)
             SELECT ?1, ?2
             WHERE NOT EXISTS (SELECT 1 FROM todo_ticks WHERE todo_id = ?1 AND done_at >= ?3)",
            params![id, now, since],
        )?;
    } else {
        conn.execute("DELETE FROM todo_ticks WHERE todo_id = ?1 AND done_at >= ?2", params![id, since])?;
    }
    Ok(())
}

/// Dailies first, then one-time to-dos; in each, open ones in the order added, then done ones
/// in the order ticked. One-time to-dos ticked before `today` have dropped off.
fn visible_todos(conn: &Connection, today: i64) -> Result<Vec<Todo>> {
    let mut stmt = conn.prepare(
        "SELECT * FROM (
             SELECT d.id, d.text, d.task_id, t.name, t.color, d.daily,
                    (SELECT MIN(k.done_at) FROM todo_ticks k
                     WHERE k.todo_id = d.id AND (d.daily = 0 OR k.done_at >= ?1)) AS done_at
             FROM todos d LEFT JOIN tasks t ON t.id = d.task_id
             WHERE d.deleted_at IS NULL
         )
         WHERE daily = 1 OR done_at IS NULL OR done_at >= ?1
         ORDER BY daily DESC, done_at IS NOT NULL, done_at, id",
    )?;
    let todos = stmt
        .query_map([today], |row| {
            Ok(Todo {
                id: row.get(0)?,
                text: row.get(1)?,
                task_id: row.get(2)?,
                task_name: row.get(3)?,
                task_color: row.get(4)?,
                daily: row.get(5)?,
                done_at: row.get(6)?,
            })
        })?
        .collect::<rusqlite::Result<Vec<_>>>()?;
    Ok(todos)
}

#[cfg(test)]
mod tests {
    use super::*;

    const DAY: i64 = 86_400;
    // Midnight of "today" in the tests; yesterday is TODAY - DAY.
    const TODAY: i64 = 100 * DAY;

    fn conn() -> Connection {
        let mut conn = Connection::open_in_memory().unwrap();
        crate::db::migrate(&mut conn).unwrap();
        conn
    }

    fn texts(todos: &[Todo]) -> Vec<&str> {
        todos.iter().map(|t| t.text.as_str()).collect()
    }

    fn ticks(conn: &Connection, id: i64) -> i64 {
        conn.query_row("SELECT COUNT(*) FROM todo_ticks WHERE todo_id = ?1", [id], |r| r.get(0)).unwrap()
    }

    #[test]
    fn dailies_come_first_and_ticked_items_sink() {
        let conn = conn();
        insert_todo(&conn, "a", None, false).unwrap();
        insert_todo(&conn, "b", None, false).unwrap();
        insert_todo(&conn, "stretch", None, true).unwrap();
        set_done(&conn, 1, true, TODAY + 60, TODAY).unwrap();
        assert_eq!(texts(&visible_todos(&conn, TODAY).unwrap()), ["stretch", "b", "a"]);

        set_done(&conn, 1, false, TODAY + 120, TODAY).unwrap();
        assert_eq!(texts(&visible_todos(&conn, TODAY).unwrap()), ["stretch", "a", "b"]);
    }

    #[test]
    fn a_daily_resets_at_midnight_and_keeps_its_history() {
        let conn = conn();
        insert_todo(&conn, "stretch", None, true).unwrap();
        set_done(&conn, 1, true, TODAY - DAY + 60, TODAY - DAY).unwrap();
        assert!(visible_todos(&conn, TODAY - DAY).unwrap()[0].done_at.is_some());

        // Next day: open again, yesterday's tick still recorded.
        assert_eq!(visible_todos(&conn, TODAY).unwrap()[0].done_at, None);
        set_done(&conn, 1, true, TODAY + 60, TODAY).unwrap();
        assert_eq!(visible_todos(&conn, TODAY).unwrap()[0].done_at, Some(TODAY + 60));
        assert_eq!(ticks(&conn, 1), 2);

        // Unticking today leaves yesterday alone.
        set_done(&conn, 1, false, TODAY + 120, TODAY).unwrap();
        assert_eq!(ticks(&conn, 1), 1);
    }

    #[test]
    fn one_time_items_drop_off_after_the_day_they_were_ticked_but_carry_over_if_open() {
        let conn = conn();
        insert_todo(&conn, "done yesterday", None, false).unwrap();
        insert_todo(&conn, "still open", None, false).unwrap();
        set_done(&conn, 1, true, TODAY - 60, TODAY - DAY).unwrap();
        assert_eq!(texts(&visible_todos(&conn, TODAY).unwrap()), ["still open"]);
        assert_eq!(ticks(&conn, 1), 1, "the tick is kept as history");
    }

    #[test]
    fn ticking_twice_keeps_the_first_tick() {
        let conn = conn();
        insert_todo(&conn, "once", None, false).unwrap();
        insert_todo(&conn, "daily", None, true).unwrap();
        for id in [1, 2] {
            set_done(&conn, id, true, TODAY + 60, TODAY).unwrap();
            set_done(&conn, id, true, TODAY + 120, TODAY).unwrap();
            assert_eq!(ticks(&conn, id), 1);
        }
    }

    #[test]
    fn deleting_hides_but_keeps_ticks() {
        let conn = conn();
        insert_todo(&conn, "stretch", None, true).unwrap();
        set_done(&conn, 1, true, TODAY + 60, TODAY).unwrap();
        conn.execute("UPDATE todos SET deleted_at = 1 WHERE id = 1", []).unwrap();
        assert!(visible_todos(&conn, TODAY).unwrap().is_empty());
        assert_eq!(ticks(&conn, 1), 1);
        assert!(set_done(&conn, 1, false, TODAY + 120, TODAY).is_err(), "deleted to-dos can't be ticked");
    }

    #[test]
    fn tags_must_be_active_tasks_but_survive_archiving() {
        let conn = conn();
        insert_todo(&conn, "two sum", Some(1), false).unwrap();
        assert_eq!(visible_todos(&conn, TODAY).unwrap()[0].task_name.as_deref(), Some("LeetCode"));

        conn.execute("UPDATE tasks SET archived = 1 WHERE id = 1", []).unwrap();
        assert!(insert_todo(&conn, "valid parens", Some(1), false).is_err());
        assert!(insert_todo(&conn, "x", Some(999), false).is_err());
        assert_eq!(visible_todos(&conn, TODAY).unwrap()[0].task_name.as_deref(), Some("LeetCode"));
    }

    #[test]
    fn text_is_one_trimmed_line() {
        assert_eq!(clean_text("  email \n recruiter ").unwrap(), "email recruiter");
        assert!(clean_text("   ").is_err());
        assert!(clean_text(&"x".repeat(201)).is_err());
    }

    #[test]
    fn migration_moves_existing_ticks() {
        let mut conn = Connection::open_in_memory().unwrap();
        // Run up to 008, add a ticked to-do the old way, then run 009.
        crate::db::migrate_to(&mut conn, 8).unwrap();
        conn.execute("INSERT INTO todos (text, done_at) VALUES ('old', 500)", []).unwrap();
        crate::db::migrate(&mut conn).unwrap();
        assert_eq!(conn.query_row("SELECT done_at FROM todo_ticks", [], |r| r.get::<_, i64>(0)).unwrap(), 500);
    }
}
