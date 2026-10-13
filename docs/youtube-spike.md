# YouTube spike (step 1)

The question: how should the app play YouTube music? The two candidates were an `<iframe>` embed in the main window, or a dedicated hidden YouTube window. The throwaway spike app was deleted once the question was answered. It's in git history before the commit that added this file (`spikes/youtube/`).

## Findings
- Hardcoded live-stream video IDs go stale when a channel restarts its stream, so presets are stored as channels.
- Iframe embedding by video ID loads under the dev origin (`localhost:1420`). The production `tauri://` origin risks YouTube's Error 153.
- Iframe `embed/live_stream?channel=` gives "Video unavailable". Embedding the *current* video ID works, so the `live_stream?channel=` form is the broken part.
- A dedicated window on `@<handle>/live` always plays the current stream.
- Google sign-in works with the Safari user agent, and the player window shows the Premium account.
- Audio keeps playing while the player window is hidden. No ads across several loads.
- Dev and prod share WebKit data (keyed by bundle identifier), and the login persists on disk.

## Result
**Use a dedicated, hidden YouTube window controlled from Rust via injected script.**

- Premium is recognised (signed in, ad-free). The iframe's login state can't be verified, and third-party cookies are at risk.
- `@<handle>/live` always resolves to the current stream. The iframe needs a fixed video ID, which goes stale.
- Avoids the `tauri://` origin / Error 153 risk entirely.
- Requirements carried forward:
  - the Safari user agent on the sign-in and player windows
  - presets stored as channel handles
  - the window stays hidden, and the scene draws its own TV
- Trade-off: control is one-way, since `eval` can't return values. Reading state back (now playing, ad detection) needs extra plumbing.
