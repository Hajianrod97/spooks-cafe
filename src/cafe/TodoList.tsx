import { useState } from "react";
import { createPortal } from "react-dom";
import { TodoEditor, type TodoDraft } from "../TodoEditor";
import type { Task, Todo } from "../types";
import type { Todos } from "../useTodos";

interface Props {
  tasks: Task[];
  todos: Todos;
  /** Today's to-do beans are used up; ticks still count, they just don't pay. */
  beansMaxed: boolean;
}

/**
 * The board's to-do section: dailies (back unticked every morning) above one-time to-dos.
 * Tags only offer active tasks.
 */
export function TodoList({ tasks, todos: { todos, error, add, setDone, remove }, beansMaxed }: Props) {
  const [adding, setAdding] = useState(false);
  // The kind and tag used last, offered again next time.
  const [last, setLast] = useState<TodoDraft>({ daily: false, taskId: null });
  // Removing a daily stops it for every future day, so its row asks first.
  const [confirming, setConfirming] = useState<number | null>(null);
  const open = todos.filter((t) => t.doneAt === null).length;
  const dailies = todos.filter((t) => t.daily);
  const oneTime = todos.filter((t) => !t.daily);

  function addTodo(text: string, draft: TodoDraft) {
    setLast(draft);
    return add(text, draft.taskId, draft.daily);
  }

  function group(title: string, items: Todo[]) {
    if (items.length === 0) return null;
    return (
      <section className="todo-group" aria-label={title}>
        <h4>{title}</h4>
        <ul>
          {items.map((todo) =>
            confirming === todo.id ? (
              <li key={todo.id} className="confirm" onKeyDown={(e) => e.key === "Escape" && setConfirming(null)}>
                <span className="text">Stop repeating “{todo.text}”?</span>
                <button className="chalk-small" onClick={() => remove(todo.id).then(() => setConfirming(null))}>
                  Stop
                </button>
                <button className="chalk-small" autoFocus onClick={() => setConfirming(null)}>
                  Keep
                </button>
              </li>
            ) : (
              <li key={todo.id} className={todo.doneAt === null ? undefined : "done"}>
                <label>
                  <input type="checkbox" checked={todo.doneAt !== null} onChange={(e) => setDone(todo.id, e.target.checked)} />
                  <span className="text">{todo.text}</span>
                  {todo.taskName && (
                    <span className="tag">
                      <span className="dot" style={{ background: todo.taskColor ?? undefined }} />
                      {todo.taskName}
                    </span>
                  )}
                </label>
                <button
                  className="remove"
                  aria-label={todo.daily ? `Stop repeating "${todo.text}"` : `Delete "${todo.text}"`}
                  title={todo.daily ? "Stop repeating" : "Delete"}
                  onClick={() => (todo.daily ? setConfirming(todo.id) : remove(todo.id))}
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" aria-hidden="true">
                    <path d="M6 6l12 12M18 6 6 18" />
                  </svg>
                </button>
              </li>
            ),
          )}
        </ul>
      </section>
    );
  }

  return (
    <div className="todos">
      <p className="status">
        {todos.length === 0 ? "Nothing to do yet" : open === 0 ? "All done!" : `${open} left`}
        {beansMaxed && " · today's to-do beans maxed"}
      </p>

      {error && <p className="error">{error}</p>}

      {todos.length === 0 ? (
        <p className="empty">Add one below.</p>
      ) : (
        <>
          {group("Daily", dailies)}
          {group("Today", oneTime)}
        </>
      )}

      <footer>
        <button className="chalk-button" onClick={() => setAdding(true)}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" aria-hidden="true">
            <path d="M12 5v14M5 12h14" />
          </svg>
          Add to-do
        </button>
      </footer>

      {/* Portalled to <body>: inside the board, the dialog would inherit its chalk font and colours. */}
      {adding &&
        createPortal(
          <TodoEditor tasks={tasks} last={last} onAdd={addTodo} error={error} onClose={() => setAdding(false)} />,
          document.body,
        )}
    </div>
  );
}
