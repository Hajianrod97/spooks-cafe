import { useEffect, useRef, useState } from "react";
import type { MusicService, MusicSnapshot, MusicSource } from "./types";
import { useMusic } from "./useMusic";

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

export function MusicBar() {
  const { music, error, call } = useMusic();
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
    <section className="music">
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

      <div className="row">
        {spotify && <button className="icon" aria-label="Previous track" onClick={() => call("music_skip", { forward: false })}>⏮</button>}
        <button
          className="play"
          aria-label={music.playing ? "Pause music" : "Play music"}
          onClick={() => call("set_music_playing", { playing: !music.playing })}
        >
          {music.playing ? "⏸" : "▶"}
        </button>
        {spotify && <button className="icon" aria-label="Next track" onClick={() => call("music_skip", { forward: true })}>⏭</button>}
        <input
          type="range"
          min="0"
          max="100"
          aria-label="Volume"
          value={volume ?? music.volume}
          onChange={(e) => changeVolume(Number(e.target.value))}
        />
      </div>

      {spotify ? <SpotifyControls music={music} call={call} /> : <YouTubeControls music={music} call={call} />}
      {error && <p className="error">{error}</p>}
    </section>
  );
}

function YouTubeControls({ music, call }: { music: MusicSnapshot; call: Call }) {
  const [editingUrl, setEditingUrl] = useState(false);

  function pickSource(source: MusicSource) {
    if (source === "custom" && !music.customUrl) return setEditingUrl(true);
    setEditingUrl(false);
    call("set_music_source", { source });
  }

  return (
    <>
      <div className="row">
        <select value={editingUrl ? "custom" : music.source} onChange={(e) => pickSource(e.target.value as MusicSource)}>
          {SOURCES.map(([value, label]) => (
            <option key={value} value={value}>{label}</option>
          ))}
        </select>
        {music.source === "custom" && music.customUrl && !editingUrl && (
          <button className="icon" aria-label="Change link" onClick={() => setEditingUrl(true)}>✎</button>
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

function SpotifyControls({ music, call }: { music: MusicSnapshot; call: Call }) {
  const [editing, setEditing] = useState(false);
  return (
    <>
      <div className="row now-playing">
        <span className="hint">{music.nowPlaying ?? (music.spotifyLink ? "Your playlist" : "Resumes what Spotify last played")}</span>
        {!editing && (
          <button className="icon" aria-label="Choose playlist" onClick={() => setEditing(true)}>✎</button>
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
      className="row"
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
