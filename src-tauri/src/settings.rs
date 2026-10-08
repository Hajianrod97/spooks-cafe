use rusqlite::{params, Connection};
use serde::{Deserialize, Serialize};
use tauri::{AppHandle, Emitter, Manager};
use tauri_plugin_autostart::ManagerExt;

use crate::db::Db;
use crate::error::{Error, Result};

/// Passed by the login item, so a launch at login starts in the menu bar only.
pub const HIDDEN_ARG: &str = "--hidden";

/// Which time of day the cafe scene shows: the clock's, or one pinned in settings.
#[derive(Clone, Copy, Debug, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub enum SceneTime {
    Auto,
    Morning,
    Afternoon,
    Evening,
    Night,
}

impl SceneTime {
    fn as_str(self) -> &'static str {
        match self {
            SceneTime::Auto => "auto",
            SceneTime::Morning => "morning",
            SceneTime::Afternoon => "afternoon",
            SceneTime::Evening => "evening",
            SceneTime::Night => "night",
        }
    }

    fn parse(s: &str) -> SceneTime {
        match s {
            "morning" => SceneTime::Morning,
            "afternoon" => SceneTime::Afternoon,
            "evening" => SceneTime::Evening,
            "night" => SceneTime::Night,
            _ => SceneTime::Auto,
        }
    }
}

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
    /// Hours (0–23) when each time-of-day phase starts; each runs until the next.
    morning_start: i64,
    afternoon_start: i64,
    evening_start: i64,
    night_start: i64,
    scene_time: SceneTime,
}

/// The phases must start in order through the day, or some hour would belong to none of them.
/// Night is the one that wraps past midnight back to morning.
fn validate_day_starts(s: &Settings) -> Result<()> {
    let starts = [s.morning_start, s.afternoon_start, s.evening_start, s.night_start];
    let in_range = starts.iter().all(|h| (0..24).contains(h));
    if !in_range || !starts.windows(2).all(|w| w[0] < w[1]) {
        return Err(Error::InvalidInput(
            "time-of-day starts must be hours from 0 to 23, in order: morning, afternoon, evening, night",
        ));
    }
    Ok(())
}

#[tauri::command]
pub fn get_settings(app: AppHandle) -> Result<Settings> {
    let mut settings = load(&app.state::<Db>().0.lock().unwrap())?;
    settings.launch_at_login = app.autolaunch().is_enabled()?;
    Ok(settings)
}

/// Durations apply from the next block; the running one keeps the length it started with.
/// Emits `settings` so the scene picks up time-of-day changes without a reload.
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
    validate_day_starts(&settings)?;
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
    let saved = get_settings(app.clone())?;
    let _ = app.emit("settings", &saved);
    Ok(saved)
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
                chime, always_on_top,
                morning_start, afternoon_start, evening_start, night_start, scene_time
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
                morning_start: row.get(6)?,
                afternoon_start: row.get(7)?,
                evening_start: row.get(8)?,
                night_start: row.get(9)?,
                scene_time: SceneTime::parse(&row.get::<_, String>(10)?),
            })
        },
    )?;
    Ok(settings)
}

fn save(conn: &Connection, s: &Settings) -> Result<()> {
    conn.execute(
        "UPDATE settings
         SET focus_minutes = ?1, short_break_minutes = ?2, long_break_minutes = ?3,
             long_break_every = ?4, chime = ?5, always_on_top = ?6,
             morning_start = ?7, afternoon_start = ?8, evening_start = ?9, night_start = ?10,
             scene_time = ?11
         WHERE id = 1",
        params![
            s.focus_minutes,
            s.short_break_minutes,
            s.long_break_minutes,
            s.long_break_every,
            s.chime,
            s.always_on_top,
            s.morning_start,
            s.afternoon_start,
            s.evening_start,
            s.night_start,
            s.scene_time.as_str()
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

    #[test]
    fn scene_settings_round_trip() {
        let mut conn = Connection::open_in_memory().unwrap();
        crate::db::migrate(&mut conn).unwrap();

        let defaults = load(&conn).unwrap();
        let starts = |s: &Settings| [s.morning_start, s.afternoon_start, s.evening_start, s.night_start];
        assert_eq!((starts(&defaults), defaults.scene_time), ([6, 12, 17, 20], SceneTime::Auto));

        save(&conn, &Settings { morning_start: 5, night_start: 22, scene_time: SceneTime::Night, ..defaults }).unwrap();
        let saved = load(&conn).unwrap();
        assert_eq!((starts(&saved), saved.scene_time), ([5, 12, 17, 22], SceneTime::Night));
    }

    #[test]
    fn day_starts_must_be_in_order_and_in_range() {
        let mut conn = Connection::open_in_memory().unwrap();
        crate::db::migrate(&mut conn).unwrap();
        let with = |m, a, e, n| Settings {
            morning_start: m,
            afternoon_start: a,
            evening_start: e,
            night_start: n,
            ..load(&conn).unwrap()
        };

        assert!(validate_day_starts(&with(6, 12, 17, 20)).is_ok());
        assert!(validate_day_starts(&with(0, 1, 2, 23)).is_ok());
        assert!(validate_day_starts(&with(6, 6, 17, 20)).is_err(), "two phases can't start together");
        assert!(validate_day_starts(&with(6, 17, 12, 20)).is_err(), "out of order");
        assert!(validate_day_starts(&with(6, 12, 17, 24)).is_err(), "past 23");
    }
}
