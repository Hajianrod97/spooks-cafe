import { useCallback, useEffect, useRef, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import type { Session, Task } from "./types";
import { useModal } from "./useModal";

const dayLabel = (d: Date) => d.toLocaleDateString(undefined, { weekday: "short", day: "numeric", month: "short" });
const timeLabel = (d: Date) => d.toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" });

/** Sessions grouped by local day, keeping the newest-first order from the backend. */
function byDay(sessions: Session[]) {
  const groups = new Map<string, Session[]>();
  for (const s of sessions) {
    const day = dayLabel(new Date(s.startedAt * 1000));
    groups.set(day, [...(groups.get(day) ?? []), s]);
  }
  return [...groups];
}

interface Props {
  /** Active tasks, for moving a session to another task. */
  tasks: Task[];
  onClose: () => void;
  /** Called after any edit or delete, so the progress bars can refresh. */
  onChanged: () => void;
}

export function SessionsDialog({ tasks, onClose, onChanged }: Props) {
  const dialog = useModal();
  const [sessions, setSessions] = useState<Session[] | null>(null);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [error, setError] = useState("");
  const [exported, setExported] = useState("");

  const load = useCallback(() => {
    invoke<Session[]>("week_sessions").then(setSessions, (e) => setError(String(e)));
  }, []);
  useEffect(load, [load]);

  const run = (cmd: string, args: Record<string, unknown>) =>
    invoke(cmd, args).then(
      () => {
        setEditingId(null);
        setError("");
        load();
        onChanged();
      },
      (e) => setError(String(e)),
    );

  return (
    <dialog ref={dialog} className="editor sessions" onClose={onClose}>
      <h2>This week</h2>
      {sessions?.length === 0 && <p className="hint">No sessions yet this week.</p>}
      {sessions &&
        byDay(sessions).map(([day, rows]) => (
          <section key={day}>
            <h3>{day}</h3>
            {rows.map((s) =>
              editingId === s.id ? (
                <SessionForm
                  key={s.id}
                  session={s}
                  tasks={tasks}
                  onCancel={() => setEditingId(null)}
                  onSave={(edit) => run("update_session", { id: s.id, edit })}
                />
              ) : (
                <SessionRow
                  key={s.id}
                  session={s}
                  onEdit={() => setEditingId(s.id)}
                  onDelete={() => run("delete_session", { id: s.id })}
                />
              ),
            )}
          </section>
        ))}
      {error && <p className="error">{error}</p>}
      {exported && <p className="hint">Saved to {exported}</p>}
      <div className="actions">
        {(["csv", "json"] as const).map((format) => (
          <button
            key={format}
            type="button"
            title="All sessions, every week, saved to Downloads"
            onClick={() => invoke<string>("export_data", { format }).then(setExported, (e) => setError(String(e)))}
          >
            Export {format.toUpperCase()}
          </button>
        ))}
        <span className="spacer" />
        <button type="button" onClick={() => dialog.current?.close()}>Close</button>
      </div>
    </dialog>
  );
}

function SessionRow({ session: s, onEdit, onDelete }: { session: Session; onEdit: () => void; onDelete: () => void }) {
  const [confirming, setConfirming] = useState(false);
  const deleteButton = useRef<HTMLButtonElement>(null);

  // Any click outside the Delete button cancels. A page-level listener rather than onBlur,
  // because WebKit doesn't move focus when you click non-focusable content.
  useEffect(() => {
    if (!confirming) return;
    const cancel = (e: PointerEvent) => {
      if (!deleteButton.current?.contains(e.target as Node)) setConfirming(false);
    };
    document.addEventListener("pointerdown", cancel);
    return () => document.removeEventListener("pointerdown", cancel);
  }, [confirming]);

  return (
    <div className="session">
      <div className="session-line">
        <span className="time">{timeLabel(new Date(s.startedAt * 1000))}</span>
        <span className="swatch" style={{ background: s.taskColor }} />
        <span className="name">
          {s.taskName}
          {s.taskArchived && <span className="tag">archived</span>}
        </span>
        <span className="stats">
          {s.durationMinutes}m {s.completed ? "🍅" : "· partial"}
        </span>
        <button className="icon" aria-label="Edit session" onClick={onEdit}>✎</button>
        {confirming ? (
          <button ref={deleteButton} className="danger" onClick={onDelete}>
            Delete
          </button>
        ) : (
          <button className="icon" aria-label="Delete session" onClick={() => setConfirming(true)}>🗑</button>
        )}
      </div>
      {s.note && <div className="note">{s.note}</div>}
    </div>
  );
}

interface FormProps {
  session: Session;
  tasks: Task[];
  onCancel: () => void;
  onSave: (edit: { taskId: number; durationMinutes: number; note: string }) => void;
}

function SessionForm({ session, tasks, onCancel, onSave }: FormProps) {
  const [taskId, setTaskId] = useState(session.taskId);
  const [minutes, setMinutes] = useState(String(session.durationMinutes));
  const [note, setNote] = useState(session.note ?? "");
  const valid = Number.isInteger(Number(minutes)) && Number(minutes) >= 1;
  // A session can keep a task that's since been archived, so it stays in the options.
  const options = session.taskArchived
    ? [{ id: session.taskId, name: `${session.taskName} (archived)` }, ...tasks]
    : tasks;

  return (
    <form
      className="session session-form"
      onSubmit={(e) => {
        e.preventDefault();
        onSave({ taskId, durationMinutes: Number(minutes), note });
      }}
    >
      <div className="session-line">
        <select value={taskId} onChange={(e) => setTaskId(Number(e.target.value))}>
          {options.map((t) => (
            <option key={t.id} value={t.id}>{t.name}</option>
          ))}
        </select>
        <input type="number" min="1" className="minutes" value={minutes} onChange={(e) => setMinutes(e.target.value)} />
        <span className="hint">min</span>
      </div>
      <input placeholder="Note (optional)" maxLength={200} value={note} onChange={(e) => setNote(e.target.value)} />
      <div className="actions">
        <span className="spacer" />
        <button type="button" onClick={onCancel}>Cancel</button>
        <button type="submit" disabled={!valid}>Save</button>
      </div>
    </form>
  );
}
