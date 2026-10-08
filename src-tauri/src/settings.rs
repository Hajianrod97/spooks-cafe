use rusqlite::{params, Connection};
use serde::{Deserialize, Serialize};
use tauri::{AppHandle, Manager};
use tauri_plugin_autostart::ManagerExt;

use crate::db::Db;
use crate::error::{Error, Result};

/// Passed by the login item, so a launch at login starts in the menu bar only.
pub const HIDDEN_ARG: &str = "--hidden";

#[derive(Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Settings {
    focus_minutes: i64,
    short_break_minutes: i64,
    long_break_minutes: i64,
    long_break_every: i64,
    chime: bool,
    always_on_top: bool,
    /// Read from and written to macOS, not the db.
    launch_at_login: bool,
}

#[tauri::command]
pub fn get_settings(app: AppHandle) -> Result<Settings> {
    let mut settings = load(&app.state::<Db>().0.lock().unwrap())?;
    settings.launch_at_login = app.autolaunch().is_enabled()?;
    Ok(settings)
}

/// Durations apply from the next block; the running one keeps the length it started with.
#[tauri::command]
pub fn update_settings(app: AppHandle, settings: Settings) -> Result<Settings> {
    let durations = [
        settings.focus_minutes,
        settings.short_break_minutes,
        settings.long_break_minutes,
        settings.long_break_every,
    ];
    if durations.iter().any(|&n| n < 1) {
        return Err(Error::InvalidInput("durations and the long-break interval must be at least 1"));
    }
    save(&app.state::<Db>().0.lock().unwrap(), &settings)?;

    apply_window(&app, settings.always_on_top);
    let autolaunch = app.autolaunch();
    if settings.launch_at_login != autolaunch.is_enabled()? {
        if settings.launch_at_login {
            autolaunch.enable()?;
        } else {
            autolaunch.disable()?;
        }
    }
    get_settings(app)
}

/// Applies the saved window preferences at launch.
pub fn apply_saved(app: &AppHandle) -> Result<()> {
    let settings = load(&app.state::<Db>().0.lock().unwrap())?;
    apply_window(app, settings.always_on_top);
    Ok(())
}

/// Missing or unreadable settings fall back to playing it, the default.
pub fn chime_enabled(app: &AppHandle) -> bool {
    let db = app.state::<Db>();
    let conn = db.0.lock().unwrap();
    conn.query_row("SELECT chime FROM settings WHERE id = 1", [], |row| row.get(0))
        .unwrap_or(true)
}

fn apply_window(app: &AppHandle, always_on_top: bool) {
    if let Some(window) = app.get_webview_window(crate::MAIN_WINDOW) {
        let _ = window.set_always_on_top(always_on_top);
    }
}

fn load(conn: &Connection) -> Result<Settings> {
    let settings = conn.query_row(
        "SELECT focus_minutes, short_break_minutes, long_break_minutes, long_break_every,
                chime, always_on_top
         FROM settings WHERE id = 1",
        [],
        |row| {
            Ok(Settings {
                focus_minutes: row.get(0)?,
                short_break_minutes: row.get(1)?,
                long_break_minutes: row.get(2)?,
                long_break_every: row.get(3)?,
                chime: row.get(4)?,
                always_on_top: row.get(5)?,
                launch_at_login: false,
            })
        },
    )?;
    Ok(settings)
}

fn save(conn: &Connection, s: &Settings) -> Result<()> {
    conn.execute(
        "UPDATE settings
         SET focus_minutes = ?1, short_break_minutes = ?2, long_break_minutes = ?3,
             long_break_every = ?4, chime = ?5, always_on_top = ?6
         WHERE id = 1",
        params![
            s.focus_minutes,
            s.short_break_minutes,
            s.long_break_minutes,
            s.long_break_every,
            s.chime,
            s.always_on_top
        ],
    )?;
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn save_and_load_round_trip() {
        let mut conn = Connection::open_in_memory().unwrap();
        crate::db::migrate(&mut conn).unwrap();

        let defaults = load(&conn).unwrap();
        assert!(defaults.chime && !defaults.always_on_top);

        save(&conn, &Settings { focus_minutes: 50, chime: false, always_on_top: true, ..defaults }).unwrap();
        let saved = load(&conn).unwrap();
        assert_eq!((saved.focus_minutes, saved.chime, saved.always_on_top), (50, false, true));
    }
}
