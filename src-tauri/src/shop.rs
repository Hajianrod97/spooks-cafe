//! The cafe shop: earning Boo Beans, the catalogue, buying, hats and decorations.
//!
//! Beans live in the append-only `bean_ledger`; the balance is the sum of its rows. Every
//! earning row has a unique `ref`, and inserts use `INSERT OR IGNORE`, so paying the same
//! thing twice is a no-op at the database level rather than a check the code must remember.

use std::collections::HashMap;

use chrono::{DateTime, Local};
use rusqlite::{params, Connection, OptionalExtension};
use serde::Serialize;
use tauri::{AppHandle, Emitter, Manager, State};

use crate::db::Db;
use crate::error::{Error, Result};
use crate::progress::week_bounds;

const TODO_BEANS: i64 = 2;
/// A to-do pays only if it was added this long before it was ticked, so add-and-tick doesn't.
const TODO_MIN_AGE_SECS: i64 = 5 * 60;
const TODO_DAILY_CAP: i64 = 10;
const TARGET_BONUS: i64 = 25;

/// 1 bean per 2.5 planned minutes, rounded half up: 25 min → 10. Same formula as the backfill
/// in migration 011.
fn focus_beans(minutes: i64) -> i64 {
    (minutes * 4 + 5) / 10
}

#[derive(Clone, Copy, PartialEq, Eq)]
enum Kind {
    Hat,
    /// A decoration that stands on something: a counter top, a table, a shelf.
    Surface,
}

struct Item {
    id: &'static str,
    kind: Kind,
    price: i64,
}

/// Names and art live in the frontend (`src/cafe/shop.ts`); ids must match.
const CATALOGUE: &[Item] = &[
    Item { id: "beanie", kind: Kind::Hat, price: 60 },
    Item { id: "witch-hat", kind: Kind::Hat, price: 200 },
    Item { id: "pumpkin", kind: Kind::Surface, price: 150 },
];

struct Slot {
    id: &'static str,
    kind: Kind,
}

/// Positions are drawn in `design/cafe/build.mjs`; ids must match `src/cafe/shop.ts`.
const SLOTS: &[Slot] = &[
    Slot { id: "counter-left", kind: Kind::Surface },
    Slot { id: "counter-right", kind: Kind::Surface },
    Slot { id: "tables-table", kind: Kind::Surface },
    Slot { id: "tables-shelf", kind: Kind::Surface },
];

fn item(id: &str) -> Result<&'static Item> {
    CATALOGUE.iter().find(|i| i.id == id).ok_or(Error::InvalidInput("no such item"))
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct Shop {
    balance: i64,
    /// How many more ticks pay today, for the To-do status line.
    todo_beans_left: i64,
    owned: Vec<String>,
    /// Slot id → item id.
    placements: HashMap<String, String>,
    hat: Option<String>,
}

// --- Earning --------------------------------------------------------------------------------
// Called inside the caller's transaction, right after the session or tick is written.

/// Pays for a completed focus block, plus the task's weekly target bonus if this block brought
/// the week to its target. Returns the beans paid.
pub(crate) fn award_focus(
    conn: &Connection,
    session_id: i64,
    task_id: i64,
    planned_minutes: i64,
    started_at: DateTime<Local>,
) -> Result<i64> {
    let mut paid = credit(conn, focus_beans(planned_minutes), "focus", &format!("session:{session_id}"), None)?;

    // Sessions count toward the week they started in. Minutes include discarded partials,
    // like the progress bars; the target is the one recorded for that week.
    let (start, end) = week_bounds(started_at);
    let (minutes, target): (i64, i64) = conn.query_row(
        "SELECT (SELECT COALESCE(SUM(duration_minutes), 0) FROM sessions
                 WHERE task_id = ?1 AND started_at >= ?2 AND started_at < ?3),
                COALESCE((SELECT target_minutes FROM week_targets WHERE task_id = ?1 AND week_start = ?2),
                         weekly_target_minutes)
         FROM tasks WHERE id = ?1",
        params![task_id, start.timestamp(), end.timestamp()],
        |row| Ok((row.get(0)?, row.get(1)?)),
    )?;
    if target > 0 && minutes >= target {
        let week = start.format("%Y-%m-%d");
        paid += credit(conn, TARGET_BONUS, "target", &format!("target:{task_id}:{week}"), None)?;
    }
    Ok(paid)
}

