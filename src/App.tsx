import { useCallback, useEffect, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import type { Task } from "./types";
import { Chalkboard } from "./cafe/Chalkboard";
import { Scene } from "./cafe/Scene";
import { MusicBar } from "./MusicBar";
import { NotePrompt } from "./NotePrompt";
import { SessionsDialog } from "./SessionsDialog";
import { SettingsDialog } from "./SettingsDialog";
import { TaskEditor } from "./TaskEditor";
import { useMusic } from "./useMusic";
import { useTimer } from "./useTimer";
import { useWeeklyProgress } from "./useWeeklyProgress";
import "./App.css";

function App() {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [error, setError] = useState("");
  const [editing, setEditing] = useState<Task | "new" | null>(null);
  const [showSettings, setShowSettings] = useState(false);
  const [showSessions, setShowSessions] = useState(false);
  const { timer, tickError } = useTimer();
  // One subscription shared by the music bar and Spook's notes.
  const music = useMusic();
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
      <Scene
        timer={timer}
        task={activeTask}
        onAction={call}
        onSettings={() => setShowSettings(true)}
        music={music.music}
      />

      <div className="below">
        {onBreak && <NotePrompt />}
        <MusicBar {...music} />

        {(error || tickError) && <p className="error">{error || tickError}</p>}

        <Chalkboard
          phase={timer.phase}
          tasks={tasks}
          progress={progress}
          activeTaskId={activeTaskId}
          locked={inFocus}
          onPick={setSelectedId}
          onEdit={setEditing}
          onAdd={() => setEditing("new")}
          onSessions={() => setShowSessions(true)}
        />
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
