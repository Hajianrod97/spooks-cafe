# YouTube spike — test plan

Throwaway. Goal: pick the music approach for SPEC.md step 5.

## Run
- Dev: `npm run tauri dev` (origin `http://localhost:1420`)
- Prod: `npm run tauri build`, then open `src-tauri/target/release/bundle/macos/youtube.app` (origin `tauri://localhost`)

Test **both**. Error 153 typically only shows up under the prod origin.

## Checklist (fill in dev / prod)

| Check | Dev | Prod |
|---|---|---|
| Google sign-in completes (not "browser may not be secure") | ✅ | |
| Sign-in persists after app relaunch | | ✅ |
| Iframe: plays at all (no Error 153) | ✅ (by video ID only) | |
| Iframe: shows as signed in / ad-free | | |
| Window: shows as signed in (avatar top-right) | ✅ | ✅ |
| Window: ad-free across ~3 video loads | ✅ | |
| Window: Play / Pause / Toggle / Volume work | ✅ | |
| Window: audio keeps playing when hidden | ✅ | |
| Window: audio keeps playing when main window minimized | | |

## Findings so far
- Hardcoded live-stream video IDs go stale when a channel restarts its stream; store presets as channels.
- Dev: iframe embed **by video ID** loads (old stream played), so the `localhost:1420` origin is accepted.
- Dev: iframe `embed/live_stream?channel=` → "Video unavailable".
- Dev: dedicated window on `@<handle>/live` plays the current stream.
- Dev: iframe embed by the *current* video ID plays → `live_stream?channel=` is the broken part.
- Dev: Google sign-in works with the Safari user agent; player window shows the Premium account.
- Dev: audio continues when the player window is hidden; no ads across several loads.
- Prod: already signed in on first launch — dev and prod share WebKit data (keyed by bundle identifier), and the login persists on disk.

## Result
**Use approach 2: a dedicated, hidden YouTube window controlled via `eval()`.**

- Premium recognized (signed-in, ad-free); iframe login state is unverifiable and third-party cookies are at risk.
- `@<handle>/live` always resolves to the current stream; the iframe needs a fixed video ID, which goes stale.
- Avoids the `tauri://` origin / Error 153 risk entirely.
- Requirements carried forward: Safari user agent on the sign-in and player windows; presets stored as channel handles; window stays hidden and the scene draws its own "TV".
- Trade-off: one-way control (eval can't return values). Reading state back (now playing, ad detection) needs extra plumbing later.
