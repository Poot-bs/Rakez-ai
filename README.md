# Focus Guardian 🛡️

Focus Guardian is an AI-powered desktop application and Chrome extension that helps you stay focused by tracking attention and blocking distracting sites.

## Features
- **Webcam Monitoring**: Uses MediaPipe to track if you are looking at the screen. Warns you if distracted.
- **Activity Tracking**: Uses \`active-win\` to detect what application you are using.
- **Site Blocking**: Extension that blocks distracting websites (YouTube, Facebook, Reddit, etc.) and notifies the desktop app.
- **Gamification**: Prevents distractions by subtracting virtual coins when you lose focus.
- **Agentic AI Brain**: LangGraph + Groq-powered multi-agent orchestration for autonomous interventions and micro-task generation.

## Setup Instructions

1. **Install Node Utilities**:
   Ensure you have \`Node.js\` installed.
   Run the following from the root directory:
   \`\`\`bash
   npm install
   \`\`\`

2. **Set Groq API Key (Required for LLM Decisions)**:
   PowerShell:
   \`\`\`powershell
   $env:GROQ_API_KEY="your_groq_api_key"
   $env:GROQ_MODEL="llama-3.3-70b-versatile"
   \`\`\`

   Notes:
   - If \`GROQ_MODEL\` is omitted, the app defaults to \`llama-3.3-70b-versatile\`.
   - If \`GROQ_API_KEY\` is missing, the graph still runs with heuristic fallback.

3. **Run Desktop App**:
   Starts the Electron window and the backend WebSocket server:
   \`\`\`bash
   npm start
   \`\`\`

4. **Install Chrome Extension**:
   - Go to \`chrome://extensions/\`
   - Enable "Developer mode"
   - Click "Load unpacked" and select the \`extension\` folder in this project.

## How it works

1. **Electron Main**: The main window runs \`active-win\` and hosts a WebSocket server on \`localhost:8080\`.
2. **MediaPipe**: Uses face-mesh on the renderer side via a simple webcam feed. If face is lost for ~3 seconds, it triggers a warning.
3. **Chrome Extension**: Injects a block screen over social media and sends a websocket message to \`localhost:8080\` that tells the Electron app you were distracted.
4. **Storage**: \`electron-store\` handles keeping long-term track of your coins and distractions locally.

## Agentic AI Architecture (LangGraph + Groq)

The multi-agent orchestration lives in \`ai/multiAgentGraph.js\` and is executed by the Electron main process.

Graph pipeline:
1. **Heuristic Context Node**:
    - Uses app name, window title, URL/title keywords
    - Detects likely mode: \`coding\`, \`writing\`, \`learning\`, \`distraction\`, \`other\`
2. **LLM Context Refinement Node**:
    - Calls Groq \`llama-3.3-70b-versatile\` to refine context and confidence
3. **Intervention Agent Node**:
    - Autonomous decision policy with signal history:
       - app/window switch frequency
       - recent distractions
       - current focus state
    - Outputs action JSON:
       - \`none\`, \`nudge\`, \`force_focus\`, \`block_distraction\`
4. **Micro-Task Generator Node**:
    - When user is stuck/procrastinating, returns exactly 3 tiny executable steps.

### A. Autonomous Intervention Agent

Implemented behavior:
- Continuously observes patterns (window switches + distraction events).
- Runs intervention cycle every active-window update and distraction signal.
- Decision-based actions:
   - force short focus sprint
   - lock distracting sites for 2 or 5 minutes
   - nudge with reasoned message
   - generate micro-tasks when stuck

Example trigger:
- 8+ switches in 5 minutes => force focus + 2-min lock + micro-task suggestion.

### B. Context-Aware Work Detection

Implemented behavior:
- Uses:
   - active window app/title parsing (desktop)
   - website hostname/title parsing (extension)
   - lightweight keyword scoring for learning intent
   - LLM context refinement for ambiguous cases

YouTube logic:
- YouTube + work/technical keywords can be treated as learning.
- Random browsing is treated as distraction and can be locked.

### D. Micro-Task Generator

Implemented behavior:
- If intervention agent marks user as stuck/procrastinating:
   - Converts vague effort into 3 tiny executable steps.
- Displayed live in desktop UI under **Agentic Brain** panel.

## Files Added/Updated for Agentic Features

- Added: \`ai/multiAgentGraph.js\`
- Updated: \`electron/main.js\`
- Updated: \`electron/ui/index.html\`
- Updated: \`electron/ui/index.js\`
- Updated: \`electron/ui/styles.css\`
- Updated: \`extension/background.js\`
- Updated: \`extension/content.js\`
- Updated: \`package.json\`

## Extension Runtime Behavior

- On each matched distracting domain, extension sends context signal (site + title).
- If autonomous lock is active, page is blocked immediately.
- In manual focus mode, educational content can be allowed using keyword intent scoring.

## Notes for Production Hardening

- Move prompts and policy thresholds to config.
- Add signed local auth between extension and desktop server.
- Add telemetry buffering and opt-in analytics.
- Add tests for JSON parsing robustness and policy regressions.