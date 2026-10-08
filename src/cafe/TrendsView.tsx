import { useState } from "react";
import type { TaskTrend, TrendsReport } from "../types";
import { Heatmap } from "./Heatmap";
import { SpookFace } from "./SpookFace";
import { hours } from "./week";

const BAR = 12;
const BAR_STEP = 16;
const PLOT = 26; // bar height at the row's maximum

const taskName = (t: TaskTrend) => (t.archived ? `${t.name} (archived)` : t.name);
const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? "" : "s"}`;

/** Monday of the week `back` weeks ago, for readouts. */
function weekOf(back: number) {
  const d = new Date();
  d.setDate(d.getDate() - ((d.getDay() + 6) % 7) - 7 * back);
  return d.toLocaleDateString(undefined, { day: "numeric", month: "short" });
}

/**
 * One row per task: eight weekly bars (this week faded, it isn't over) and a tick at each
 * week's target. Each row has its own scale, since the question is "how did this task do
 * against its target", not how tasks compare.
 */
function TaskTrends({ tasks }: { tasks: TaskTrend[] }) {
  const [hover, setHover] = useState<{ task: TaskTrend; week: number } | null>(null);
  const width = 8 * BAR_STEP - (BAR_STEP - BAR);

  function readout() {
    if (!hover) return "Hover a bar for that week";
    const { task, week } = hover;
    const w = task.weeks[week];
    const back = task.weeks.length - 1 - week;
    const when = back === 0 ? "this week so far" : `week of ${weekOf(back)}`;
    const target = w.targetMinutes ? ` / ${hours(w.targetMinutes)}` : "";
    return `${task.name} · ${when} · ${hours(w.minutes)}${target} h`;
  }

  return (
    <section aria-label="Per-task trends">
      <h4>Last 8 weeks</h4>
      <ul className="trends" onMouseLeave={() => setHover(null)}>
        {tasks.map((t) => {
          const top = Math.max(1, ...t.weeks.map((w) => Math.max(w.minutes, w.targetMinutes ?? 0)));
          const y = (minutes: number) => PLOT - (minutes / top) * PLOT;
          // Average over finished weeks the task existed in.
          const full = t.weeks.slice(0, -1).filter((w) => w.targetMinutes !== null || w.minutes > 0);
          const average = full.length ? full.reduce((sum, w) => sum + w.minutes, 0) / full.length : 0;
          const summary = t.weeks.map((w) => hours(w.minutes)).join(", ");
          return (
            <li key={t.taskId}>
              <span className="name">{taskName(t)}</span>
              <svg width={width} height={PLOT + 2} viewBox={`0 0 ${width} ${PLOT + 2}`} role="img" aria-label={`${t.name}, hours per week, oldest first: ${summary}`}>
                <line x1={0} x2={width} y1={PLOT + 1} y2={PLOT + 1} className="baseline" />
                {t.weeks.map((w, i) => {
                  const x = i * BAR_STEP;
                  const h = Math.max(w.minutes > 0 ? 2 : 0, PLOT - y(w.minutes));
                  // Rounded at the top, square on the baseline.
                  const r = Math.min(4, h);
                  return (
                    <g key={i} onMouseEnter={() => setHover({ task: t, week: i })}>
                      {/* The whole slot is the hover target, not just the (maybe tiny) bar. */}
                      <rect x={x - 2} y={0} width={BAR_STEP} height={PLOT + 2} fill="transparent" />
                      {h > 0 && (
                        <path
                          d={`M${x} ${PLOT} V${PLOT - h + r} q0 -${r} ${r} -${r} H${x + BAR - r} q${r} 0 ${r} ${r} V${PLOT} Z`}
                          fill={t.color}
                          opacity={i === t.weeks.length - 1 ? 0.45 : 1}
                        />
                      )}
                      {w.targetMinutes ? <line x1={x - 1} x2={x + BAR + 1} y1={y(w.targetMinutes)} y2={y(w.targetMinutes)} className="target" /> : null}
                    </g>
                  );
                })}
              </svg>
              <span className="value">avg {hours(average)} h</span>
            </li>
          );
        })}
      </ul>
      <p className={hover ? "readout trend-readout" : "readout trend-readout idle"} aria-live="polite">
        {readout()}
      </p>
      <p className="caption">Faded bar: this week so far · line: that week's target</p>
    </section>
  );
}

function Tile({ value, label }: { value: string; label: string }) {
  return (
    <div className="tile">
      <span className="tile-value">{value}</span>
      <span className="tile-label">{label}</span>
    </div>
  );
}

/** Over time, read-only: the heatmap, per-task trends, streaks and insights. */
export function TrendsView({ report }: { report: TrendsReport }) {
  const { insights: i, focusStreak } = report;
  if (i.completionRate === null) {
    return (
      <div className="empty-week">
        <SpookFace size={36} />
        <p>Nothing brewed yet</p>
      </div>
    );
  }

  const weekday =
    i.bestWeekday === null ? "—" : new Date(2024, 0, 1 + i.bestWeekday).toLocaleDateString(undefined, { weekday: "long" }); // 1 Jan 2024 was a Monday
  const hour = i.bestHour === null ? "—" : new Date(2024, 0, 1, i.bestHour).toLocaleTimeString(undefined, { hour: "numeric" });

  return (
    <div className="trends-view">
      <Heatmap firstDay={report.firstDay} days={report.days} />

      {report.tasks.length > 0 && <TaskTrends tasks={report.tasks} />}

      <section aria-label="Streaks">
        <h4>Streaks</h4>
        <div className="tiles">
          <Tile value={plural(focusStreak.current, "day")} label="focus streak" />
          <Tile value={plural(focusStreak.longest, "day")} label="longest" />
        </div>
        {report.dailies.length > 0 && (
          <ul className="daily-streaks">
            {report.dailies.map((d) => (
              <li key={d.id}>
                <span className="name">{d.text}</span>
                <span className="value">
                  {plural(d.streak.current, "day")}
                  {d.streak.longest > d.streak.current && ` · best ${d.streak.longest}`}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section aria-label="Insights">
        <h4>Insights</h4>
        <div className="tiles">
          <Tile value={weekday} label="best day" />
          <Tile value={hour} label="most focused hour" />
          <Tile value={`${Math.round(i.completionRate * 100)}%`} label="blocks finished" />
          <Tile value={`${hours(i.averageActiveDay ?? 0)} h`} label="per active day" />
        </div>
      </section>
    </div>
  );
}
