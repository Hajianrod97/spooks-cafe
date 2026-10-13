mod store;

use std::sync::Mutex;
use std::time::{Duration, Instant, SystemTime};

use chrono::{DateTime, Local, TimeDelta};
use rusqlite::{params, Connection};
use serde::Serialize;
use tauri::{AppHandle, Emitter, Manager};

use crate::alerts::{self, Alert};
use crate::db::Db;
use crate::error::{Error, Result};

const TICK: Duration = Duration::from_millis(250);
const SAVE_EVERY: Duration = Duration::from_secs(5);
/// A gap this long between 250 ms ticks means the process was suspended (sleep, App Nap).
const SLEEP_GAP: Duration = Duration::from_secs(5);
const STREAK_IDLE_LIMIT: TimeDelta = TimeDelta::minutes(30);

#[derive(Clone, Copy, Debug, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub enum Phase {
    Idle,
    Focus,
    ShortBreak,
    LongBreak,
}

#[derive(Clone, Copy, Default)]
struct Durations {
    focus: i64,
    short_break: i64,
    long_break: i64,
    long_break_every: u32,
}

#[derive(Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct Snapshot {
    pub phase: Phase,
    pub task_id: Option<i64>,
    pub running: bool,
    pub remaining_secs: u64,
    pub length_secs: u64,
    pub focus_streak: u32,
}

pub struct Timer {
    phase: Phase,
    task_id: Option<i64>,
    durations: Durations,
    length: Duration,
    /// Time elapsed before the most recent pause.
    banked: Duration,
    /// `Some` while running. Monotonic, so wall-clock changes don't affect the countdown.
    running_since: Option<Instant>,
    /// Wall-clock start of the current phase; becomes the session's `started_at`.
    started_at: DateTime<Local>,
    /// Completed focus blocks since the last long break.
    focus_streak: u32,
    last_focus_end: Option<DateTime<Local>>,
}

pub struct TimerState(pub Mutex<Timer>);

impl Default for TimerState {
    fn default() -> Self {
        Self(Mutex::new(Timer {
            phase: Phase::Idle,
            task_id: None,
            durations: Durations::default(),
            length: Duration::ZERO,
            banked: Duration::ZERO,
            running_since: None,
            started_at: Local::now(),
            focus_streak: 0,
            last_focus_end: None,
        }))
    }
}

impl Timer {
    fn elapsed(&self) -> Duration {
        self.banked + self.running_since.map_or(Duration::ZERO, |t| t.elapsed())
    }

    fn remaining(&self) -> Duration {
        self.length.saturating_sub(self.elapsed())
    }

    fn begin(&mut self, phase: Phase, minutes: i64) {
        self.phase = phase;
        self.length = minutes_to_duration(minutes);
        self.banked = Duration::ZERO;
        self.running_since = Some(Instant::now());
        self.started_at = Local::now();
    }

    /// Stops the clock as of `at`, banking the time run until then. Returns false if it wasn't running.
    fn pause_at(&mut self, at: Instant) -> bool {
        let Some(since) = self.running_since.take() else {
            return false;
        };
        self.banked += at.saturating_duration_since(since);
        true
    }

    fn pause_now(&mut self) -> bool {
        self.pause_at(Instant::now())
    }

    fn go_idle(&mut self) {
        self.phase = Phase::Idle;
        self.length = Duration::ZERO;
        self.banked = Duration::ZERO;
        self.running_since = None;
    }

    /// Counts a completed focus block and picks the break that follows it.
    fn next_break(&mut self) -> (Phase, i64) {
        self.focus_streak += 1;
        if self.focus_streak >= self.durations.long_break_every {
            self.focus_streak = 0;
            (Phase::LongBreak, self.durations.long_break)
        } else {
            (Phase::ShortBreak, self.durations.short_break)
        }
    }

    pub fn snapshot(&self) -> Snapshot {
        Snapshot {
            phase: self.phase,
            task_id: self.task_id,
            running: self.running_since.is_some(),
            // Round up so the display reads 25:00 at the start and 00:01 in the last second.
            remaining_secs: self.remaining().as_secs_f64().ceil() as u64,
            length_secs: self.length.as_secs(),
            focus_streak: self.focus_streak,
        }
    }
}

/// Whether the long-break streak survives the gap between the last focus block
/// ending and a new one starting. Resets at local midnight or after 30+ idle minutes.
fn streak_survives(last_focus_end: DateTime<Local>, now: DateTime<Local>) -> bool {
    last_focus_end.date_naive() == now.date_naive() && now - last_focus_end < STREAK_IDLE_LIMIT
}

/// `LOFI_FAST=1 npm run tauri dev` treats minutes as seconds, so a full cycle takes under a minute.
fn minutes_to_duration(minutes: i64) -> Duration {
    let secs = minutes.max(0) as u64;
    if cfg!(debug_assertions) && std::env::var_os("LOFI_FAST").is_some() {
        Duration::from_secs(secs)
    } else {
        Duration::from_secs(secs * 60)
    }
}

