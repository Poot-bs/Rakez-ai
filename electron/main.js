const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('path');
const fs = require('fs');
const Store = require('electron-store');
const activeWin = require('active-win');
const WebSocket = require('ws');
const express = require('express');
const cors = require('cors');
const { runAgenticGraph } = require('../ai/multiAgentGraph');

const store = new Store();
let mainWindow;
let isFocusModeActive = false;
let focusRewardInterval = null;
let focusRewardAccumulator = 0;
let lockUntil = 0;
let lastWindowTitle = '';
let latestSignal = { app: 'unknown', title: '', site: '' };
let analysisInFlight = false;
let pendingAnalysis = false;

const switchEvents = [];
const distractionEvents = [];

const maxLogEntries = 200;
let eventLog = [];

if (!store.has('distractionLog')) store.set('distractionLog', []);

// Initialize default store values
if (!store.has('coins')) store.set('coins', 100);
if (!store.has('distractions')) store.set('distractions', 0);
if (!store.has('focusSeconds')) store.set('focusSeconds', 0);
if (!store.has('shieldUntilTs')) store.set('shieldUntilTs', 0);
if (!store.has('calibrationProfile')) {
  store.set('calibrationProfile', null);
}

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

const SHIELD_COST_COINS = 20;
const SHIELD_DURATION_MINUTES = 10;

function isLockActive() {
  return Date.now() < lockUntil;
}

function isEffectiveFocusMode() {
  return isFocusModeActive || isLockActive();
}

function resolveModelPath() {
  const devPath = path.join(app.getAppPath(), 'assets', 'models', 'distraction_model.onnx');
  const packagedPath = path.join(process.resourcesPath || '', 'assets', 'models', 'distraction_model.onnx');

  if (fs.existsSync(devPath)) {
    return { modelPath: devPath, modelAvailable: true, source: 'dev' };
  }

  if (packagedPath && fs.existsSync(packagedPath)) {
    return { modelPath: packagedPath, modelAvailable: true, source: 'packaged' };
  }

  return { modelPath: devPath, modelAvailable: false, source: 'missing' };
}

function getShieldRemainingSec() {
  const shieldUntilTs = store.get('shieldUntilTs', 0);
  return Math.max(0, Math.ceil((shieldUntilTs - Date.now()) / 1000));
}

function isShieldActive() {
  return getShieldRemainingSec() > 0;
}

function notifyRenderer(channel, payload) {
  if (!mainWindow || mainWindow.isDestroyed()) return;
  mainWindow.webContents.send(channel, payload);
}

function logEvent(data) {
  const entry = {
    timestamp: Date.now(),
    ...data
  };

  eventLog.unshift(entry);
  if (eventLog.length > maxLogEntries) {
    eventLog.pop();
  }

  notifyRenderer('event-logged', entry);
}

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

function getDistractionLog(limit = 20) {
  return store.get('distractionLog', []).slice(0, limit);
}

function pushDistractionLog(entry) {
  const current = store.get('distractionLog', []);
  current.unshift(entry);
  store.set('distractionLog', current.slice(0, 200));
}

function publishStats(targetEvent = null) {
  const payload = {
    coins: store.get('coins'),
    distractions: store.get('distractions'),
    focusSeconds: store.get('focusSeconds'),
    focusMode: isEffectiveFocusMode(),
    lockUntil,
    lockActive: isLockActive(),
    shieldRemainingSec: getShieldRemainingSec(),
    shieldCost: SHIELD_COST_COINS,
    shieldDurationMinutes: SHIELD_DURATION_MINUTES
  };

  if (targetEvent) {
    targetEvent.reply('stats-data', payload);
  } else if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send('stats-data', payload);
  }
}

function applyPenalty(source, reason, score = null, targetEvent = null) {
  if (isShieldActive()) {
    pushDistractionLog({
      ts: Date.now(),
      source,
      reason: `${reason} (blocked by shield)`,
      score,
      skipped: true
    });

    publishStats(targetEvent);
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send('distraction-log-update', getDistractionLog());
    }
    return;
  }

  const coins = store.get('coins');
  const distractions = store.get('distractions');
  distractionEvents.push(Date.now());

  store.set('coins', Math.max(0, coins - 5));
  store.set('distractions', distractions + 1);

  pushDistractionLog({
    ts: Date.now(),
    source,
    reason,
    score,
    skipped: false
  });

  focusRewardAccumulator = 0;
  publishStats(targetEvent);

  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send('distraction-log-update', getDistractionLog());
  }
}

function startFocusRewardLoop() {
  if (focusRewardInterval) return;

  focusRewardInterval = setInterval(() => {
    if (!isEffectiveFocusMode()) return;

    store.set('focusSeconds', store.get('focusSeconds') + 1);
    focusRewardAccumulator += 1;

    if (focusRewardAccumulator >= 60) {
      store.set('coins', store.get('coins') + 1);
      focusRewardAccumulator = 0;

      pushDistractionLog({
        ts: Date.now(),
        source: 'reward',
        reason: 'Focus reward: +1 coin for 60 seconds of focus mode',
        score: null,
        skipped: false
      });
    }

    publishStats();
  }, 1000);
}

