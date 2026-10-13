import { Fragment } from "react";
import type { TimerSnapshot } from "../types";
import breakArt from "../assets/spook/spook-break.svg";
import breakOutsideArt from "../assets/spook/spook-break-outside.svg";
import breakTableArt from "../assets/spook/spook-break-table.svg";
import focusOutsideArt from "../assets/spook/spook-focus-outside.svg";
import focusOutsideHeld from "../assets/spook/spook-focus-outside-held.svg";
import idleOutsideArt from "../assets/spook/spook-idle-outside.svg";
import sleepOutsideArt from "../assets/spook/spook-sleep-outside.svg";
import sleepOutsideProps from "../assets/spook/spook-sleep-outside-props.svg";
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
  /** Something he holds that also moves on its own (the broom swishes); bobs with him. */
  held?: string;
  /** Moves him from his usual spot for this pose, in stage px (outside, he steps out to sweep). */
  offset?: { x: number; y: number };
  /** He's wearing headphones, so music playing shows as notes around him. */
  headphones?: boolean;
}

export type PoseSet = Record<Pose, PoseArt>;

export const COUNTER_POSES: PoseSet = {
  idle: { src: idleArt, alt: "Spook waving hello" },
  focus: { src: focusArt, alt: "Spook with headphones on, typing on a laptop", headphones: true },
  break: { src: breakArt, alt: "Spook sipping a coffee" },
  sleep: { src: sleepArt, alt: "Spook dozing" },
};

export const TABLE_POSES: PoseSet = {
  idle: { src: idleTableArt, alt: "Spook resting his cheeks on his mitts" },
  focus: { src: focusTableArt, alt: "Spook with headphones on, typing on a laptop", props: focusTableProps, headphones: true },
  break: { src: breakTableArt, alt: "Spook looking at his phone" },
  sleep: { src: sleepTableArt, alt: "Spook dozing on the table" },
};

interface SpookProps {
  pose: Pose;
  art: PoseArt;
  music: boolean;
  /** The hat overlay for this pose, if he's wearing one. */
  hat?: string;
}

// Floating in the open doorway; nothing in front of him.
export const OUTSIDE_POSES: PoseSet = {
  idle: { src: idleOutsideArt, alt: "Spook leaning on the doorframe, waving" },
  // Out on the pavement in front of the left window, clear of the buttons under the doorway.
  focus: { src: focusOutsideArt, alt: "Spook sweeping the pavement", held: focusOutsideHeld, offset: { x: -155, y: 34 } },
  break: { src: breakOutsideArt, alt: "Spook petting Mochi the ghost cat" },
  sleep: { src: sleepOutsideArt, alt: "Spook dozing against the doorframe", props: sleepOutsideProps },
};

/** `music` floats notes around Spook while he has headphones on. Props are rendered by the scene. */
export function Spook({ pose, art, music, hat }: SpookProps) {
  return (
    <>
      {/* Keyed by pose and hat so whatever appears with a change mounts together with Spook and
          bobs in step with him. */}
      <Fragment key={`${pose}:${hat ?? ""}`}>
        <img className={`spook ${pose}`} src={art.src} alt={art.alt} />
        {/* The wrapper bobs; the image inside swishes, since one element can't run both on `transform`. */}
        {art.held && (
          <div className={`spook ${pose}`}>
            <img className="spook-held" src={art.held} alt="" />
          </div>
        )}
        {hat && <img className={`spook ${pose}`} src={hat} alt="" />}
      </Fragment>
      {music && art.headphones && <img className="spook-notes" src={notesArt} alt="" />}
    </>
  );
}
