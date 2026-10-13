//! The hidden YouTube window (decided in `docs/youtube-spike.md`). Rust can only push
//! scripts into it with `eval`, never read back, so control is desired-state: we store what
//! we want in the page's sessionStorage, and an injected loop keeps the `<video>` matching it.

use std::process::Command;
use std::sync::Mutex;
use std::time::{Duration, Instant};

use serde::Serialize;
use tauri::{AppHandle, Emitter, Manager, Url, WebviewUrl, WebviewWindowBuilder};

use super::{MusicSnapshot, Service};
use crate::error::{Error, Result};

const PLAYER: &str = "yt-player";
const SIGN_IN: &str = "yt-sign-in";

/// A paused player is kept so resuming is instant, but a YouTube page holds a few hundred MB,
/// so after this long paused it's closed. Live streams rejoin at the live edge anyway.
const IDLE_CLOSE: Duration = Duration::from_secs(10 * 60);

/// When a paused player should close. Every sync resets it, so any change while paused restarts
/// the countdown; the music watcher calls `close_if_idle` every few seconds.
static IDLE_DEADLINE: Mutex<Option<Instant>> = Mutex::new(None);

// Google rejects sign-in from user agents that look like an embedded webview.
// WKWebView's default UA omits the "Version/x Safari/x" tokens, so we claim to be Safari.
const SAFARI_UA: &str = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) \
    AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Safari/605.1.15";

/// Runs on every page load in the player. sessionStorage belongs to this one webview and
/// survives its navigations, so the desired state carries over when the stream changes.
const PLAYER_SCRIPT: &str = r#"
(() => {
  if (window.top !== window) return;
  const KEY = "lofi-focus";
  if (!sessionStorage.getItem(KEY)) sessionStorage.setItem(KEY, __INITIAL__);
  const apply = () => {
    const want = JSON.parse(sessionStorage.getItem(KEY));
    const v = document.querySelector("video");
    if (!v) return;
    if (Math.abs(v.volume - want.volume / 100) > 0.005) v.volume = want.volume / 100;
    if (v.muted && want.volume > 0) v.muted = false;
    if (want.playing && v.paused) v.play().catch(() => {});
    if (!want.playing && !v.paused) v.pause();
  };
  window.__lofiApply = apply;
  // Also undoes YouTube's own pauses and volume resets within a second.
  setInterval(apply, 1000);
})();
"#;

#[derive(Serialize)]
struct Desired {
    playing: bool,
    volume: u8,
}

impl From<&MusicSnapshot> for Desired {
    fn from(m: &MusicSnapshot) -> Self {
        Self { playing: m.playing, volume: m.volume }
    }
}

/// A JS string literal holding the desired state as JSON (JSON is also valid JS, so
/// double-encoding gives a safely quoted string).
fn desired_literal(m: &MusicSnapshot) -> String {
    let json = serde_json::to_string(&Desired::from(m)).expect("plain struct serializes");
    serde_json::to_string(&json).expect("string serializes")
}

/// Brings the player in line with `next`. The window is created on first play and kept while
/// paused (so a playlist resumes where it was) until `IDLE_CLOSE`, or until another service
/// takes over, which closes it at once.
pub(super) fn sync(app: &AppHandle, prev: &MusicSnapshot, next: &MusicSnapshot) -> Result<()> {
    *IDLE_DEADLINE.lock().unwrap() = None;
    let window = app.get_webview_window(PLAYER);
    if next.service != Service::YouTube {
        if let Some(window) = window {
            window.destroy()?;
        }
        return Ok(());
    }
    let Some(url) = next.youtube_url() else { return Ok(()) };
    let Some(window) = window else {
        if next.playing {
            let script = PLAYER_SCRIPT.replace("__INITIAL__", &desired_literal(next));
            WebviewWindowBuilder::new(app, PLAYER, WebviewUrl::External(url))
                .title("Spook's Cafe Player")
                .user_agent(SAFARI_UA)
                .visible(false)
                .initialization_script(&script)
                .build()?;
        }
        return Ok(());
    };
    if prev.youtube_url() != next.youtube_url() {
        window.navigate(url)?;
    }
    let desired = desired_literal(next);
    window.eval(format!(
        "sessionStorage.setItem('lofi-focus', {desired}); window.__lofiApply && window.__lofiApply();"
    ))?;
    if !next.playing {
        *IDLE_DEADLINE.lock().unwrap() = Some(Instant::now() + IDLE_CLOSE);
    }
    Ok(())
}

