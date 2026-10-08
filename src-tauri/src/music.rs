mod spotify;
mod youtube;

use std::sync::Mutex;
use std::time::{Duration, Instant};

use rusqlite::{params, Connection};
use serde::{Deserialize, Serialize};
use tauri::{AppHandle, Emitter, Manager, Url};

use crate::db::Db;
use crate::error::{Error, Result};

#[derive(Clone, Copy, Debug, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub enum Service {
    YouTube,
    Spotify,
}

/// The YouTube preset; Spotify has its own link.
#[derive(Clone, Copy, Debug, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub enum Source {
    LofiGirl,
    Chillhop,
    Custom,
}

impl Source {
    fn as_str(self) -> &'static str {
        match self {
            Source::LofiGirl => "lofiGirl",
            Source::Chillhop => "chillhop",
            Source::Custom => "custom",
        }
    }

    fn parse(s: &str) -> Source {
        match s {
            "chillhop" => Source::Chillhop,
            "custom" => Source::Custom,
            _ => Source::LofiGirl,
        }
    }
}

#[derive(Clone, Debug, PartialEq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct MusicSnapshot {
    pub service: Service,
    pub source: Source,
    pub custom_url: Option<String>,
    pub spotify_link: Option<String>,
    pub volume: u8,
    pub playing: bool,
    /// "Track — Artist", Spotify only; read from the app, not stored.
    pub now_playing: Option<String>,
}

impl MusicSnapshot {
    /// Presets are channels opened at `/live`: live-stream video ids go stale when a channel
    /// restarts its stream, but the channel's live page always points at the current one.
    fn youtube_url(&self) -> Option<Url> {
        let url = match self.source {
            Source::LofiGirl => "https://www.youtube.com/@LofiGirl/live",
            Source::Chillhop => "https://www.youtube.com/@ChillhopMusic/live",
            Source::Custom => self.custom_url.as_deref()?,
        };
        url.parse().ok()
    }
}

struct Music {
    snapshot: MusicSnapshot,
    /// When the user last changed something. Spotify's state lags our commands by a moment,
    /// so polls within `COMMAND_SETTLE` of one are ignored rather than undoing it.
    last_command: Instant,
}

const COMMAND_SETTLE: Duration = Duration::from_secs(3);

pub struct MusicState(Mutex<Music>);

/// Loads the saved service, sources and volume at launch. Music always starts paused.
pub fn restore(db: &Db) -> Result<MusicState> {
    let snapshot = load(&db.0.lock().unwrap())?;
    Ok(MusicState(Mutex::new(Music { snapshot, last_command: Instant::now() })))
}

pub fn current(app: &AppHandle) -> MusicSnapshot {
    app.state::<MusicState>().0.lock().unwrap().snapshot.clone()
}

fn publish(app: &AppHandle, before: &MusicSnapshot, after: &MusicSnapshot) {
    let _ = app.emit("music", after);
    // The menu shows play/pause and Next for Spotify; don't rebuild it for volume or track changes.
    if before.playing != after.playing || before.service != after.service {
        crate::tray::refresh(app);
    }
}

/// The single path for user changes, mirroring `timer::apply`: change and save under the lock,
/// release it, then bring the services in line and publish.
fn change(app: &AppHandle, f: impl FnOnce(&mut MusicSnapshot) -> Result<()>) -> Result<MusicSnapshot> {
    let (before, mut after) = {
        let state = app.state::<MusicState>();
        let mut music = state.0.lock().unwrap();
        let before = music.snapshot.clone();
        f(&mut music.snapshot)?;
        if music.snapshot.service != Service::Spotify {
            music.snapshot.now_playing = None;
        }
        save(&app.state::<Db>().0.lock().unwrap(), &music.snapshot)?;
        music.last_command = Instant::now();
        (before, music.snapshot.clone())
    };
    if before == after {
        return Ok(after);
    }
    let synced = youtube::sync(app, &before, &after).and_then(|()| spotify::sync(&before, &after));
    // Restart the settle window now the services have caught up: launching Spotify alone can
    // take longer than `COMMAND_SETTLE`.
    app.state::<MusicState>().0.lock().unwrap().last_command = Instant::now();
    if let Err(e) = synced {
        // The player window failed to open, or Spotify is missing or not permitted: whatever
        // happened, the UI must hear about it, and it mustn't claim music is playing.
        if after.playing {
            after = observe(app, |music| music.snapshot.playing = false).unwrap_or(after);
        }
        publish(app, &before, &after);
        return Err(e);
    }
    publish(app, &before, &after);
    Ok(after)
}

