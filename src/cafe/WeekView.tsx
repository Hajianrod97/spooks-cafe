import type { TaskWeek, WeekReport } from "../types";
import { Donut, type Slice } from "./Donut";
import { SpookFace } from "./SpookFace";
import { hours } from "./week";

const DAYS = ["M", "T", "W", "T", "F", "S", "S"];
const DAY_NAMES = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];
// Past ~6 slices a donut stops reading at a glance; the rest fold into one, and the target
// list below still names every task.
const MAX_SLICES = 6;
const OTHER_COLOR = "#7d8783";

const taskName = (t: TaskWeek) => (t.archived ? `${t.name} (archived)` : t.name);

function slicesFor(tasks: TaskWeek[]): Slice[] {
  const worked = tasks.filter((t) => t.minutes > 0).sort((a, b) => b.minutes - a.minutes);
  const slices = worked.map((t) => ({ key: String(t.taskId), label: taskName(t), color: t.color, minutes: t.minutes }));
  if (slices.length <= MAX_SLICES) return slices;
  const rest = slices.slice(MAX_SLICES - 1);
  return [
    ...slices.slice(0, MAX_SLICES - 1),
    {
      key: "other",
      label: `Other (${rest.length} tasks)`,
      color: OTHER_COLOR,
      minutes: rest.reduce((sum, s) => sum + s.minutes, 0),
    },
  ];
}

interface Props {
  report: WeekReport;
  /** This week: future days aren't missed yet, and its sessions can be opened. */
  isThisWeek: boolean;
  onSessions: () => void;
}

/** One week, read-only: where the time went, targets, and to-dos. */
export function WeekView({ report, isThisWeek, onSessions }: Props) {
  const total = report.tasks.reduce((sum, t) => sum + t.minutes, 0);
  const targeted = report.tasks.filter((t) => t.targetMinutes > 0);
  const hit = targeted.filter((t) => t.minutes >= t.targetMinutes).length;
  const dailyTicks = report.dailies.reduce((sum, d) => sum + d.days.filter(Boolean).length, 0);
  const todosDone = report.todosDone + dailyTicks;
  // Days after today haven't happened; they're drawn as blanks, not misses.
  const today = isThisWeek ? (new Date().getDay() + 6) % 7 : 7;

  const headline = [
    `${hours(total)} h focused`,
    targeted.length > 0 && `${hit} of ${targeted.length} targets hit`,
    `${todosDone} to-do${todosDone === 1 ? "" : "s"} done`,
  ].filter(Boolean);

  return (
    <div className="week-view">
      <p className="headline">{headline.join(" · ")}</p>

      {total === 0 ? (
        <div className="empty-week">
          <SpookFace size={36} />
          <p>Nothing brewed this week</p>
        </div>
      ) : (
        <>
          <Donut slices={slicesFor(report.tasks)} />

          <section aria-label="Targets">
            <h4>Targets</h4>
            <ul className="targets">
              {report.tasks
                .filter((t) => t.minutes > 0 || t.targetMinutes > 0)
                .map((t) => {
                  const done = t.targetMinutes > 0 && t.minutes >= t.targetMinutes;
                  return (
                    <li key={t.taskId}>
                      <span className="name">{taskName(t)}</span>
                      <span className="value">
                        {hours(t.minutes)}
                        {t.targetMinutes > 0 && ` / ${hours(t.targetMinutes)}`} h
                        {done && (
                          <>
                            <span aria-hidden="true"> ✓</span>
                            <span className="visually-hidden">, target hit</span>
                          </>
                        )}
                      </span>
                      {t.targetMinutes > 0 && (
                        <div className="report-bar" aria-hidden="true">
                          <div style={{ width: `${Math.min(t.minutes / t.targetMinutes, 1) * 100}%`, background: t.color }} />
                        </div>
                      )}
                    </li>
                  );
                })}
            </ul>
          </section>
        </>
      )}

      {(report.todosDone > 0 || report.dailies.length > 0) && (
        <section aria-label="To-dos">
          <h4>To-dos</h4>
          <p className="todo-count">
            {report.todosDone} one-time to-do{report.todosDone === 1 ? "" : "s"} done
          </p>
          {report.dailies.length > 0 && (
            <table className="habits">
              <thead>
                <tr>
                  <th>
                    <span className="visually-hidden">Daily</span>
                  </th>
                  {DAYS.map((d, i) => (
                    <th key={i} scope="col" aria-label={DAY_NAMES[i]}>
                      {d}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {report.dailies.map((d) => (
                  <tr key={d.id}>
                    <th scope="row">{d.text}</th>
                    {d.days.map((ticked, i) => (
                      <td key={i}>
                        <span className={ticked ? "habit done" : i > today ? "habit future" : "habit"}>
                          <span className="visually-hidden">{ticked ? "done" : i > today ? "not yet" : "missed"}</span>
                        </span>
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </section>
      )}

      {isThisWeek && (
        <button className="chalk-link" onClick={onSessions}>
          See sessions
        </button>
      )}
    </div>
  );
}
