//! Which cafe scene the window shows. Only the window's scene arrows change it, so there's no
//! event: the page that sets it already knows.

use rusqlite::{params, Connection};
use serde::{Deserialize, Serialize};
use tauri::{AppHandle, Manager};

use crate::db::Db;
use crate::error::Result;

#[derive(Clone, Copy, Debug, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub enum Scene {
    Outside,
    Counter,
    Tables,
}

impl Scene {
    fn as_str(self) -> &'static str {
        match self {
            Scene::Outside => "outside",
            Scene::Counter => "counter",
            Scene::Tables => "tables",
        }
    }

    fn parse(s: &str) -> Scene {
        match s {
            "outside" => Scene::Outside,
            "tables" => Scene::Tables,
            _ => Scene::Counter,
        }
    }
}

#[tauri::command]
pub fn get_scene(app: AppHandle) -> Result<Scene> {
    load(&app.state::<Db>().0.lock().unwrap())
}

#[tauri::command]
pub fn set_scene(app: AppHandle, scene: Scene) -> Result<()> {
    save(&app.state::<Db>().0.lock().unwrap(), scene)
}

fn load(conn: &Connection) -> Result<Scene> {
    let scene: String = conn.query_row("SELECT scene FROM settings WHERE id = 1", [], |row| row.get(0))?;
    Ok(Scene::parse(&scene))
}

fn save(conn: &Connection, scene: Scene) -> Result<()> {
    conn.execute("UPDATE settings SET scene = ?1 WHERE id = 1", params![scene.as_str()])?;
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn defaults_to_the_counter_and_round_trips() {
        let mut conn = Connection::open_in_memory().unwrap();
        crate::db::migrate(&mut conn).unwrap();

        assert_eq!(load(&conn).unwrap(), Scene::Counter);
        save(&conn, Scene::Tables).unwrap();
        assert_eq!(load(&conn).unwrap(), Scene::Tables);
    }
}
