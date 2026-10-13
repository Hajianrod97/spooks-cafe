# Defects

Known problems to tackle later: bugs, rough edges and tech debt. New features belong in SPEC.md
("Later"). Tick an item when it's fixed and note the commit, or delete it once that's committed.

Each item: what's wrong, where, and how to see it.

## Open

### Look
- [ ] **Mochi needs more work.** The redraw after the reference image (2026-10-08) is a step up but not final. Ideas so far: open eyes when awake, rounder head, longer tail. Art: `design/spook/build.mjs` → "Mochi"; spots: `src/cafe/mochi.ts`.
- [ ] **A stray pink dot above Mochi in the tables scene**: it's the bud vase's flower. Mochi lies in front of the vase on Spook's table and hides it, so only the pink flower and a bit of stem poke out above the cat's head. Move the vase (`bud-vase` in `design/cafe/build.mjs`, drawn into `tables-front.svg`) or Mochi's spot (`MOCHI_SPOTS.tables` in `src/cafe/mochi.ts`).
- [ ] **Mochi floats in mid-air in the outside scene.** Its one outside spot (`MOCHI_SPOTS.outside` in `src/cafe/mochi.ts`, x 404) was moved left so Spook could reach it while petting. But the curled-up Mochi is about 72 px wide, so its left half now hangs past the doorstep's left end (x 408) over the window box. And the petted Mochi floats beside the doorway with nothing under it. Likely fix: a spot per pose (curled on the doorstep proper, petted resting on something such as the window-box ledge), and/or Spook reaching further.
- [ ] **Make the sidewalk chalkboard bigger and put the cafe's name on it, in place of the name board on the building** (outside scene). Today the A-frame (`aFrame(694)` in `design/cafe/build.mjs`) is small and shows only chalk scribbles, and "Spook's Cafe" is on a board left of the timer sign (`nameBoards`, plus `lettering` in `src/cafe/scenes.ts`). To do: draw a larger A-frame; move the `lettering` entry onto its face (chalk-white Kalam, like the chalkboard menu, rather than gold paint); remove the building board, and the space it took above the left window. Check it at the narrowest window, where the A-frame sits at the right edge near the buttons. This reverses a decision recorded in SPEC.md (Scenes → Outside), so update that too.
- [ ] **The chairs need a revamp** (tables scene). All three are the same front-facing bentwood chair from `frontChair()` in `design/cafe/build.mjs`: the empty one at Spook's table (front layer, `spooksTable`) and the pair at the two-seat table (back layer, `leftTable`, scale 0.8). They're thin ink outlines with no wood fill on the back or legs, so they read as wireframes next to the filled furniture. What exactly to change hasn't been decided yet.
- [ ] **The tables' idle pose is still on trial** (Spook resting his cheeks on his mitts). The user wasn't sure about it. `design/spook/build.mjs` → `poses.table.idle`.

### Dialogs
- [ ] **A big empty gap under "Time of day" in Settings.** The label is stretched to 123 px (about 70 px too tall), matching the height of the four-dropdown grid below it. Cause: `.editor label { flex: 1 }` in `src/App.css` is meant for labels side by side in a row, but the Scene section (`.editor fieldset.scene`) is a flex *column*, so `flex: 1` makes the label grow vertically. Fix: `.editor fieldset.scene label { flex: none; }`, or scope the `flex: 1` to row containers such as `.pair` and `.grid`.