pub(super) fn close_if_idle(app: &AppHandle) {
    let mut deadline = IDLE_DEADLINE.lock().unwrap();
    if deadline.is_some_and(|d| Instant::now() >= d) {
        *deadline = None;
        if let Some(window) = app.get_webview_window(PLAYER) {
            let _ = window.destroy();
        }
    }
}

/// Accepts YouTube video, playlist and short links, rewritten to a page that starts playing.
pub(super) fn normalize_url(input: &str) -> Result<String> {
    const INVALID: Error = Error::InvalidInput("that isn't a YouTube link");
    let url: Url = input.trim().parse().map_err(|_| INVALID)?;
    if url.scheme() != "https" && url.scheme() != "http" {
        return Err(INVALID);
    }
    let query = |key: &str| url.query_pairs().find(|(k, _)| k == key).map(|(_, v)| v.into_owned());
    let host = url.host_str().unwrap_or_default().trim_start_matches("www.").trim_start_matches("m.");
    let normalized = match host {
        // youtu.be/<id>
        "youtu.be" => {
            let id = url.path().trim_start_matches('/');
            if id.is_empty() {
                return Err(INVALID);
            }
            format!("https://www.youtube.com/watch?v={id}")
        }
        "youtube.com" | "music.youtube.com" => match url.path() {
            // A playlist page doesn't play by itself; its watch page does.
            "/playlist" => format!("https://www.youtube.com/watch?list={}", query("list").ok_or(INVALID)?),
            "/watch" if query("v").is_some() || query("list").is_some() => {
                let mut out = Url::parse("https://www.youtube.com/watch").unwrap();
                for key in ["v", "list"] {
                    if let Some(value) = query(key) {
                        out.query_pairs_mut().append_pair(key, &value);
                    }
                }
                out.to_string()
            }
            // Channel live pages, e.g. youtube.com/@LofiGirl/live.
            path if path.starts_with("/@") => format!("https://www.youtube.com{path}"),
            // Share links for live streams (/live/<id>) and Shorts (/shorts/<id>).
            path if path.starts_with("/live/") || path.starts_with("/shorts/") => {
                let id = path.split('/').nth(2).filter(|id| !id.is_empty()).ok_or(INVALID)?;
                format!("https://www.youtube.com/watch?v={id}")
            }
            _ => return Err(INVALID),
        },
        _ => return Err(INVALID),
    };
    Ok(normalized)
}

/// The artwork for a station, for the TV in the scene: a watch link's own video thumbnail, or
/// else the page's `og:image` (what link previews show), fetched with macOS's curl. Channel
/// live pages need the fetch, since the video id is only in the page, not the URL. Only ytimg.com
/// images come back, as the UI puts this straight into an `<img>`.
pub fn thumbnail(url: &Url) -> Result<Option<String>> {
    let video = url.query_pairs().find(|(k, _)| k == "v").map(|(_, v)| v.into_owned());
    if let Some(id) = video.filter(|id| id.chars().all(|c| c.is_ascii_alphanumeric() || c == '-' || c == '_')) {
        return Ok(Some(format!("https://i.ytimg.com/vi/{id}/hqdefault.jpg")));
    }
    let output = Command::new("curl")
        .args(["--silent", "--location", "--max-time", "10", "--user-agent", SAFARI_UA, url.as_str()])
        .output()?;
    if !output.status.success() {
        return Ok(None);
    }
    Ok(og_image(&String::from_utf8_lossy(&output.stdout)))
}

fn og_image(html: &str) -> Option<String> {
    const TAG: &str = r#"<meta property="og:image" content=""#;
    let start = html.find(TAG)? + TAG.len();
    let end = start + html[start..].find('"')?;
    let image = html[start..end].replace("&amp;", "&");
    image.starts_with("https://i.ytimg.com/").then_some(image)
}

