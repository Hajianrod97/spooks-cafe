#!/usr/bin/env bash
# Builds the release app and installs it over the one in /Applications:
# build → quit the running app → back up the database → replace → relaunch.
# Usage: npm run release:install
set -euo pipefail

APP_NAME="Spook's Cafe"
BUNDLE_ID="dev.lofifocus.app"
INSTALLED="/Applications/$APP_NAME.app"
BUILT="src-tauri/target/release/bundle/macos/$APP_NAME.app"
# The data folder keeps the app's original name (see CLAUDE.md).
DATA_DIR="$HOME/Library/Application Support/Lofi Focus"
DB="$DATA_DIR/lofi-focus.db"
BACKUPS="$DATA_DIR/backups"
KEEP_BACKUPS=10

cd "$(dirname "$0")/.."

# Matched by path, so it works whatever the executable inside the bundle is called.
running() { pgrep -f "$INSTALLED/Contents/MacOS/" >/dev/null; }

version_of() {
  defaults read "$1/Contents/Info" CFBundleShortVersionString 2>/dev/null || echo "none"
}

# Build first, so the app keeps running during the slow part. Only the .app: the .dmg is for sharing.
npm run tauri build -- --bundles app
new_version=$(version_of "$PWD/$BUILT")
old_version=$(version_of "$INSTALLED")

if running; then
  echo "Quitting $APP_NAME…"
  osascript -e "quit app id \"$BUNDLE_ID\""
  for _ in $(seq 20); do
    running || break
    sleep 0.5
  done
  if running; then
    echo "$APP_NAME didn't quit within 10 s; quit it from the menu bar and run this again." >&2
    exit 1
  fi
fi

# sqlite3's .backup writes one consistent file, folding in anything still in the -wal file.
if [[ -f "$DB" ]]; then
  mkdir -p "$BACKUPS"
  backup="$BACKUPS/lofi-focus-$(date +%Y-%m-%d-%H%M%S)-v$old_version.db"
  sqlite3 "$DB" ".backup '$backup'"
  echo "Backed up the database to $backup"
  # Keep only the newest few (names sort by date), with any -wal/-shm left from opening one.
  ls -1 "$BACKUPS"/lofi-focus-*.db | sort -r | tail -n +$((KEEP_BACKUPS + 1)) | while read -r old; do rm -f -- "$old" "$old-wal" "$old-shm"; done
fi

rm -rf "$INSTALLED"
# ditto copies an app bundle faithfully (symlinks, extended attributes, code signature).
ditto "$BUILT" "$INSTALLED"
open "$INSTALLED"

if [[ "$old_version" == "$new_version" ]]; then
  echo "Installed $APP_NAME $new_version (same version as before; bump \"version\" in src-tauri/tauri.conf.json to tell builds apart)."
else
  echo "Installed $APP_NAME $new_version (was $old_version)."
fi
