# Spook's Cafe

A macOS Pomodoro tracker with a lofi ghost cafe. Spook brews while you focus, and the cafe follows the time of day.

Built with Tauri 2, React and TypeScript (Vite), and SQLite.

## Run it

```sh
npm install
npm run tauri dev       # LOFI_FAST=1 makes minutes run as seconds
```

## Docs

- `SPEC.md`: requirements, design decisions and build order
- `DEFECTS.md`: known bugs and rough edges
- `docs/`: research notes, such as the YouTube spike that chose the hidden player window
- `design/`: scripts that generate the SVG art in `src/assets/` (`node design/<name>/build.mjs`)
