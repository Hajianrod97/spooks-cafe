mod db;
mod error;
mod tasks;

use tauri::Manager;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .setup(|app| {
            let db = db::open(app.handle())?;
            app.manage(db);
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![tasks::list_tasks])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
