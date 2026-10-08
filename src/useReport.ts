import { useEffect, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import type { Phase, Todo } from "./types";

/**
 * A report command's result. Refetched when its arguments change, when a block is logged
 * (the phase changes) and when a to-do changes.
 */
export function useReport<T>(command: string, args: Record<string, unknown>, phase: Phase, todos: Todo[]) {
  const [report, setReport] = useState<T | null>(null);
  const [error, setError] = useState("");
  // Compared by value: callers pass a fresh object every render.
  const key = JSON.stringify(args);

  useEffect(() => {
    // Replies can arrive out of order (e.g. stepping through weeks quickly); only the latest counts.
    let current = true;
    invoke<T>(command, JSON.parse(key)).then(
      (r) => {
        if (!current) return;
        setReport(r);
        setError("");
      },
      (e) => current && setError(String(e)),
    );
    return () => {
      current = false;
    };
  }, [command, key, phase, todos]);

  return { report, error };
}