/// Records state read back from a service (Spotify paused in its own window, a new track)
/// without sending anything to it. Returns the new snapshot if it changed.
fn observe(app: &AppHandle, f: impl FnOnce(&mut Music)) -> Option<MusicSnapshot> {
    let (before, after) = {
        let state = app.state::<MusicState>();
        let mut music = state.0.lock().unwrap();
        let before = music.snapshot.clone();
        f(&mut music);
        (before, music.snapshot.clone())
    };
    (before != after).then(|| {
        publish(app, &before, &after);
        after
    })
}

/// Background loop: closes an idle YouTube player, and while Spotify is the service keeps our
/// state in step with the app, since you can pause, skip or change volume in Spotify itself.
pub fn spawn_watcher(app: AppHandle) {
    std::thread::spawn(move || loop {
        std::thread::sleep(spotify::POLL);
        youtube::close_if_idle(&app);
        if current(&app).service != Service::Spotify {
            continue;
        }
        // Read without holding our lock: osascript takes tens of milliseconds.
        let Some(status) = spotify::status() else { continue };
        observe(&app, |music| {
            // Checked under the same lock as the write, so a command that lands while we were
            // reading Spotify can't be overwritten by the older reading.
            let settled = music.last_command.elapsed() >= COMMAND_SETTLE;
            let m = &mut music.snapshot;
            if m.service != Service::Spotify {
                return;
            }
            m.now_playing = status.track.clone();
            if settled {
                m.playing = status.playing;
                // Unknown while Spotify is closed; keep ours for when it opens.
                if let Some(volume) = status.volume {
                    m.volume = volume;
                }
            }
        });
    });
}

pub fn set_playing(app: &AppHandle, playing: bool) -> Result<MusicSnapshot> {
    change(app, |m| {
        if playing && m.service == Service::YouTube && m.youtube_url().is_none() {
            return Err(Error::InvalidInput("add a YouTube link for Custom first"));
        }
        m.playing = playing;
        Ok(())
    })
}

pub fn toggle(app: &AppHandle) -> Result<MusicSnapshot> {
    set_playing(app, !current(app).playing)
}

/// Spotify only; YouTube live streams can't skip.
pub fn skip(app: &AppHandle, forward: bool) -> Result<()> {
    if current(app).service != Service::Spotify {
        return Err(Error::InvalidInput("skipping works with Spotify"));
    }
    spotify::skip(forward)
}

#[tauri::command]
pub fn get_music(app: AppHandle) -> MusicSnapshot {
    current(&app)
}

// Async so they run off the main thread: creating the player window or waiting on osascript
// shouldn't block the UI, and window creation from sync commands can deadlock on some platforms.

#[tauri::command]
pub async fn set_music_playing(app: AppHandle, playing: bool) -> Result<MusicSnapshot> {
    set_playing(&app, playing)
}

#[tauri::command]
pub async fn set_music_volume(app: AppHandle, volume: u8) -> Result<MusicSnapshot> {
    change(&app, |m| {
        m.volume = volume.min(100);
        Ok(())
    })
}

#[tauri::command]
pub async fn set_music_service(app: AppHandle, service: Service) -> Result<MusicSnapshot> {
    change(&app, |m| {
        m.service = service;
        Ok(())
    })
}

