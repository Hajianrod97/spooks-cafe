-- The cafe shop. Beans are never stored as a balance: every earning and spending is a row in
-- an append-only ledger, and the balance is the sum. Rows are never edited or deleted, so a
-- change to the earning rules never rewrites what was already paid.
CREATE TABLE bean_ledger (
    id     INTEGER PRIMARY KEY,
    at     INTEGER NOT NULL DEFAULT (unixepoch()),
    amount INTEGER NOT NULL CHECK (amount <> 0),
    reason TEXT    NOT NULL CHECK (reason IN ('focus', 'todo', 'target', 'purchase', 'backfill')),
    -- What the row pays for, e.g. 'session:12', 'todo:3', 'todo:4:<local midnight>', 'target:1:2026-10-05',
    -- 'item:beanie'. Unique, so nothing pays (or is bought) twice. NULL only for the backfill.
    ref    TEXT UNIQUE
);
CREATE INDEX bean_ledger_reason_at ON bean_ledger(reason, at);

-- Item ids come from the catalogue in code (shop.rs).
CREATE TABLE owned_items (
    item_id   TEXT PRIMARY KEY,
    bought_at INTEGER NOT NULL DEFAULT (unixepoch())
);

-- Where each decoration stands. One item in one place, one item per slot.
CREATE TABLE placements (
    slot_id TEXT PRIMARY KEY,
    item_id TEXT NOT NULL UNIQUE REFERENCES owned_items(item_id) ON DELETE RESTRICT
);

ALTER TABLE settings ADD COLUMN hat TEXT REFERENCES owned_items(item_id);

-- Backfill: pay the history from before the shop existed, at the same rates as shop.rs but
-- without the to-do guard. Completed blocks pay round(minutes / 2.5); every tick pays 2.
INSERT INTO bean_ledger (amount, reason)
SELECT total, 'backfill' FROM (
    SELECT (SELECT COALESCE(SUM((duration_minutes * 4 + 5) / 10), 0) FROM sessions WHERE completed = 1)
         + (SELECT COUNT(*) * 2 FROM todo_ticks) AS total
)
WHERE total > 0;

-- Target bonuses, one row per task-week that reached its target. A week is keyed by its local
-- Monday ('-6 days' then 'weekday 1' lands on the Monday on or before the date), the same key
-- shop.rs uses, so this week's bonus can't be paid again by the next block.
WITH weeks AS (
    SELECT task_id,
           date(started_at, 'unixepoch', 'localtime', '-6 days', 'weekday 1') AS monday,
           SUM(duration_minutes) AS minutes
    FROM sessions
    GROUP BY task_id, monday
)
INSERT INTO bean_ledger (amount, reason, ref)
SELECT 25, 'target', 'target:' || w.task_id || ':' || w.monday
FROM weeks w
JOIN tasks t ON t.id = w.task_id
LEFT JOIN week_targets wt
       ON wt.task_id = w.task_id AND date(wt.week_start, 'unixepoch', 'localtime') = w.monday
WHERE COALESCE(wt.target_minutes, t.weekly_target_minutes) > 0
  AND w.minutes >= COALESCE(wt.target_minutes, t.weekly_target_minutes);
