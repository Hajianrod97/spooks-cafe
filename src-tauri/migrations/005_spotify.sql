-- Spotify alongside YouTube; one service plays at a time. `music_source` stays the YouTube preset.
ALTER TABLE settings ADD COLUMN music_service TEXT NOT NULL DEFAULT 'youtube'
    CHECK (music_service IN ('youtube', 'spotify'));
-- A `spotify:playlist:…` or `spotify:album:…` URI; NULL resumes whatever Spotify last played.
ALTER TABLE settings ADD COLUMN spotify_link TEXT;