/// Pays for a to-do tick, unless the to-do is too new or today's cap is reached. `today` is
/// local midnight, so a daily pays once per day and a one-time to-do once ever.
pub(crate) fn award_todo(conn: &Connection, todo_id: i64, now: i64, today: i64) -> Result<i64> {
    let (daily, created_at): (bool, i64) =
        conn.query_row("SELECT daily, created_at FROM todos WHERE id = ?1", [todo_id], |row| {
            Ok((row.get(0)?, row.get(1)?))
        })?;
    if now - created_at < TODO_MIN_AGE_SECS || todos_paid_since(conn, today)? >= TODO_DAILY_CAP {
        return Ok(0);
    }
    let reference = if daily { format!("todo:{todo_id}:{today}") } else { format!("todo:{todo_id}") };
    credit(conn, TODO_BEANS, "todo", &reference, Some(now))
}

/// Inserts an earning row unless `reference` has been paid before. Returns what was paid.
fn credit(conn: &Connection, amount: i64, reason: &str, reference: &str, at: Option<i64>) -> Result<i64> {
    let inserted = conn.execute(
        "INSERT OR IGNORE INTO bean_ledger (at, amount, reason, ref)
         VALUES (COALESCE(?1, unixepoch()), ?2, ?3, ?4)",
        params![at, amount, reason, reference],
    )?;
    Ok(if inserted == 1 { amount } else { 0 })
}

fn todos_paid_since(conn: &Connection, today: i64) -> Result<i64> {
    let paid = conn.query_row(
        "SELECT COUNT(*) FROM bean_ledger WHERE reason = 'todo' AND at >= ?1",
        [today],
        |row| row.get(0),
    )?;
    Ok(paid)
}

/// Tells the window about beans just earned. Call after releasing the timer and db locks.
pub fn publish_earned(app: &AppHandle, amount: i64) {
    if amount <= 0 {
        return;
    }
    let shop = load(&app.state::<Db>().0.lock().unwrap(), crate::todos::today_start());
    match shop {
        Ok(shop) => {
            let _ = app.emit("shop", &shop);
            let _ = app.emit("beans-earned", amount);
        }
        Err(e) => eprintln!("reading the shop after earning failed: {e}"),
    }
}

// --- Commands -------------------------------------------------------------------------------

#[tauri::command]
pub fn get_shop(db: State<Db>) -> Result<Shop> {
    load(&db.0.lock().unwrap(), crate::todos::today_start())
}

/// Buys an item. A hat goes on straight away; a decoration waits to be placed.
#[tauri::command]
pub fn buy_item(db: State<Db>, id: String) -> Result<Shop> {
    let conn = db.0.lock().unwrap();
    buy(&conn, &id)?;
    load(&conn, crate::todos::today_start())
}

/// `None` takes the hat off.
#[tauri::command]
pub fn wear_hat(db: State<Db>, id: Option<String>) -> Result<Shop> {
    let conn = db.0.lock().unwrap();
    wear(&conn, id.as_deref())?;
    load(&conn, crate::todos::today_start())
}

/// Moves a decoration to `slot`, or puts it away with `None`.
#[tauri::command]
pub fn place_item(db: State<Db>, id: String, slot: Option<String>) -> Result<Shop> {
    let conn = db.0.lock().unwrap();
    place(&conn, &id, slot.as_deref())?;
    load(&conn, crate::todos::today_start())
}

