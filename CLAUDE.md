# Lofi Focus

macOS Pomodoro tracker with a lofi theme. Full requirements and build order are in `SPEC.md` — read it before starting work, and keep it updated when decisions change.

## Working with the user
- The user is a mid-level engineer job-searching full-time and using this project to learn.
- Split: Claude builds the core; the user extends it later. "Later" items in SPEC.md are the user's practice tickets — don't build them unless asked.
- Teach while building: explain the *why* behind architecture and idioms (Tauri IPC, Rust, React patterns). Leave meaningful pieces (state machines, SQL queries, Tauri commands) for the user to write when the Learning output style is on.
- Code style: clean, idiomatic TypeScript/Rust; comments only where non-obvious.
- Give a recommendation when presenting options; don't just list them.

## Stack
- Tauri 2 + React + TypeScript (Vite), SQLite for storage.
- Run the app with `npm run tauri dev`.

## Environment
- Shell is fish. Rust/cargo are on PATH via `~/.config/fish/conf.d/rustup.fish`.
- Editor: VS Code.

## Current status
- Step 1 done: YouTube spike in `spikes/youtube/` chose the dedicated hidden window (see SPEC.md Music / SPIKE.md).
- Step 2 done: app scaffolded at repo root; SQLite via rusqlite in Rust (`src-tauri/src/db.rs`, migrations in `src-tauri/migrations/`, run via `PRAGMA user_version`). Schema: `tasks`, `sessions` (user-written), single-row `settings`. Seeds verified in the running app.
- Step 3 done, split 3a engine → 3b interruptions/persistence → 3c menu bar → 3d notifications. 3a: engine in `src-tauri/src/timer.rs` (Rust owns the timer, pushes `"timer"` events; React `useTimer` hook). 3a done and committed. 3b done (quit, crash and sleep verified in the app): `timer_state` table (migration 002), `src-tauri/src/timer/store.rs` save/load; saved every 5 s, on every change and on quit (`RunEvent::Exit`); restores paused; sleep detected as a >5 s gap between ticks on either clock (wall or `Instant`), pausing as of the last awake tick; tick failures sent as `timer-error` events. 3c done (verified in the app): `src-tauri/src/tray.rs` menu bar title + phase-aware menu; closing the window hides it and drops the Dock icon (Accessory policy). All user actions go through `timer::apply(Action)`; never touch UI while holding the timer lock (see comment in timer.rs). Tray menu has one `Start focus` submenu listing all tasks, last-used first and checkmarked, and is rebuilt only when phase/running/task changes — step 4's task editing must also trigger a tray menu rebuild. `LOFI_FAST=1` makes minutes run as seconds in dev; clear the fake sessions it logs with `npm run db:clear-sessions` (deletes **all** sessions — the dev and real app share one DB). 3d done (banner and chime verified in the app): `src-tauri/src/alerts.rs` posts a silent notification via `tauri-plugin-notification` and plays a chime with `afplay` (system Glass sound) when a phase ends on its own; `tick()` returns a `TickOutcome` and the ticker fires the alert after releasing the lock. Phases that would end during sleep pause instead, so they don't alert. In dev, notifications post as Terminal (plugin behaviour); the built `.app` asks for its own permission. Chime toggle is deferred to step 4 settings. `src-tauri/src/app_nap.rs` opts out of App Nap while the timer runs (otherwise throttled ticks look like sleep and pause the timer); it's driven from `publish`.