/// Whether the app's WebKit store holds a YouTube login. All the app's webviews share one store,
/// so asking through the main window (which always exists) answers for the player too.
/// Read from Rust, so nothing runs inside YouTube's page.
pub fn signed_in(app: &AppHandle) -> Result<bool> {
    let Some(window) = app.get_webview_window(crate::MAIN_WINDOW) else {
        return Ok(false);
    };
    let cookies = window.cookies_for_url("https://www.youtube.com".parse().expect("valid url"))?;
    Ok(cookies.iter().any(|c| matches!(c.name(), "LOGIN_INFO" | "SAPISID")))
}

/// Google's sign-in, once, so a Premium account plays ad-free. Cookies live in the shared
/// WebKit store, so the player picks them up; it's reloaded when this window closes, and
/// `youtube-auth` tells the UI to re-check `signed_in`.
pub fn open_sign_in(app: &AppHandle) -> Result<()> {
    if let Some(window) = app.get_webview_window(SIGN_IN) {
        window.set_focus()?;
        return Ok(());
    }
    let url = "https://accounts.google.com/ServiceLogin?service=youtube&continue=https://www.youtube.com/"
        .parse()
        .expect("valid url");
    let window = WebviewWindowBuilder::new(app, SIGN_IN, WebviewUrl::External(url))
        .title("Sign in to YouTube")
        .user_agent(SAFARI_UA)
        .inner_size(500.0, 700.0)
        .build()?;
    let app = app.clone();
    window.on_window_event(move |event| {
        if let tauri::WindowEvent::Destroyed = event {
            if let Some(player) = app.get_webview_window(PLAYER) {
                let _ = player.eval("location.reload()");
            }
            let _ = app.emit("youtube-auth", ());
        }
    });
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::music::Source;

    #[test]
    fn normalizes_youtube_links() {
        let n = |s| normalize_url(s).unwrap();
        assert_eq!(n("https://youtu.be/jfKfPfyJRdk"), "https://www.youtube.com/watch?v=jfKfPfyJRdk");
        assert_eq!(n(" https://www.youtube.com/watch?v=abc&t=42s&list=PL1 "), "https://www.youtube.com/watch?v=abc&list=PL1");
        assert_eq!(n("https://youtube.com/playlist?list=PL1"), "https://www.youtube.com/watch?list=PL1");
        assert_eq!(n("https://m.youtube.com/@LofiGirl/live"), "https://www.youtube.com/@LofiGirl/live");
        assert_eq!(n("https://www.youtube.com/live/jfKfPfyJRdk?si=x"), "https://www.youtube.com/watch?v=jfKfPfyJRdk");
        assert_eq!(n("https://youtube.com/shorts/abc123"), "https://www.youtube.com/watch?v=abc123");
        for bad in ["not a url", "https://vimeo.com/1", "https://www.youtube.com/", "javascript:alert(1)", "https://youtu.be/", "https://www.youtube.com/live/"] {
            assert!(normalize_url(bad).is_err(), "{bad}");
        }
    }

    #[test]
    fn desired_state_is_a_quoted_js_string() {
        let m = MusicSnapshot {
            service: Service::YouTube,
            source: Source::LofiGirl,
            custom_url: None,
            spotify_link: None,
            volume: 40,
            playing: true,
            now_playing: None,
        };
        assert_eq!(desired_literal(&m), r#""{\"playing\":true,\"volume\":40}""#);
    }

    #[test]
    fn thumbnail_from_watch_link_needs_no_fetch() {
        let url = "https://www.youtube.com/watch?v=jfKfPfyJRdk".parse().unwrap();
        assert_eq!(thumbnail(&url).unwrap().as_deref(), Some("https://i.ytimg.com/vi/jfKfPfyJRdk/hqdefault.jpg"));
    }

    #[test]
    fn og_image_only_trusts_ytimg() {
        let page = r#"<head><meta property="og:image" content="https://i.ytimg.com/vi/abc/maxresdefault.jpg?v=1&amp;x=2"></head>"#;
        assert_eq!(og_image(page).as_deref(), Some("https://i.ytimg.com/vi/abc/maxresdefault.jpg?v=1&x=2"));
        assert_eq!(og_image(r#"<meta property="og:image" content="https://evil.example/x.jpg">"#), None);
        assert_eq!(og_image("<html></html>"), None);
    }
}
