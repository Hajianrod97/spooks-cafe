import { useEffect, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import type { MusicSnapshot } from "../types";

/**
 * The current YouTube station's artwork for the TV, or null (Spotify, offline, no station).
 * Rust fetches it, so it's asked for only when the station changes, not on every music event.
 */
export function useTvThumbnail(music: MusicSnapshot | null) {
  const [thumbnail, setThumbnail] = useState<string | null>(null);
  const station = music?.service === "youTube" ? `${music.source} ${music.customUrl ?? ""}` : null;

  useEffect(() => {
    setThumbnail(null);
    if (station === null) return;
    // A slow answer for a station we've since left must not overwrite the new one.
    let current = true;
    invoke<string | null>("youtube_thumbnail").then(
      (url) => current && setThumbnail(url),
      () => current && setThumbnail(null),
    );
    return () => {
      current = false;
    };
  }, [station]);

  return thumbnail;
}
