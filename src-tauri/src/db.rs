use std::sync::Mutex;

use rusqlite::Connection;
use tauri::{AppHandle, Manager};

use crate::error::Result;

pub struct Db(pub Mutex<Connection>);

/// Dev builds get their own file, so test runs (and `npm run db:clear-sessions`) never touch real history.
const FILE_NAME: &str = if cfg!(debug_assertions) { "lofi-focus-dev.db" } else { "lofi-focus.db" };

// Append-only: never edit a migration that has shipped; add a new one.
const MIGRATIONS: &[&str] = &[
    include_str!("../migrations/001_init.sql"),
    include_str!("../migrations/002_timer_state.sql"),
];

pub fn open(app: &AppHandle) -> Result<Db> {
    let dir = app.path().data_dir()?.join("Lofi Focus");
    std::fs::create_dir_all(&dir)?;

    let mut conn = Connection::open(dir.join(FILE_NAME))?;
    conn.pragma_update(None, "foreign_keys", true)?;
    conn.pragma_update(None, "journal_mode", "WAL")?;
    migrate(&mut conn)?;
    Ok(Db(Mutex::new(conn)))
}

pub(crate) fn migrate(conn: &mut Connection) -> Result<()> {
    let applied: i64 = conn.pragma_query_value(None, "user_version", |row| row.get(0))?;
    for (i, sql) in MIGRATIONS.iter().enumerate().skip(applied as usize) {
        let tx = conn.transaction()?;
        tx.execute_batch(sql)?;
        tx.pragma_update(None, "user_version", i as i64 + 1)?;
        tx.commit()?;
    }
    Ok(())
}
