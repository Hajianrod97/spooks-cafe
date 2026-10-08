-- Preferences added with the settings panel. Launch at login isn't stored here:
-- macOS owns that (a LaunchAgent), so the app asks it instead of keeping a copy that can drift.
ALTER TABLE settings ADD COLUMN chime         INTEGER NOT NULL DEFAULT 1 CHECK (chime IN (0, 1));
ALTER TABLE settings ADD COLUMN always_on_top INTEGER NOT NULL DEFAULT 0 CHECK (always_on_top IN (0, 1));
