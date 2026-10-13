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

## To-do list
- A plain checklist in the chalkboard's To-do section, written in chalk. Separate from the timer; each item can optionally be tagged with an active task (the tag keeps showing after that task is archived).
- Added from a "New to-do" dialog (the "+ Add to-do" button at the bottom of the To-do section): text, Repeats (One-time / Daily) and an optional tag; the last kind and tag are offered again next time. Two kinds:
  - **Daily**: repeats every day; comes back unticked at local midnight. Every day's tick is kept.
  - **One-time**: stays until ticked, carrying over day to day; once ticked it stays (struck through) until midnight, then drops off the list. Its tick is kept.
- Shown in two groups: Daily, then Today (one-time). In each, open items in the order added, then ticked ones in the order ticked.
- Every tick lives in one `todo_ticks` table (one per one-time to-do, at most one per day per daily), so reporting and the shop read history from one place. Ticking something already done keeps the first tick.
- Delete hides a to-do for good but keeps its ticks. One-time items go straight away; a daily asks first, inline in its row ("Stop repeating “…”?" Stop / Keep, Keep focused, Esc cancels), since it stops every future day.
- Text is one trimmed line, 200 characters max.

## Cafe shop (7c)
- **Boo Beans** are the currency: a brown coffee bean with a ghost's wispy tail, eyes and blush, drawn as SVG (not an emoji). The UI just says "beans".
- **Earning**, every change appended to a `bean_ledger` table (rows are never edited or deleted; the balance is their sum; each earning row has a unique `ref`, so nothing pays twice):
  - Completed focus block: 1 bean per 2.5 *planned* minutes, rounded (25 min → 10). Discarded blocks earn nothing. Deleting a session later keeps its beans.
  - Ticked to-do: 2 beans, only if it was added at least 5 minutes before the tick, and at most 10 paying ticks per local day (dailies count). Ticks past the cap are still recorded; they just don't pay. Unticking keeps the beans; a re-tick can't pay again (a one-time to-do pays once ever, a daily once per day).
  - Weekly target bonus: 25 beans, once per task per week, when a completed block brings the task's week (all logged minutes, like the progress bars) to its target for that week (`week_targets`). A target of 0 never pays.
  - Backfill: migration 011 pays existing history once at the same rates and without the to-do guard: one `backfill` row for past blocks and ticks, plus a `target` row per task-week that hit its target.
  - Awards are written in the same db transaction as the session or tick; events go out after the locks are released.
