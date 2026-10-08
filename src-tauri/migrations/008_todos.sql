-- A plain checklist, separate from the timer. A to-do can be tagged with a task, but needn't be.
-- Ticked items keep their row (done_at set), so reporting and the shop can count them later.
CREATE TABLE todos (
    id         INTEGER PRIMARY KEY,
    text       TEXT    NOT NULL CHECK (length(text) BETWEEN 1 AND 200),
    task_id    INTEGER REFERENCES tasks(id) ON DELETE RESTRICT,
    created_at INTEGER NOT NULL DEFAULT (unixepoch()),
    done_at    INTEGER
);

CREATE INDEX todos_done_at ON todos(done_at);
