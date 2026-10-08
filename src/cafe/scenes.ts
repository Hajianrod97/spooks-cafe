import type { TimeOfDay } from "../types";
import roomBack from "../assets/cafe/room-back.svg";
import roomFront from "../assets/cafe/room-front.svg";
import skyAfternoon from "../assets/cafe/sky-afternoon.svg";
import skyEvening from "../assets/cafe/sky-evening.svg";
import skyMorning from "../assets/cafe/sky-morning.svg";
import skyNight from "../assets/cafe/sky-night.svg";
import tablesBack from "../assets/cafe/tables-back.svg";
import tablesFront from "../assets/cafe/tables-front.svg";
import tablesSkyAfternoon from "../assets/cafe/tables-sky-afternoon.svg";
import tablesSkyEvening from "../assets/cafe/tables-sky-evening.svg";
import tablesSkyMorning from "../assets/cafe/tables-sky-morning.svg";
import tablesSkyNight from "../assets/cafe/tables-sky-night.svg";

/** Mirrors the Rust `Scene` enum. */
export type SceneName = "outside" | "counter" | "tables";

export interface SceneArt {
  name: SceneName;
  /** For the arrow that leads here: "Go to the tables". */
  label: string;
  /** Walls and floor, with the window as a hole; Spook goes between back and front. */
  back: string;
  front: string;
  sky: Record<TimeOfDay, string>;
  /** The window opening in stage coordinates (960×340), where the rain falls. */
  window: { x: number; y: number; w: number; h: number };
}

/**
 * Left to right, as the camera pans. The outside scene (a practice ticket in SPEC.md) goes
 * first; its art comes from design/cafe/build.mjs like these.
 */
export const SCENES: SceneArt[] = [
  {
    name: "counter",
    label: "the counter",
    back: roomBack,
    front: roomFront,
    sky: { morning: skyMorning, afternoon: skyAfternoon, evening: skyEvening, night: skyNight },
    window: { x: 274, y: 44, w: 132, h: 122 },
  },
  {
    name: "tables",
    label: "the tables",
    back: tablesBack,
    front: tablesFront,
    sky: { morning: tablesSkyMorning, afternoon: tablesSkyAfternoon, evening: tablesSkyEvening, night: tablesSkyNight },
    window: { x: 78, y: 34, w: 136, h: 150 },
  },
];
