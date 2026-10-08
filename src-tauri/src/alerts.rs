use std::process::Command;

use tauri::AppHandle;
use tauri_plugin_notification::NotificationExt;

const CHIME: &str = "/System/Library/Sounds/Glass.aiff";
const CHIME_VOLUME: &str = "0.5";

/// What the user is told when a phase ends on its own.
pub enum Alert {
    FocusDone { break_minutes: i64, long: bool },
    BreakOver,
}

/// Posts a notification and plays the chime. Call without holding the timer lock.
pub fn fire(app: &AppHandle, alert: Alert) {
    let (title, body) = match alert {
        Alert::FocusDone { break_minutes, long } => {
            let kind = if long { "long break" } else { "break" };
            ("Focus done", format!("{break_minutes} min {kind}"))
        }
        Alert::BreakOver => ("Break over", "Ready when you are".to_string()),
    };
    // Silent on purpose: macOS mutes notification sounds under Focus modes, so the chime is ours.
    if let Err(e) = app.notification().builder().title(title).body(body).show() {
        eprintln!("notification failed: {e}");
    }
    chime();
}

/// Plays through `afplay` (ships with macOS) on its own thread, which also reaps the process.
fn chime() {
    std::thread::spawn(|| match Command::new("afplay").args(["-v", CHIME_VOLUME, CHIME]).status() {
        Ok(status) if !status.success() => eprintln!("chime failed: afplay {status}"),
        Err(e) => eprintln!("chime failed: {e}"),
        Ok(_) => {}
    });
}