/// Global settings, with the task's overrides applied where set.
fn load_durations(conn: &Connection, task_id: i64) -> Result<Durations> {
    let durations = conn.query_row(
        "SELECT COALESCE(t.focus_minutes, s.focus_minutes),
                COALESCE(t.short_break_minutes, s.short_break_minutes),
                COALESCE(t.long_break_minutes, s.long_break_minutes),
                s.long_break_every
         FROM tasks t, settings s
         WHERE t.id = ?1 AND t.archived = 0",
        [task_id],
        |row| {
            Ok(Durations {
                focus: row.get(0)?,
                short_break: row.get(1)?,
                long_break: row.get(2)?,
                long_break_every: row.get(3)?,
            })
        },
    )?;
    Ok(durations)
}

/// Returns the new session's id.
fn log_session(conn: &Connection, timer: &Timer, minutes: i64, completed: bool) -> Result<i64> {
    conn.execute(
        "INSERT INTO sessions (task_id, started_at, duration_minutes, completed)
         VALUES (?1, ?2, ?3, ?4)",
        params![timer.task_id, timer.started_at.timestamp(), minutes, completed],
    )?;
    Ok(conn.last_insert_rowid())
}

/// Logs a completed focus block and pays its beans in one transaction, so a crash can't leave
/// one without the other. Returns the beans paid.
fn complete_focus(conn: &Connection, timer: &Timer) -> Result<i64> {
    let task_id = timer.task_id.ok_or(Error::InvalidState("focus block without a task"))?;
    let tx = conn.unchecked_transaction()?;
    let session = log_session(&tx, timer, timer.durations.focus, true)?;
    let beans = crate::shop::award_focus(&tx, session, task_id, timer.durations.focus, timer.started_at)?;
    tx.commit()?;
    Ok(beans)
}

// Locking rules, to prevent deadlock:
// 1. Lock order is always timer, then db.
// 2. Never touch UI (events, tray) while holding the timer lock. Tray updates block on the
//    main thread, and sync commands run on the main thread waiting for the timer lock.
//    So: change state and save under the lock, take a snapshot, release, then `publish`.

/// Sends a snapshot to every display: the React window and the menu bar.
fn publish(app: &AppHandle, snapshot: &Snapshot) {
    // A failed emit only means no window is listening; the timer itself is unaffected.
    let _ = app.emit("timer", snapshot);
    crate::tray::update(app, snapshot);
    crate::app_nap::set_busy(app, snapshot.running);
}

fn save(app: &AppHandle, timer: &Timer) -> Result<Snapshot> {
    store::save(&app.state::<Db>().0.lock().unwrap(), timer)?;
    Ok(timer.snapshot())
}

/// Builds the timer at launch, restoring whatever was running before quit or crash (paused).
pub fn restore(db: &Db) -> Result<TimerState> {
    let state = TimerState::default();
    store::load(&db.0.lock().unwrap(), &mut state.0.lock().unwrap())?;
    Ok(state)
}

/// Final save on quit, so a relaunch resumes from the exact second rather than the last periodic save.
pub fn save_on_exit(app: &AppHandle) {
    let state = app.state::<TimerState>();
    let timer = state.0.lock().unwrap();
    if let Err(e) = store::save(&app.state::<Db>().0.lock().unwrap(), &timer) {
        eprintln!("saving timer on exit failed: {e}");
    }
}

pub fn current(app: &AppHandle) -> Snapshot {
    app.state::<TimerState>().0.lock().unwrap().snapshot()
}

/// Something the user asked the timer to do, from the window or the menu bar.
pub enum Action {
    StartFocus(i64),
    Pause,
    Resume,
    /// Ends a focus block early: partial minutes are logged, but it doesn't count as a 🍅.
    Discard,
    SkipBreak,
}

/// The single entry point for user actions: validate, change state, save, then publish.
pub fn apply(app: &AppHandle, action: Action) -> Result<Snapshot> {
    let snapshot = {
        let state = app.state::<TimerState>();
        let mut timer = state.0.lock().unwrap();
        transition(app, &mut timer, action)?;
        save(app, &timer)?
    };
    publish(app, &snapshot);
    Ok(snapshot)
}

