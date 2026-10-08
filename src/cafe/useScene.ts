import { useEffect, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import type { SceneName } from "./scenes";

/**
 * The scene the window shows, saved in the db so it's the same after a relaunch. Only this
 * window changes it, so it's plain React state that writes through, with no event to follow.
 */
export function useScene() {
  const [scene, setScene] = useState<SceneName>("counter");
  // Transitions start with the first switch, so opening on the tables doesn't pan there.
  const [switched, setSwitched] = useState(false);

  useEffect(() => {
    invoke<SceneName>("get_scene").then(setScene, () => {});
  }, []);

  const goTo = (next: SceneName) => {
    setSwitched(true);
    setScene(next);
    invoke("set_scene", { scene: next }).catch(() => {});
  };

  return { scene, goTo, switched };
}
