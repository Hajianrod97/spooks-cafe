mod db;
mod error;
mod tasks;
mod timer;

use tauri::{Manager, RunEvent};

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .setup(|app| {
            let db = db::open(app.handle())?;
            let timer = timer::restore(&db)?;
            app.manage(db);
            app.manage(timer);
            timer::spawn_ticker(app.handle().clone());
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            tasks::list_tasks,
            timer::get_timer,
            timer::start_focus,
            timer::pause,
            timer::resume,
            timer::discard,
            timer::skip_break,
        ])
        .build(tauri::generate_context!())
        .expect("error while building tauri application")
        .run(|app, event| {
            if let RunEvent::Exit = event {
                timer::save_on_exit(app);
            }
        });
}
