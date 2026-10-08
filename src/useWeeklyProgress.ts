import { useCallback, useEffect, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import type { Phase, TaskProgress } from "./types";

/**
 * This week's logged time per task id. The timer only logs a session when a focus block ends
 * (completed or discarded), which always changes the phase, so that's when to refetch.
 * Session edits happen outside the timer, so their callers use `reload`.
 */
export function useWeeklyProgress(phase: Phase | undefined) {
  const [progress, setProgress] = useState(new Map<number, TaskProgress>());

  const reload = useCallback(() => {
    invoke<TaskProgress[]>("weekly_progress").then((rows) =>
      setProgress(new Map(rows.map((r) => [r.taskId, r]))),
    );
  }, []);

  useEffect(reload, [phase, reload]);

  return { progress, reload };
}
