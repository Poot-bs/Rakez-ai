const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('path');
const Store = require('electron-store');
const activeWin = require('active-win');
const WebSocket = require('ws');
const express = require('express');
const cors = require('cors');

const store = new Store();
let mainWindow;
let isFocusModeActive = false;

// Initialize default store values
if (!store.has('coins')) store.set('coins', 100);
if (!store.has('distractions')) store.set('distractions', 0);

// Setup Express API for Extension
const api = express();
api.use(cors());
api.get('/status', (req, res) => {
  res.json({ focusMode: isFocusModeActive });
});
api.listen(8081, () => {
  console.log('Focus Guardian API listening on port 8081');
});

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

  // Track active window every 20 seconds
  setInterval(async () => {
    try {
      const activeApp = await activeWin();
      if (activeApp) {
        mainWindow.webContents.send('active-app-update', activeApp.title);
      }
    } catch (err) {
      console.error('Error getting active window:', err);
    }
  }, 20000);
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

// WebSocket Server for Chrome Extension Communication
const wss = new WebSocket.Server({ port: 8080 });
wss.on('connection', ws => {
  ws.on('message', message => {
    const data = JSON.parse(message);
    if (data.type === 'distraction') {
      mainWindow.webContents.send('extension-distraction', data.site);
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
    distractions: store.get('distractions')
  });
});

ipcMain.on('add-distraction', (event) => {
  let coins = store.get('coins');
  let distractions = store.get('distractions');
  
  store.set('coins', Math.max(0, coins - 5)); // penalty
  store.set('distractions', distractions + 1);
  
  event.reply('stats-data', {
    coins: store.get('coins'),
    distractions: store.get('distractions')
  });
});