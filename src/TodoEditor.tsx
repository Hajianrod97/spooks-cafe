import { useState, type FormEvent } from "react";
import type { Task } from "./types";
import { useModal } from "./useModal";

export interface TodoDraft {
  daily: boolean;
  taskId: number | null;
}

interface Props {
  tasks: Task[];
  /** The kind and tag used last time, so a run of similar to-dos needs them picked once. */
  last: TodoDraft;
  /** Resolves to whether the to-do was added. */
  onAdd: (text: string, draft: TodoDraft) => Promise<boolean>;
  error: string;
  onClose: () => void;
}

/** Adding a to-do: its text, whether it repeats daily, and an optional task tag. */
export function TodoEditor({ tasks, last, onAdd, error, onClose }: Props) {
  const dialog = useModal();
  const [text, setText] = useState("");
  const [daily, setDaily] = useState(last.daily);
  // A remembered tag may since have been archived.
  const [taskId, setTaskId] = useState(tasks.some((t) => t.id === last.taskId) ? last.taskId : null);

  function save(e: FormEvent) {
    e.preventDefault();
    if (!text.trim()) return;
    onAdd(text, { daily, taskId }).then((ok) => ok && dialog.current?.close());
  }

  return (
    <dialog ref={dialog} className="editor" onClose={onClose}>
      <form onSubmit={save}>
        <h2>New to-do</h2>

        <label>
          To-do
          <input autoFocus maxLength={200} value={text} onChange={(e) => setText(e.target.value)} />
        </label>

        <fieldset>
          <legend>Repeats</legend>
          <label className="toggle">
            <input type="radio" name="todo-kind" checked={!daily} onChange={() => setDaily(false)} />
            One-time — stays until it's done
          </label>
          <label className="toggle">
            <input type="radio" name="todo-kind" checked={daily} onChange={() => setDaily(true)} />
            Daily — back unticked every morning
          </label>
        </fieldset>

        <label>
          Tag
          <select value={taskId ?? ""} onChange={(e) => setTaskId(e.target.value ? Number(e.target.value) : null)}>
            <option value="">No tag</option>
            {tasks.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name}
              </option>
            ))}
          </select>
        </label>

        {error && <p className="error">{error}</p>}

        <div className="actions">
          <span className="spacer" />
          <button type="button" onClick={() => dialog.current?.close()}>
            Cancel
          </button>
          <button type="submit" disabled={!text.trim()}>
            Add
          </button>
        </div>
      </form>
    </dialog>
  );
}
