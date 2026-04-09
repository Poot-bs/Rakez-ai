# LangGraph + Groq Multi-Agent Implementation

## Fixed Issues

### LangGraph Node Naming Conflict ✅
**Problem**: Node name `intervention` conflicted with channel name `intervention`
**Solution**: Renamed node from `intervention` to `intervention_agent`
- Updated in `ai/multiAgentGraph.js` at lines 345-350
- Graph edges now reference `intervention_agent`

## New Features Implemented

### 1. Settings Panel
**Location**: `Overview` → `Settings` tab in desktop UI

Configurable thresholds without code edits:

#### Switch Count Threshold (3-20)
- Default: 8 switches in 5 minutes
- Triggers autonomous focus sprint when exceeded
- Used by `interventionAgentNode` at line 163 in `multiAgentGraph.js`

#### Default Lock Duration (1-10 minutes)
- Default: 2 minutes
- Applied to autonomously triggered distraction locks
- Used at lines 165-166 in `multiAgentGraph.js`

#### Distraction Confidence Threshold (0.5-1.0)
- Default: 0.75
- Higher = stricter distraction detection
- Used at line 228 in `multiAgentGraph.js`

**Implementation Files**:
- Backend: `electron/main.js` lines 24-44 (settings initialization/management)
- Frontend: `electron/ui/index.html` (settings form HTML)
- Styling: `electron/ui/styles.css` (settings panel styles)
- IPC Handlers: `electron/main.js` lines 320-325

### 2. Event Log (Timeline)
**Location**: `Overview` → `Event Log` tab in desktop UI

Displays timestamped intervention decisions with:
- **Timestamp**: When decision was made
- **Trigger**: What caused the analysis (e.g., 'distraction', 'active-window')
- **Action**: What intervention was taken ('none', 'nudge', 'force_focus', 'block_distraction')
- **Reason**: Detailed explanation of decision

**Features**:
- Real-time log updates (up to 200 entries)
- Refresh button to manually load log
- Clear button to reset log history
- Auto-truncates oldest entries when limit reached

**Implementation Files**:
- Backend: `electron/main.js` lines 51-64 (event logging)
- Event logging in cycle: `electron/main.js` lines 161-166
- IPC Handlers: `electron/main.js` lines 328-337
- Frontend: `electron/ui/index.html` (log UI)
- Display logic: `electron/ui/index.js` lines 182-215

## Architecture Overview

### Graph Pipeline
```
Input Signals (app/browser)
    ↓
[Heuristic Context] → Infer mode (coding/writing/learning/distraction)
    ↓
[LLM Refine Context] → Groq llama-3.3-70b-versatile refines classification
    ↓
[Intervention Agent] → Decision engine (uses SETTINGS)
    ↓
[Micro-Task Generator] → Create 3 actionable steps if stuck
    ↓
Output → Action + Lock Duration + Micro-tasks
```

### Settings Flow
1. User adjusts threshold in Settings tab
2. Frontend sends IPC: `update-setting`
3. Backend stores in electron-store
4. Next intervention cycle receives updated settings
5. Graph nodes use settings for decision logic

### Event Logging Flow
1. Intervention cycle completes
2. `logEvent()` called with decision details
3. Entry added to in-memory `eventLog` array
4. `event-logged` IPC event notifies renderer
5. Event appears in real-time in Event Log tab

## Running the App

### 1. Set Groq API Key
```powershell
$env:GROQ_API_KEY="your_groq_api_key"
$env:GROQ_MODEL="llama-3.3-70b-versatile"
```

### 2. Start App
```bash
npm start
```

### 3. Access Features
- **Overview Tab**: Real-time monitoring and webcam
- **Settings Tab**: Adjust intervention thresholds
- **Event Log Tab**: Inspect all intervention decisions

## Data Storage

### Settings (Persistent)
- Stored in electron-store
- Survives app restarts
- Initialized with sensible defaults on first run

### Event Log (Session)
- In-memory array, up to 200 entries
- Clears on app restart
- Displayed in reverse chronological order (newest first)

## Testing the Features

### Test Switch Threshold
1. Go to Settings, set "Tab Switch Threshold" to 3
2. Quickly switch between windows >3 times in 5 minutes
3. Check Event Log — should see `force_focus` action logged

### Test Confidence Threshold
1. Go to Settings, set "Distraction Confidence Threshold" to 0.9
2. Visit YouTube without technical keywords in page title
3. Check Event Log — should show high-confidence distraction detection

### Test Lock Duration
1. Trigger an intervention that locks distractions
2. Check Event Log for the lock duration used
3. Change setting and observe new lock durations in subsequent interventions

## Default Configuration

```javascript
{
  switchCountThreshold: 8,        // Switches in 5 min
  defaultLockMinutes: 2,          // Auto-lock duration
  confidenceThreshold: 0.75       // Distraction detection strictness
}
```

## Performance Notes

- Settings loaded at app startup via `getSettings()`
- Event log limited to 200 in-memory entries (older entries auto-purged)
- Settings passed to graph each cycle (minimal overhead)
- Log entries streamed to UI in real-time (~5ms latency)

## Future Enhancements

1. **Persistence for Event Log**: Save to disk for long-term analytics
2. **Export Event Data**: CSV/JSON export for offline analysis
3. **Advanced Filtering**: Filter logs by trigger, action, or date range
4. **Custom Policies**: Let users create rules like "Always allow Stack Overflow"
5. **Telemetry Dashboard**: Visualize intervention frequency over time