fn buy(conn: &Connection, id: &str) -> Result<()> {
    let item = item(id)?;
    let tx = conn.unchecked_transaction()?;
    if owns(&tx, id)? {
        return Err(Error::InvalidInput("you already own that"));
    }
    if balance(&tx)? < item.price {
        return Err(Error::InvalidInput("not enough beans"));
    }
    tx.execute(
        "INSERT INTO bean_ledger (amount, reason, ref) VALUES (?1, 'purchase', ?2)",
        params![-item.price, format!("item:{id}")],
    )?;
    tx.execute("INSERT INTO owned_items (item_id) VALUES (?1)", [id])?;
    if item.kind == Kind::Hat {
        tx.execute("UPDATE settings SET hat = ?1 WHERE id = 1", [id])?;
    }
    tx.commit()?;
    Ok(())
}

fn wear(conn: &Connection, id: Option<&str>) -> Result<()> {
    if let Some(id) = id {
        if item(id)?.kind != Kind::Hat {
            return Err(Error::InvalidInput("that isn't a hat"));
        }
        if !owns(conn, id)? {
            return Err(Error::InvalidInput("you don't own that hat"));
        }
    }
    conn.execute("UPDATE settings SET hat = ?1 WHERE id = 1", [id])?;
    Ok(())
}

fn place(conn: &Connection, id: &str, slot: Option<&str>) -> Result<()> {
    let item = item(id)?;
    if item.kind == Kind::Hat {
        return Err(Error::InvalidInput("hats are worn, not placed"));
    }
    if !owns(conn, id)? {
        return Err(Error::InvalidInput("you don't own that"));
    }
    let tx = conn.unchecked_transaction()?;
    tx.execute("DELETE FROM placements WHERE item_id = ?1", [id])?;
    if let Some(slot) = slot {
        let slot = SLOTS.iter().find(|s| s.id == slot).ok_or(Error::InvalidInput("no such spot"))?;
        if slot.kind != item.kind {
            return Err(Error::InvalidInput("that doesn't fit there"));
        }
        let taken = tx
            .query_row("SELECT 1 FROM placements WHERE slot_id = ?1", [slot.id], |_| Ok(()))
            .optional()?
            .is_some();
        if taken {
            return Err(Error::InvalidInput("that spot is taken"));
        }
        tx.execute("INSERT INTO placements (slot_id, item_id) VALUES (?1, ?2)", [slot.id, id])?;
    }
    tx.commit()?;
    Ok(())
}

fn owns(conn: &Connection, id: &str) -> Result<bool> {
    let owned = conn.query_row("SELECT EXISTS (SELECT 1 FROM owned_items WHERE item_id = ?1)", [id], |r| r.get(0))?;
    Ok(owned)
}

fn balance(conn: &Connection) -> Result<i64> {
    let balance = conn.query_row("SELECT COALESCE(SUM(amount), 0) FROM bean_ledger", [], |r| r.get(0))?;
    Ok(balance)
}

fn load(conn: &Connection, today: i64) -> Result<Shop> {
    let owned = conn
        .prepare("SELECT item_id FROM owned_items ORDER BY bought_at, item_id")?
        .query_map([], |row| row.get(0))?
        .collect::<rusqlite::Result<Vec<String>>>()?;
    let placements = conn
        .prepare("SELECT slot_id, item_id FROM placements")?
        .query_map([], |row| Ok((row.get(0)?, row.get(1)?)))?
        .collect::<rusqlite::Result<HashMap<String, String>>>()?;
    Ok(Shop {
        balance: balance(conn)?,
        todo_beans_left: (TODO_DAILY_CAP - todos_paid_since(conn, today)?).max(0),
        owned,
        placements,
        hat: conn.query_row("SELECT hat FROM settings WHERE id = 1", [], |r| r.get(0))?,
    })
}

#[cfg(test)]
mod tests {
    use super::*;
    use chrono::TimeZone;

    const DAY: i64 = 86_400;
    const TODAY: i64 = 100 * DAY;

    fn conn() -> Connection {
        let mut conn = Connection::open_in_memory().unwrap();
        crate::db::migrate(&mut conn).unwrap();
        conn
    }

    fn grant(conn: &Connection, amount: i64) {
        conn.execute("INSERT INTO bean_ledger (amount, reason) VALUES (?1, 'backfill')", [amount]).unwrap();
    }

