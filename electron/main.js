const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('path');
const Store = require('electron-store');
const activeWin = require('active-win');
const WebSocket = require('ws');
const express = require('express');
const cors = require('cors');
const { runAgenticGraph } = require('../ai/multiAgentGraph');

const store = new Store();
let mainWindow;
let isFocusModeActive = false;
let lockUntil = 0;
let lastWindowTitle = '';
let latestSignal = { app: 'unknown', title: '', site: '' };
let analysisInFlight = false;
let pendingAnalysis = false;

const switchEvents = [];
const distractionEvents = [];

// Initialize event log and settings
const maxLogEntries = 200;
let eventLog = [];

function initializeSettings() {
  const defaults = {
    switchCountThreshold: 8,
    defaultLockMinutes: 2,
    confidenceThreshold: 0.75
  };
  
  if (!store.has('settings')) {
    store.set('settings', defaults);
  }
  return store.get('settings');
}

function getSettings() {
  return initializeSettings();
}

function updateSetting(key, value) {
  const settings = getSettings();
  settings[key] = value;
  store.set('settings', settings);
  notifyRenderer('settings-updated', settings);
  return settings;
}

function logEvent(data) {
  const timestamp = Date.now();
  const entry = {
    timestamp,
    ...data
  };
  
  eventLog.unshift(entry);
  if (eventLog.length > maxLogEntries) {
    eventLog.pop();
  }
  
  notifyRenderer('event-logged', entry);
}

// Initialize default store values
if (!store.has('coins')) store.set('coins', 100);
if (!store.has('distractions')) store.set('distractions', 0);
initializeSettings();

// Setup Express API for Extension
const api = express();
api.use(cors());

function isLockActive() {
  return Date.now() < lockUntil;
}

function isEffectiveFocusMode() {
  return isFocusModeActive || isLockActive();
}

api.get('/status', (req, res) => {
  res.json({
    focusMode: isEffectiveFocusMode(),
    lockActive: isLockActive(),
    lockUntil
  });
});
api.listen(8081, () => {
  console.log('Focus Guardian API listening on port 8081');
});

function pruneEvents(events, windowMs) {
  const threshold = Date.now() - windowMs;
  while (events.length && events[0] < threshold) {
    events.shift();
  }
}

function getMetrics() {
  pruneEvents(switchEvents, 10 * 60 * 1000);
  pruneEvents(distractionEvents, 10 * 60 * 1000);

  const fiveMinThreshold = Date.now() - 5 * 60 * 1000;
  const tabSwitches5m = switchEvents.filter((ts) => ts >= fiveMinThreshold).length;
  const recentDistractions = distractionEvents.length;

  return {
    tabSwitches5m,
    recentDistractions,
    stuckSignals10m: tabSwitches5m + recentDistractions,
    focusActive: isEffectiveFocusMode()
  };
}

function notifyRenderer(channel, payload) {
  if (!mainWindow || mainWindow.isDestroyed()) return;
  mainWindow.webContents.send(channel, payload);
}

function applyInterventionDecision(result) {
  const intervention = result.intervention || {};
  const minutes = Number(intervention.lockMinutes) || 0;

  if (intervention.forceFocus) {
    isFocusModeActive = true;
  }

  if (intervention.lockDistractions && minutes > 0) {
    lockUntil = Math.max(lockUntil, Date.now() + minutes * 60 * 1000);
  }

  notifyRenderer('agent-decision', {
    context: result.context || {},
    intervention,
    microTasks: result.microTasks || [],
    lockActive: isLockActive(),
    lockUntil,
    focusMode: isEffectiveFocusMode()
  });
}

async function runInterventionCycle(reason) {
  if (analysisInFlight) {
    pendingAnalysis = true;
    return;
  }

  analysisInFlight = true;

  try {
    const result = await runAgenticGraph({
      latestSignal,
      metrics: getMetrics(),
      settings: getSettings()
    });

    if (reason === 'distraction' || (result.intervention && result.intervention.action !== 'none')) {
      applyInterventionDecision(result);
      logEvent({
        trigger: reason,
        context: result.context,
        intervention: result.intervention
      });
    }
  } catch (error) {
    console.error('Agentic cycle failed:', error);
  } finally {
    analysisInFlight = false;
    if (pendingAnalysis) {
      pendingAnalysis = false;
      runInterventionCycle('queued');
    }
  }
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 900,
    height: 700,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      nodeIntegration: true,
      contextIsolation: false // Simplification for MVP
    }
  });

  mainWindow.loadFile('electron/ui/index.html');
  mainWindow.webContents.openDevTools();
}

app.whenReady().then(() => {
  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });

  // Track active window every 8 seconds for near-real-time intervention.
  setInterval(async () => {
    try {
      const activeApp = await activeWin();
      if (activeApp) {
        const title = activeApp.title || 'Unknown window';
        const appName = activeApp.owner?.name || 'Unknown app';

        latestSignal = {
          app: appName,
          title,
          site: activeApp.url || ''
        };

        if (title !== lastWindowTitle) {
          lastWindowTitle = title;
          switchEvents.push(Date.now());
        }

        notifyRenderer('active-app-update', `${appName} - ${title}`);
        runInterventionCycle('active-window');
      }
    } catch (err) {
      console.error('Error getting active window:', err);
    }
  }, 8000);
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

// WebSocket Server for Chrome Extension Communication
const wss = new WebSocket.Server({ port: 8080 });
wss.on('connection', ws => {
  ws.on('message', message => {
    try {
      const data = JSON.parse(message);
      if (data.type === 'distraction') {
        distractionEvents.push(Date.now());
        latestSignal = {
          app: 'Browser',
          title: data.title || data.site || 'Unknown site',
          site: data.site || ''
        };

        notifyRenderer('extension-distraction', data.site);
        runInterventionCycle('distraction');
      } else if (data.type === 'context') {
        latestSignal = {
          app: 'Browser',
          title: data.title || data.site || 'Unknown site',
          site: data.site || ''
        };
        runInterventionCycle('browser-context');
      }
    } catch (error) {
      console.error('Invalid WS message:', error.message);
    }
  });
});

// IPC listeners for Storage & Penalties
ipcMain.on('set-focus-mode', (event, active) => {
  isFocusModeActive = active;
});

ipcMain.on('get-stats', (event) => {
  event.reply('stats-data', {
    coins: store.get('coins'),
    distractions: store.get('distractions'),
    focusMode: isEffectiveFocusMode(),
    lockUntil
  });
});

ipcMain.on('add-distraction', (event) => {
  let coins = store.get('coins');
  let distractions = store.get('distractions');
  distractionEvents.push(Date.now());
  
  store.set('coins', Math.max(0, coins - 5)); // penalty
  store.set('distractions', distractions + 1);
  
  event.reply('stats-data', {
    coins: store.get('coins'),
    distractions: store.get('distractions'),
    focusMode: isEffectiveFocusMode(),
    lockUntil
  });

  runInterventionCycle('manual-distraction');
});

// IPC handlers for settings
ipcMain.on('get-settings', (event) => {
  event.reply('settings-data', getSettings());
});

ipcMain.on('update-setting', (event, key, value) => {
  const updated = updateSetting(key, value);
  event.reply('settings-data', updated);
});

// IPC handlers for event logs
ipcMain.on('get-event-log', (event) => {
  event.reply('event-log-data', eventLog);
});

ipcMain.on('clear-event-log', (event) => {
  eventLog = [];
  event.reply('event-log-data', eventLog);
});