fn transition(app: &AppHandle, timer: &mut Timer, action: Action) -> Result<()> {
    let db = app.state::<Db>();
    match action {
        Action::StartFocus(task_id) => {
            if timer.phase == Phase::Focus {
                return Err(Error::InvalidState("a focus block is already running"));
            }
            let durations = load_durations(&db.0.lock().unwrap(), task_id)?;
            if let Some(end) = timer.last_focus_end {
                if !streak_survives(end, Local::now()) {
                    timer.focus_streak = 0;
                }
            }
            timer.task_id = Some(task_id);
            timer.durations = durations;
            timer.begin(Phase::Focus, durations.focus);
        }
        Action::Pause => {
            if !timer.pause_now() {
                return Err(Error::InvalidState("timer is not running"));
            }
        }
        Action::Resume => {
            if timer.phase == Phase::Idle || timer.running_since.is_some() {
                return Err(Error::InvalidState("nothing is paused"));
            }
            timer.running_since = Some(Instant::now());
        }
        Action::Discard => {
            if timer.phase != Phase::Focus {
                return Err(Error::InvalidState("no focus block to discard"));
            }
            let minutes = (timer.elapsed().as_secs() / 60) as i64;
            if minutes > 0 {
                log_session(&db.0.lock().unwrap(), timer, minutes, false)?;
            }
            timer.go_idle();
        }
        Action::SkipBreak => {
            if !matches!(timer.phase, Phase::ShortBreak | Phase::LongBreak) {
                return Err(Error::InvalidState("no break to skip"));
            }
            timer.go_idle();
        }
    }
    Ok(())
}

/// Bookkeeping for the background loop, kept between ticks.
struct Ticker {
    last_emitted: Option<u64>,
    last_saved: Instant,
    last_error: Option<String>,
    wall: SystemTime,
    mono: Instant,
}

impl Ticker {
    /// If the process was suspended since the last tick, returns that tick: the last moment
    /// we know the machine was awake. Checks both clocks, because whether `Instant` keeps
    /// counting during sleep differs by platform; one of the two will show the gap.
    fn suspended_since(&mut self) -> Option<Instant> {
        let last_awake = self.mono;
        let gap = self.wall.elapsed().unwrap_or_default().max(last_awake.elapsed());
        self.wall = SystemTime::now();
        self.mono = Instant::now();
        (gap > SLEEP_GAP).then_some(last_awake)
    }
}

/// Background loop: completes phases, pauses on sleep, saves periodically, and publishes each new second.
pub fn spawn_ticker(app: AppHandle) {
    std::thread::spawn(move || {
        let mut ticker = Ticker {
            last_emitted: None,
            last_saved: Instant::now(),
            last_error: None,
            wall: SystemTime::now(),
            mono: Instant::now(),
        };
        loop {
            std::thread::sleep(TICK);
            let TickOutcome { result, alert, beans } = tick(&app, &mut ticker);
            match result {
                Ok(snapshot) => {
                    ticker.last_error = None;
                    if let Some(snapshot) = snapshot {
                        publish(&app, &snapshot);
                    }
                }
                // Report each distinct failure once, not every 250 ms while it keeps failing.
                Err(e) => {
                    let message = e.to_string();
                    if ticker.last_error.as_ref() != Some(&message) {
                        eprintln!("timer tick failed: {message}");
                        let _ = app.emit("timer-error", &message);
                        ticker.last_error = Some(message);
                    }
                }
            }
            if let Some(alert) = alert {
                alerts::fire(&app, alert);
            }
            crate::shop::publish_earned(&app, beans);
        }
    });
}

/// What a tick decided under the lock, for the loop to act on after releasing it.
struct TickOutcome {
    /// A snapshot when there's something new to publish.
    result: Result<Option<Snapshot>>,
    /// Set when a phase ended on its own. Kept separate from `result` so a failure after the
    /// phase changed in memory (e.g. the save) can't swallow the alert.
    alert: Option<Alert>,
    /// Beans a completed focus block earned, announced after the locks are released.
    beans: i64,
}

fn tick(app: &AppHandle, ticker: &mut Ticker) -> TickOutcome {
    let mut alert = None;
    let mut beans = 0;
    let result = advance(app, ticker, &mut alert, &mut beans);
    TickOutcome { result, alert, beans }
}

