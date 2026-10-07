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

export type Phase = "idle" | "focus" | "shortBreak" | "longBreak";

export interface TimerSnapshot {
  phase: Phase;
  taskId: number | null;
  running: boolean;
  remainingSecs: number;
  lengthSecs: number;
  focusStreak: number;
}
