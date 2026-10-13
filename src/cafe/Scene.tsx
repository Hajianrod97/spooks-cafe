import { useEffect, useState, type CSSProperties } from "react";
import type { MusicSnapshot, Phase, Task, TimeOfDay, TimerSnapshot } from "../types";
import type { ShopState } from "../useShop";
import { BeanIcon } from "./BeanIcon";
import { DecorateSpots } from "./DecorateSpots";
import { MOCHI_SCALE, MOCHI_SPOTS, mochiArt } from "./mochi";
import { PickMenu } from "./PickMenu";
import { CATALOGUE, SLOTS, hatArt, itemById, type Slot } from "./shop";
import { useSettings } from "../useSettings";
import { useWindowVisible } from "../useWindowVisible";
import { SCENES, type SceneArt } from "./scenes";
import { Spook, poseFor, type Pose } from "./Spook";
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

/** Sets --spook-drop and --spook-shift (see cafe.css) for everything that follows Spook. */
function spookPlace(art: SceneArt, pose: Pose): CSSProperties {
  const offset = art.poses[pose].offset ?? { x: 0, y: 0 };
  return { "--spook-drop": `${(art.spookDrop ?? 0) + offset.y}px`, "--spook-shift": `${offset.x}px` } as CSSProperties;
}

/**
 * Tints are masked to their own layer, so the sky and Spook between the layers keep their colours.
 * The URL must be quoted: Vite inlines small SVGs as `data:` URIs, which an unquoted `url()` can't
 * hold, and a dropped mask lets the tint cover the whole stage.
 */
const maskTo = (layer: string): CSSProperties => {
  const url = `url(${JSON.stringify(layer)})`;
  return { maskImage: url, WebkitMaskImage: url };
};

/** A decoration standing in its slot: the art, its own tint (masked to it), then any lit parts on top. */
function Decoration({ slot, itemId, time }: { slot: Slot; itemId: string; time: TimeOfDay }) {
  const item = itemById(itemId);
  if (!item || item.kind === "hat") return null;
  const width = item.width * slot.scale;
  const height = item.height * slot.scale;
  const box: CSSProperties = { left: slot.x - width / 2, top: slot.y - height, width, height };
  const lit = item.glow && (time === "evening" || time === "night");
  return (
    <>
      <img className="decor" style={box} src={item.art} alt="" />
      <div className="tint decor" style={{ ...box, ...maskTo(item.art) }} />
      {lit && <img className="decor" style={box} src={item.glow} alt="" />}
    </>
  );
}

interface Props {
  timer: TimerSnapshot;
  /** The task a focus block would log to: the running one, or the one picked in the menu. */
  task: Task | undefined;
  onAction: (cmd: string, args?: Record<string, unknown>) => void;
  onSettings: () => void;
  music: MusicSnapshot | null;
  shop: ShopState;
  onShop: () => void;
  onError: (e: unknown) => void;
}

