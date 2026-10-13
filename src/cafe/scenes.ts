import type { TimeOfDay } from "../types";
import { COUNTER_POSES, OUTSIDE_POSES, TABLE_POSES, type PoseSet } from "./Spook";
import outsideBack from "../assets/cafe/outside-back.svg";
import outsideGlow from "../assets/cafe/outside-glow.svg";
import outsideSkyAfternoon from "../assets/cafe/outside-sky-afternoon.svg";
import outsideSkyEvening from "../assets/cafe/outside-sky-evening.svg";
import outsideSkyMorning from "../assets/cafe/outside-sky-morning.svg";
import outsideSkyNight from "../assets/cafe/outside-sky-night.svg";
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
  /** What hides Spook's lower half (counter, table top); none where he floats in full view. */
  front?: string;
  sky: Record<TimeOfDay, string>;
  /** Spook's art for each pose here: what he does depends on where he is. */
  poses: PoseSet;
  /** The window opening in stage coordinates (960×340), where the rain falls. */
  window: { x: number; y: number; w: number; h: number };
  /** Lit windows and lamps, shown above the room tint in the evening and at night. */
  glow?: string;
  /** How far below his usual spot Spook floats here, in stage px (his hat, notes and glow follow). */
  spookDrop?: number;
  /** Text painted on boards drawn in the back layer (stage coordinates of each board's face). */
  lettering?: { text: string; x: number; y: number; w: number; h: number }[];
}

/** Left to right, as the ◀ ▶ arrows step; all art comes from design/cafe/build.mjs. */
export const SCENES: SceneArt[] = [
  {
    name: "outside",
    label: "the street",
    back: outsideBack,
    sky: { morning: outsideSkyMorning, afternoon: outsideSkyAfternoon, evening: outsideSkyEvening, night: outsideSkyNight },
    poses: OUTSIDE_POSES,
    // The sky is the whole background here, so rain falls everywhere it shows.
    window: { x: 0, y: 0, w: 960, h: 288 },
    glow: outsideGlow,
    // Nothing hides him here, so he floats lower in the doorway, nearer its floor.
    spookDrop: 16,
    // Over the name board in design/cafe/build.mjs (NAME_BOARDS).
    lettering: [{ text: "Spook's Cafe", x: 296, y: 74, w: 100, h: 32 }],
  },
  {
    name: "counter",
    label: "the counter",
    back: roomBack,
    front: roomFront,
    sky: { morning: skyMorning, afternoon: skyAfternoon, evening: skyEvening, night: skyNight },
    poses: COUNTER_POSES,
    window: { x: 274, y: 44, w: 132, h: 122 },
  },
  {
    name: "tables",
    label: "the tables",
    back: tablesBack,
    front: tablesFront,
    sky: { morning: tablesSkyMorning, afternoon: tablesSkyAfternoon, evening: tablesSkyEvening, night: tablesSkyNight },
    poses: TABLE_POSES,
    window: { x: 84, y: 24, w: 124, h: 128 },
  },
];
