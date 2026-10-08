-- Music player preferences. Whether music is playing isn't stored: it never starts by itself.
ALTER TABLE settings ADD COLUMN music_source TEXT NOT NULL DEFAULT 'lofiGirl'
    CHECK (music_source IN ('lofiGirl', 'chillhop', 'custom'));
ALTER TABLE settings ADD COLUMN music_custom_url TEXT;
ALTER TABLE settings ADD COLUMN music_volume INTEGER NOT NULL DEFAULT 50
    CHECK (music_volume BETWEEN 0 AND 100);
