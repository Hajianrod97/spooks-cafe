import { useState } from "react";
import { hours } from "./week";

export interface Slice {
  key: string;
  label: string;
  color: string;
  minutes: number;
}

const SIZE = 150;
const C = SIZE / 2;
const OUTER = 70;
const INNER = 48;
// A 2px gap of board between slices, measured along the ring's middle.
const GAP = 2 / ((OUTER + INNER) / 2);

const point = (r: number, angle: number) => `${(C + r * Math.cos(angle)).toFixed(2)} ${(C + r * Math.sin(angle)).toFixed(2)}`;

/** A ring segment from `start` to `end` (radians, 0 = 12 o'clock, clockwise). */
function arc(start: number, end: number) {
  const [a, b] = [start - Math.PI / 2, end - Math.PI / 2];
  const large = end - start > Math.PI ? 1 : 0;
  return `M${point(OUTER, a)} A${OUTER} ${OUTER} 0 ${large} 1 ${point(OUTER, b)} L${point(INNER, b)} A${INNER} ${INNER} 0 ${large} 0 ${point(INNER, a)} Z`;
}

/**
 * Part-to-whole for one week, largest slice first from 12 o'clock. The legend names every
 * slice with its share; hovering either highlights both and shows the hours in the middle.
 */
export function Donut({ slices }: { slices: Slice[] }) {
  const [active, setActive] = useState<string | null>(null);
  const total = slices.reduce((sum, s) => sum + s.minutes, 0);
  const share = (s: Slice) => Math.round((s.minutes / total) * 100);
  const focus = slices.find((s) => s.key === active);

  let angle = 0;
  const arcs = slices.map((s) => {
    const sweep = (s.minutes / total) * 2 * Math.PI;
    const start = angle;
    angle += sweep;
    return { ...s, start, sweep };
  });

  const summary = slices.map((s) => `${s.label} ${hours(s.minutes)} h`).join(", ");

  return (
    <div className="donut-row" onMouseLeave={() => setActive(null)}>
      <svg width={SIZE} height={SIZE} viewBox={`0 0 ${SIZE} ${SIZE}`} role="img" aria-label={`Time per task: ${summary}`}>
        {arcs.length === 1 ? (
          // A single task is a whole ring; an arc from 0 to 2π would draw nothing.
          <circle cx={C} cy={C} r={(OUTER + INNER) / 2} fill="none" stroke={arcs[0].color} strokeWidth={OUTER - INNER} />
        ) : (
          arcs.map((a) => (
            <path
              key={a.key}
              // A sliver thinner than the gap keeps a hairline instead of turning inside out.
              d={arc(a.start + Math.min(GAP, a.sweep * 0.4) / 2, a.start + a.sweep - Math.min(GAP, a.sweep * 0.4) / 2)}
              fill={a.color}
              opacity={active && active !== a.key ? 0.3 : 1}
              onMouseEnter={() => setActive(a.key)}
            />
          ))
        )}
        <text x={C} y={C - 4} textAnchor="middle" className="donut-value">
          {hours(focus ? focus.minutes : total)} h
        </text>
        <text x={C} y={C + 16} textAnchor="middle" className="donut-caption">
          {focus ? `${share(focus)}%` : "focused"}
        </text>
      </svg>

      <ul className="legend">
        {slices.map((s) => (
          <li key={s.key} className={active === s.key ? "on" : undefined} onMouseEnter={() => setActive(s.key)}>
            <span className="dot" style={{ background: s.color }} />
            <span className="name">{s.label}</span>
            <span className="value">{share(s)}%</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
