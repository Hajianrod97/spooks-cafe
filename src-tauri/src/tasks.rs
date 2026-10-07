use rusqlite::Connection;
use serde::Serialize;
use tauri::State;

use crate::{db::Db, error::Result};

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct Task {
    pub id: i64,
    pub name: String,
    color: String,
    weekly_target_minutes: i64,
    total_target_minutes: Option<i64>,
    focus_minutes: Option<i64>,
    short_break_minutes: Option<i64>,
    long_break_minutes: Option<i64>,
    archived: bool,
}

#[tauri::command]
pub fn list_tasks(db: State<Db>) -> Result<Vec<Task>> {
    active_tasks(&db.0.lock().unwrap())
}

/// Non-archived tasks in display order. Shared by the window and the menu bar.
pub fn active_tasks(conn: &Connection) -> Result<Vec<Task>> {
    let mut stmt = conn.prepare(
        "SELECT id, name, color, weekly_target_minutes, total_target_minutes,
                focus_minutes, short_break_minutes, long_break_minutes, archived
         FROM tasks
         WHERE archived = 0
         ORDER BY sort_order, id",
    )?;
    let tasks = stmt
        .query_map([], |row| {
            Ok(Task {
                id: row.get(0)?,
                name: row.get(1)?,
                color: row.get(2)?,
                weekly_target_minutes: row.get(3)?,
                total_target_minutes: row.get(4)?,
                focus_minutes: row.get(5)?,
                short_break_minutes: row.get(6)?,
                long_break_minutes: row.get(7)?,
                archived: row.get(8)?,
            })
        })?
        .collect::<rusqlite::Result<Vec<_>>>()?;
    Ok(tasks)
}

