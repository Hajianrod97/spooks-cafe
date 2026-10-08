import { useCallback, useEffect, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import type { Todo } from "./types";
import { useWindowVisible } from "./useWindowVisible";

/**
 * The to-do list. Every todo command answers with the whole list, so each change just
 * replaces it. It's also refetched when the window is shown and at midnight.
 */
export function useTodos() {
  const [todos, setTodos] = useState<Todo[]>([]);
  const [error, setError] = useState("");
  const visible = useWindowVisible();

  /** Resolves to whether the change went through, so a form knows when to clear itself. */
  const run = useCallback(
    (cmd: string, args?: Record<string, unknown>) =>
      invoke<Todo[]>(cmd, args).then(
        (list) => {
          setTodos(list);
          setError("");
          return true;
        },
        (e) => {
          setError(String(e));
          return false;
        },
      ),
    [],
  );

  useEffect(() => {
    if (visible) run("list_todos");
  }, [visible, run]);

  // Dailies reset and ticked one-time to-dos drop off at midnight; refetch then in case the
  // window is open across it. Re-armed after every change, since `todos` changes with each.
  useEffect(() => {
    const midnight = new Date();
    midnight.setHours(24, 0, 1, 0);
    const timer = setTimeout(() => run("list_todos"), midnight.getTime() - Date.now());
    return () => clearTimeout(timer);
  }, [todos, run]);

  return {
    todos,
    error,
    add: (text: string, taskId: number | null, daily: boolean) => run("add_todo", { text, taskId, daily }),
    setDone: (id: number, done: boolean) => run("set_todo_done", { id, done }),
    remove: (id: number) => run("delete_todo", { id }),
  };
}

export type Todos = ReturnType<typeof useTodos>;
