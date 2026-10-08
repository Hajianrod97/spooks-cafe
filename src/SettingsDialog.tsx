import { useEffect, useState, type FormEvent } from "react";
import { invoke } from "@tauri-apps/api/core";
import type { Settings } from "./types";
import { useModal } from "./useModal";

type DurationKey = "focusMinutes" | "shortBreakMinutes" | "longBreakMinutes" | "longBreakEvery";
type ToggleKey = "chime" | "alwaysOnTop" | "launchAtLogin";

const DURATIONS: [DurationKey, string][] = [
  ["focusMinutes", "Focus (min)"],
  ["shortBreakMinutes", "Short break (min)"],
  ["longBreakMinutes", "Long break (min)"],
  ["longBreakEvery", "Long break every (blocks)"],
];

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
