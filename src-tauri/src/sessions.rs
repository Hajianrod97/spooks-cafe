use rusqlite::{params, Connection, OptionalExtension, Row};
use serde::{Deserialize, Serialize};
use tauri::State;

use crate::db::Db;
use crate::error::{Error, Result};
use crate::progress::week_bounds;

const NOTE_MAX_CHARS: usize = 200;

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct Session {
    id: i64,
    task_id: i64,
    task_name: String,
    task_color: String,
    task_archived: bool,
    /// Unix seconds.
    started_at: i64,
    duration_minutes: i64,
    completed: bool,
    note: Option<String>,
}

/// The editable parts of a session. Start time and completed-ness are facts, not edits.
#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SessionEdit {
    task_id: i64,
    duration_minutes: i64,
    note: Option<String>,
}

impl SessionEdit {
    fn validated(mut self) -> Result<Self> {
        if !(1..=24 * 60).contains(&self.duration_minutes) {
            return Err(Error::InvalidInput("duration must be between 1 minute and 24 hours"));
        }
        // One line, trimmed; an empty note is stored as NULL.
        self.note = self
            .note
            .map(|n| n.split_whitespace().collect::<Vec<_>>().join(" "))
            .filter(|n| !n.is_empty());
        if self.note.as_ref().is_some_and(|n| n.chars().count() > NOTE_MAX_CHARS) {
            return Err(Error::InvalidInput("note is too long (200 characters max)"));
        }
        Ok(self)
    }
}

const SELECT: &str = "SELECT s.id, s.task_id, t.name, t.color, t.archived, s.started_at,
                             s.duration_minutes, s.completed, s.note
                      FROM sessions s JOIN tasks t ON t.id = s.task_id";

fn from_row(row: &Row) -> rusqlite::Result<Session> {
    Ok(Session {
        id: row.get(0)?,
        task_id: row.get(1)?,
        task_name: row.get(2)?,
        task_color: row.get(3)?,
        task_archived: row.get(4)?,
        started_at: row.get(5)?,
        duration_minutes: row.get(6)?,
        completed: row.get(7)?,
        note: row.get(8)?,
    })
}

/// This week's sessions, newest first. Includes sessions of archived tasks: the time still counts.
#[tauri::command]
pub fn week_sessions(db: State<Db>) -> Result<Vec<Session>> {
    let (start, end) = week_bounds(chrono::Local::now());
    sessions_between(&db.0.lock().unwrap(), start.timestamp(), end.timestamp())
}

/// The most recent completed block. During a break that's always the one that just ended,
/// since nothing else can log a session until the next focus block.
#[tauri::command]
pub fn latest_session(db: State<Db>) -> Result<Option<Session>> {
    let conn = db.0.lock().unwrap();
    let sql = format!("{SELECT} WHERE s.completed = 1 ORDER BY s.started_at DESC, s.id DESC LIMIT 1");
    Ok(conn.query_row(&sql, [], from_row).optional()?)
}

#[tauri::command]
pub fn update_session(db: State<Db>, id: i64, edit: SessionEdit) -> Result<()> {
    write_session(&db.0.lock().unwrap(), id, &edit.validated()?)
}

#[tauri::command]
pub fn delete_session(db: State<Db>, id: i64) -> Result<()> {
    if db.0.lock().unwrap().execute("DELETE FROM sessions WHERE id = ?1", [id])? == 0 {
        return Err(Error::InvalidInput("session not found"));
    }
    Ok(())
}

fn sessions_between(conn: &Connection, start: i64, end: i64) -> Result<Vec<Session>> {
    let sql = format!(
        "{SELECT} WHERE s.started_at >= ?1 AND s.started_at < ?2 ORDER BY s.started_at DESC, s.id DESC"
    );
    let rows = conn
        .prepare(&sql)?
        .query_map([start, end], from_row)?
        .collect::<rusqlite::Result<Vec<_>>>()?;
    Ok(rows)
}

/// A session can move to any active task, or keep the one it has even if that's since archived.
fn write_session(conn: &Connection, id: i64, e: &SessionEdit) -> Result<()> {
    let changed = conn.execute(
        "UPDATE sessions SET task_id = ?1, duration_minutes = ?2, note = ?3
         WHERE id = ?4
           AND (task_id = ?1 OR ?1 IN (SELECT id FROM tasks WHERE archived = 0))",
        params![e.task_id, e.duration_minutes, e.note, id],
    )?;
    if changed == 0 {
        return Err(Error::InvalidInput("session or task not found"));
    }
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;

    fn edit(task_id: i64, minutes: i64, note: Option<&str>) -> SessionEdit {
        SessionEdit { task_id, duration_minutes: minutes, note: note.map(Into::into) }
    }

    fn setup() -> Connection {
        let mut conn = Connection::open_in_memory().unwrap();
        crate::db::migrate(&mut conn).unwrap();
        conn.execute_batch(
            "INSERT INTO sessions (task_id, started_at, duration_minutes, completed) VALUES
                (1, 1000, 25, 1), (2, 1500, 10, 0), (1, 5000, 25, 1);",
        )
        .unwrap();
        conn
    }

    #[test]
    fn lists_week_newest_first_with_task_names() {
        let conn = setup();
        let rows = sessions_between(&conn, 0, 2000).unwrap();
        let got: Vec<_> = rows.iter().map(|s| (s.started_at, s.task_name.as_str())).collect();
        assert_eq!(got, [(1500, "Job Search"), (1000, "LeetCode")]);
    }

    #[test]
    fn edits_move_tasks_but_not_onto_archived_ones() {
        let conn = setup();
        write_session(&conn, 1, &edit(3, 20, Some("graphs"))).unwrap();
        let s = &sessions_between(&conn, 0, 1001).unwrap()[0];
        assert_eq!((s.task_id, s.duration_minutes, s.note.as_deref()), (3, 20, Some("graphs")));

        conn.execute("UPDATE tasks SET archived = 1 WHERE id IN (3, 4)", []).unwrap();
        assert!(write_session(&conn, 1, &edit(4, 20, None)).is_err(), "can't move onto archived");
        write_session(&conn, 1, &edit(3, 15, None)).unwrap(); // keeping its archived task is fine
        assert!(sessions_between(&conn, 0, 1001).unwrap()[0].task_archived);
    }

    #[test]
    fn validation_normalizes_notes() {
        let e = edit(1, 25, Some("  two-pointer\n problems ")).validated().unwrap();
        assert_eq!(e.note.as_deref(), Some("two-pointer problems"));
        assert_eq!(edit(1, 25, Some("   ")).validated().unwrap().note, None);
        assert!(edit(1, 0, None).validated().is_err());
        assert!(edit(1, 25, Some(&"x".repeat(201))).validated().is_err());
    }
}
