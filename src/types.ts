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

export interface Settings {
  focusMinutes: number;
  shortBreakMinutes: number;
  longBreakMinutes: number;
  longBreakEvery: number;
  chime: boolean;
  alwaysOnTop: boolean;
  launchAtLogin: boolean;
  /** Hours (0–23) when each time of day starts; each runs until the next, night wraps. */
  morningStart: number;
  afternoonStart: number;
  eveningStart: number;
  nightStart: number;
  sceneTime: SceneTime;
}

export type TimeOfDay = "morning" | "afternoon" | "evening" | "night";
/** "auto" follows the clock; a time of day pins the scene to it. */
export type SceneTime = "auto" | TimeOfDay;

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
  /** This week. */
  minutes: number;
  /** This week. */
  pomodoros: number;
  allTimeMinutes: number;
}

export interface Session {
  id: number;
  taskId: number;
  taskName: string;
  taskColor: string;
  taskArchived: boolean;
  /** Unix seconds. */
  startedAt: number;
  durationMinutes: number;
  completed: boolean;
  note: string | null;
}

export type SessionEdit = Pick<Session, "taskId" | "durationMinutes" | "note">;

export type MusicService = "youTube" | "spotify";
/** The YouTube preset. */
export type MusicSource = "lofiGirl" | "chillhop" | "custom";

export interface MusicSnapshot {
  service: MusicService;
  source: MusicSource;
  customUrl: string | null;
  /** A `spotify:playlist:…` / `spotify:album:…` URI; null resumes what Spotify last played. */
  spotifyLink: string | null;
  /** 0–100. */
  volume: number;
  playing: boolean;
  /** "Track — Artist", Spotify only. */
  nowPlaying: string | null;
}
