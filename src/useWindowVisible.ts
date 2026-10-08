import { useEffect, useState } from "react";
import { listen } from "@tauri-apps/api/event";
import { getCurrentWindow } from "@tauri-apps/api/window";

/**
 * Whether the main window is on screen. Closing it only hides it (the app lives on in the
 * menu bar), and a login launch starts hidden, so the page can't assume it's being seen.
 */
export function useWindowVisible() {
  const [visible, setVisible] = useState(true);

  useEffect(() => {
    getCurrentWindow().isVisible().then(setVisible);
    const unlisten = listen<boolean>("window-visible", (e) => setVisible(e.payload));
    return () => {
      unlisten.then((stop) => stop());
    };
  }, []);

  return visible;
}