    fn add_todo(conn: &Connection, daily: bool, created_at: i64) -> i64 {
        conn.execute("INSERT INTO todos (text, daily, created_at) VALUES ('x', ?1, ?2)", params![daily, created_at])
            .unwrap();
        conn.last_insert_rowid()
    }

    fn add_session(conn: &Connection, task_id: i64, started_at: DateTime<Local>, minutes: i64) -> i64 {
        conn.execute(
            "INSERT INTO sessions (task_id, started_at, duration_minutes, completed) VALUES (?1, ?2, ?3, 1)",
            params![task_id, started_at.timestamp(), minutes],
        )
        .unwrap();
        conn.last_insert_rowid()
    }

    #[test]
    fn focus_rate_rounds_to_the_nearest_bean() {
        assert_eq!([25, 50, 1, 2, 4].map(focus_beans), [10, 20, 0, 1, 2]);
    }

    #[test]
    fn a_block_pays_once_and_the_target_bonus_once_per_week() {
        let conn = conn();
        conn.execute("UPDATE tasks SET weekly_target_minutes = 50 WHERE id = 1", []).unwrap();
        let wed = Local.with_ymd_and_hms(2026, 10, 7, 10, 0, 0).unwrap();

        let first = add_session(&conn, 1, wed, 25);
        assert_eq!(award_focus(&conn, first, 1, 25, wed).unwrap(), 10);
        assert_eq!(award_focus(&conn, first, 1, 25, wed).unwrap(), 0, "same session pays once");

        let second = add_session(&conn, 1, wed, 25);
        assert_eq!(award_focus(&conn, second, 1, 25, wed).unwrap(), 10 + TARGET_BONUS, "reaches 50");
        let third = add_session(&conn, 1, wed, 25);
        assert_eq!(award_focus(&conn, third, 1, 25, wed).unwrap(), 10, "bonus already paid this week");

        let next_week = wed + chrono::Days::new(7);
        let s = add_session(&conn, 1, next_week, 50);
        assert_eq!(award_focus(&conn, s, 1, 50, next_week).unwrap(), 20 + TARGET_BONUS);
        assert_eq!(balance(&conn).unwrap(), 10 + 35 + 10 + 45);
    }

    #[test]
    fn a_zero_target_never_pays_a_bonus() {
        let conn = conn();
        conn.execute("UPDATE tasks SET weekly_target_minutes = 0 WHERE id = 1", []).unwrap();
        let now = Local::now();
        let s = add_session(&conn, 1, now, 25);
        assert_eq!(award_focus(&conn, s, 1, 25, now).unwrap(), 10);
    }

    #[test]
    fn todos_pay_only_when_old_enough() {
        let conn = conn();
        let fresh = add_todo(&conn, false, TODAY + 100);
        assert_eq!(award_todo(&conn, fresh, TODAY + 100 + TODO_MIN_AGE_SECS - 1, TODAY).unwrap(), 0);
        let old = add_todo(&conn, false, TODAY);
        assert_eq!(award_todo(&conn, old, TODAY + TODO_MIN_AGE_SECS, TODAY).unwrap(), TODO_BEANS);
    }

    #[test]
    fn a_one_time_todo_pays_once_ever_and_a_daily_once_a_day() {
        let conn = conn();
        let once = add_todo(&conn, false, 0);
        let daily = add_todo(&conn, true, 0);
        assert_eq!(award_todo(&conn, once, TODAY + 10, TODAY).unwrap(), 2);
        assert_eq!(award_todo(&conn, once, TODAY + DAY + 10, TODAY + DAY).unwrap(), 0, "re-tick");
        assert_eq!(award_todo(&conn, daily, TODAY + 10, TODAY).unwrap(), 2);
        assert_eq!(award_todo(&conn, daily, TODAY + 20, TODAY).unwrap(), 0, "same day");
        assert_eq!(award_todo(&conn, daily, TODAY + DAY + 10, TODAY + DAY).unwrap(), 2, "next day");
    }

