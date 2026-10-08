mod alerts;
mod app_nap;
mod db;
mod error;
mod progress;
mod tasks;
mod timer;
mod tray;

use tauri::{AppHandle, Manager, RunEvent, WindowEvent};

const MAIN_WINDOW: &str = "main";

/// Menu-bar-only while the window is hidden; a regular app (Dock icon, ⌘-Tab) while it's open.
fn set_dock_visible(app: &AppHandle, visible: bool) {
    #[cfg(target_os = "macos")]
    {
        let policy = if visible {
            tauri::ActivationPolicy::Regular
        } else {
            tauri::ActivationPolicy::Accessory
        };
        let _ = app.set_activation_policy(policy);
    }
}

pub fn show_main_window(app: &AppHandle) {
    let Some(window) = app.get_webview_window(MAIN_WINDOW) else {
        return;
    };
    set_dock_visible(app, true);
    let _ = window.unminimize();
    let _ = window.show();
    let _ = window.set_focus();
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_notification::init())
        .setup(|app| {
            let db = db::open(app.handle())?;
            let timer = timer::restore(&db)?;
            app.manage(db);
            app.manage(timer);
            app.manage(tray::TrayState::default());
            tray::create(app.handle())?;
            timer::spawn_ticker(app.handle().clone());
            Ok(())
        })
        // Closing the window only hides it; the timer keeps running in the menu bar.
        .on_window_event(|window, event| {
            if let WindowEvent::CloseRequested { api, .. } = event {
                if window.label() == MAIN_WINDOW {
                    api.prevent_close();
                    let _ = window.hide();
                    set_dock_visible(window.app_handle(), false);
                }
            }
        })
        .invoke_handler(tauri::generate_handler![
            tasks::list_tasks,
            tasks::create_task,
            tasks::update_task,
            tasks::archive_task,
            progress::weekly_progress,
            timer::get_timer,
            timer::start_focus,
            timer::pause,
            timer::resume,
            timer::discard,
            timer::skip_break,
        ])
        .build(tauri::generate_context!())
        .expect("error while building tauri application")
        .run(|app, event| match event {
            RunEvent::Exit => timer::save_on_exit(app),
            // Clicking the Dock icon while the window is hidden brings it back.
            #[cfg(target_os = "macos")]
            RunEvent::Reopen { .. } => show_main_window(app),
            _ => {}
        });
}
