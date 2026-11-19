# AGENTS.md

This file describes how coding agents should work in this repository.

## Project Overview

Rakez Ai is an Electron desktop app plus a Chrome extension.

Core parts:
- `electron/main.js`: App window, IPC, app status API, active window checks, WebSocket server.
- `electron/ui/index.js`: Focus mode state, alerts, stats rendering.
- `ai/distractionDetector.js`: Webcam + MediaPipe face tracking logic.
- `extension/background.js`: Relays distraction events from content script to desktop app.
- `extension/content.js`: Enforces distraction-site policy using focus state and lock state.

## Setup And Run

From repo root:

```bash
npm install
npm start
```

## Extension Setup

1. Open `chrome://extensions`.
2. Enable Developer mode.
3. Click Load unpacked.
4. Select the `extension` folder.

## Agent Workflow Requirements

1. Read relevant files before editing.
2. Make minimal, focused changes.
3. Preserve existing behavior unless the request requires changes.
4. Prefer fixing root causes instead of adding temporary workarounds.
5. Verify changes by running the app or a targeted command when possible.

## Behavioral Rules

1. Focus mode is the source of truth for enforcing distractions.
2. In regular focus mode, show countdown warning before full-page block.
3. In lock mode, block immediately (no countdown).
4. Do not block websites when focus mode is off.
5. Do not trigger distraction penalties when monitoring is off.
6. Keep desktop app and extension communication backward-compatible.

## Known Interfaces

- WebSocket: `ws://localhost:8080` for extension distraction events.
- Status API: `http://localhost:8081/status` includes `focusMode` and lock state fields used by extension policy.
- IPC channels:
  - `get-stats`
  - `stats-data`
  - `add-distraction`
  - `set-focus-mode`
  - `active-app-update`
  - `extension-distraction`

## Git Hygiene

- Never commit `node_modules`.
- Keep `.gitignore` entries for generated/build artifacts.
- Keep commits small and descriptive.

## Definition Of Done

1. App launches via `npm start`.
2. Focus mode toggles and updates app status.
3. Webcam distraction warnings can trigger alerts.
4. Extension shows warning countdown in normal focus mode and blocks at timer end.
5. Extension blocks immediately when lock mode is active.
6. Stats update after a distraction event.
