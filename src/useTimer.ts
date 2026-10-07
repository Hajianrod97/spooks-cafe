import { useEffect, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import type { TimerSnapshot } from "./types";

/** Mirrors the Rust timer: fetch the current state once, then follow its "timer" events. */
export function useTimer() {
  const [timer, setTimer] = useState<TimerSnapshot | null>(null);

  useEffect(() => {
    invoke<TimerSnapshot>("get_timer").then(setTimer);
    const unlisten = listen<TimerSnapshot>("timer", (e) => setTimer(e.payload));
    return () => {
      unlisten.then((stop) => stop());
    };
  }, []);

  return timer;
}
