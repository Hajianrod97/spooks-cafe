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

export interface Todo {
  id: number;
  text: string;
  taskId: number | null;
  /** The tag's name and colour; still set after the task is archived. */
  taskName: string | null;
  taskColor: string | null;
  /** Comes back unticked every day. */
  daily: boolean;
  /** Unix seconds of the tick that makes it done (for a daily, today's); null while open. */
  doneAt: number | null;
}

/** One task's week in the report. Mirrors `report::TaskWeek`. */
export interface TaskWeek {
  taskId: number;
  name: string;
  color: string;
  archived: boolean;
  minutes: number;
  /** The target it had that week. */
  targetMinutes: number;
}

export interface DailyWeek {
  id: number;
  text: string;
  /** Mon..Sun: ticked that day. */
  days: boolean[];
}

export interface WeekReport {
  /** Local Monday 00:00, Unix seconds. */
  weekStart: number;
  /** Whether there are sessions before this week. */
  hasEarlier: boolean;
  tasks: TaskWeek[];
  /** One-time to-dos ticked this week. */
  todosDone: number;
  dailies: DailyWeek[];
}

export interface TrendWeek {
  minutes: number;
  /** null for weeks before the task existed. */
  targetMinutes: number | null;
}

export interface TaskTrend {
  taskId: number;
  name: string;
  color: string;
  archived: boolean;
  /** Eight weeks, oldest first; the last is this week so far. */
  weeks: TrendWeek[];
}

export interface Streak {
  current: number;
  longest: number;
}

export interface TrendsReport {
  /** Local midnight of the heatmap's first day (a Monday), Unix seconds. */
  firstDay: number;
  /** Minutes per day from firstDay through today. */
  days: number[];
  tasks: TaskTrend[];
  /** Days with at least one completed block. */
  focusStreak: Streak;
  dailies: { id: number; text: string; streak: Streak }[];
  insights: {
    /** 0 = Monday. */
    bestWeekday: number | null;
    /** 0–23. */
    bestHour: number | null;
    completionRate: number | null;
    /** Minutes. */
    averageActiveDay: number | null;
  };
}

/** The cafe shop's state, from `get_shop` and the `shop` event. */
export interface Shop {
  balance: number;
  /** How many more to-do ticks pay beans today. */
  todoBeansLeft: number;
  owned: string[];
  /** Slot id → item id. */
  placements: Record<string, string>;
  hat: string | null;
}
