mod alerts;
mod app_nap;
mod db;
mod error;
mod export;
mod music;
mod progress;
mod report;
mod scene;
mod sessions;
mod settings;
mod tasks;
mod timer;
mod todos;
mod tray;

use tauri::{AppHandle, Emitter, Manager, RunEvent, WindowEvent};

pub const MAIN_WINDOW: &str = "main";

/// Tells the page whether its window is on screen, so the scene can stop animating while
/// hidden. `show_main_window` and the close handler are the only places it's shown or hidden.
fn announce_visible(app: &AppHandle, visible: bool) {
    let _ = app.emit_to(MAIN_WINDOW, "window-visible", visible);
}

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
    announce_visible(app, true);
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_notification::init())
        .plugin(tauri_plugin_autostart::init(
            tauri_plugin_autostart::MacosLauncher::LaunchAgent,
            Some(vec![settings::HIDDEN_ARG]),
        ))
        .setup(|app| {
            let db = db::open(app.handle())?;
            let timer = timer::restore(&db)?;
            app.manage(db);
            app.manage(timer);
            app.manage(music::restore(app.state::<db::Db>().inner())?);
            app.manage(tray::TrayState::default());
            tray::create(app.handle())?;
            timer::spawn_ticker(app.handle().clone());
            music::spawn_watcher(app.handle().clone());
            settings::apply_saved(app.handle())?;
            // The window starts hidden (tauri.conf.json), so a login launch never flashes it.
            if std::env::args().any(|a| a == settings::HIDDEN_ARG) {
                set_dock_visible(app.handle(), false);
            } else {
                show_main_window(app.handle());
            }
            Ok(())
        })
        // Closing the window only hides it; the timer keeps running in the menu bar.
        .on_window_event(|window, event| {
            if let WindowEvent::CloseRequested { api, .. } = event {
                if window.label() == MAIN_WINDOW {
                    api.prevent_close();
                    let _ = window.hide();
                    set_dock_visible(window.app_handle(), false);
                    announce_visible(window.app_handle(), false);
                }
            }
        })
        .invoke_handler(tauri::generate_handler![
            tasks::list_tasks,
            tasks::create_task,
            tasks::update_task,
            tasks::archive_task,
            progress::weekly_progress,
            report::report_week,
            report::trends::report_trends,
            export::export_data,
            music::get_music,
            music::set_music_playing,
            music::set_music_volume,
            music::set_music_source,
            music::set_music_service,
            music::set_spotify_link,
            music::music_skip,
            music::youtube_sign_in,
            music::youtube_signed_in,
            music::youtube_thumbnail,
            scene::get_scene,
            scene::set_scene,
            sessions::week_sessions,
            sessions::latest_session,
            sessions::update_session,
            sessions::delete_session,
            settings::get_settings,
            settings::update_settings,
            timer::get_timer,
            timer::start_focus,
            timer::pause,
            timer::resume,
            timer::discard,
            timer::skip_break,
            todos::list_todos,
            todos::add_todo,
            todos::set_todo_done,
            todos::delete_todo,
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
