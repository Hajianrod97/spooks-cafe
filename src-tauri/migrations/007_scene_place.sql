-- Which scene the window shows; changed only with the scene arrows. 'outside' is allowed already
-- so adding that scene later needs no migration (SQLite can't alter a CHECK in place).
ALTER TABLE settings ADD COLUMN scene TEXT NOT NULL DEFAULT 'counter'
    CHECK (scene IN ('outside', 'counter', 'tables'));
