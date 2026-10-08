import { useEffect, useState, type FormEvent } from "react";
import { invoke } from "@tauri-apps/api/core";
import type { Session } from "./types";

/** Shown during a break: an optional one-line note for the block that just ended. */
export function NotePrompt() {
  const [session, setSession] = useState<Session | null>(null);
  const [note, setNote] = useState("");
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState("");

  // Mounted fresh for each break, so this fetches the block that just ended.
  useEffect(() => {
    invoke<Session | null>("latest_session").then((s) => {
      setSession(s);
      setNote(s?.note ?? "");
    });
  }, []);

  if (!session) return null;

  function save(e: FormEvent) {
    e.preventDefault();
    if (!session) return;
    const edit = { taskId: session.taskId, durationMinutes: session.durationMinutes, note };
    invoke("update_session", { id: session.id, edit }).then(
      () => {
        setSaved(true);
        setError("");
      },
      (e) => setError(String(e)),
    );
  }

  return (
    <form className="note-prompt" onSubmit={save}>
      <div className="hint">
        Just finished: <span className="swatch" style={{ background: session.taskColor }} /> {session.taskName} ·{" "}
        {session.durationMinutes} min
      </div>
      <input
        placeholder="What did you work on?"
        maxLength={200}
        value={note}
        onChange={(e) => {
          setNote(e.target.value);
          setSaved(false);
        }}
      />
      {saved && <span className="hint"> Saved ✓</span>}
      {error && <p className="error">{error}</p>}
    </form>
  );
}