/// Advances the timer under its lock. Returns a snapshot when there's something new to publish.
fn advance(
    app: &AppHandle,
    ticker: &mut Ticker,
    alert: &mut Option<Alert>,
    beans: &mut i64,
) -> Result<Option<Snapshot>> {
    let state = app.state::<TimerState>();
    let mut timer = state.0.lock().unwrap();
    // Checked every tick, even when idle, so the clock baselines stay current.
    let suspended_since = ticker.suspended_since();
    if timer.running_since.is_none() {
        return Ok(None);
    }

    // A phase that would have ended during sleep is paused instead, so there's no alert on wake.
    if let Some(last_awake) = suspended_since {
        timer.pause_at(last_awake);
        return save(app, &timer).map(Some);
    }

    if timer.remaining() > Duration::ZERO {
        if ticker.last_saved.elapsed() >= SAVE_EVERY {
            ticker.last_saved = Instant::now();
            store::save(&app.state::<Db>().0.lock().unwrap(), &timer)?;
        }
        let snapshot = timer.snapshot();
        if ticker.last_emitted == Some(snapshot.remaining_secs) {
            return Ok(None);
        }
        ticker.last_emitted = Some(snapshot.remaining_secs);
        return Ok(Some(snapshot));
    }

    *alert = match timer.phase {
        Phase::Focus => {
            let db = app.state::<Db>();
            *beans = complete_focus(&db.0.lock().unwrap(), &timer)?;
            timer.last_focus_end = Some(Local::now());
            let (brk, minutes) = timer.next_break();
            timer.begin(brk, minutes);
            Some(Alert::FocusDone { break_minutes: minutes, long: brk == Phase::LongBreak })
        }
        Phase::ShortBreak | Phase::LongBreak => {
            timer.go_idle();
            Some(Alert::BreakOver)
        }
        Phase::Idle => None,
    };
    ticker.last_emitted = None;
    save(app, &timer).map(Some)
}

#[tauri::command]
pub fn get_timer(app: AppHandle) -> Snapshot {
    current(&app)
}

#[tauri::command]
pub fn start_focus(app: AppHandle, task_id: i64) -> Result<Snapshot> {
    apply(&app, Action::StartFocus(task_id))
}

#[tauri::command]
pub fn pause(app: AppHandle) -> Result<Snapshot> {
    apply(&app, Action::Pause)
}

#[tauri::command]
pub fn resume(app: AppHandle) -> Result<Snapshot> {
    apply(&app, Action::Resume)
}

#[tauri::command]
pub fn discard(app: AppHandle) -> Result<Snapshot> {
    apply(&app, Action::Discard)
}

#[tauri::command]
pub fn skip_break(app: AppHandle) -> Result<Snapshot> {
    apply(&app, Action::SkipBreak)
}

#[cfg(test)]
mod tests {
    use super::*;
    use chrono::TimeZone;

    fn at(h: u32, m: u32) -> DateTime<Local> {
        Local.with_ymd_and_hms(2026, 10, 7, h, m, 0).unwrap()
    }

    #[test]
    fn short_gap_keeps_streak() {
        assert!(streak_survives(at(10, 0), at(10, 10)));
    }

    #[test]
    fn exactly_thirty_minutes_resets() {
        assert!(!streak_survives(at(10, 0), at(10, 30)));
    }

    #[test]
    fn long_gap_resets() {
        assert!(!streak_survives(at(10, 0), at(11, 15)));
    }

    /// SQL strings aren't checked by the compiler, so run every query against the real migrations.
    #[test]
    fn queries_match_schema() {
        let mut conn = Connection::open_in_memory().unwrap();
        crate::db::migrate(&mut conn).unwrap();

        let durations = load_durations(&conn, 1).unwrap();
        assert_eq!((durations.focus, durations.short_break, durations.long_break), (25, 5, 15));

        let mut timer = TimerState::default().0.into_inner().unwrap();
        timer.task_id = Some(1);
        log_session(&conn, &timer, 25, true).unwrap();
        let logged: i64 = conn.query_row("SELECT count(*) FROM sessions", [], |r| r.get(0)).unwrap();
        assert_eq!(logged, 1);
    }

    fn ticker(wall_ago: Duration, mono_ago: Duration) -> Ticker {
        Ticker {
            last_emitted: None,
            last_saved: Instant::now(),
            last_error: None,
            wall: SystemTime::now() - wall_ago,
            mono: Instant::now() - mono_ago,
        }
    }

    #[test]
    fn normal_tick_is_not_a_suspension() {
        assert!(ticker(TICK, TICK).suspended_since().is_none());
    }

    #[test]
    fn wall_clock_gap_means_suspended() {
        // Platform where Instant stops during sleep.
        assert!(ticker(Duration::from_secs(3600), TICK).suspended_since().is_some());
    }

    #[test]
    fn monotonic_gap_means_suspended() {
        // Platform where Instant keeps counting during sleep.
        assert!(ticker(Duration::from_secs(3600), Duration::from_secs(3600)).suspended_since().is_some());
    }

    #[test]
    fn pause_at_excludes_time_after_last_awake() {
        let mut timer = TimerState::default().0.into_inner().unwrap();
        let now = Instant::now();
        timer.phase = Phase::Focus;
        timer.running_since = Some(now - Duration::from_secs(70));
        // Ran 10 s, then the machine slept for the last minute.
        assert!(timer.pause_at(now - Duration::from_secs(60)));
        assert_eq!(timer.banked.as_secs(), 10);
        assert!(timer.running_since.is_none());
    }

    #[test]
    fn crossing_midnight_resets_even_if_gap_is_short() {
        let before = at(23, 50);
        let after = before + TimeDelta::minutes(15);
        assert!(!streak_survives(before, after));
    }
}
