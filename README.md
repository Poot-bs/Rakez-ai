# Rakez Ai 🛡️

Rakez Ai is an AI-powered desktop application and Chrome extension that helps you stay focused by tracking attention and blocking distracting sites.

## Features
- **Webcam Monitoring**: Uses MediaPipe to track if you are looking at the screen. Warns you if distracted.
- **Source-Model AI Detection**: Uses the exact `distraction_detection` HDF5 model (converted to ONNX for Electron runtime).
- **Calibration Persistence**: Learns your baseline and stores your calibration profile.
- **Activity Tracking**: Uses \`active-win\` to detect what application you are using.
- **Site Blocking**: Extension that blocks distracting websites (YouTube, Facebook, Reddit, etc.) and notifies the desktop app.
- **Gamification Economy**:
   - Lose 5 coins when distracted.
   - Earn 1 coin every 60 seconds in focus mode.
   - Spend coins to buy a temporary distraction shield.

## Setup Instructions

1. **Install Node Utilities**:
   Ensure you have \`Node.js\` installed.
   Run the following from the root directory:
   \`\`\`bash
   npm install
   \`\`\`

2. **Run Desktop App**:
   Starts the Electron window and the backend WebSocket server:
   \`\`\`bash
   npm start
   \`\`\`

3. **Install Chrome Extension**:
   - Go to \`chrome://extensions/\`
   - Enable "Developer mode"
   - Click "Load unpacked" and select the \`extension\` folder in this project.

4. **Validation (recommended before beta tag)**:
   \`\`\`bash
   npm run validate:all
   \`\`\`

## How it works

1. **Electron Main**: Runs secure BrowserWindow settings and hosts WebSocket (`localhost:8080`) plus status API (`localhost:8081`).
2. **Renderer CV**: Uses MediaPipe eye landmarks + ONNX Runtime Web worker for real-time distraction inference.
3. **Calibration**: Baseline thresholds are saved to \`electron-store\` and reloaded on startup.
4. **Chrome Extension**: Blocks distractions only when focus mode is ON, and notifies desktop app.
5. **Storage**: \`electron-store\` keeps coins, distractions, focus time, shield timer, logs, and calibration profile.