    #[test]
    fn todo_beans_stop_at_the_daily_cap_and_reset_at_midnight() {
        let conn = conn();
        let ids: Vec<i64> = (0..TODO_DAILY_CAP + 1).map(|_| add_todo(&conn, false, 0)).collect();
        let paid: i64 = ids.iter().map(|&id| award_todo(&conn, id, TODAY + 10, TODAY).unwrap()).sum();
        assert_eq!(paid, TODO_DAILY_CAP * TODO_BEANS);
        assert_eq!(load(&conn, TODAY).unwrap().todo_beans_left, 0);

        let tomorrow = add_todo(&conn, false, 0);
        assert_eq!(award_todo(&conn, tomorrow, TODAY + DAY + 10, TODAY + DAY).unwrap(), 2);
        assert_eq!(load(&conn, TODAY + DAY).unwrap().todo_beans_left, TODO_DAILY_CAP - 1);
    }

    #[test]
    fn buying_needs_beans_and_happens_once() {
        let conn = conn();
        assert!(buy(&conn, "beanie").is_err(), "balance is 0");
        grant(&conn, 100);
        buy(&conn, "beanie").unwrap();
        let shop = load(&conn, TODAY).unwrap();
        assert_eq!((shop.balance, shop.hat.as_deref()), (40, Some("beanie")), "a hat goes on when bought");
        assert!(buy(&conn, "beanie").is_err(), "already owned");
        assert!(buy(&conn, "crown").is_err(), "not in the catalogue");
    }

    #[test]
    fn only_owned_hats_can_be_worn() {
        let conn = conn();
        grant(&conn, 500);
        assert!(wear(&conn, Some("witch-hat")).is_err());
        buy(&conn, "witch-hat").unwrap();
        buy(&conn, "pumpkin").unwrap();
        assert!(wear(&conn, Some("pumpkin")).is_err(), "not a hat");
        wear(&conn, None).unwrap();
        assert_eq!(load(&conn, TODAY).unwrap().hat, None);
    }

    #[test]
    fn a_decoration_has_one_place_and_a_slot_holds_one_decoration() {
        let conn = conn();
        grant(&conn, 500);
        assert!(place(&conn, "pumpkin", Some("counter-left")).is_err(), "not owned yet");
        buy(&conn, "pumpkin").unwrap();
        assert!(load(&conn, TODAY).unwrap().placements.is_empty(), "a decoration waits to be placed");

        place(&conn, "pumpkin", Some("counter-left")).unwrap();
        place(&conn, "pumpkin", Some("tables-shelf")).unwrap();
        let placed = load(&conn, TODAY).unwrap().placements;
        assert_eq!(placed.len(), 1);
        assert_eq!(placed["tables-shelf"], "pumpkin");
        assert!(place(&conn, "pumpkin", Some("nowhere")).is_err());

        place(&conn, "pumpkin", None).unwrap();
        assert!(load(&conn, TODAY).unwrap().placements.is_empty());
    }

    #[test]
    fn migration_backfills_history_once() {
        let mut conn = Connection::open_in_memory().unwrap();
        crate::db::migrate_to(&mut conn, 10).unwrap();
        // LeetCode (target 480) gets 500 min in one week; one discarded block; two ticks.
        let wed = Local.with_ymd_and_hms(2026, 9, 30, 10, 0, 0).unwrap();
        for _ in 0..20 {
            add_session(&conn, 1, wed, 25);
        }
        conn.execute(
            "INSERT INTO sessions (task_id, started_at, duration_minutes, completed) VALUES (2, ?1, 12, 0)",
            [wed.timestamp()],
        )
        .unwrap();
        let todo = add_todo(&conn, true, 0);
        conn.execute("INSERT INTO todo_ticks VALUES (?1, 10), (?1, 90000)", [todo]).unwrap();
        crate::db::migrate(&mut conn).unwrap();

        assert_eq!(balance(&conn).unwrap(), 20 * 10 + 2 * 2 + TARGET_BONUS);
        // The bonus row uses the same key as award_focus, so the next block that week can't pay it again.
        let s = add_session(&conn, 1, wed, 25);
        assert_eq!(award_focus(&conn, s, 1, 25, wed).unwrap(), 10);
    }
}