export function Scene({ timer, task, onAction, onSettings, music, shop: { shop, earned, wear, place }, onShop, onError }: Props) {
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
  const pose = poseFor(timer);
  const [hatMenu, setHatMenu] = useState(false);
  const [decorating, setDecorating] = useState(false);
  const ownedHats = CATALOGUE.filter((i) => i.kind === "hat" && shop?.owned.includes(i.id));
  const ownsDecor = CATALOGUE.some((i) => i.kind !== "hat" && shop?.owned.includes(i.id));

  // Esc leaves Decorate mode (an open spot menu catches its own Esc first).
  useEffect(() => {
    if (!decorating) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setDecorating(false);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [decorating]);

  // A saved scene that doesn't exist (yet) falls back to the counter.
  const index = Math.max(0, SCENES.findIndex((s) => s.name === scene));
  const prev = SCENES[index - 1];
  const next = SCENES[index + 1];

  function panel(art: SceneArt, i: number) {
    const active = i === index;
    const { window: win } = art;
    const spook = art.poses[pose];
    const hat = shop?.hat ? hatArt(shop.hat, art.name, pose) : undefined;
    // Mochi lives in every scene; like Spook it's drawn after the tints, so it keeps its colours.
    const spot = MOCHI_SPOTS[art.name];
    const cat = mochiArt(art.name, pose);
    const mochi = (layer: Slot["layer"]) =>
      spot.layer === layer && (
        <img
          className="mochi"
          src={cat.src}
          alt={active ? cat.alt : ""}
          style={{
            left: spot.x - (cat.width * MOCHI_SCALE) / 2,
            top: spot.y - cat.height * MOCHI_SCALE,
            width: cat.width * MOCHI_SCALE,
            height: cat.height * MOCHI_SCALE,
          }}
        />
      );
    const decorations = (layer: Slot["layer"]) =>
      SLOTS.filter((s) => s.scene === art.name && s.layer === layer && shop?.placements[s.id]).map((s) => (
        <Decoration key={s.id} slot={s} itemId={shop!.placements[s.id]} time={time} />
      ));
    return (
      <div key={art.name} className={active ? "panel active" : "panel"} aria-hidden={!active}>
        <div className="stage" style={spookPlace(art, pose)}>
          <img className="layer" src={art.sky[time]} alt="" />
          {time === "night" && (
            <div className="rain" style={{ left: win.x, top: win.y, width: win.w, height: win.h }}>
              {Array.from({ length: Math.round(win.w / 14) }, (_, d) => (
                <i key={d} style={{ left: 8 + d * 14, animationDelay: `${(d * 0.37) % 0.9}s` }} />
              ))}
            </div>
          )}
          <img className="layer" src={art.back} alt="" />
          {/* Before the tint, so the paint darkens with its board at night. */}
          {art.lettering?.map(({ text, x, y, w, h }) => (
            <div key={text} className="lettering" style={{ left: x, top: y, width: w, height: h }}>
              {text}
            </div>
          ))}
          <div className="tint" style={maskTo(art.back)} />
          {art.glow && (time === "evening" || time === "night") && <img className="layer" src={art.glow} alt="" />}
          {decorations("back")}
          {mochi("back")}
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
              <Spook pose={pose} art={spook} music={playing} hat={hat} />
            </>
          )}
          {art.front && <img className="layer" src={art.front} alt="" />}
          {art.name === "counter" && (
            <div className="drip">
              <i />
              <i />
            </div>
          )}
          {art.front && <div className="tint" style={maskTo(art.front)} />}
          {decorations("front")}
          {mochi("front")}
          {/* After the front tint, so props stay unlit like the rest of Spook's art. */}
          {active && spook.props && <img className="spook-props" src={spook.props} alt="" />}
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
        <div className="stage" style={spookPlace(SCENES[index], pose)} data-tauri-drag-region>
          <div className="sign">
            <div className="sign-neon">Spook's Cafe</div>
            <div className="sign-label">{paused ? "Paused" : SIGN_LABEL[timer.phase]}</div>
            <div className="sign-clock">{clock(timer.remainingSecs)}</div>
          </div>

          {/* Over Spook's spot: click him to change hats. */}
          {ownedHats.length > 0 && !decorating && (
            <button
              type="button"
              className="spook-hit"
              aria-label="Change Spook's hat"
              aria-haspopup="menu"
              aria-expanded={hatMenu}
              data-pick-trigger
              onClick={() => setHatMenu(!hatMenu)}
            />
          )}
          {hatMenu && shop && (
            <PickMenu
              label="Spook's hat"
              // To his left: on the right it would run off a narrow window.
              style={{ left: 428, top: 124, transform: "translateX(-100%)" }}
              items={[
                ...ownedHats.map((h) => ({
                  key: h.id,
                  label: h.name,
                  checked: shop.hat === h.id,
                  onPick: () => wear(h.id).catch(onError),
                })),
                { key: "none", label: "No hat", checked: shop.hat === null, onPick: () => wear(null).catch(onError) },
              ]}
              onClose={() => setHatMenu(false)}
            />
          )}
          {decorating && shop && <DecorateSpots scene={SCENES[index].name} shop={shop} place={place} onError={onError} />}

          <div className="counter" data-tauri-drag-region>
            {decorating ? (
              <>
                <div className="caption">Decorating · click a spot</div>
                <div className="controls">
                  <button className="chip primary" onClick={() => setDecorating(false)}>Done</button>
                </div>
              </>
            ) : (
              <>
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
              </>
            )}
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

        {/* Outside the stage, so they stay in the window's corner at any width. */}
        <div className="corner">
          {(ownsDecor || decorating) && (
            <button
              className="round decorate-button"
              aria-label="Decorate the cafe"
              aria-pressed={decorating}
              onClick={() => {
                setHatMenu(false);
                setDecorating(!decorating);
              }}
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M14.5 4.5l5 5-8 8-5-5z" />
                <path d="M6.5 12.5l-2.5 2.5c-1 1-1 3.5-2 4.5 2 0 4.5-.5 5.5-1.5l2.5-2.5" />
              </svg>
            </button>
          )}
          <button className="shop-button" aria-label={`Shop, ${shop?.balance ?? 0} beans`} onClick={onShop}>
            <BeanIcon />
            <span>{shop?.balance ?? "–"}</span>
            {earned && (
              <span key={earned.n} className="shop-earned" aria-hidden="true">
                +{earned.amount}
              </span>
            )}
          </button>
          <button className="round settings" aria-label="Settings" onClick={onSettings}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" aria-hidden="true">
              <circle cx="12" cy="12" r="3.2" />
              <circle cx="12" cy="12" r="7" />
              <path d="M12 2.5v2.5M12 19v2.5M2.5 12H5M19 12h2.5M5.3 5.3l1.8 1.8M16.9 16.9l1.8 1.8M5.3 18.7l1.8-1.8M16.9 7.1l1.8-1.8" />
            </svg>
          </button>
        </div>
      </div>
    </section>
  );
}
