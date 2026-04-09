# Focus Guardian 🛡️

Focus Guardian is an AI-powered desktop application and Chrome extension that helps you stay focused by tracking attention and blocking distracting sites.

## Features
- **Webcam Monitoring**: Uses MediaPipe to track if you are looking at the screen. Warns you if distracted.
- **Activity Tracking**: Uses \`active-win\` to detect what application you are using.
- **Site Blocking**: Extension that blocks distracting websites (YouTube, Facebook, Reddit, etc.) and notifies the desktop app.
- **Gamification**: Prevents distractions by subtracting virtual coins when you lose focus.

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

## How it works

1. **Electron Main**: The main window runs \`active-win\` and hosts a WebSocket server on \`localhost:8080\`.
2. **MediaPipe**: Uses face-mesh on the renderer side via a simple webcam feed. If face is lost for ~3 seconds, it triggers a warning.
3. **Chrome Extension**: Injects a block screen over social media and sends a websocket message to \`localhost:8080\` that tells the Electron app you were distracted.
4. **Storage**: \`electron-store\` handles keeping long-term track of your coins and distractions locally.