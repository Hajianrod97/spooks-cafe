import { useEffect, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import type { Task } from "./types";
import "./App.css";

const hours = (minutes: number) => +(minutes / 60).toFixed(1);

function App() {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [error, setError] = useState("");

  useEffect(() => {
    invoke<Task[]>("list_tasks").then(setTasks, (e) => setError(String(e)));
  }, []);

  return (
    <main className="container">
      <h1>Lofi Focus</h1>
      {error && <p className="error">{error}</p>}
      <ul className="tasks">
        {tasks.map((task) => (
          <li key={task.id}>
            <span className="swatch" style={{ background: task.color }} />
            {task.name} — 0 / {hours(task.weeklyTargetMinutes)} h
          </li>
        ))}
      </ul>
    </main>
  );
}

export default App;
