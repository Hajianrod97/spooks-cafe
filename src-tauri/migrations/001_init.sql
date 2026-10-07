-- All durations are in minutes. Timestamps are Unix seconds (UTC).

CREATE TABLE tasks (
    id                    INTEGER PRIMARY KEY,
    name                  TEXT    NOT NULL,
    color                 TEXT    NOT NULL,
    weekly_target_minutes INTEGER NOT NULL DEFAULT 0,
    total_target_minutes  INTEGER,
    -- Pomodoro overrides; NULL means "use the global setting".
    focus_minutes         INTEGER,
    short_break_minutes   INTEGER,
    long_break_minutes    INTEGER,
    archived              INTEGER NOT NULL DEFAULT 0 CHECK (archived IN (0, 1)),
    sort_order            INTEGER NOT NULL DEFAULT 0,
    created_at            INTEGER NOT NULL DEFAULT (unixepoch())
);



-- Single-row table: typed columns instead of key/value strings.
CREATE TABLE settings (
    id                   INTEGER PRIMARY KEY CHECK (id = 1),
    focus_minutes        INTEGER NOT NULL DEFAULT 25,
    short_break_minutes  INTEGER NOT NULL DEFAULT 5,
    long_break_minutes   INTEGER NOT NULL DEFAULT 15,
    long_break_every     INTEGER NOT NULL DEFAULT 4
);

INSERT INTO settings (id) VALUES (1);

CREATE TABLE sessions (
    id          INTEGER PRIMARY KEY,
    task_id     INTEGER NOT NULL REFERENCES tasks(id) ON DELETE RESTRICT,
    started_at INTEGER NOT NULL,
    duration_minutes   INTEGER NOT NULL CHECK (duration_minutes >= 0),
    completed  INTEGER NOT NULL CHECK (completed IN (0, 1)),
    note      TEXT
);

CREATE INDEX sessions_started_at ON sessions(started_at);


INSERT INTO tasks (name, color, weekly_target_minutes, sort_order) VALUES
    ('LeetCode',            '#E8A87C', 480, 1),
    ('Job Search',          '#C38D9E', 420, 2),
    ('System Design',       '#41B3A3', 240, 3),
    ('AI Engineering',      '#8E9AAF', 240, 4),
    ('Side Projects / OSS', '#F2C14E', 240, 5),
    ('CS Fundamentals',     '#7FA7C9', 120, 6),
    ('Debugging',           '#D96C6C',  60, 7);
