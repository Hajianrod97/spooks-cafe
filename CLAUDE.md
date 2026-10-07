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
- Step 3 in progress, split 3a engine → 3b interruptions/persistence → 3c menu bar → 3d notifications. 3a: engine in `src-tauri/src/timer.rs` (Rust owns the timer, pushes `"timer"` events; React `useTimer` hook). 3a done and committed. 3b done (quit, crash and sleep verified in the app): `timer_state` table (migration 002), `src-tauri/src/timer/store.rs` save/load; saved every 5 s, on every change and on quit (`RunEvent::Exit`); restores paused; sleep detected as a >5 s gap between ticks on either clock (wall or `Instant`), pausing as of the last awake tick; tick failures sent as `timer-error` events. `LOFI_FAST=1` makes minutes run as seconds in dev.
