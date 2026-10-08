use std::sync::Mutex;

use tauri::menu::{CheckMenuItem, Menu, MenuItem, PredefinedMenuItem, Submenu};
use tauri::tray::TrayIconBuilder;
use tauri::{AppHandle, Emitter, Manager, Wry};

use crate::db::Db;
use crate::tasks::active_tasks;
use crate::timer::{self, Action, Phase, Snapshot};

const TRAY_ID: &str = "main";

/// The parts of a snapshot the menu depends on. The menu is rebuilt only when these change,
/// not on every second of the countdown.
#[derive(Clone, Copy, PartialEq)]
struct MenuShape {
    phase: Phase,
    running: bool,
    task_id: Option<i64>,
}

impl From<&Snapshot> for MenuShape {
    fn from(s: &Snapshot) -> Self {
        Self { phase: s.phase, running: s.running, task_id: s.task_id }
    }
}

/// Only touched on the main thread (see `update`), so the lock is never contended.
#[derive(Default)]
pub struct TrayState(Mutex<Option<MenuShape>>);

pub fn create(app: &AppHandle) -> tauri::Result<()> {
    let snapshot = timer::current(app);
    TrayIconBuilder::with_id(TRAY_ID)
        .title(title(&snapshot))
        .menu(&build_menu(app, &snapshot)?)
        .show_menu_on_left_click(true)
        .on_menu_event(|app, event| on_menu(app, event.id().as_ref()))
        .build(app)?;
    *app.state::<TrayState>().0.lock().unwrap() = Some(MenuShape::from(&snapshot));
    Ok(())
}

/// Refreshes the menu bar from a snapshot. Safe to call from any thread: the work is
/// queued onto the main thread, which macOS requires for menu bar changes.
pub fn update(app: &AppHandle, snapshot: &Snapshot) {
    schedule(app, snapshot.clone(), false);
}

/// Rebuilds the menu even though the timer hasn't changed: after tasks are added, renamed or
/// archived, or music starts or stops. Don't hold the db or music lock when calling this:
/// building the menu reads both.
pub fn refresh(app: &AppHandle) {
    schedule(app, timer::current(app), true);
}

fn schedule(app: &AppHandle, snapshot: Snapshot, force: bool) {
    let handle = app.clone();
    let _ = app.run_on_main_thread(move || {
        let Some(tray) = handle.tray_by_id(TRAY_ID) else {
            return;
        };
        let _ = tray.set_title(Some(title(&snapshot)));

        let shape = MenuShape::from(&snapshot);
        let state = handle.state::<TrayState>();
        let mut current = state.0.lock().unwrap();
        if force || *current != Some(shape) {
            if let Ok(menu) = build_menu(&handle, &snapshot) {
                let _ = tray.set_menu(Some(menu));
                *current = Some(shape);
            }
        }
    });
}

fn title(s: &Snapshot) -> String {
    let clock = format!("{:02}:{:02}", s.remaining_secs / 60, s.remaining_secs % 60);
    let paused = if s.running { "" } else { " ⏸" };
    match s.phase {
        Phase::Idle => "🍅".into(),
        Phase::Focus => format!("🍅 {clock}{paused}"),
        Phase::ShortBreak | Phase::LongBreak => format!("☕ {clock}{paused}"),
    }
}

fn item(app: &AppHandle, id: &str, label: &str, enabled: bool) -> tauri::Result<MenuItem<Wry>> {
    MenuItem::with_id(app, id, label, enabled, None::<&str>)
}

fn build_menu(app: &AppHandle, s: &Snapshot) -> tauri::Result<Menu<Wry>> {
    let menu = Menu::new(app)?;
    let pause_or_resume = || {
        if s.running {
            item(app, "pause", "Pause", true)
        } else {
            item(app, "resume", "Resume", true)
        }
    };

    match s.phase {
        Phase::Idle => append_start_items(app, &menu, "Start focus", s.task_id)?,
        Phase::Focus => {
            menu.append(&pause_or_resume()?)?;
            menu.append(&item(app, "discard", "Discard", true)?)?;
        }
        // Like the window, a break can be cut short by starting the next focus block.
        Phase::ShortBreak | Phase::LongBreak => {
            menu.append(&pause_or_resume()?)?;
            menu.append(&item(app, "skip", "End break", true)?)?;
            menu.append(&PredefinedMenuItem::separator(app)?)?;
            append_start_items(app, &menu, "Continue focus", s.task_id)?;
        }
    }
    menu.append(&PredefinedMenuItem::separator(app)?)?;
    let music = crate::music::current(app);
    menu.append(&item(app, "music", if music.playing { "⏸ Pause music" } else { "▶ Play music" }, true)?)?;
    if music.service == crate::music::Service::Spotify {
        menu.append(&item(app, "next-track", "⏭ Next track", true)?)?;
    }
    menu.append(&PredefinedMenuItem::separator(app)?)?;
    menu.append(&item(app, "open", "Open Lofi Focus", true)?)?;
    menu.append(&PredefinedMenuItem::quit(app, Some("Quit Lofi Focus"))?)?;
    Ok(menu)
}

const START_PREFIX: &str = "start:";

/// A submenu with every task to start a focus block on; the last one used comes first, checkmarked.
fn append_start_items(app: &AppHandle, menu: &Menu<Wry>, label: &str, last_task: Option<i64>) -> tauri::Result<()> {
    let mut tasks = active_tasks(&app.state::<Db>().0.lock().unwrap()).unwrap_or_default();
    // Stable sort: the last task moves to the top, the rest keep their order.
    tasks.sort_by_key(|t| Some(t.id) != last_task);

    let submenu = Submenu::new(app, label, !tasks.is_empty())?;
    for task in &tasks {
        let id = format!("{START_PREFIX}{}", task.id);
        let is_last = Some(task.id) == last_task;
        submenu.append(&CheckMenuItem::with_id(app, id, &task.name, true, is_last, None::<&str>)?)?;
    }
    menu.append(&submenu)
}

fn on_menu(app: &AppHandle, id: &str) {
    if let Some(task_id) = id.strip_prefix(START_PREFIX).and_then(|n| n.parse().ok()) {
        if let Err(e) = timer::apply(app, Action::StartFocus(task_id)) {
            let _ = app.emit("timer-error", e.to_string());
        }
        return;
    }
    let action = match id {
        "pause" => Action::Pause,
        "resume" => Action::Resume,
        "discard" => Action::Discard,
        "skip" => Action::SkipBreak,
        "open" => return crate::show_main_window(app),
        // Off the main thread (menu handlers run on it): these can wait seconds on osascript
        // while Spotify launches or macOS shows its permission prompt.
        "music" | "next-track" => {
            let (app, toggle) = (app.clone(), id == "music");
            std::thread::spawn(move || {
                let result = if toggle { crate::music::toggle(&app).map(|_| ()) } else { crate::music::skip(&app, true) };
                if let Err(e) = result {
                    let _ = app.emit("music-error", e.to_string());
                }
            });
            return;
        }
        _ => return,
    };
    if let Err(e) = timer::apply(app, action) {
        let _ = app.emit("timer-error", e.to_string());
    }
}
