-- When each time-of-day phase starts, as an hour of the day. Each lasts until the next one
-- starts and night wraps past midnight, so the four must be in order (checked in Rust).
ALTER TABLE settings ADD COLUMN morning_start   INTEGER NOT NULL DEFAULT 6  CHECK (morning_start BETWEEN 0 AND 23);
ALTER TABLE settings ADD COLUMN afternoon_start INTEGER NOT NULL DEFAULT 12 CHECK (afternoon_start BETWEEN 0 AND 23);
ALTER TABLE settings ADD COLUMN evening_start   INTEGER NOT NULL DEFAULT 17 CHECK (evening_start BETWEEN 0 AND 23);
ALTER TABLE settings ADD COLUMN night_start     INTEGER NOT NULL DEFAULT 20 CHECK (night_start BETWEEN 0 AND 23);
-- 'auto' follows the clock; anything else pins the scene to that time of day.
ALTER TABLE settings ADD COLUMN scene_time TEXT NOT NULL DEFAULT 'auto'
    CHECK (scene_time IN ('auto', 'morning', 'afternoon', 'evening', 'night'));
