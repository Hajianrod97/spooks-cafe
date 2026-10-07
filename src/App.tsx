import { useEffect, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import type { Phase, Task } from "./types";
import { useTimer } from "./useTimer";
import "./App.css";

const hours = (minutes: number) => +(minutes / 60).toFixed(1);

const clock = (secs: number) =>
  `${String(Math.floor(secs / 60)).padStart(2, "0")}:${String(secs % 60).padStart(2, "0")}`;

const PHASE_LABEL: Record<Phase, string> = {
  idle: "Ready",
  focus: "Focus",
  shortBreak: "Short break",
  longBreak: "Long break",
};

function App() {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [error, setError] = useState("");
  const { timer, tickError } = useTimer();

  useEffect(() => {
    invoke<Task[]>("list_tasks").then(setTasks, (e) => setError(String(e)));
  }, []);

  const call = (cmd: string, args?: Record<string, unknown>) =>
    invoke(cmd, args).then(() => setError(""), (e) => setError(String(e)));

  if (!timer) return null;
  const inFocus = timer.phase === "focus";
  const onBreak = timer.phase === "shortBreak" || timer.phase === "longBreak";
  // Defaults to the last task used, matching the menu bar's "Start focus".
  const activeTaskId = inFocus ? timer.taskId : (selectedId ?? timer.taskId);

  return (
    <main className="container">
      <h1>Lofi Focus</h1>

      <section className="timer">
        <div className="phase">{PHASE_LABEL[timer.phase]}{!timer.running && timer.phase !== "idle" && " · paused"}</div>
        <div className="clock">{clock(timer.remainingSecs)}</div>
        <div className="row">
          {!inFocus && (
            <button disabled={activeTaskId === null} onClick={() => call("start_focus", { taskId: activeTaskId })}>
              Start focus
            </button>
          )}
          {timer.phase !== "idle" &&
            (timer.running
              ? <button onClick={() => call("pause")}>Pause</button>
              : <button onClick={() => call("resume")}>Resume</button>)}
          {inFocus && <button onClick={() => call("discard")}>Discard</button>}
          {onBreak && <button onClick={() => call("skip_break")}>Skip break</button>}
        </div>
        {!inFocus && activeTaskId === null && <p className="hint">Pick a task below to start.</p>}
      </section>

      {(error || tickError) && <p className="error">{error || tickError}</p>}

      <ul className="tasks">
        {tasks.map((task) => (
          <li key={task.id}>
            <label className={inFocus ? "locked" : undefined}>
              <input
                type="radio"
                name="task"
                checked={activeTaskId === task.id}
                disabled={inFocus}
                onChange={() => setSelectedId(task.id)}
              />
              <span className="swatch" style={{ background: task.color }} />
              {task.name} — 0 / {hours(task.weeklyTargetMinutes)} h
            </label>
          </li>
        ))}
      </ul>
    </main>
  );
}

export default App;
