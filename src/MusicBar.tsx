import { useEffect, useRef, useState } from "react";
import type { MusicService, MusicSnapshot, MusicSource } from "./types";
import type { useMusic } from "./useMusic";

const SERVICES: [MusicService, string][] = [
  ["youTube", "YouTube"],
  ["spotify", "Spotify"],
];

const SOURCES: [MusicSource, string][] = [
  ["lofiGirl", "Lofi Girl"],
  ["chillhop", "Chillhop"],
  ["custom", "Custom link…"],
];

type Call = (cmd: string, args?: Record<string, unknown>) => Promise<boolean>;

const Icon = ({ d, filled = false }: { d: string; filled?: boolean }) => (
  <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true"
    fill={filled ? "currentColor" : "none"} stroke={filled ? "none" : "currentColor"}
    strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
    <path d={d} />
  </svg>
);
const PLAY = "M8 5v14l11-7z";
const PAUSE = "M7 5h3.5v14H7zM13.5 5H17v14h-3.5z";
const PREV = "M18 6v12L9.5 12zM7 6v12";
const NEXT = "M6 6v12l8.5-6zM17 6v12";
const EDIT = "M4 20h4L19 9l-4-4L4 16v4ZM13.5 6.5l4 4";
const VOLUME = "M4 9v6h4l5 4V5L8 9zM17 9a4 4 0 0 1 0 6";

/** The music strip under the scene. Takes `useMusic()` from App, which shares it with the scene. */
export function MusicBar({ music, error, call }: ReturnType<typeof useMusic>) {
  // The slider moves locally and sends once dragging pauses: every send is a database write,
  // and for Spotify an osascript process.
  const [volume, setVolume] = useState<number | null>(null);
  const pending = useRef<number | undefined>(undefined);
  const moves = useRef(0);
  useEffect(() => () => clearTimeout(pending.current), []);

  if (!music) return null;
  const changeVolume = (value: number) => {
    setVolume(value);
    const move = ++moves.current;
    clearTimeout(pending.current);
    pending.current = window.setTimeout(() => {
      // Hand the slider back to the backend's value only if the user hasn't moved it since.
      call("set_music_volume", { volume: value }).then(() => moves.current === move && setVolume(null));
    }, 150);
  };
  const spotify = music.service === "spotify";

  return (
    <section className="music" aria-label="Music">
      <div className="transport">
        {spotify && (
          <button className="icon-button" aria-label="Previous track" onClick={() => call("music_skip", { forward: false })}>
            <Icon d={PREV} filled />
          </button>
        )}
        <button
          className="play"
          aria-label={music.playing ? "Pause music" : "Play music"}
          onClick={() => call("set_music_playing", { playing: !music.playing })}
        >
          <Icon d={music.playing ? PAUSE : PLAY} filled />
        </button>
        {spotify && (
          <button className="icon-button" aria-label="Next track" onClick={() => call("music_skip", { forward: true })}>
            <Icon d={NEXT} filled />
          </button>
        )}
      </div>

      {spotify ? <SpotifyTrack music={music} call={call} /> : <YouTubeTrack music={music} call={call} />}

      <div className="music-settings">
        <div className="segmented" role="radiogroup" aria-label="Music service">
          {SERVICES.map(([service, label]) => (
            <button
              key={service}
              role="radio"
              aria-checked={music.service === service}
              onClick={() => call("set_music_service", { service })}
            >
              {label}
            </button>
          ))}
        </div>
        <label className="volume">
          <Icon d={VOLUME} />
          <input
            type="range"
            min="0"
            max="100"
            aria-label="Volume"
            value={volume ?? music.volume}
            onChange={(e) => changeVolume(Number(e.target.value))}
          />
        </label>
      </div>

      {error && <p className="error">{error}</p>}
    </section>
  );
}

const status = (music: MusicSnapshot, where: string) => (music.playing ? `Playing ${where}` : "Paused");

function YouTubeTrack({ music, call }: { music: MusicSnapshot; call: Call }) {
  const [editingUrl, setEditingUrl] = useState(false);

  function pickSource(source: MusicSource) {
    if (source === "custom" && !music.customUrl) return setEditingUrl(true);
    setEditingUrl(false);
    call("set_music_source", { source });
  }

  return (
    <>
      <div className="track">
        <div className="track-text">
          <span className="track-title">
            <select
              aria-label="YouTube station"
              value={editingUrl ? "custom" : music.source}
              onChange={(e) => pickSource(e.target.value as MusicSource)}
            >
              {SOURCES.map(([value, label]) => (
                <option key={value} value={value}>{label}</option>
              ))}
            </select>
            <svg width="12" height="12" viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
              <path d="m6 9 6 6 6-6" />
            </svg>
          </span>
          <span className="track-sub">YouTube · {status(music, "on the TV")}</span>
        </div>
        {music.source === "custom" && music.customUrl && !editingUrl && (
          <button className="icon-button" aria-label="Change link" onClick={() => setEditingUrl(true)}>
            <Icon d={EDIT} />
          </button>
        )}
      </div>
      {editingUrl && (
        <LinkForm
          initial={music.customUrl ?? ""}
          placeholder="YouTube video, playlist or channel link"
          onSubmit={(url) => call("set_music_source", { source: "custom", customUrl: url })}
          onDone={() => setEditingUrl(false)}
        />
      )}
    </>
  );
}

function SpotifyTrack({ music, call }: { music: MusicSnapshot; call: Call }) {
  const [editing, setEditing] = useState(false);
  const title = music.nowPlaying ?? (music.spotifyLink ? "Your playlist" : "Resumes what Spotify last played");
  return (
    <>
      <div className="track">
        <div className="track-text">
          <span className="track-title" title={title}>{title}</span>
          <span className="track-sub">Spotify · {status(music, "in Spotify")}</span>
        </div>
        {!editing && (
          <button className="icon-button" aria-label="Choose playlist" onClick={() => setEditing(true)}>
            <Icon d={EDIT} />
          </button>
        )}
      </div>
      {editing && (
        <LinkForm
          initial={music.spotifyLink ?? ""}
          placeholder="Spotify playlist or album link (empty: resume)"
          onSubmit={(link) => call("set_spotify_link", { link })}
          onDone={() => setEditing(false)}
        />
      )}
    </>
  );
}

interface LinkFormProps {
  initial: string;
  placeholder: string;
  onSubmit: (value: string) => Promise<boolean>;
  onDone: () => void;
}

/** A one-field form that stays open (showing the error) until the link is accepted. */
function LinkForm({ initial, placeholder, onSubmit, onDone }: LinkFormProps) {
  const [value, setValue] = useState(initial);
  useEffect(() => setValue(initial), [initial]);
  return (
    <form
      className="link-form"
      onSubmit={(e) => {
        e.preventDefault();
        onSubmit(value).then((ok) => ok && onDone());
      }}
    >
      <input autoFocus placeholder={placeholder} value={value} onChange={(e) => setValue(e.target.value)} />
      <button type="submit">Use</button>
      <button type="button" onClick={onDone}>Cancel</button>
    </form>
  );
}