function stopFocusRewardLoop() {
  if (!focusRewardInterval) return;
  clearInterval(focusRewardInterval);
  focusRewardInterval = null;
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

// Setup Express API for Extension
const api = express();
api.use(cors());
api.get('/status', (req, res) => {
  res.json({
    focusMode: isEffectiveFocusMode(),
    lockActive: isLockActive(),
    lockUntil
  });
});
api.listen(8081, () => {
  console.log('Rakez Ai API listening on port 8081');
});

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 900,
    height: 700,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: true,
      webSecurity: true
    }
  });

  mainWindow.loadFile('electron/ui/index.html');
}

app.whenReady().then(() => {
  const runtimeConfig = resolveModelPath();
  if (!runtimeConfig.modelAvailable) {
    console.warn('Distraction model not found. Expected at:', runtimeConfig.modelPath);
  }

  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });

  // Track active window every 20 seconds
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

  setInterval(() => {
    if (mainWindow && !mainWindow.isDestroyed() && getShieldRemainingSec() > 0) {
      publishStats();
    }
  }, 1000);

  setInterval(() => {
    if (!isLockActive()) return;
    publishStats();
  }, 1000);
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

        if (mainWindow && !mainWindow.isDestroyed()) {
          mainWindow.webContents.send('extension-distraction', data.site);
        }

        if (isEffectiveFocusMode()) {
          applyPenalty('extension', `Distracting site visited: ${data.site}`);
        }

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
      console.error('Invalid WebSocket payload:', error.message);
    }
  });
});

// IPC listeners for Storage & Penalties
ipcMain.on('set-focus-mode', (event, active) => {
  if (typeof active !== 'boolean') return;

  isFocusModeActive = active;

  if (active) {
    startFocusRewardLoop();
  } else {
    stopFocusRewardLoop();
  }

  publishStats(event);
});

ipcMain.on('get-stats', (event) => {
  publishStats(event);
  event.reply('distraction-log-update', getDistractionLog());
});

ipcMain.on('add-distraction', (event) => {
  applyPenalty('ui', 'Manual/legacy distraction event', null, event);
  runInterventionCycle('manual-distraction');
});

ipcMain.on('cv-distraction-event', (event, payload) => {
  if (!isFocusModeActive) return;
  if (!payload || typeof payload !== 'object') return;

  const reason = payload?.reason || 'Attention score dropped';
  const score = typeof payload?.score === 'number' ? payload.score : null;
  applyPenalty('cv', reason, score);
});

ipcMain.on('request-distraction-log', (event) => {
  event.reply('distraction-log-update', getDistractionLog());
});

ipcMain.handle('buy-focus-shield', () => {
  const coins = store.get('coins');
  if (coins < SHIELD_COST_COINS) {
    return { ok: false, message: `Not enough coins. Need ${SHIELD_COST_COINS}.` };
  }

  const now = Date.now();
  const shieldUntilTs = Math.max(store.get('shieldUntilTs', 0), now);
  const nextShieldUntilTs = shieldUntilTs + (SHIELD_DURATION_MINUTES * 60 * 1000);

  store.set('coins', coins - SHIELD_COST_COINS);
  store.set('shieldUntilTs', nextShieldUntilTs);

  pushDistractionLog({
    ts: now,
    source: 'shop',
    reason: `Bought ${SHIELD_DURATION_MINUTES} min shield for ${SHIELD_COST_COINS} coins`,
    score: null,
    skipped: false
  });

  publishStats();
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send('distraction-log-update', getDistractionLog());
  }

  return { ok: true, shieldRemainingSec: getShieldRemainingSec() };
});

ipcMain.handle('save-calibration', (event, profile) => {
  if (!profile || typeof profile !== 'object') {
    return { ok: false, message: 'Invalid calibration payload.' };
  }

  store.set('calibrationProfile', {
    ...profile,
    savedAt: Date.now()
  });
  return { ok: true };
});

ipcMain.handle('get-calibration', () => {
  return store.get('calibrationProfile', null);
});

ipcMain.handle('get-runtime-config', () => {
  const runtimeConfig = resolveModelPath();
  return {
    modelAvailable: runtimeConfig.modelAvailable,
    modelPath: runtimeConfig.modelPath,
    source: runtimeConfig.source
  };
});

ipcMain.on('get-settings', (event) => {
  event.reply('settings-data', getSettings());
});

ipcMain.on('update-setting', (event, keyOrTuple, value) => {
  let key = keyOrTuple;
  let nextValue = value;

  if (Array.isArray(keyOrTuple)) {
    [key, nextValue] = keyOrTuple;
  }

  if (typeof key !== 'string') return;

  const updated = updateSetting(key, nextValue);
  event.reply('settings-data', updated);
});

ipcMain.on('get-event-log', (event) => {
  event.reply('event-log-data', eventLog);
});

ipcMain.on('clear-event-log', (event) => {
  eventLog = [];
  event.reply('event-log-data', eventLog);
});

initializeSettings();