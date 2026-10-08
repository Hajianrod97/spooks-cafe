import type { TimerSnapshot } from "../types";
import breakArt from "../assets/spook/spook-break.svg";
import breakTableArt from "../assets/spook/spook-break-table.svg";
import focusArt from "../assets/spook/spook-focus.svg";
import focusTableArt from "../assets/spook/spook-focus-table.svg";
import focusTableProps from "../assets/spook/spook-focus-table-props.svg";
import idleArt from "../assets/spook/spook-idle.svg";
import idleTableArt from "../assets/spook/spook-idle-table.svg";
import notesArt from "../assets/spook/spook-notes.svg";
import sleepArt from "../assets/spook/spook-sleep.svg";
import sleepTableArt from "../assets/spook/spook-sleep-table.svg";

export type Pose = "idle" | "focus" | "break" | "sleep";

/** Spook mirrors the timer: any paused phase dozes, whatever it was doing. */
export function poseFor(timer: TimerSnapshot): Pose {
  if (timer.phase === "idle") return "idle";
  if (!timer.running) return "sleep";
  return timer.phase === "focus" ? "focus" : "break";
}

export interface PoseArt {
  src: string;
  alt: string;
  /** Things standing on the furniture, drawn above the scene's front layer so they don't bob. */
  props?: string;
}

export type PoseSet = Record<Pose, PoseArt>;

export const COUNTER_POSES: PoseSet = {
  idle: { src: idleArt, alt: "Spook waving hello" },
  focus: { src: focusArt, alt: "Spook with headphones on, typing on a laptop" },
  break: { src: breakArt, alt: "Spook sipping a coffee" },
  sleep: { src: sleepArt, alt: "Spook dozing" },
};

export const TABLE_POSES: PoseSet = {
  idle: { src: idleTableArt, alt: "Spook resting his cheeks on his mitts" },
  focus: { src: focusTableArt, alt: "Spook with headphones on, typing on a laptop", props: focusTableProps },
  break: { src: breakTableArt, alt: "Spook looking at his phone" },
  sleep: { src: sleepTableArt, alt: "Spook dozing on the table" },
};

/** `music` floats notes around Spook, except while dozing. Props are rendered by the scene. */
export function Spook({ pose, art, music }: { pose: Pose; art: PoseArt; music: boolean }) {
  return (
    <>
      <img className={`spook ${pose}`} src={art.src} alt={art.alt} />
      {music && pose !== "sleep" && <img className="spook-notes" src={notesArt} alt="" />}
    </>
  );
}
