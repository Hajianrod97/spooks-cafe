import { useState, type CSSProperties } from "react";
import type { MusicSnapshot, Phase, Task, TimerSnapshot } from "../types";
import { useSettings } from "../useSettings";
import { useWindowVisible } from "../useWindowVisible";
import { SCENES, type SceneArt } from "./scenes";
import { Spook, poseFor } from "./Spook";
import { useTimeOfDay } from "./timeOfDay";
import { useScene } from "./useScene";
import { useTvThumbnail } from "./useTvThumbnail";
import "./cafe.css";

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

/** Tints are masked to their own layer, so the sky and Spook between the layers keep their colours. */
const maskTo = (layer: string): CSSProperties => ({ maskImage: `url(${layer})`, WebkitMaskImage: `url(${layer})` });

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
  const { scene, goTo, switched } = useScene();
  const thumbnail = useTvThumbnail(music);
  // An image that failed to load (e.g. offline) leaves the TV showing its drawn play button.
  const [brokenThumbnail, setBrokenThumbnail] = useState<string | null>(null);
  const playing = music?.playing ?? false;
  const inFocus = timer.phase === "focus";
  const onBreak = timer.phase === "shortBreak" || timer.phase === "longBreak";
  const paused = timer.phase !== "idle" && !timer.running;

  // A saved scene that doesn't exist (yet) falls back to the counter.
  const index = Math.max(0, SCENES.findIndex((s) => s.name === scene));
  const prev = SCENES[index - 1];
  const next = SCENES[index + 1];

  function panel(art: SceneArt, i: number) {
    const active = i === index;
    const { window: win } = art;
    return (
      <div key={art.name} className={active ? "panel active" : "panel"} aria-hidden={!active}>
        <div className="stage">
          <img className="layer" src={art.sky[time]} alt="" />
          {time === "night" && (
            <div className="rain" style={{ left: win.x, top: win.y, width: win.w, height: win.h }}>
              {Array.from({ length: Math.round(win.w / 14) }, (_, d) => (
                <i key={d} style={{ left: 8 + d * 14, animationDelay: `${(d * 0.37) % 0.9}s` }} />
              ))}
            </div>
          )}
          <img className="layer" src={art.back} alt="" />
          <div className="tint" style={maskTo(art.back)} />
          {/* After the tint: a TV glows, it isn't lit by the room. */}
          {art.name === "counter" && thumbnail && thumbnail !== brokenThumbnail && (
            <div className={playing ? "tv-screen" : "tv-screen off"}>
              <img src={thumbnail} alt="" onError={() => setBrokenThumbnail(thumbnail)} />
            </div>
          )}
          {/* Spook is only in the scene you're looking at, so a switch reads as Spook moving with you. */}
          {active && (
            <>
              <div className="ghost-glow" />
              <Spook pose={poseFor(timer)} music={playing} />
            </>
          )}
          <img className="layer" src={art.front} alt="" />
          {art.name === "counter" && (
            <div className="drip">
              <i />
              <i />
            </div>
          )}
          <div className="tint" style={maskTo(art.front)} />
        </div>
      </div>
    );
  }

  return (
    <section className={`scene t-${time}${visible ? "" : " paused"}`}>
      <div className={switched ? "strip animated" : "strip"}>
        {SCENES.map(panel)}
      </div>

      {/* Everything you can click sits above the scenes, so it stays put while they change.
          With the overlay title bar this also stands in for it: Tauri only drags when the pressed
          element itself has the attribute, so the containers carry it and the art ignores the pointer. */}
      <div className="overlay" data-tauri-drag-region>
        <div className="stage" data-tauri-drag-region>
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

        {prev && (
          <button className="round scene-arrow left" aria-label={`Go to ${prev.label}`} onClick={() => goTo(prev.name)}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="m15 5-7 7 7 7" />
            </svg>
          </button>
        )}
        {next && (
          <button className="round scene-arrow right" aria-label={`Go to ${next.label}`} onClick={() => goTo(next.name)}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="m9 5 7 7-7 7" />
            </svg>
          </button>
        )}

        {/* Outside the stage, so it stays in the window's corner at any width. */}
        <button className="round settings" aria-label="Settings" onClick={onSettings}>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" aria-hidden="true">
            <circle cx="12" cy="12" r="3.2" />
            <circle cx="12" cy="12" r="7" />
            <path d="M12 2.5v2.5M12 19v2.5M2.5 12H5M19 12h2.5M5.3 5.3l1.8 1.8M16.9 16.9l1.8 1.8M5.3 18.7l1.8-1.8M16.9 7.1l1.8-1.8" />
          </svg>
        </button>
      </div>
    </section>
  );
}
