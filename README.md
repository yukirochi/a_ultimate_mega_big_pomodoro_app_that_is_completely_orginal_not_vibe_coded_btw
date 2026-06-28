# Focus Bomb 💣

A focused, dark-themed Pomodoro timer for Ubuntu. Built with Electron + vanilla JS + SQLite.

## Features

- **Configurable sessions** — set 1–10 sessions, each with custom work/break durations
- **Live countdown** — circular SVG progress ring, MM:SS display
- **Auto-advance** — phases advance automatically with alarm sound and desktop notification
- **Screen lock** — locks Ubuntu screen when all sessions are done
- **Ambient audio** — white noise or lo-fi generated via Web Audio API (no files needed)
- **Session history** — SQLite-backed history with streak tracking and per-day breakdown

## Prerequisites

- **Node.js 18+** and **npm**
- Ubuntu / Linux desktop

## Setup & Run

```bash
git clone <repo-url>
cd focus-bomb
npm install
npm start
```

## Build AppImage (Ubuntu)

```bash
npm run build
# Output in dist/
```

## Project Structure

```
focus-bomb/
├── package.json
├── src/
│   ├── main.js       # Electron main process + IPC handlers
│   ├── preload.js    # contextBridge IPC bridge
│   ├── index.html    # App shell + CSS
│   ├── renderer.js   # UI logic
│   ├── timer.js      # FocusTimer class
│   ├── db.js         # SQLite helpers
│   └── audio.js      # AudioEngine (Web Audio API)
└── assets/
    └── icon.png
```

## Data Storage

Session history is stored in a local SQLite file at:
`~/.config/focus-bomb/sessions.db` (or the Electron userData path on your system).

## Keyboard Shortcuts

The app is fully mouse-driven. Use the sidebar to switch between Timer and History views.
