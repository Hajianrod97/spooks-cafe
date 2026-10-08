# Spook's Cafe — v1 Spec

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
- Alerts: macOS notification + soft chime when a phase ends on its own (not on pause/discard/skip, and not for a phase that would have ended during sleep). The notification is silent; the chime is played by the app so it still sounds under Focus modes. Chime can be turned off in settings.
- **Pause**: nothing logged. **Discard**: partial minutes logged, not counted as a completed 🍅.
- Optional one-line note on each completed session: prompted in the window during the break that follows, editable later in the sessions list.
- **End break** button: ends the break immediately; next focus still waits for a click. Nothing logged.
- **Continue focus** (during a break): ends the break and starts the next focus block right away. Called **Start focus** when idle.
- Long-break counter (every 4th) resets at midnight or after 30+ min with no focus block.
- **Interruptions** (sleep, quit, crash): timer auto-pauses at elapsed time and restores paused on wake/relaunch. Timer state persisted to SQLite every few seconds.
- A session counts toward the week it **started** in (no splitting across Monday midnight).

## Tasks & targets
- All time stored in minutes; targets set in hours/week; weeks start Monday.
- Optional long-term total per task (e.g. "40 h to finish DDIA"). Where its progress is displayed is decided with the UI design (step 6); the main task list shows this week only.
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
- Weekly progress bars per task: `LeetCode — 6.5 / 8 h · 14 👻` (the unit icon is Spook's face, drawn as SVG, not an emoji)
- One-click export to JSON/CSV.

## Music (independent of the timer)
- Primary: YouTube as a "TV" in the scene (Lofi Girl, Chillhop, custom playlist URL).
  - Decided (spike, `spikes/youtube/SPIKE.md`): a dedicated, hidden YouTube window controlled from Rust via injected script; the scene draws its own TV. Premium login works and plays ad-free.
  - Sign-in and player windows use a Safari user agent (Google blocks the default WKWebView UA).
  - Presets are stored as channel handles and opened at `youtube.com/@<handle>/live`, since live-stream video IDs go stale.
- Spotify (decided over its web SDK, which needs browser DRM and OAuth): control the Spotify desktop app via AppleScript — play/pause, skip, volume, now playing; optional playlist/album link, otherwise resumes what Spotify last played. Requires Spotify installed; macOS asks once for Automation permission. Lofi Focus is a remote: it never starts music by itself, but quitting it leaves Spotify playing, and on launch it shows whatever Spotify is already doing.
- One service plays at a time. Switching away from YouTube closes its hidden player; a YouTube player paused for 10 min also closes (it holds a few hundred MB).
- Fallback: shuffle a local folder (`~/Music/Lofi`) — optional, decide after Spotify.

## Look & shell
- Theme: a cafe run by **Spook**, a lofi sheet-ghost (flat sticker style: indigo outline, cream body, blush, purple headphones over the ears). Art lives in `design/` as SVG built by `node design/spook/build.mjs` and `node design/cafe/build.mjs`.
- Spook's pose follows the timer: idle → waving, focus → headphones + typing on a laptop, break → sipping coffee, paused → dozing.
- Main window layout (480–960 wide, height free; the art is 960 wide and a wider window reveals more of the cafe): cafe scene on top (window, shelf TV, string lights, counter; Spook floats behind the counter), timer on a hanging chalk sign, controls on the counter, music bar, then the task list as a chalkboard "This week's menu".
- Palette shifts with time of day: four phases whose start hours are adjustable in settings (defaults: morning 6, afternoon 12, evening 17, night 20; each lasts until the next, night wraps past midnight). Settings can also pin the scene to one time of day instead of following the clock. Scene animations pause while the window is hidden. The room is drawn once and tinted per phase (tint masked to the room, so the sky and Spook keep their colours; Spook glows at night).
- Cafe details: a neon "Spook's Cafe" across the top of the hanging timer sign (glows and flickers in the evening and at night); coffee always dripping from the espresso machine into its cup; while YouTube is the service, the shelf TV shows the station's real artwork (the page's `og:image` thumbnail, dimmed when paused). Lofi Girl's character is trademarked, so the app never draws or bundles her art.
- The cafe window shows a **pixel-art sky** (decided over flat): sunrise, daylight, pixel sunset, night with moon and rain; a pixel city skyline with lit windows in the evening and at night.
- **Scenes**, left to right: Outside | Counter | Tables (counter is home, in the middle; no wrap-around). Switched only by the user, with faint ◀ ▶ arrows on the scene's edges (no menu bar control; the timer never changes the scene). The current scene is remembered across launches. All scenes share the 960×340 canvas, the stage crop and the time-of-day system. Scenes crossfade (about 0.6 s); a camera pan was tried in the app and dropped.
  - The timer sign and the controls are one fixed overlay, in the same place in every scene. **Layout contract for scene art:** keep the top centre (stage x 402–558, y 0–114) plain so the sign hangs over wall, not over a window or picture; put Spook's spot under it (stage x 405–555, y 98–255) with something in front that hides him from about y 250 down (counter, table top); keep the bottom band (y 264–340) a calm foreground surface the buttons can sit on.
  - Tables: Spook's round table under the sign. The back wall reads, left to right: hanging plant, big window (above a two-seat table), pendant lamp, framed snapshot of Spook, [sign], moon painting, potted plant, booth with a bookshelf above. At the narrowest width the window is off-screen; it shows from about 600 px wide. Tables are empty for now.
  - Still to decide: Spook's poses per scene. Until then the table scene borrows the counter's poses.
- Menu bar countdown (`👻 18:42`, Spook as a template-image tray icon, not an emoji) with quick controls + full main window.
- Clickable mockup: https://claude.ai/artifact/XJ1C9sQtjFkmYFaXPz4b2X (private).
- Closing the main window keeps the app running in the menu bar. Optional always-on-top toggle (default off).
- Launch at login, menu bar only (main window closed); toggle in settings.

## Build order
1. ~~YouTube spike (riskiest)~~ — done, see Music
2. Scaffold, SQLite schema, seed tasks
3. Timer engine, menu bar, notifications
4. Task list, progress bars, settings (incl. chime on/off)
5. Music player
6. Lofi visuals — the Spook cafe (6a scene, time-of-day sky and tint, tray icon → 6b time-of-day hours in settings, animations paused while hidden → 6c chalkboard menu + dialogs → 6d music bar)

## Later (practice tickets for the user)
- Outside scene: the shop front, to the left of the counter. Follow the table scene's pattern (art in `design/cafe/build.mjs`, an entry in the scene list, its sky window, the ◀ arrow on the counter appears once it exists); follow the layout contract under Scenes.
- Ghost customers at the empty tables
- Cafe shop (gamification): earn currency from completed focus blocks and spend it on scene decorations and outfits for Spook. Fits the layered art: decorations are extra layers in a scene's panel, outfits are overlays in Spook's box (like the music notes). Needs a currency/inventory design first (what earns, prices, whether discarded blocks count).
- History view: past weeks, daily heatmap, per-task trends
- Internet radio streams
- Automatic iCloud backup
- Streaks and insights
