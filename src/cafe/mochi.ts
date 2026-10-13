import type { Pose } from "./Spook";
import type { SceneName } from "./scenes";
import curled from "../assets/spook/mochi-curled.svg";
import petted from "../assets/spook/mochi-petted.svg";

/** Mochi, the ghost cat. Drawn by design/spook/build.mjs at Spook's scale, base on the bottom edge. */
const ART = {
  curled: { src: curled, width: 96, height: 58, alt: "Mochi the ghost cat, curled up asleep" },
  petted: { src: petted, width: 84, height: 88, alt: "Mochi the ghost cat, purring while Spook pets it" },
};

export interface MochiSpot {
  /** Stage coordinates of the bottom centre. */
  x: number;
  y: number;
  /** "back": on the back wall's furniture, behind Spook; "front": in front of him. */
  layer: "back" | "front";
}

// Clear of the sign, the buttons, the decoration slots and the seats kept for ghost customers.
export const MOCHI_SPOTS: Record<SceneName, MochiSpot> = {
  counter: { x: 352, y: 173, layer: "back" }, // the window sill, beside the plant
  tables: { x: 408, y: 246, layer: "front" }, // the left end of Spook's table
  // The doorstep at Spook's lower left; behind him, so his petting mitt lands on top of its head.
  outside: { x: 404, y: 272, layer: "back" },
};

/** Asleep everywhere, except outside on a break, when Spook pets it awake. */
export function mochiArt(scene: SceneName, pose: Pose) {
  return scene === "outside" && pose === "break" ? ART.petted : ART.curled;
}

/** The page shows Mochi at the same 0.75 scale as Spook. */
export const MOCHI_SCALE = 0.75;
