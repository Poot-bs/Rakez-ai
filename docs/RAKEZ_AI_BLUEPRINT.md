# Rakez AI - Architecture and Phase 1 Plan

This document defines a production-ready architecture for Rakez AI and the implementation sequence.

## 1. Target Architecture

### Runtime Layers

- Electron Main Process (`main/`): app lifecycle, IPC orchestration, local APIs, WebSocket server, storage adapters.
- React Renderer (`renderer/`): dashboard UI, session controls, heatmaps, pet animation, user feedback.
- AI/CV Runtime (`ai/` + `services/fatigue/`): MediaPipe/ONNX local inference and signal extraction.
- Domain Services (`services/`): analytics, blocking, gamification, social duels.
- Storage (`database/`): SQLite schema and repositories.

### High-Level Data Flow

1. Camera frames are processed locally by MediaPipe/ONNX.
2. Renderer emits sampled metrics via IPC (`cv-metric-sample`).
3. Main feeds metrics into `focusIntelligenceEngine`.
4. Engines compute fatigue, correlations, and heatmap updates.
5. Main pushes UI events (`fatigue-alert`, stats, analytics snapshot).
6. Extension queries status API and enforces blocking policy.

## 2. Folder Structure

```text
main/
  ipc/
    registerFocusIpc.js
renderer/
  src/
    App.jsx
    components/
      FocusDashboard.jsx
    hooks/
      useFocusAnalytics.js
    state/
      focusStore.js
services/
  focus/
    focusIntelligenceEngine.js
  analytics/
    correlationEngine.js
    focusHeatmapEngine.js
  fatigue/
    fatigueDetector.js
  blocking/
    blockingEngine.js
  gamification/
    gamificationEngine.js
  realtime/
    duelSocketServer.js
shared/
  contracts/
    ipcChannels.js
database/
  schema.sql
```

## 3. Phase 1 Scope (Implemented)

### 3.1 Focus Intelligence Engine

- `services/focus/focusIntelligenceEngine.js`
- Orchestrates:
  - Correlation Engine
  - Focus Heatmap Engine
  - Fatigue Detector

### 3.2 Correlation Engine

- `services/analytics/correlationEngine.js`
- Detects trigger patterns such as: app/site switch followed by distraction in <= 5 minutes.

### 3.3 Focus Heatmap Engine

- `services/analytics/focusHeatmapEngine.js`
- Aggregates hourly average focus scores and distraction density.

### 3.4 Fatigue Detection

- `services/fatigue/fatigueDetector.js`
- Uses blink and yawn event windows.
- Emits suggestion aligned with the 20-20-20 rule.

### 3.5 IPC Integration

- New inbound sample channel: `cv-metric-sample`
- New outbound alert channel: `fatigue-alert`
- New request/response channel: `get-focus-analytics`

## 4. Key Snippets

### MediaPipe/ONNX Signal Pipeline (Renderer)

```js
window.focusGuardian.send('cv-metric-sample', {
  ts: Date.now(),
  score: payload.score,
  blinkDetected: Boolean(payload.blinkDetected),
  yawnDetected: Boolean(payload.yawnDetected)
});
```

### Blink/Yawn Fatigue Detection (Main Service)

```js
const fatigue = focusIntelligence.recordFaceSignal({
  ts,
  blinkDetected: Boolean(payload.blinkDetected),
  yawnDetected: Boolean(payload.yawnDetected)
});

if (fatigue?.fatigueDetected) {
  notifyRenderer('fatigue-alert', {
    suggestion: fatigue.suggestion,
    severity: fatigue.severity
  });
}
```

### IPC Bridge Contract (Preload)

```js
send('cv-metric-sample', payload);
invoke('get-focus-analytics');
on('fatigue-alert', callback);
```

### WebSocket Duel Concept (Server)

```js
// Pair two users in a room, broadcast focus status changes.
duelServer.publishStatus(roomId, { userId, focused: true, ts: Date.now() });
```

## 5. Database Schema (SQLite)

See `database/schema.sql`.

Core tables:
- `focus_sessions`
- `attention_samples`
- `distraction_events`
- `fatigue_events`
- `coin_ledger`
- `duel_matches`

## 6. Week-by-Week MVP Roadmap

### Week 1 - Core Focus and CV

1. Stabilize MediaPipe/ONNX sampling and calibration.
2. Persist local session/distraction records.
3. Verify timer + lock-mode extension enforcement.

### Week 2 - Analytics and Insights

1. Ship heatmap panel and top correlation cards.
2. Add fatigue trend view.
3. Add daily insight summary generation.

### Week 3 - Gamification and Stakes

1. Introduce focus pet states.
2. Add stake-lock and burn logic.
3. Add coin ledger UI and anti-cheat checks.

### Week 4 - Social Duels and Polish

1. Enable WebSocket duel rooms.
2. Add reconnect/session resilience.
3. Finalize privacy UX (ghost mode toggle and disclosures).

## 7. Privacy and Performance Guardrails

- All inference local only; no raw frame storage.
- Sampled metric transport over IPC (not raw frames).
- Throttle CV metric emission (2s heartbeat).
- Fall back gracefully when APIs are unavailable.
