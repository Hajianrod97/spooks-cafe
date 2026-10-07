# Lofi Focus — v1 Spec

A macOS Pomodoro tracker for a full-time job search / engineering study routine, with a lofi aesthetic and built-in music.

## Stack
- Tauri + React + TypeScript
- Local SQLite in `~/Library/Application Support/Lofi Focus/`
- Clean, idiomatic code; comments only where non-obvious

## Timer
- One global timer. Pick a task, start a focus block; the completed block is logged to that task.
- Task is **locked** while a focus block runs; switching is allowed during breaks.
- Durations: global default 25 focus / 5 short break / 15 long break every 4. Per-task override.
- Focus ends → break **auto-starts**. Break ends → next focus **waits for a click**.
- Alerts: macOS notification + soft chime.
- **Pause**: nothing logged. **Discard**: partial minutes logged, not counted as a completed 🍅.
- Optional one-line note on each completed session.
- **Skip break** button: ends the break immediately; next focus still waits for a click. Nothing logged.
- Long-break counter (every 4th) resets at midnight or after 30+ min with no focus block.
- **Interruptions** (sleep, quit, crash): timer auto-pauses at elapsed time and restores paused on wake/relaunch. Timer state persisted to SQLite every few seconds.
- A session counts toward the week it **started** in (no splitting across Monday midnight).

## Tasks & targets
- All time stored in minutes; targets set in hours/week; weeks start Monday.
- Optional long-term total per task (e.g. "40 h to finish DDIA").
- Tasks editable in-app: add, rename, recolor, archive (never delete), weekly target, Pomodoro override.
- Logged sessions can be edited or deleted.

Seed tasks (mid-level target roles, 30 h/week total):

| Task | h/week |
|---|---|
| LeetCode | 8 |
| Job Search (apps, networking, mock interviews) | 7 |
| System Design | 4 |
| AI Engineering | 4 |
| Side Projects / OSS | 4 |
| CS Fundamentals | 2 |
| Debugging (exercises + tools) | 1 |

## Views
- Weekly progress bars per task: `LeetCode — 6.5 / 8 h · 14 🍅`
- One-click export to JSON/CSV.

## Music (independent of the timer)
- Primary: YouTube as a "TV" in the scene (Lofi Girl, Chillhop, custom playlist URL).
  - Decided (spike, `spikes/youtube/SPIKE.md`): a dedicated, hidden YouTube window controlled from Rust via injected script; the scene draws its own TV. Premium login works and plays ad-free.
  - Sign-in and player windows use a Safari user agent (Google blocks the default WKWebView UA).
  - Presets are stored as channel handles and opened at `youtube.com/@<handle>/live`, since live-stream video IDs go stale.
- Fallback: shuffle a local folder (`~/Music/Lofi`).

## Look & shell
- Cozy palette that shifts with time of day: four fixed phases, adjustable in settings — morning 6–12, afternoon 12–17, evening 17–20, night 20–6.
- Small animated scene element: corner window — sun + dust (morning), bright daylight (afternoon), sunset (evening), rain (night); optional steaming mug.
- Menu bar countdown (`🍅 18:42`) with quick controls + full main window.
- Closing the main window keeps the app running in the menu bar. Optional always-on-top toggle (default off).
- Launch at login, menu bar only (main window closed); toggle in settings.

## Build order
1. ~~YouTube spike (riskiest)~~ — done, see Music
2. Scaffold, SQLite schema, seed tasks
3. Timer engine, menu bar, notifications
4. Task list, progress bars, settings
5. Music player
6. Lofi visuals

## Later (practice tickets for the user)
- History view: past weeks, daily heatmap, per-task trends
- Internet radio streams
- Automatic iCloud backup
- Streaks and insights
