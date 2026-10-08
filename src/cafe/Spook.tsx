import type { TimerSnapshot } from "../types";
import breakArt from "../assets/spook/spook-break.svg";
import focusArt from "../assets/spook/spook-focus.svg";
import idleArt from "../assets/spook/spook-idle.svg";
import notesArt from "../assets/spook/spook-notes.svg";
import sleepArt from "../assets/spook/spook-sleep.svg";

export type Pose = "idle" | "focus" | "break" | "sleep";

/** Spook mirrors the timer: any paused phase dozes, whatever it was doing. */
export function poseFor(timer: TimerSnapshot): Pose {
  if (timer.phase === "idle") return "idle";
  if (!timer.running) return "sleep";
  return timer.phase === "focus" ? "focus" : "break";
}

const ART: Record<Pose, { src: string; alt: string }> = {
  idle: { src: idleArt, alt: "Spook waving hello" },
  focus: { src: focusArt, alt: "Spook with headphones on, typing on a laptop" },
  break: { src: breakArt, alt: "Spook sipping a coffee" },
  sleep: { src: sleepArt, alt: "Spook dozing" },
};

/** `music` floats notes around Spook, except while dozing. */
export function Spook({ pose, music }: { pose: Pose; music: boolean }) {
  const { src, alt } = ART[pose];
  return (
    <>
      <img className={`spook ${pose}`} src={src} alt={alt} />
      {music && pose !== "sleep" && <img className="spook-notes" src={notesArt} alt="" />}
    </>
  );
}
