import { useEffect, useState, type FormEvent } from "react";
import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import type { SceneTime, Settings } from "./types";
import { useModal } from "./useModal";

type DurationKey = "focusMinutes" | "shortBreakMinutes" | "longBreakMinutes" | "longBreakEvery";
type ToggleKey = "chime" | "alwaysOnTop" | "launchAtLogin";

const DURATIONS: [DurationKey, string][] = [
  ["focusMinutes", "Focus (min)"],
  ["shortBreakMinutes", "Short break (min)"],
  ["longBreakMinutes", "Long break (min)"],
  ["longBreakEvery", "Long break every (blocks)"],
];

type StartKey = "morningStart" | "afternoonStart" | "eveningStart" | "nightStart";

const DAY_STARTS: [StartKey, string][] = [
  ["morningStart", "Morning starts"],
  ["afternoonStart", "Afternoon starts"],
  ["eveningStart", "Evening starts"],
  ["nightStart", "Night starts"],
];

const SCENE_TIMES: [SceneTime, string][] = [
  ["auto", "Follow the clock"],
  ["morning", "Always morning"],
  ["afternoon", "Always afternoon"],
  ["evening", "Always evening"],
  ["night", "Always night"],
];

const HOURS = Array.from({ length: 24 }, (_, h) => h);
const hourLabel = (h: number) => `${String(h).padStart(2, "0")}:00`;

const TOGGLES: [ToggleKey, string, string?][] = [
  ["chime", "Chime when a phase ends"],
  ["alwaysOnTop", "Keep window on top"],
  ["launchAtLogin", "Launch at login", "Starts in the menu bar only"],
];

export function SettingsDialog({ onClose }: { onClose: () => void }) {
  const dialog = useModal();
  const [settings, setSettings] = useState<Settings | null>(null);
  // Durations are edited as text so a field can be empty mid-edit.
  const [durations, setDurations] = useState<Record<DurationKey, string> | null>(null);
  const [error, setError] = useState("");
  const [signedIn, setSignedIn] = useState<boolean | null>(null);

  // Re-checked when the sign-in window closes, since that's when the login may have changed.
  useEffect(() => {
    const check = () => invoke<boolean>("youtube_signed_in").then(setSignedIn, () => setSignedIn(false));
    check();
    const unlisten = listen("youtube-auth", check);
    return () => {
      unlisten.then((stop) => stop());
    };
  }, []);

  useEffect(() => {
    invoke<Settings>("get_settings").then((s) => {
      setSettings(s);
      setDurations(Object.fromEntries(DURATIONS.map(([k]) => [k, String(s[k])])) as Record<DurationKey, string>);
    }, (e) => setError(String(e)));
  }, []);

  function save(e: FormEvent) {
    e.preventDefault();
    if (!settings || !durations) return;
    const parsed = Object.fromEntries(DURATIONS.map(([k]) => [k, Number(durations[k])]));
    if (Object.values(parsed).some((n) => !Number.isInteger(n) || n < 1)) {
      return setError("Durations must be whole numbers of at least 1.");
    }
    const starts = DAY_STARTS.map(([k]) => settings[k]);
    if (starts.some((h, i) => i > 0 && h <= starts[i - 1])) {
      return setError("Times of day must start in order: morning, afternoon, evening, night.");
    }
    invoke("update_settings", { settings: { ...settings, ...parsed } }).then(
      () => dialog.current?.close(),
      (e) => setError(String(e)),
    );
  }

  return (
    <dialog ref={dialog} className="editor" onClose={onClose}>
      <form onSubmit={save}>
        <h2>Settings</h2>
        {settings && durations && (
          <>
            <fieldset>
              <legend>Pomodoro defaults</legend>
              <div className="grid">
                {DURATIONS.map(([key, label]) => (
                  <label key={key}>
                    {label}
                    <input
                      type="number"
                      min="1"
                      value={durations[key]}
                      onChange={(e) => setDurations({ ...durations, [key]: e.target.value })}
                    />
                  </label>
                ))}
              </div>
              <p className="hint">Tasks with their own override keep it. Applies from the next block.</p>
            </fieldset>

            {TOGGLES.map(([key, label, hint]) => (
              <label key={key} className="toggle">
                <input
                  type="checkbox"
                  checked={settings[key]}
                  onChange={(e) => setSettings({ ...settings, [key]: e.target.checked })}
                />
                <span>
                  {label}
                  {hint && <span className="hint"> · {hint}</span>}
                </span>
              </label>
            ))}
            <fieldset className="scene">
              <legend>Scene</legend>
              <label>
                Time of day
                <select
                  value={settings.sceneTime}
                  onChange={(e) => setSettings({ ...settings, sceneTime: e.target.value as SceneTime })}
                >
                  {SCENE_TIMES.map(([value, label]) => (
                    <option key={value} value={value}>{label}</option>
                  ))}
                </select>
              </label>
              <div className="grid">
                {DAY_STARTS.map(([key, label]) => (
                  <label key={key}>
                    {label}
                    <select
                      value={settings[key]}
                      onChange={(e) => setSettings({ ...settings, [key]: Number(e.target.value) })}
                    >
                      {HOURS.map((h) => (
                        <option key={h} value={h}>{hourLabel(h)}</option>
                      ))}
                    </select>
                  </label>
                ))}
              </div>
              <p className="hint">Each lasts until the next starts; night runs past midnight to morning.</p>
            </fieldset>

            <fieldset>
              <legend>Music</legend>
              <div className="signin">
                {signedIn && <span>✓ Signed in to YouTube</span>}
                <button
                  type="button"
                  disabled={signedIn === null}
                  onClick={() => invoke("youtube_sign_in").catch((e) => setError(String(e)))}
                >
                  {signedIn ? "Switch account" : "Sign in to YouTube"}
                </button>
              </div>
              {!signedIn && (
                <p className="hint">Once, so YouTube Premium plays ad-free. Close the window when you're done.</p>
              )}
            </fieldset>
          </>
        )}

        {error && <p className="error">{error}</p>}

        <div className="actions">
          <span className="spacer" />
          <button type="button" onClick={() => dialog.current?.close()}>Cancel</button>
          <button type="submit" disabled={!settings}>Save</button>
        </div>
      </form>
    </dialog>
  );
}
