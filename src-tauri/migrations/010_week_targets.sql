-- Each task's weekly target as it was in a given week, so past weeks are judged against the
-- target they had then. week_start is that week's local Monday 00:00 (Unix seconds). Weeks
-- with no row fall back to the task's current target.
CREATE TABLE week_targets (
    week_start     INTEGER NOT NULL,
    task_id        INTEGER NOT NULL REFERENCES tasks(id) ON DELETE RESTRICT,
    target_minutes INTEGER NOT NULL CHECK (target_minutes >= 0),
    PRIMARY KEY (week_start, task_id)
);
