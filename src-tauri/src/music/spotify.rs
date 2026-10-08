//! Controls the Spotify desktop app through its AppleScript dictionary: no Spotify developer
//! account or OAuth, and playback (Premium, no ads) stays in Spotify itself. macOS asks once
//! for permission to control Spotify (Privacy & Security → Automation).

use std::path::Path;
use std::process::Command;
use std::sync::Mutex;
use std::time::Duration;

use super::{MusicSnapshot, Service};
use crate::error::{Error, Result};

pub(super) const POLL: Duration = Duration::from_secs(3);

/// The link we last started, so Play resumes it instead of restarting it from the top.
static STARTED: Mutex<Option<String>> = Mutex::new(None);

pub(super) struct Status {
    pub playing: bool,
    /// `None` while Spotify isn't running.
    pub volume: Option<u8>,
    pub track: Option<String>,
}

/// Sends whatever `next` needs that `prev` didn't have. Only talks to Spotify when it's (or
/// was) the active service, so YouTube users never get Spotify launched on them.
pub(super) fn sync(prev: &MusicSnapshot, next: &MusicSnapshot) -> Result<()> {
    let was_playing = prev.service == Service::Spotify && prev.playing;
    if next.service != Service::Spotify {
        return if was_playing { tell("pause") } else { Ok(()) };
    }
    let set_volume = || tell(&format!("set sound volume to {}", next.volume));
    if next.playing && (!was_playing || prev.spotify_link != next.spotify_link) {
        // Playing may launch Spotify, so the volume goes after it.
        play(next.spotify_link.as_deref())?;
        set_volume()
    } else if !next.playing && was_playing {
        tell("pause")
    } else if (prev.service != Service::Spotify || prev.volume != next.volume) && running() {
        set_volume()
    } else {
        Ok(())
    }
}

fn play(link: Option<&str>) -> Result<()> {
    ensure_installed()?;
    let mut started = STARTED.lock().unwrap();
    match link {
        Some(link) if started.as_deref() != Some(link) => {
            // `link` passed `normalize_link`, so it's only `spotify:kind:base62` — safe to quote.
            tell(&format!("play track \"{link}\""))?;
            *started = Some(link.to_string());
        }
        _ => tell("play")?,
    }
    Ok(())
}

pub(super) fn skip(forward: bool) -> Result<()> {
    tell(if forward { "next track" } else { "previous track" })
}

/// Reads Spotify's state without launching it. `None` if the read itself failed.
pub(super) fn status() -> Option<Status> {
    if !running() {
        return Some(Status { playing: false, volume: None, track: None });
    }
    let out = osascript(
        r#"tell application "Spotify"
             set t to ""
             try
               set t to (name of current track) & " — " & (artist of current track)
             end try
             return (player state as text) & linefeed & (sound volume as text) & linefeed & t
           end tell"#,
    )
    .ok()?;
    let mut lines = out.lines();
    let playing = lines.next()? == "playing";
    let volume = lines.next()?.trim().parse().ok();
    let track = lines.next().map(str::to_string).filter(|t| !t.is_empty());
    Some(Status { playing, volume, track })
}

/// Accepts open.spotify.com share links and `spotify:` URIs for playlists and albums.
pub(super) fn normalize_link(input: &str) -> Result<String> {
    const INVALID: Error = Error::InvalidInput("paste a Spotify playlist or album link");
    let parts: Vec<String> = if let Some(uri) = input.strip_prefix("spotify:") {
        uri.split(':').map(str::to_string).collect()
    } else {
        let url: tauri::Url = input.parse().map_err(|_| INVALID)?;
        if url.host_str() != Some("open.spotify.com") {
            return Err(INVALID);
        }
        // Share links can carry a locale segment: /intl-de/playlist/<id>.
        url.path_segments().ok_or(INVALID)?.filter(|s| !s.starts_with("intl-")).map(str::to_string).collect()
    };
    let parts: Vec<&str> = parts.iter().map(String::as_str).collect();
    match parts[..] {
        [kind @ ("playlist" | "album"), id, ..]
            if !id.is_empty() && id.len() <= 64 && id.chars().all(|c| c.is_ascii_alphanumeric()) =>
        {
            Ok(format!("spotify:{kind}:{id}"))
        }
        _ => Err(INVALID),
    }
}

fn tell(command: &str) -> Result<()> {
    ensure_installed()?;
    osascript(&format!("tell application \"Spotify\" to {command}")).map(|_| ())
}

/// `is running` doesn't launch the app, unlike any `tell`.
fn running() -> bool {
    osascript(r#"application "Spotify" is running"#).is_ok_and(|out| out.trim() == "true")
}

/// Checked up front: AppleScript can't compile a `tell` for an app that isn't installed.
fn ensure_installed() -> Result<()> {
    let home = std::env::var_os("HOME").map(|h| Path::new(&h).join("Applications/Spotify.app"));
    let installed = Path::new("/Applications/Spotify.app").exists() || home.is_some_and(|p| p.exists());
    if installed {
        Ok(())
    } else {
        Err(Error::External("Spotify isn't installed".into()))
    }
}

fn osascript(script: &str) -> Result<String> {
    let out = Command::new("osascript").arg("-e").arg(script).output()?;
    if out.status.success() {
        return Ok(String::from_utf8_lossy(&out.stdout).trim_end_matches('\n').to_string());
    }
    let stderr = String::from_utf8_lossy(&out.stderr);
    // -1743: the user (or nobody yet) hasn't allowed us to control Spotify.
    Err(Error::External(if stderr.contains("-1743") {
        "Allow Spook's Cafe to control Spotify in System Settings → Privacy & Security → Automation".into()
    } else {
        format!("Spotify: {}", stderr.trim())
    }))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn normalizes_spotify_links() {
        let n = |s: &str| normalize_link(s).unwrap();
        let id = "37i9dQZF1DWWQRwui0ExPn";
        assert_eq!(n(&format!("https://open.spotify.com/playlist/{id}?si=abc")), format!("spotify:playlist:{id}"));
        assert_eq!(n(&format!("https://open.spotify.com/intl-de/album/{id}")), format!("spotify:album:{id}"));
        assert_eq!(n(&format!("spotify:playlist:{id}")), format!("spotify:playlist:{id}"));
        for bad in [
            "https://open.spotify.com/track/abc",
            "https://evil.com/playlist/abc",
            "spotify:playlist:abc\" & do shell script \"x",
            "nonsense",
        ] {
            assert!(normalize_link(bad).is_err(), "{bad}");
        }
    }
}
