import { useEffect, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import type { Settings } from "./types";

/** The saved settings, kept current by the `settings` event that `update_settings` emits. */
export function useSettings() {
  const [settings, setSettings] = useState<Settings | null>(null);

  useEffect(() => {
    invoke<Settings>("get_settings").then(setSettings);
    const unlisten = listen<Settings>("settings", (e) => setSettings(e.payload));
    return () => {
      unlisten.then((stop) => stop());
    };
  }, []);

  return settings;
}
