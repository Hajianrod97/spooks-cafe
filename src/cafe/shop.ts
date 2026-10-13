import type { SceneName } from "./scenes";
import type { Pose } from "./Spook";
import pumpkin from "../assets/shop/pumpkin.svg";
import pumpkinGlow from "../assets/shop/pumpkin-glow.svg";

// Prices and the rules live in Rust (src-tauri/src/shop.rs); ids here must match it.

export interface HatItem {
  id: string;
  kind: "hat";
  name: string;
  price: number;
}

export interface DecorItem {
  id: string;
  kind: "surface";
  name: string;
  price: number;
  /** Drawn at scene scale with its base on the bottom edge (design/shop/build.mjs). */
  art: string;
  width: number;
  height: number;
  /** Lit parts, drawn above the time-of-day tint in the evening and at night. */
  glow?: string;
}

export type Item = HatItem | DecorItem;

export const CATALOGUE: Item[] = [
  { id: "beanie", kind: "hat", name: "Beanie", price: 60 },
  { id: "witch-hat", kind: "hat", name: "Witch hat", price: 200 },
  { id: "pumpkin", kind: "surface", name: "Jack-o'-lantern", price: 150, art: pumpkin, glow: pumpkinGlow, width: 48, height: 42 },
];

export interface Slot {
  id: string;
  scene: SceneName;
  label: string;
  kind: DecorItem["kind"];
  /** "back" stands on the back wall's furniture (behind Spook); "front" on what hides him. */
  layer: "back" | "front";
  /** Stage coordinates of the item's bottom centre, and its size relative to scene scale. */
  x: number;
  y: number;
  scale: number;
}

// Placed against the layout contract in SPEC.md: off the sign, Spook's spot and the bottom band.
export const SLOTS: Slot[] = [
  { id: "counter-left", scene: "counter", label: "Counter · left of Spook", kind: "surface", layer: "front", x: 393, y: 251, scale: 0.9 },
  { id: "counter-right", scene: "counter", label: "Counter · right of Spook", kind: "surface", layer: "front", x: 580, y: 251, scale: 1 },
  { id: "tables-table", scene: "tables", label: "Tables · Spook's table", kind: "surface", layer: "front", x: 556, y: 244, scale: 0.9 },
  { id: "tables-shelf", scene: "tables", label: "Tables · bookshelf", kind: "surface", layer: "back", x: 789, y: 141, scale: 0.7 },
];

export const itemById = (id: string) => CATALOGUE.find((i) => i.id === id);

// One overlay per hat, scene and pose, drawn by design/spook/build.mjs with the pose's transform.
const HAT_ART = import.meta.glob<string>("../assets/spook/hat-*.svg", { eager: true, import: "default" });

// The builder names a scene's files after its pose set; the counter's have no suffix.
const POSE_SUFFIX: Record<SceneName, string> = { counter: "", tables: "-table", outside: "-outside" };

export function hatArt(hat: string, scene: SceneName, pose: Pose): string | undefined {
  const suffix = POSE_SUFFIX[scene];
  return HAT_ART[`../assets/spook/hat-${hat}-${pose}${suffix}.svg`];
}
