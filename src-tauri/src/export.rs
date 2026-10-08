use std::fmt::Write as _;
use std::path::PathBuf;

use chrono::{Local, TimeZone};
use rusqlite::Connection;
use serde::{Deserialize, Serialize};
use tauri::{AppHandle, Manager};
use tauri_plugin_opener::OpenerExt;

use crate::db::Db;
use crate::error::Result;

#[derive(Clone, Copy, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum Format {
    Json,
    Csv,
}

/// A self-describing row: task by name and local time, so the file reads without the database.
#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
struct ExportedSession {
    task: String,
    task_archived: bool,
    /// RFC 3339 with the local offset, e.g. `2026-10-07T14:05:00+02:00`.
    started_at: String,
    duration_minutes: i64,
    completed: bool,
    note: Option<String>,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
struct ExportedTask {
    name: String,
    color: String,
    weekly_target_minutes: i64,
    total_target_minutes: Option<i64>,
    archived: bool,
}

/// Writes every session (and, for JSON, every task) to ~/Downloads, then shows the file in
/// Finder. Returns the path so the UI can say where it went.
#[tauri::command]
pub fn export_data(app: AppHandle, format: Format) -> Result<String> {
    let contents = {
        let db = app.state::<Db>();
        let conn = db.0.lock().unwrap();
        let sessions = sessions(&conn)?;
        match format {
            Format::Json => {
                let json = serde_json::json!({
                    "exportedAt": Local::now().to_rfc3339(),
                    "tasks": tasks(&conn)?,
                    "sessions": sessions,
                });
                serde_json::to_string_pretty(&json).expect("JSON values always serialize")
            }
            Format::Csv => to_csv(&sessions),
        }
    };

    let path = export_path(&app, format)?;
    std::fs::write(&path, contents)?;
    // The file is written either way; failing to open Finder isn't worth an error.
    let _ = app.opener().reveal_item_in_dir(&path);
    Ok(path.display().to_string())
}

fn export_path(app: &AppHandle, format: Format) -> Result<PathBuf> {
    let ext = match format {
        Format::Json => "json",
        Format::Csv => "csv",
    };
    let stamp = Local::now().format("%Y-%m-%d-%H%M%S");
    Ok(app.path().download_dir()?.join(format!("lofi-focus-{stamp}.{ext}")))
}

fn sessions(conn: &Connection) -> Result<Vec<ExportedSession>> {
    let rows = conn
        .prepare(
            "SELECT t.name, t.archived, s.started_at, s.duration_minutes, s.completed, s.note
             FROM sessions s JOIN tasks t ON t.id = s.task_id
             ORDER BY s.started_at, s.id",
        )?
        .query_map([], |row| {
            Ok(ExportedSession {
                task: row.get(0)?,
                task_archived: row.get(1)?,
                started_at: local_rfc3339(row.get(2)?),
                duration_minutes: row.get(3)?,
                completed: row.get(4)?,
                note: row.get(5)?,
            })
        })?
        .collect::<rusqlite::Result<Vec<_>>>()?;
    Ok(rows)
}

fn tasks(conn: &Connection) -> Result<Vec<ExportedTask>> {
    let rows = conn
        .prepare(
            "SELECT name, color, weekly_target_minutes, total_target_minutes, archived
             FROM tasks ORDER BY sort_order, id",
        )?
        .query_map([], |row| {
            Ok(ExportedTask {
                name: row.get(0)?,
                color: row.get(1)?,
                weekly_target_minutes: row.get(2)?,
                total_target_minutes: row.get(3)?,
                archived: row.get(4)?,
            })
        })?
        .collect::<rusqlite::Result<Vec<_>>>()?;
    Ok(rows)
}

fn local_rfc3339(unix: i64) -> String {
    Local.timestamp_opt(unix, 0).single().map(|t| t.to_rfc3339()).unwrap_or_default()
}

fn to_csv(sessions: &[ExportedSession]) -> String {
    let mut out = String::from("task,task_archived,started_at,duration_minutes,completed,note\n");
    for s in sessions {
        let _ = writeln!(
            out,
            "{},{},{},{},{},{}",
            csv_field(&s.task),
            s.task_archived,
            s.started_at,
            s.duration_minutes,
            s.completed,
            csv_field(s.note.as_deref().unwrap_or("")),
        );
    }
    out
}

/// RFC 4180: quote a field containing a comma, quote or newline, doubling inner quotes.
fn csv_field(s: &str) -> String {
    if s.contains([',', '"', '\n', '\r']) {
        format!("\"{}\"", s.replace('"', "\"\""))
    } else {
        s.to_string()
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn csv_quotes_only_when_needed() {
        assert_eq!(csv_field("LeetCode"), "LeetCode");
        assert_eq!(csv_field("Side Projects / OSS"), "Side Projects / OSS");
        assert_eq!(csv_field("graphs, trees"), "\"graphs, trees\"");
        assert_eq!(csv_field("the \"hard\" one"), "\"the \"\"hard\"\" one\"");
    }

    #[test]
    fn exports_every_session_with_task_names() {
        let mut conn = Connection::open_in_memory().unwrap();
        crate::db::migrate(&mut conn).unwrap();
        conn.execute_batch(
            "INSERT INTO sessions (task_id, started_at, duration_minutes, completed, note) VALUES
                (2, 2000, 10, 0, NULL), (1, 1000, 25, 1, 'graphs, trees');",
        )
        .unwrap();
        let csv = to_csv(&sessions(&conn).unwrap());
        let lines: Vec<_> = csv.lines().collect();
        assert_eq!(lines.len(), 3);
        assert!(lines[1].starts_with("LeetCode,false,") && lines[1].ends_with(",25,true,\"graphs, trees\""));
        assert!(lines[2].starts_with("Job Search,false,") && lines[2].ends_with(",10,false,"));
        assert_eq!(tasks(&conn).unwrap().len(), 7);
    }
}
