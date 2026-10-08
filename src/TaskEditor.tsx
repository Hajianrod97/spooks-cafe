import { useEffect, useRef, useState, type ChangeEvent, type FormEvent } from "react";
import { invoke } from "@tauri-apps/api/core";
import type { Task, TaskInput } from "./types";

const PALETTE = [
  "#E8A87C", "#C38D9E", "#41B3A3", "#8E9AAF", "#F2C14E",
  "#7FA7C9", "#D96C6C", "#9BC53D", "#B388EB", "#6C757D",
];

// Inputs hold strings so a field can be empty mid-edit; numbers are parsed on save.
interface Form {
  name: string;
  color: string;
  weeklyHours: string;
  totalHours: string;
  focus: string;
  shortBreak: string;
  longBreak: string;
}

const text = (n: number | null, scale = 1) => (n === null ? "" : String(+(n / scale).toFixed(2)));

function toForm(task: Task | null): Form {
  return {
    name: task?.name ?? "",
    color: task?.color ?? PALETTE[0],
    weeklyHours: text(task?.weeklyTargetMinutes ?? 0, 60),
    totalHours: text(task?.totalTargetMinutes ?? null, 60),
    focus: text(task?.focusMinutes ?? null),
    shortBreak: text(task?.shortBreakMinutes ?? null),
    longBreak: text(task?.longBreakMinutes ?? null),
  };
}

/** Empty means "not set". Returns NaN for anything that isn't a number. */
const minutes = (s: string, scale = 1) => (s.trim() === "" ? null : Math.round(Number(s) * scale));

function toInput(f: Form): TaskInput | string {
  const input: TaskInput = {
    name: f.name.trim(),
    color: f.color,
    weeklyTargetMinutes: minutes(f.weeklyHours, 60) ?? 0,
    totalTargetMinutes: minutes(f.totalHours, 60),
    focusMinutes: minutes(f.focus),
    shortBreakMinutes: minutes(f.shortBreak),
    longBreakMinutes: minutes(f.longBreak),
  };
  if (!input.name) return "Give the task a name.";
  if (Object.values(input).some((v) => Number.isNaN(v))) return "Times must be numbers.";
  return input;
}

interface Props {
  /** `null` adds a new task. */
  task: Task | null;
  /** False while this task's focus block is running. */
  canArchive: boolean;
  onClose: () => void;
  onSaved: () => void;
}

export function TaskEditor({ task, canArchive, onClose, onSaved }: Props) {
  const dialog = useRef<HTMLDialogElement>(null);
  const [form, setForm] = useState(() => toForm(task));
  const [confirmArchive, setConfirmArchive] = useState(false);
  const [error, setError] = useState("");

  // showModal() gives focus trapping, Esc to close and a backdrop for free.
  // The guard is for StrictMode, which runs effects twice in dev.
  useEffect(() => {
    if (dialog.current && !dialog.current.open) dialog.current.showModal();
  }, []);

  const field = (key: keyof Form) => ({
    value: form[key],
    onChange: (e: ChangeEvent<HTMLInputElement>) => setForm({ ...form, [key]: e.target.value }),
  });

  const run = (cmd: string, args: Record<string, unknown>) =>
    invoke(cmd, args).then(onSaved, (e) => setError(String(e)));

  function save(e: FormEvent) {
    e.preventDefault();
    const input = toInput(form);
    if (typeof input === "string") return setError(input);
    run(task ? "update_task" : "create_task", task ? { id: task.id, task: input } : { task: input });
  }

  return (
    <dialog ref={dialog} className="editor" onClose={onClose}>
      <form onSubmit={save}>
        <h2>{task ? "Edit task" : "New task"}</h2>

        <label>
          Name
          <input autoFocus {...field("name")} />
        </label>

        <div className="palette" role="radiogroup" aria-label="Color">
          {PALETTE.map((c) => (
            <button
              key={c}
              type="button"
              role="radio"
              aria-checked={form.color === c}
              className="swatch-pick"
              style={{ background: c }}
              onClick={() => setForm({ ...form, color: c })}
            />
          ))}
        </div>

        <div className="pair">
          <label>
            Weekly target (h)
            <input type="number" min="0" step="0.5" {...field("weeklyHours")} />
          </label>
          <label>
            Long-term total (h)
            <input type="number" min="0" step="1" placeholder="optional" {...field("totalHours")} />
          </label>
        </div>

        <details open={Boolean(task?.focusMinutes || task?.shortBreakMinutes || task?.longBreakMinutes)}>
          <summary>Pomodoro override</summary>
          <p className="hint">Leave empty to use the defaults. Applies from the next block.</p>
          <div className="pair">
            <label>
              Focus (min)
              <input type="number" min="1" {...field("focus")} />
            </label>
            <label>
              Short break
              <input type="number" min="1" {...field("shortBreak")} />
            </label>
            <label>
              Long break
              <input type="number" min="1" {...field("longBreak")} />
            </label>
          </div>
        </details>

        {error && <p className="error">{error}</p>}

        <div className="actions">
          {task &&
            (confirmArchive ? (
              <button type="button" className="danger" onClick={() => run("archive_task", { id: task.id })}>
                Archive — logged time is kept
              </button>
            ) : (
              <button
                type="button"
                disabled={!canArchive}
                title={canArchive ? undefined : "Can't archive during this task's focus block"}
                onClick={() => setConfirmArchive(true)}
              >
                Archive
              </button>
            ))}
          <span className="spacer" />
          <button type="button" onClick={() => dialog.current?.close()}>Cancel</button>
          <button type="submit">Save</button>
        </div>
      </form>
    </dialog>
  );
}
