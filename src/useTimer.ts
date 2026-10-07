import { useEffect, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import type { TimerSnapshot } from "./types";

/**
 * Mirrors the Rust timer: fetch the current state once, then follow its events.
 * `tickError` is set when the background loop fails (e.g. a session can't be saved)
 * and clears on the next successful update.
 */
export function useTimer() {
  const [timer, setTimer] = useState<TimerSnapshot | null>(null);
  const [tickError, setTickError] = useState("");

  useEffect(() => {
    invoke<TimerSnapshot>("get_timer").then(setTimer);
    const unlisteners = [
      listen<TimerSnapshot>("timer", (e) => {
        setTimer(e.payload);
        setTickError("");
      }),
      listen<string>("timer-error", (e) => setTickError(e.payload)),
    ];
    return () => {
      unlisteners.forEach((p) => p.then((stop) => stop()));
    };
  }, []);

  return { timer, tickError };
}
