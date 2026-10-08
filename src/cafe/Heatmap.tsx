import { useState, type KeyboardEvent } from "react";
import { hours } from "./week";

const CELL = 18;
const STEP = 22;
const LEFT = 18; // weekday letters
const TOP = 16; // month names
// Upper bounds in minutes for levels 1–3; 4 hours and up is the brightest. Level 0 is no focus.
const LEVELS = [60, 120, 240];
// One hue (chalk), more of it for more time.
const LEVEL_FILL = [0.07, 0.25, 0.45, 0.7, 0.95].map((a) => `rgba(244, 241, 232, ${a})`);
const WEEKDAY_LABELS: [number, string][] = [
  [0, "M"],
  [2, "W"],
  [4, "F"],
];

const level = (minutes: number) => (minutes === 0 ? 0 : 1 + LEVELS.filter((max) => minutes >= max).length);

/** Day `i` after `firstDay` (local midnight). Calendar arithmetic, so DST doesn't shift it. */
function dayAt(firstDay: number, i: number) {
  const d = new Date(firstDay * 1000);
  d.setDate(d.getDate() + i);
  return d;
}

/**
 * Focused minutes per day, one column per week (Mon at the top). The line under it reads out
 * the picked day — today until you hover, click or arrow to another. One Tab stop.
 */
export function Heatmap({ firstDay, days }: { firstDay: number; days: number[] }) {
  const [pick, setPicked] = useState(days.length - 1);
  // A refetch can change the number of days (e.g. after midnight); stay on a real one.
  const picked = Math.min(pick, days.length - 1);
  const weeks = Math.ceil(days.length / 7);
  const width = LEFT + weeks * STEP - (STEP - CELL);
  const height = TOP + 7 * STEP - (STEP - CELL);
  const day = dayAt(firstDay, picked);

  // A month's name sits over the week holding its 1st.
  const months: { col: number; name: string }[] = [];
  for (let i = 0; i < days.length; i++) {
    const d = dayAt(firstDay, i);
    if (d.getDate() === 1) months.push({ col: Math.floor(i / 7), name: d.toLocaleDateString(undefined, { month: "short" }) });
  }

  function onKeyDown(e: KeyboardEvent) {
    const move = { ArrowLeft: -7, ArrowRight: 7, ArrowUp: -1, ArrowDown: 1 }[e.key];
    if (move === undefined) return;
    e.preventDefault();
    setPicked((p) => Math.min(days.length - 1, Math.max(0, p + move)));
  }

  return (
    <div className="heatmap">
      <div
        className="heatmap-grid"
        role="group"
        tabIndex={0}
        aria-label="Focus per day over the last 16 weeks. Arrow keys pick a day."
        onKeyDown={onKeyDown}
      >
        <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} aria-hidden="true">
          {months.map((m) => (
            <text key={m.col} x={LEFT + m.col * STEP} y={11} className="axis">
              {m.name}
            </text>
          ))}
          {WEEKDAY_LABELS.map(([row, label]) => (
            <text key={row} x={0} y={TOP + row * STEP + 13} className="axis">
              {label}
            </text>
          ))}
          {days.map((minutes, i) => (
            <rect
              key={i}
              x={LEFT + Math.floor(i / 7) * STEP}
              y={TOP + (i % 7) * STEP}
              width={CELL}
              height={CELL}
              rx={3}
              fill={LEVEL_FILL[level(minutes)]}
              className={i === picked ? "picked" : undefined}
              onMouseEnter={() => setPicked(i)}
              onClick={() => setPicked(i)}
            />
          ))}
        </svg>
      </div>
      <div className="heatmap-foot">
        <p className="readout" aria-live="polite">
          {day.toLocaleDateString(undefined, { weekday: "short", day: "numeric", month: "short" })} ·{" "}
          {days[picked] > 0 ? `${hours(days[picked])} h focused` : "no focus"}
        </p>
        <span className="scale" aria-hidden="true">
          Less
          {LEVEL_FILL.map((fill) => (
            <i key={fill} style={{ background: fill }} />
          ))}
          More
        </span>
      </div>
    </div>
  );
}
