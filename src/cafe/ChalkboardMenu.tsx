import type { Task, TaskProgress } from "../types";
import { SpookFace } from "./SpookFace";
import "./menu.css";

const hours = (minutes: number) => +(minutes / 60).toFixed(1);

/** "Mon 5 Oct – Sun 11 Oct" in the user's locale. Weeks start Monday, like the progress query. */
function weekLabel(now: Date) {
  const monday = new Date(now);
  monday.setHours(0, 0, 0, 0);
  monday.setDate(monday.getDate() - ((monday.getDay() + 6) % 7));
  const sunday = new Date(monday);
  sunday.setDate(monday.getDate() + 6);
  const format = (d: Date) => d.toLocaleDateString(undefined, { weekday: "short", day: "numeric", month: "short" });
  return `${format(monday)} – ${format(sunday)}`;
}

interface Props {
  tasks: Task[];
  progress: Map<number, TaskProgress>;
  activeTaskId: number | null;
  /** During a focus block the running task can't change. */
  locked: boolean;
  onPick: (id: number) => void;
  onEdit: (task: Task) => void;
  onAdd: () => void;
  onSessions: () => void;
}

export function ChalkboardMenu({ tasks, progress, activeTaskId, locked, onPick, onEdit, onAdd, onSessions }: Props) {
  const totalDone = tasks.reduce((sum, t) => sum + (progress.get(t.id)?.minutes ?? 0), 0);
  const totalTarget = tasks.reduce((sum, t) => sum + t.weeklyTargetMinutes, 0);

  return (
    <section className="chalkboard" aria-labelledby="menu-title">
      <div className="board">
        <header>
          <h2 id="menu-title">~ This week's menu ~</h2>
          <p className="week">
            {weekLabel(new Date())} · {hours(totalDone)}
            {totalTarget > 0 && ` / ${hours(totalTarget)}`} h
          </p>
        </header>

        {/* Native radios (visually hidden) keep arrow-key selection and screen-reader semantics. */}
        <ul className={locked ? "menu-items locked" : "menu-items"}>
          {tasks.map((task) => {
            const done = progress.get(task.id);
            const minutes = done?.minutes ?? 0;
            const blocks = done?.pomodoros ?? 0;
            const target = task.weeklyTargetMinutes;
            const active = activeTaskId === task.id;
            return (
              <li key={task.id} className={active ? "active" : undefined}>
                <label className="item">
                  <input
                    type="radio"
                    name="task"
                    className="visually-hidden"
                    checked={active}
                    disabled={locked}
                    onChange={() => onPick(task.id)}
                  />
                  <span className="dot" style={{ background: task.color }} />
                  <span className="name">{task.name}</span>
                  <span className="leader" aria-hidden="true" />
                  <span className="hours">
                    {hours(minutes)}
                    {target > 0 && ` / ${hours(target)}`} h
                  </span>
                  <span className="count" aria-label={`${blocks} focus blocks`}>
                    {blocks}
                    <SpookFace />
                  </span>
                </label>
                <button className="edit" aria-label={`Edit ${task.name}`} onClick={() => onEdit(task)}>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                    <path d="M4 20h4L19 9l-4-4L4 16v4Z" />
                    <path d="m13.5 6.5 4 4" />
                  </svg>
                </button>
                {target > 0 && (
                  <div className="chalk-bar" aria-hidden="true">
                    <div style={{ width: `${Math.min(minutes / target, 1) * 100}%`, background: task.color }} />
                  </div>
                )}
              </li>
            );
          })}
        </ul>

        <footer>
          <button className="chalk-button" onClick={onAdd}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" aria-hidden="true">
              <path d="M12 5v14M5 12h14" />
            </svg>
            Add item
          </button>
          <button className="chalk-button" onClick={onSessions}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" aria-hidden="true">
              <path d="M8 6h12M8 12h12M8 18h12M4 6h.01M4 12h.01M4 18h.01" />
            </svg>
            Sessions
          </button>
        </footer>
      </div>
    </section>
  );
}
