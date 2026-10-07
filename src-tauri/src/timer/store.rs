use std::time::Duration;

use chrono::{DateTime, Local, TimeZone};
use rusqlite::{params, Connection, OptionalExtension};

use super::{load_durations, Phase, Timer};
use crate::error::Result;

impl Phase {
    fn as_str(self) -> &'static str {
        match self {
            Phase::Idle => "idle",
            Phase::Focus => "focus",
            Phase::ShortBreak => "shortBreak",
            Phase::LongBreak => "longBreak",
        }
    }

    fn parse(s: &str) -> Phase {
        match s {
            "focus" => Phase::Focus,
            "shortBreak" => Phase::ShortBreak,
            "longBreak" => Phase::LongBreak,
            _ => Phase::Idle,
        }
    }
}

fn secs(n: i64) -> Duration {
    Duration::from_secs(n.max(0) as u64)
}

fn from_unix(secs: i64) -> DateTime<Local> {
    Local.timestamp_opt(secs, 0).single().unwrap_or_else(Local::now)
}

pub(super) fn save(conn: &Connection, timer: &Timer) -> Result<()> {
    conn.execute(
        "INSERT OR REPLACE INTO timer_state
             (id, phase, task_id, length_secs, elapsed_secs, started_at, focus_streak, last_focus_end)
         VALUES (1, ?1, ?2, ?3, ?4, ?5, ?6, ?7)",
        params![
            timer.phase.as_str(),
            timer.task_id,
            timer.length.as_secs() as i64,
            timer.elapsed().as_secs() as i64,
            timer.started_at.timestamp(),
            timer.focus_streak,
            timer.last_focus_end.map(|t| t.timestamp()),
        ],
    )?;
    Ok(())
}

/// Loads the saved timer, always paused: time spent crashed, quit or asleep never counts as focus.
pub(super) fn load(conn: &Connection, timer: &mut Timer) -> Result<()> {
    let saved = conn
        .query_row(
            "SELECT phase, task_id, length_secs, elapsed_secs, started_at, focus_streak, last_focus_end
             FROM timer_state WHERE id = 1",
            [],
            |row| {
                Ok((
                    row.get::<_, String>(0)?,
                    row.get::<_, Option<i64>>(1)?,
                    row.get::<_, i64>(2)?,
                    row.get::<_, i64>(3)?,
                    row.get::<_, i64>(4)?,
                    row.get::<_, u32>(5)?,
                    row.get::<_, Option<i64>>(6)?,
                ))
            },
        )
        .optional()?;
    let Some((phase, task_id, length, elapsed, started_at, streak, last_focus_end)) = saved else {
        return Ok(());
    };

    timer.phase = Phase::parse(&phase);
    timer.task_id = task_id;
    // Re-read rather than save durations, so edits to the task's settings apply after a relaunch.
    if let Some(id) = task_id {
        timer.durations = load_durations(conn, id).unwrap_or_default();
    }
    timer.length = secs(length);
    timer.banked = secs(elapsed);
    timer.running_since = None;
    timer.started_at = from_unix(started_at);
    timer.focus_streak = streak;
    timer.last_focus_end = last_focus_end.map(from_unix);
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::timer::TimerState;

    fn migrated() -> Connection {
        let mut conn = Connection::open_in_memory().unwrap();
        crate::db::migrate(&mut conn).unwrap();
        conn
    }

    fn fresh_timer() -> Timer {
        TimerState::default().0.into_inner().unwrap()
    }

    #[test]
    fn running_timer_restores_paused_at_elapsed_time() {
        let conn = migrated();
        let mut running = fresh_timer();
        running.task_id = Some(1);
        running.begin(Phase::Focus, 25);
        running.banked = Duration::from_secs(600);
        running.focus_streak = 2;
        save(&conn, &running).unwrap();

        let mut restored = fresh_timer();
        load(&conn, &mut restored).unwrap();
        assert_eq!(restored.phase, Phase::Focus);
        assert_eq!(restored.task_id, Some(1));
        assert!(restored.running_since.is_none(), "must restore paused");
        assert_eq!(restored.banked.as_secs(), 600);
        assert_eq!(restored.focus_streak, 2);
        assert_eq!(restored.durations.focus, 25, "durations re-read from the task");
    }

    #[test]
    fn nothing_saved_leaves_timer_idle() {
        let conn = migrated();
        let mut timer = fresh_timer();
        load(&conn, &mut timer).unwrap();
        assert_eq!(timer.phase, Phase::Idle);
    }
}