/// `custom_url` is only read for `Source::Custom`, and is kept when switching back to a preset.
#[tauri::command]
pub async fn set_music_source(app: AppHandle, source: Source, custom_url: Option<String>) -> Result<MusicSnapshot> {
    let custom_url = custom_url.map(|u| youtube::normalize_url(&u)).transpose()?;
    change(&app, |m| {
        if source == Source::Custom {
            m.custom_url = Some(
                custom_url.or(m.custom_url.take()).ok_or(Error::InvalidInput("paste a YouTube link for Custom"))?,
            );
        }
        m.source = source;
        Ok(())
    })
}

/// An empty link clears it, so Play resumes whatever Spotify last played.
#[tauri::command]
pub async fn set_spotify_link(app: AppHandle, link: String) -> Result<MusicSnapshot> {
    let link = match link.trim() {
        "" => None,
        s => Some(spotify::normalize_link(s)?),
    };
    change(&app, |m| {
        m.spotify_link = link;
        Ok(())
    })
}

#[tauri::command]
pub async fn music_skip(app: AppHandle, forward: bool) -> Result<()> {
    skip(&app, forward)
}

#[tauri::command]
pub async fn youtube_sign_in(app: AppHandle) -> Result<()> {
    youtube::open_sign_in(&app)
}

/// The current YouTube station's artwork for the TV in the scene; None when there's no station
/// or YouTube can't be reached. curl can take seconds, so it runs on a blocking thread.
#[tauri::command]
pub async fn youtube_thumbnail(app: AppHandle) -> Result<Option<String>> {
    let Some(url) = current(&app).youtube_url() else { return Ok(None) };
    tauri::async_runtime::spawn_blocking(move || youtube::thumbnail(&url))
        .await
        .map_err(|e| Error::External(e.to_string()))?
}

/// Async on purpose: reading cookies waits on WebKit, which must not block the main thread.
#[tauri::command]
pub async fn youtube_signed_in(app: AppHandle) -> Result<bool> {
    youtube::signed_in(&app)
}

fn load(conn: &Connection) -> Result<MusicSnapshot> {
    let music = conn.query_row(
        "SELECT music_service, music_source, music_custom_url, spotify_link, music_volume
         FROM settings WHERE id = 1",
        [],
        |row| {
            Ok(MusicSnapshot {
                service: if row.get::<_, String>(0)? == "spotify" { Service::Spotify } else { Service::YouTube },
                source: Source::parse(&row.get::<_, String>(1)?),
                custom_url: row.get(2)?,
                spotify_link: row.get(3)?,
                volume: row.get(4)?,
                playing: false,
                now_playing: None,
            })
        },
    )?;
    Ok(music)
}

fn save(conn: &Connection, m: &MusicSnapshot) -> Result<()> {
    let service = match m.service {
        Service::YouTube => "youtube",
        Service::Spotify => "spotify",
    };
    conn.execute(
        "UPDATE settings
         SET music_service = ?1, music_source = ?2, music_custom_url = ?3, spotify_link = ?4, music_volume = ?5
         WHERE id = 1",
        params![service, m.source.as_str(), m.custom_url, m.spotify_link, m.volume],
    )?;
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn save_and_load_round_trip() {
        let mut conn = Connection::open_in_memory().unwrap();
        crate::db::migrate(&mut conn).unwrap();
        let defaults = load(&conn).unwrap();
        assert_eq!((defaults.service, defaults.source, defaults.volume), (Service::YouTube, Source::LofiGirl, 50));

        let saved = MusicSnapshot {
            service: Service::Spotify,
            source: Source::Custom,
            custom_url: Some("https://www.youtube.com/watch?v=abc".into()),
            spotify_link: Some("spotify:playlist:37i9dQZF1DWWQRwui0ExPn".into()),
            volume: 20,
            playing: true,
            now_playing: Some("Song — Artist".into()),
        };
        save(&conn, &saved).unwrap();
        let loaded = load(&conn).unwrap();
        assert_eq!(
            loaded,
            MusicSnapshot { playing: false, now_playing: None, ..saved },
            "everything but playback state survives a relaunch"
        );
    }
}
