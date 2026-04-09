const { ipcRenderer } = require('electron');

let isFocusMode = false;
const toggleBtn = document.getElementById('toggle-focus');
const coinEl = document.getElementById('coin-count');
const distractionEl = document.getElementById('distraction-count');
const statusText = document.getElementById('status-text');
const activeAppEl = document.getElementById('active-app');
const alertSound = document.getElementById('alert-sound');

// Init stats
ipcRenderer.send('get-stats');
ipcRenderer.on('stats-data', (event, data) => {
  coinEl.innerText = data.coins;
  distractionEl.innerText = data.distractions;
});

toggleBtn.addEventListener('click', () => {
  isFocusMode = !isFocusMode;
  toggleBtn.innerText = `Focus Mode: ${isFocusMode ? 'ON' : 'OFF'}`;
  toggleBtn.className = isFocusMode ? 'btn active' : 'btn';
  
  ipcRenderer.send('set-focus-mode', isFocusMode);
  
  if (isFocusMode) {
    statusText.innerText = 'Monitoring attention...';
    startCamera();
  } else {
    statusText.innerText = 'Paused.';
    stopCamera();
  }
});

ipcRenderer.on('active-app-update', (event, appName) => {
  activeAppEl.innerText = `Current App: ${appName}`;
});

ipcRenderer.on('extension-distraction', (event, site) => {
  if (isFocusMode) {
    triggerAlert(`Distracting site visited: ${site}`);
  }
});

function triggerAlert(reason) {
  if (!isFocusMode) return;
  
  alertSound.play();
  statusText.innerText = `⚠️ Distraction detected: ${reason}`;
  statusText.style.color = '#e94560';
  
  ipcRenderer.send('add-distraction');
  
  setTimeout(() => {
    statusText.innerText = 'Monitoring attention...';
    statusText.style.color = '#fff';
  }, 3000);
}

// Make accessible to distractionDetector.js
window.triggerAlert = triggerAlert;