### Leftovers from before the cafe look
- [x] **The Sessions dialog still marks completed blocks with 🍅** (fixed 2026-10-13: `<SpookFace />` with a hidden "completed" label; the timer.rs comment too) (`src/SessionsDialog.tsx`, the `stats` line: `{s.durationMinutes}m {s.completed ? "🍅" : "· partial"}`). Since step 6 the unit is Spook's face (`SpookFace.tsx`, as in the menu's block counts in `MenuSection.tsx`). Swap in `<SpookFace />` with an accessible label such as "completed". (A doc comment in `src-tauri/src/timer.rs` on `Action::Discard` also says 🍅; it isn't shown to users, but could say "completed block".)

### Music
- [ ] **YouTube plays very loudly, and the volume sometimes jumps up out of nowhere** (reported 2026-10-08). Player script: `PLAYER_SCRIPT` in `src-tauri/src/music/youtube.rs`. Likely causes, not yet confirmed:
  - *Too loud overall:* the slider maps straight onto `video.volume` (`volume / 100`), but loudness is perceived on a log scale. 50% still sounds loud, and the usable range is squeezed into the bottom fifth of the slider. A perceptual curve (e.g. `(v / 100) ** 2`) would spread it out.
  - *Sudden jumps:* the script only re-applies the volume once a second (`setInterval(apply, 1000)`). When YouTube resets it (a new video or stream reconnect, an ad, its own saved player volume), it can play at full volume for up to a second. Re-applying on the `<video>`'s `volumechange` / `loadeddata` / `play` events would close that gap.
  - *Also possible:* it only controls the first `<video>` on the page (`querySelector`), so an ad's separate video element would play at its own volume; and YouTube's "Stable volume" can change loudness between segments.

### Accessibility
- [ ] **Task colours fail colour-blind separation on the dark board**: System Design ↔ Job Search ΔE 1.7 for deuteranopia. Charts never rely on colour alone (legends are always named), but the palette itself is undecided. Seeds: `src-tauri/migrations/001_init.sql`.

- [ ] **Reflow is iffy**: the layout doesn't adapt well when the window size or text size changes. Not yet audited; known starting points:
  - The scene is a fixed 960×340 canvas, cropped at the sides and never scaled. The window's minimum is 480×600 (`tauri.conf.json`).
  - Things in the overlay are positioned in stage pixels and can collide at narrow widths (they've already had to be moved apart by hand): the corner buttons vs the sign, the corner buttons vs the outside name board, the hat menu.
  - Text zoom: Tauri's zoom hotkeys aren't enabled (`zoomHotkeysEnabled`), so check whether the app respects a larger system text size, and that dialogs (`width: min(…, 90vw)`) and the chalkboard hold up when text is bigger.
  - Check: the narrowest window, a tall narrow window, the widest window, and text at 200%.
- [ ] **Make everything keyboard accessible.** Not yet audited end to end. Already keyboard-friendly: the chalkboard and shop tabs (arrow keys), the heatmap (one Tab stop and arrows), the to-do rows, `PickMenu` (arrows, Esc, focus returns), the scene arrows (shown on `:focus-visible`), the Spook hat button and the Decorate spots, and native `<dialog>`s (Esc, focus trap). To check:
  - The Tab order through the whole window: scene overlay → note prompt → music bar → chalkboard.
  - A visible focus style on every control. Done for buttons on every surface (2026-10-13, when the global `outline: none` went); still check custom non-button controls.
  - No keyboard traps; focus goes back where it was when dialogs and menus close.
  - Anything that only shows on hover.
  - Whether the main actions want shortcuts (e.g. Space for start/pause), and whether the tray menu covers what the window can't.

- [ ] **The caption under the scene ("Next up · LeetCode", "Brewing · …") is hard to read in some scenes.** It's 14 px cream text (`.scene .caption` in `src/cafe/cafe.css`) with no backing, so its contrast depends on the art behind it. Measured against the scene colours, it never reaches the 4.5:1 that WCAG asks of normal text: counter front 3.9:1, counter top and table top 2.6:1, tables floor and doorway floor 3.1:1, outside doorstep 2.2:1, outside pavement **1.6:1**. Fix options: a translucent dark pill behind it, like a label (works in every scene whatever the art; recommended), or a dark text shadow/outline (lighter touch, but thin text on busy art stays weak). The timer buttons are fine: they have their own cream fill.

### Shop
- [ ] **The bookshelf decoration spot only shows in wide windows** (about 870 px and up), so you can't see or place anything there at the default width. `SLOTS` in `src/cafe/shop.ts`.
- [ ] **A spot's menu in Decorate mode can cover Spook** (its menu opens above the spot, and the Spook's-table spot is right beside him). `DecorateSpots.tsx`.
- [ ] **"Today's to-do beans maxed" can be stale after midnight** if the window stays open, since `useShop` only refetches when the window is shown or beans come in.
- [ ] **A to-do ticked before migration 011 can pay again if it's unticked and re-ticked.** The backfill paid it as one lump row with no `ref`, so the re-tick's `todo:<id>` ref looks new. Worth at most 2 beans per old to-do.

### Tech debt
- [x] **The Tauri template's global `input, button` rules in `App.css`** (including `transition: border-color 0.25s`) leak into every custom control, so each one has to reset padding, background, box-shadow and transitions. Scope them to the old controls or remove them. (Fixed 2026-10-13: removed, leaving only font and cursor. Each control now declares what it used, and the `box-shadow: none` resets are gone. Checked by diffing every control's computed style in 20 headless scenarios: no visible change apart from the new focus rings.)
