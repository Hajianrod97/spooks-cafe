import { useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import "./App.css";

// Point at channels, not video IDs: live stream IDs change whenever a stream restarts.
const PRESETS = {
  "Lofi Girl": { handle: "LofiGirl", channelId: "UCSJ4gkVC6NrvII8umztf0Ow" },
  Chillhop: { handle: "ChillhopMusic", channelId: "UCOxqgCwgOqC2lMqC5PYz_Dg" },
};
type PresetName = keyof typeof PRESETS;

type PlayerAction =
  | { type: "play" }
  | { type: "pause" }
  | { type: "toggle" }
  | { type: "setVolume"; level: number };

function App() {
  const [presetName, setPresetName] = useState<PresetName>("Lofi Girl");
  const preset = PRESETS[presetName];
  const [showIframe, setShowIframe] = useState(false);
  // Diagnostic: empty = embed by channel; otherwise embed this exact video ID.
  const [iframeVideoId, setIframeVideoId] = useState("");
  const [volume, setVolume] = useState(50);
  const [error, setError] = useState("");

  const iframeSrc = new URL(
    iframeVideoId
      ? `https://www.youtube.com/embed/${iframeVideoId}`
      : "https://www.youtube.com/embed/live_stream",
  );
  if (!iframeVideoId) iframeSrc.searchParams.set("channel", preset.channelId);
  iframeSrc.searchParams.set("autoplay", "1");
  iframeSrc.searchParams.set("enablejsapi", "1");
  iframeSrc.searchParams.set("origin", window.location.origin);

  const call = (cmd: string, args?: Record<string, unknown>) =>
    invoke(cmd, args).then(() => setError(""), (e) => setError(String(e)));

  const control = (action: PlayerAction) => call("player_control", { action });

  return (
    <main className="container">
      <h1>YouTube spike</h1>
      <p className="origin">Page origin: <code>{window.location.origin}</code></p>

      <section>
        <label>
          Video:{" "}
          <select value={presetName} onChange={(e) => setPresetName(e.target.value as PresetName)}>
            {Object.keys(PRESETS).map((name) => (
              <option key={name}>{name}</option>
            ))}
          </select>
        </label>{" "}
        <button onClick={() => call("open_signin")}>Sign in to Google</button>
      </section>

      <section>
        <h2>Approach 1 — IFrame embed</h2>
        <button onClick={() => setShowIframe((s) => !s)}>
          {showIframe ? "Remove iframe" : "Load iframe"}
        </button>
        <input
          value={iframeVideoId}
          onChange={(e) => setIframeVideoId(e.target.value.trim())}
          placeholder="Video ID (blank = by channel)"
        />
        {showIframe && (
          <iframe
            width="560"
            height="315"
            src={iframeSrc.href}
            referrerPolicy="strict-origin-when-cross-origin"
            allow="autoplay; encrypted-media; picture-in-picture"
            allowFullScreen
          />
        )}
      </section>

      <section>
        <h2>Approach 2 — Dedicated window</h2>
        <div className="row">
          <button onClick={() => call("open_player", { url: `https://www.youtube.com/@${preset.handle}/live` })}>
            Open player
          </button>
          <button onClick={() => control({ type: "play" })}>Play</button>
          <button onClick={() => control({ type: "pause" })}>Pause</button>
          <button onClick={() => control({ type: "toggle" })}>Toggle</button>
          <button onClick={() => call("set_player_visible", { visible: false })}>Hide</button>
          <button onClick={() => call("set_player_visible", { visible: true })}>Show</button>
        </div>
        <label>
          Volume {volume}
          <input
            type="range" min={0} max={100} value={volume}
            onChange={(e) => setVolume(+e.target.value)}
            onMouseUp={() => control({ type: "setVolume", level: volume })}
          />
        </label>
      </section>

      {error && <p className="error">{error}</p>}
    </main>
  );
}

export default App;
