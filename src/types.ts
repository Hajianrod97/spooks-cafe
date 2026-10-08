// Mirrors the Rust structs serialized by Tauri commands (camelCase via serde).
export interface Task {
  id: number;
  name: string;
  color: string;
  weeklyTargetMinutes: number;
  totalTargetMinutes: number | null;
  focusMinutes: number | null;
  shortBreakMinutes: number | null;
  longBreakMinutes: number | null;
  archived: boolean;
}

/** The editable fields of a task, as sent to `create_task` / `update_task`. */
export type TaskInput = Omit<Task, "id" | "archived">;

export type Phase = "idle" | "focus" | "shortBreak" | "longBreak";

export interface TimerSnapshot {
  phase: Phase;
  taskId: number | null;
  running: boolean;
  remainingSecs: number;
  lengthSecs: number;
  focusStreak: number;
}

export interface TaskProgress {
  taskId: number;
  minutes: number;
  pomodoros: number;
}
