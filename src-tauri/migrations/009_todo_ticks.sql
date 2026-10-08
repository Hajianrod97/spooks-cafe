-- Daily to-dos, and one table of ticks for every kind of to-do. A one-time to-do is done once
-- it has a tick; a daily is done today if it has a tick since local midnight. Deleting a to-do
-- only hides it, so its ticks stay for reporting and the shop.
ALTER TABLE todos ADD COLUMN daily INTEGER NOT NULL DEFAULT 0 CHECK (daily IN (0, 1));
ALTER TABLE todos ADD COLUMN deleted_at INTEGER;

CREATE TABLE todo_ticks (
    todo_id INTEGER NOT NULL REFERENCES todos(id) ON DELETE RESTRICT,
    done_at INTEGER NOT NULL
);
CREATE INDEX todo_ticks_todo ON todo_ticks(todo_id, done_at);
CREATE INDEX todo_ticks_done_at ON todo_ticks(done_at);

INSERT INTO todo_ticks (todo_id, done_at) SELECT id, done_at FROM todos WHERE done_at IS NOT NULL;
DROP INDEX todos_done_at;
ALTER TABLE todos DROP COLUMN done_at;
