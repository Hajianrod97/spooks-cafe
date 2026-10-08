import { useEffect, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import type { Phase, TaskProgress } from "./types";

/**
 * This week's logged time per task id. Sessions are only logged when a focus block ends
 * (completed or discarded), which always changes the phase, so that's when to refetch.
 */
export function useWeeklyProgress(phase: Phase | undefined) {
  const [progress, setProgress] = useState(new Map<number, TaskProgress>());

  useEffect(() => {
    invoke<TaskProgress[]>("weekly_progress").then((rows) =>
      setProgress(new Map(rows.map((r) => [r.taskId, r]))),
    );
  }, [phase]);

  return progress;
}
