import { useEffect, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import type { MusicSnapshot } from "./types";

/**
 * Mirrors the Rust music state, like `useTimer`: fetch once, then follow `"music"` events,
 * which fire for changes from the window and the menu bar alike.
 */
export function useMusic() {
  const [music, setMusic] = useState<MusicSnapshot | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    invoke<MusicSnapshot>("get_music").then(setMusic);
    const unlisteners = [
      listen<MusicSnapshot>("music", (e) => {
        setMusic(e.payload);
        setError("");
      }),
      listen<string>("music-error", (e) => setError(e.payload)),
    ];
    return () => {
      unlisteners.forEach((p) => p.then((stop) => stop()));
    };
  }, []);

  /** Runs a music command and resolves to whether it worked; the new state arrives via the event. */
  const call = (cmd: string, args?: Record<string, unknown>) =>
    invoke(cmd, args).then(
      () => {
        setError("");
        return true;
      },
      (e) => {
        setError(String(e));
        return false;
      },
    );

  return { music, error, call };
}
