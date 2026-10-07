-- The running timer, saved every few seconds so it survives a crash, quit or sleep.
CREATE TABLE timer_state (
    id             INTEGER PRIMARY KEY CHECK (id = 1),
    phase          TEXT    NOT NULL CHECK (phase IN ('idle', 'focus', 'shortBreak', 'longBreak')),
    task_id        INTEGER REFERENCES tasks(id),
    length_secs    INTEGER NOT NULL,
    elapsed_secs   INTEGER NOT NULL,
    started_at     INTEGER NOT NULL,
    focus_streak   INTEGER NOT NULL,
    last_focus_end INTEGER
);