- **Spending**: `buy_item` checks the balance and writes the ledger row and `owned_items` in one transaction. Buying takes two clicks (Buy · 150 → Confirm 150?, Esc cancels); no refunds. The catalogue lives in code (Rust for prices and checks, TS for names and art), so the ledger keeps what was actually paid.
- **Catalogue v1** (kept small until the asset approach is decided): beanie 60, witch hat 200 (hats); jack-o'-lantern 150 (decoration, surface kind, glows in the evening and at night).
- **Hats**: one slot, worn in every pose of every scene; `settings.hat`. A bought hat goes on straight away. The timer sign was raised and shortened for hats (it now ends at y 96, about 24 px above Spook's head), and hats still hug the head (the witch hat is floppy, its point drooping down the side); tall hats would vanish behind the sign. The Spook build writes one overlay per hat and pose with that pose's transform; while he wears headphones they're drawn over the hat.
- **Decorations go in slots**: each scene has a few named spots, each with a kind (v1: surface only; later wall, wall-top, floor) and its depth and tint mask worked out in advance. An item goes in any free slot of its kind in any scene; `placements(slot_id PK, item_id UNIQUE)` means one item has one place and a slot holds one item. v1 slots: counter left and right of Spook; tables: the free end of Spook's own table and the lower bookshelf (the two-seat table was already full and is kept for ghost customers; the top shelf sat against the corner buttons). Slots respect the Scenes layout contract and leave the tables' empty seats free for ghost customers. Decorations are tinted with the room, except glowing parts. A drag-anywhere placement editor was considered and left for later.
- **UI**: a button next to ⚙ shows the bean and the balance, and opens the shop. A "+N" floats up from it when beans come in (none with Reduce motion); ticks that don't pay show nothing there, and the To-do status line says when today's to-do beans are maxed. The balance isn't shown in the tray or the Report. Ghost customers (Later) don't interact with the shop.
- **The shop is for buying only**: a cream card dialog, balance on top, tabs Hats | Decor (ARIA tabs). Each row shows the item, its price and Buy → Confirm, or "Owned" (a decoration also says where it stands, or "Not placed yet"). The Hats tab has a try-on Spook (idle, counter) wearing the selected hat. A bought hat goes on straight away; a bought decoration waits to be placed. The shop works during focus.
- **Changing hats**: click Spook (an invisible button over his spot, shown once you own a hat) for a small menu of owned hats plus "No hat". It opens to his left so it fits the narrowest window.
- **Placing decorations — Decorate mode**: a brush button under ⚙ (shown once you own a decoration) outlines every spot in the current scene (dashed; "+" when empty) and swaps the caption and timer buttons for "Decorating · click a spot" and Done. Clicking a spot opens a menu above it: owned decorations of its kind ("move from …" if placed elsewhere, ✓ for the one there) and "Empty this spot". Done or Esc leaves the mode; the scene arrows still work in it.

## Reporting
- The chalkboard's Report section, read-only (editing stays in the Sessions dialog). Two sub-views behind chalk pills: **Week** (default) and **Trends**; the last one is remembered in localStorage. Charts are hand-drawn SVG in chalk, no chart library. Data comes from `report_week` and `report_trends`; Report refetches when the timer phase changes and when a to-do changes. Archived tasks appear wherever they have time, marked "(archived)".
- **Week** (7b-1): one week at a time; ◀ ▶ around the week's dates step back to the week of the first session and forward to this week; on a past week a "This week" link jumps back. Report always opens on this week. Top to bottom: a headline (`12.5 h focused · 4 of 7 targets hit · 9 to-dos done`); a donut of the week's minutes per task (discarded partial minutes included, like the progress bars) with the total in the middle and a legend (name, hours, %); hours vs target per task with ✓ on targets hit; to-dos: one-time to-dos done that week and 7 habit dots (Mon–Sun) per daily; "See sessions" (opens the Sessions dialog; this week only). A week with no sessions shows Spook's face and "Nothing brewed this week". A task shows in a week if it existed then (created before the week ended) and is active, or has time that week.
- **Targets per week**: a `week_targets` table records each task's weekly target per week, filled the first time the week is loaded (the main window's progress query) and updated when a task is edited that week. Weeks with no record use the task's current target.
- **Trends** (7b-2): a heatmap of focused minutes per day over the last 16 weeks (five levels, weekday letters, month names; a line under it shows the picked day's total, today by default; click/hover, one Tab stop with arrow keys); per-task trends as small multiples (one row per task, 8 weekly bars, a dashed tick at each week's recorded target, the current week faded; each row has its own scale, since the question is how a task did against its target; the right column is the average over finished weeks the task existed in; hovering a bar reads out its week); streaks (current and longest run of days with a completed block, today doesn't break it until midnight; each daily to-do's own streak); insights (best weekday, most focused hour, completion rate = completed ÷ started blocks, average focus per active day).

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
- Main window layout (480–960 wide, height free; the art is 960 wide and a wider window reveals more of the cafe): cafe scene on top (window, shelf TV, string lights, counter; Spook floats behind the counter), timer on a hanging chalk sign, controls on the counter, music bar, then the chalkboard.
- **Chalkboard sections**: Menu (home: this week's tasks, progress, Add item / Sessions) | To-do | Report, one at a time. Chalk tabs across the top are the board's title (current one underlined); each section has one small status line under them (Menu: week dates and hours; To-do: "2 left"; Report: "Coming soon"). Tabs show no counts; the open count is only in To-do's status line. Click a tab, or ← / → on the tabs (wrapping; Home/End). Only the user switches: the timer never does, and the tabs work during focus (only task picking is locked). The last section is remembered in the window's localStorage, not the db. The board's height follows the section; switching fades the content in about 150 ms (none with Reduce motion). The shop is not a board section. Report is a placeholder (Spook face, "Reports are still brewing…", the list of planned views) until 7b; whether Report absorbs the Sessions dialog is decided in 7b.
- Palette shifts with time of day: four phases whose start hours are adjustable in settings (defaults: morning 6, afternoon 12, evening 17, night 20; each lasts until the next, night wraps past midnight). Settings can also pin the scene to one time of day instead of following the clock. Scene animations pause while the window is hidden. The room is drawn once and tinted per phase (tint masked to the room, so the sky and Spook keep their colours; Spook glows at night).
- Cafe details: a neon "Spook's Cafe" across the top of the hanging timer sign (glows and flickers in the evening and at night); coffee always dripping from the espresso machine into its cup; while YouTube is the service, the shelf TV shows the station's real artwork (the page's `og:image` thumbnail, dimmed when paused). Lofi Girl's character is trademarked, so the app never draws or bundles her art. While music plays, ♪ notes float around Spook, but only in poses where he wears headphones (focus at the counter and the tables).
- The cafe window shows a **pixel-art sky** (decided over flat): sunrise, daylight, pixel sunset, night with moon and rain; a pixel city skyline with lit windows in the evening and at night.
- **Scenes**, left to right: Outside | Counter | Tables (counter is home, in the middle; no wrap-around). Switched only by the user, with faint ◀ ▶ arrows on the scene's edges (no menu bar control; the timer never changes the scene). The current scene is remembered across launches. All scenes share the 960×340 canvas, the stage crop and the time-of-day system. Scenes crossfade (about 0.6 s); a camera pan was tried in the app and dropped.
  - The timer sign and the controls are one fixed overlay, in the same place in every scene. **Layout contract for scene art:** keep the top centre (stage x 402–558, y 0–114) plain so the sign hangs over wall, not over a window or picture; put Spook's spot under it (stage x 405–555, y 98–255) with something in front that hides him from about y 250 down (counter, table top); keep the bottom band (y 264–340) a calm foreground surface the buttons can sit on (the caption and buttons start at y 270).
  - Tables: Spook's round table under the sign. The back wall reads, left to right: hanging plant, big window (above a two-seat table), pendant lamp, framed snapshot of Spook, [sign], moon painting, potted plant, booth with a bookshelf above. At the narrowest width the window is off-screen; it shows from about 600 px wide. Tables are empty for now.
  - Outside (built by Claude at the user's request; it was a Later practice ticket): the cafe's shop front seen from the street. A sage facade fills the middle under a pink-striped scalloped awning (the sign hangs in front of it), with one name board left of the sign reading "Spook's Cafe" (styled like the timer sign, gold hand lettering, below the corner buttons so a narrow window doesn't cover it); Spook floats in an open doorway under the sign, in full view down to his hem, 16 px lower than in the other scenes (no door and no front layer: the one scene where nothing hides his lower half; a stable door was tried and dropped), with the cafe's floor inside a step up from the street (its front edge at y 270, where the broom's bristles land, just above the caption) and a stone doorstep below it; a front window each side looks into the warm-lit cafe, with window boxes below. The pavement and a plain plinth make the calm bottom band. The pixel sky (with the pixel city) is the whole background, so rain falls wherever it shows; the sun and moon sit just right of the building so a narrow window still shows them. Wider windows reveal street lamps and a bush on the left, a sidewalk chalkboard, a bench and a bush on the right. In the evening and at night a glow layer above the tint lights the windows, the doorway (spilling onto the pavement) and the lamps. Outside poses (Spook floats in the doorway): idle → leaning on the left doorframe with a mitt on it, a small wave with the other; focus → he steps out of the doorway onto the pavement in front of the left window and sweeps the street (no headphones, unlike the other scenes; out there he's clear of the buttons under the doorway) with a broom held in both mitts, the broom swishing about ±6° every 1.2 s around his upper mitt (still with Reduce motion); break → petting Mochi on the doorstep (one mitt on its head, eyes happy, little hearts; replaced a to-go cup); paused → dozing slumped against the doorframe, the broom leaning on the inside of the right jamb with its bristles on the doorway floor (a still props overlay). Hats are made for every pose by the builder.
  - Spook's poses depend on the scene (each scene lists its own set). At the table: idle → cheeks resting on his mitts (on trial), focus → headphones + laptop standing on the table, break → looking at his phone (we see its back: camera bump and a Spook logo where the Apple would be), paused → dozing slumped towards the table. The table top hides more of him (from his y ≈ 165), so table poses sit higher. Things standing on the table (the laptop and the mitts typing on it) are a separate props overlay drawn above the front layer and don't bob; anything he holds bobs with him.
- **Mochi, the ghost cat**: Spook's cat, in every scene. Pale, see-through blue with a glowing blue outline instead of Spook's ink line (so the two never merge), after a reference image the user picked: a big round head with tall pointy ears, pink inner ears, a `:3` mouth and whiskers, no legs, the body trailing off into a long wispy tail. About 1.4× the first draft. Floats with its own slow bob, untinted and glowing at night like Spook. Asleep and curled up everywhere: the counter's window sill beside the plant, the left end of Spook's table, the outside doorstep. Only outside during a break is it awake, sitting up and purring while Spook pets it. Its spots stay clear of the sign, the buttons, the decoration slots and the seats kept for ghost customers.
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
7. More functionality, asked for by the user (so built by Claude, not practice tickets): 7a to-do list → 7b reporting → 7c cafe shop.
   - 7b reporting, in the chalkboard's Report section; split 7b-1 Week → 7b-2 Trends (see Reporting).
   - 7c cafe shop: earn beans from completed focus blocks and ticked to-dos, spend them on hats for Spook and decorations for the scenes (see Cafe shop). Build order: migration 011 → Rust (`shop.rs`, awards in block completion and `set_todo_done`) → art → React → in-app check.

## Future (to design together)
Features the user wants next, designed in grilling rounds before building (not practice tickets). Known bugs and rough edges are in DEFECTS.md instead.
- **Decorating, fleshed out**: more to place and more ways to place it. Includes the items below and the asset question (generated SVG, online packs or the user drawing in Figma).
  - Shop paintings (on hold until the outside scene is done and decorations are revisited): the four existing pictures (counter's ghost-and-cup and latte heart, tables' polaroid and moon) become free starter paintings; frames stay part of the wall and only the picture inside swaps (drawn subject-centred, cropped to each opening, tilted for the polaroid); a frame always holds a painting, so picking one hanging elsewhere swaps them; a Paintings tab in the shop. Decoration sizes stay fixed per slot.
  - Shop: more hats and decorations (once the asset approach is decided), wall/wall-top/floor slots, more outfit slots (scarves, glasses), a drag-anywhere placement editor, beans earned per week in the Report.
- **Spook's poses, updated**: revisit the pose sets across the scenes (counter, tables, outside). Known starting points: the tables' idle pose is on trial; outside, Mochi floats and the petting reach is short (see DEFECTS.md).
- **Sound effects**: small sounds for things happening in the cafe. To design: which moments (e.g. beans coming in, buying, ticking a to-do, the shop till, Mochi purring while petted, the broom outside, rain at night as ambience); one on/off toggle and volume in Settings, next to the existing chime toggle (`settings.chime`); keeping them quiet under the music and never during focus unless asked; where they play (in the webview with `<audio>`, versus Rust's `afplay` as the phase-end chime in `src-tauri/src/alerts.rs` does); and where the sounds come from, with licences (CC0 packs such as Kenney's, or freesound.org with attribution).
- **Spotify artwork on the TV**, like the YouTube thumbnail: add `artwork url of current track` to the AppleScript in `spotify::status()` (already polled every 3 s, so it updates per song), carry it in the music snapshot (only `https://i.scdn.co/` URLs), and have `useTvThumbnail` return it when Spotify is the service. Album art is square, so it's cropped to the TV screen.

## Later (practice tickets for the user)
- Ghost customers at the empty tables
- Internet radio streams
- Automatic iCloud backup
