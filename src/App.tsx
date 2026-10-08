import { useCallback, useEffect, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import type { Task } from "./types";
import { Scene } from "./cafe/Scene";
import { MusicBar } from "./MusicBar";
import { NotePrompt } from "./NotePrompt";
import { SessionsDialog } from "./SessionsDialog";
import { SettingsDialog } from "./SettingsDialog";
import { TaskEditor } from "./TaskEditor";
import { useTimer } from "./useTimer";
import { useWeeklyProgress } from "./useWeeklyProgress";
import "./App.css";

const hours = (minutes: number) => +(minutes / 60).toFixed(1);

function App() {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [error, setError] = useState("");
  const [editing, setEditing] = useState<Task | "new" | null>(null);
  const [showSettings, setShowSettings] = useState(false);
  const [showSessions, setShowSessions] = useState(false);
  const { timer, tickError } = useTimer();
  const { progress, reload: reloadProgress } = useWeeklyProgress(timer?.phase);

  const loadTasks = useCallback(() => {
    invoke<Task[]>("list_tasks").then(setTasks, (e) => setError(String(e)));
  }, []);
  useEffect(loadTasks, [loadTasks]);

  const call = (cmd: string, args?: Record<string, unknown>) =>
    invoke(cmd, args).then(() => setError(""), (e) => setError(String(e)));

  if (!timer) return null;
  const inFocus = timer.phase === "focus";
  const onBreak = timer.phase === "shortBreak" || timer.phase === "longBreak";
  // Defaults to the last task used, matching the menu bar's "Start focus". Either may since
  // have been archived, so only ids still in the list count.
  const isListed = (id: number | null) => tasks.some((t) => t.id === id);
  const activeTaskId = inFocus ? timer.taskId : ([selectedId, timer.taskId].find(isListed) ?? null);
  const activeTask = tasks.find((t) => t.id === activeTaskId);

  return (
    <main>
      <Scene timer={timer} task={activeTask} onAction={call} onSettings={() => setShowSettings(true)} />

      <div className="below">
        {onBreak && <NotePrompt />}
        <MusicBar />

        {(error || tickError) && <p className="error">{error || tickError}</p>}

        <ul className="tasks">
          {tasks.map((task) => {
            const done = progress.get(task.id);
            const minutes = done?.minutes ?? 0;
            const target = task.weeklyTargetMinutes;
            return (
              <li key={task.id}>
                <div className="task-row">
                  <label className={inFocus ? "locked" : undefined}>
                    <input
                      type="radio"
                      name="task"
                      checked={activeTaskId === task.id}
                      disabled={inFocus}
                      onChange={() => setSelectedId(task.id)}
                    />
                    <span className="swatch" style={{ background: task.color }} />
                    <span className="name">{task.name}</span>
                    <span className="stats">
                      {hours(minutes)}{target > 0 && ` / ${hours(target)}`} h · {done?.pomodoros ?? 0} 🍅
                    </span>
                  </label>
                  <button className="icon" aria-label={`Edit ${task.name}`} onClick={() => setEditing(task)}>✎</button>
                </div>
                {target > 0 && (
                  <div className="bar">
                    <div style={{ width: `${Math.min(minutes / target, 1) * 100}%`, background: task.color }} />
                  </div>
                )}
              </li>
            );
          })}
        </ul>
        <div className="row list-actions">
          <button className="add" onClick={() => setEditing("new")}>+ Add task</button>
          <button className="add" onClick={() => setShowSessions(true)}>This week's sessions</button>
        </div>
      </div>

      {editing && (
        <TaskEditor
          task={editing === "new" ? null : editing}
          canArchive={!(inFocus && editing !== "new" && editing.id === timer.taskId)}
          onClose={() => setEditing(null)}
          onSaved={() => {
            setEditing(null);
            loadTasks();
          }}
        />
      )}
      {showSettings && <SettingsDialog onClose={() => setShowSettings(false)} />}
      {showSessions && (
        <SessionsDialog tasks={tasks} onClose={() => setShowSessions(false)} onChanged={reloadProgress} />
      )}
    </main>
  );
}

export default App;
