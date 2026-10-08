use rusqlite::{params, Connection};
use serde::{Deserialize, Serialize};
use tauri::{AppHandle, Manager, State};

use crate::db::Db;
use crate::error::{Error, Result};

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

/// What the edit panel sends. All times are minutes; a `None` override means "use the global setting".
#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct TaskInput {
    name: String,
    color: String,
    weekly_target_minutes: i64,
    total_target_minutes: Option<i64>,
    focus_minutes: Option<i64>,
    short_break_minutes: Option<i64>,
    long_break_minutes: Option<i64>,
}

impl TaskInput {
    /// The UI validates too, but the backend is the one that has to be right.
    fn validated(mut self) -> Result<Self> {
        self.name = self.name.trim().to_string();
        if self.name.is_empty() {
            return Err(Error::InvalidInput("name can't be empty"));
        }
        if self.weekly_target_minutes < 0 || self.total_target_minutes.is_some_and(|m| m < 0) {
            return Err(Error::InvalidInput("targets can't be negative"));
        }
        let overrides = [self.focus_minutes, self.short_break_minutes, self.long_break_minutes];
        if overrides.into_iter().flatten().any(|m| m < 1) {
            return Err(Error::InvalidInput("durations must be at least 1 minute"));
        }
        Ok(self)
    }
}

// Each command's db guard is a temporary, dropped at the end of its statement, so the lock is
// already released when `tray::refresh` rebuilds the menu (which locks the db itself).

#[tauri::command]
pub fn create_task(app: AppHandle, task: TaskInput) -> Result<i64> {
    let task = task.validated()?;
    let id = insert_task(&app.state::<Db>().0.lock().unwrap(), &task)?;
    crate::tray::refresh(&app);
    Ok(id)
}

#[tauri::command]
pub fn update_task(app: AppHandle, id: i64, task: TaskInput) -> Result<()> {
    let task = task.validated()?;
    write_task(&app.state::<Db>().0.lock().unwrap(), id, &task)?;
    crate::tray::refresh(&app);
    Ok(())
}

/// Hides a task everywhere but keeps its sessions; tasks are never deleted.
#[tauri::command]
pub fn archive_task(app: AppHandle, id: i64) -> Result<()> {
    set_archived(&app.state::<Db>().0.lock().unwrap(), id)?;
    crate::tray::refresh(&app);
    Ok(())
}

fn insert_task(conn: &Connection, t: &TaskInput) -> Result<i64> {
    conn.execute(
        "INSERT INTO tasks (name, color, weekly_target_minutes, total_target_minutes,
                            focus_minutes, short_break_minutes, long_break_minutes, sort_order)
         VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, (SELECT COALESCE(MAX(sort_order), 0) + 1 FROM tasks))",
        params![
            t.name,
            t.color,
            t.weekly_target_minutes,
            t.total_target_minutes,
            t.focus_minutes,
            t.short_break_minutes,
            t.long_break_minutes
        ],
    )?;
    Ok(conn.last_insert_rowid())
}

fn write_task(conn: &Connection, id: i64, t: &TaskInput) -> Result<()> {
    let changed = conn.execute(
        "UPDATE tasks
         SET name = ?1, color = ?2, weekly_target_minutes = ?3, total_target_minutes = ?4,
             focus_minutes = ?5, short_break_minutes = ?6, long_break_minutes = ?7
         WHERE id = ?8 AND archived = 0",
        params![
            t.name,
            t.color,
            t.weekly_target_minutes,
            t.total_target_minutes,
            t.focus_minutes,
            t.short_break_minutes,
            t.long_break_minutes,
            id
        ],
    )?;
    if changed == 0 {
        return Err(Error::InvalidInput("task not found"));
    }
    Ok(())
}

fn set_archived(conn: &Connection, id: i64) -> Result<()> {
    if conn.execute("UPDATE tasks SET archived = 1 WHERE id = ?1", [id])? == 0 {
        return Err(Error::InvalidInput("task not found"));
    }
    Ok(())
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


#[cfg(test)]
mod tests {
    use super::*;

    fn input(name: &str) -> TaskInput {
        TaskInput {
            name: name.into(),
            color: "#000000".into(),
            weekly_target_minutes: 60,
            total_target_minutes: None,
            focus_minutes: Some(50),
            short_break_minutes: None,
            long_break_minutes: None,
        }
    }

    #[test]
    fn create_rename_archive_round_trip() {
        let mut conn = Connection::open_in_memory().unwrap();
        crate::db::migrate(&mut conn).unwrap();

        let id = insert_task(&conn, &input("Reading")).unwrap();
        let last = active_tasks(&conn).unwrap().pop().unwrap();
        assert_eq!((last.id, last.name.as_str(), last.focus_minutes), (id, "Reading", Some(50)));

        write_task(&conn, id, &input("Reading list")).unwrap();
        assert!(active_tasks(&conn).unwrap().iter().any(|t| t.name == "Reading list"));

        set_archived(&conn, id).unwrap();
        assert!(active_tasks(&conn).unwrap().iter().all(|t| t.id != id));
        assert!(write_task(&conn, id, &input("x")).is_err(), "archived tasks can't be edited");
    }

    #[test]
    fn validation_trims_and_rejects_bad_values() {
        assert_eq!(input("  Reading ").validated().unwrap().name, "Reading");
        assert!(input("   ").validated().is_err());
        assert!(TaskInput { focus_minutes: Some(0), ..input("a") }.validated().is_err());
        assert!(TaskInput { weekly_target_minutes: -1, ..input("a") }.validated().is_err());
    }
}
