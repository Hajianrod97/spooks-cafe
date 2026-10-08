import { useState } from "react";
import type { MusicSnapshot, Phase, Task, TimeOfDay, TimerSnapshot } from "../types";
import { useSettings } from "../useSettings";
import { useWindowVisible } from "../useWindowVisible";
import roomBack from "../assets/cafe/room-back.svg";
import roomFront from "../assets/cafe/room-front.svg";
import skyAfternoon from "../assets/cafe/sky-afternoon.svg";
import skyEvening from "../assets/cafe/sky-evening.svg";
import skyMorning from "../assets/cafe/sky-morning.svg";
import skyNight from "../assets/cafe/sky-night.svg";
import { Spook, poseFor } from "./Spook";
import { useTimeOfDay } from "./timeOfDay";
import { useTvThumbnail } from "./useTvThumbnail";
import "./cafe.css";

const SKY: Record<TimeOfDay, string> = {
  morning: skyMorning,
  afternoon: skyAfternoon,
  evening: skyEvening,
  night: skyNight,
};

const SIGN_LABEL: Record<Phase, string> = {
  idle: "Ready",
  focus: "Focus",
  shortBreak: "Break",
  longBreak: "Long break",
};

const clock = (secs: number) =>
  `${String(Math.floor(secs / 60)).padStart(2, "0")}:${String(secs % 60).padStart(2, "0")}`;

function caption(timer: TimerSnapshot, task: Task | undefined) {
  if (!task) return "Pick something from the menu below";
  if (timer.phase === "idle") return `Next up · ${task.name}`;
  if (!timer.running) return `Paused · ${task.name}`;
  if (timer.phase === "focus") return `Brewing · ${task.name}`;
  return `Coffee break · next up ${task.name}`;
}

interface Props {
  timer: TimerSnapshot;
  /** The task a focus block would log to: the running one, or the one picked in the menu. */
  task: Task | undefined;
  onAction: (cmd: string, args?: Record<string, unknown>) => void;
  onSettings: () => void;
  music: MusicSnapshot | null;
}

export function Scene({ timer, task, onAction, onSettings, music }: Props) {
  const time = useTimeOfDay(useSettings());
  // Rain and Spook's bobbing would keep the GPU busy in a window nobody can see.
  const visible = useWindowVisible();
  const thumbnail = useTvThumbnail(music);
  // An image that failed to load (e.g. offline) leaves the TV showing its drawn play button.
  const [brokenThumbnail, setBrokenThumbnail] = useState<string | null>(null);
  const playing = music?.playing ?? false;
  const inFocus = timer.phase === "focus";
  const onBreak = timer.phase === "shortBreak" || timer.phase === "longBreak";
  const paused = timer.phase !== "idle" && !timer.running;

  return (
    // With the overlay title bar the scene stands in for it, so its empty areas drag the window.
    // Tauri only drags when the pressed element itself has the attribute, so each container
    // has it, and the art layers ignore the pointer so a press on them lands on a container.
    <section className={`scene t-${time}${visible ? "" : " paused"}`} data-tauri-drag-region>
      <div className="stage" data-tauri-drag-region>
        <img className="layer" src={SKY[time]} alt="" />
        {time === "night" && (
          <div className="rain" aria-hidden="true">
            {Array.from({ length: 9 }, (_, i) => (
              <i key={i} style={{ left: 8 + i * 14, animationDelay: `${(i * 0.37) % 0.9}s` }} />
            ))}
          </div>
        )}
        <img className="layer" src={roomBack} alt="" />
        <div className="tint tint-back" />
        {/* After the tint: a TV glows, it isn't lit by the room. */}
        {thumbnail && thumbnail !== brokenThumbnail && (
          <div className={playing ? "tv-screen" : "tv-screen off"}>
            <img src={thumbnail} alt="" onError={() => setBrokenThumbnail(thumbnail)} />
          </div>
        )}
        <div className="ghost-glow" />
        <Spook pose={poseFor(timer)} music={playing} />
        <img className="layer" src={roomFront} alt="" />
        <div className="drip" aria-hidden="true">
          <i />
          <i />
        </div>
        <div className="tint tint-front" />

        <div className="sign">
          <div className="sign-neon">Spook's Cafe</div>
          <div className="sign-label">{paused ? "Paused" : SIGN_LABEL[timer.phase]}</div>
          <div className="sign-clock">{clock(timer.remainingSecs)}</div>
        </div>

        <div className="counter" data-tauri-drag-region>
          <div className="caption">{caption(timer, task)}</div>
          <div className="controls">
            {!inFocus && (
              <button className="chip primary" disabled={!task} onClick={() => onAction("start_focus", { taskId: task?.id })}>
                {onBreak ? "Continue focus" : "Start focus"}
              </button>
            )}
            {timer.phase !== "idle" &&
              (timer.running
                ? <button className="chip" onClick={() => onAction("pause")}>Pause</button>
                : <button className="chip" onClick={() => onAction("resume")}>Resume</button>)}
            {inFocus && <button className="chip" onClick={() => onAction("discard")}>Discard</button>}
            {onBreak && <button className="chip" onClick={() => onAction("skip_break")}>End break</button>}
          </div>
        </div>
      </div>

      {/* Outside the stage, so it stays in the window's corner at any width. */}
      <button className="round settings" aria-label="Settings" onClick={onSettings}>
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round">
          <circle cx="12" cy="12" r="3.2" />
          <circle cx="12" cy="12" r="7" />
          <path d="M12 2.5v2.5M12 19v2.5M2.5 12H5M19 12h2.5M5.3 5.3l1.8 1.8M16.9 16.9l1.8 1.8M5.3 18.7l1.8-1.8M16.9 7.1l1.8-1.8" />
        </svg>
      </button>
    </section>
  );
}
