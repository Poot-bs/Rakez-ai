const { ipcRenderer } = require('electron');

let isFocusMode = false;
const toggleBtn = document.getElementById('toggle-focus');
const coinEl = document.getElementById('coin-count');
const distractionEl = document.getElementById('distraction-count');
const statusText = document.getElementById('status-text');
const activeAppEl = document.getElementById('active-app');
const alertSound = document.getElementById('alert-sound');
const agentMessageEl = document.getElementById('agent-message');
const contextModeEl = document.getElementById('context-mode');
const lockStatusEl = document.getElementById('lock-status');
const microTaskListEl = document.getElementById('micro-task-list');

function updateFocusButton(active) {
  toggleBtn.innerText = `Focus Mode: ${active ? 'ON' : 'OFF'}`;
  toggleBtn.className = active ? 'btn active' : 'btn';
}

function formatLock(lockUntil) {
  const lockTs = Number(lockUntil);
  if (!lockTs || Number.isNaN(lockTs) || lockTs <= Date.now()) {
    return 'Distraction lock: inactive';
  }

  const remainingMs = Math.max(0, lockTs - Date.now());
  const remainingMin = Math.ceil(remainingMs / 60000);
  return `Distraction lock: active (${remainingMin} min remaining)`;
}

function renderMicroTasks(steps) {
  microTaskListEl.innerHTML = '';
  if (!Array.isArray(steps) || !steps.length) return;

  for (const step of steps) {
    const li = document.createElement('li');
    li.innerText = step;
    microTaskListEl.appendChild(li);
  }
}

// Init stats
ipcRenderer.send('get-stats');
ipcRenderer.on('stats-data', (event, data) => {
  coinEl.innerText = data.coins;
  distractionEl.innerText = data.distractions;
  isFocusMode = Boolean(data.focusMode);
  updateFocusButton(isFocusMode);
  lockStatusEl.innerText = formatLock(data.lockUntil);
});

toggleBtn.addEventListener('click', () => {
  isFocusMode = !isFocusMode;
  updateFocusButton(isFocusMode);
  
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

ipcRenderer.on('agent-decision', (event, payload) => {
  const contextMode = payload.context?.mode || 'unknown';
  const confidence = payload.context?.confidence || 0;
  const message = payload.intervention?.message || 'No intervention required.';
  const reason = payload.intervention?.reason || payload.context?.reason || 'No reason provided.';

  isFocusMode = Boolean(payload.focusMode);
  updateFocusButton(isFocusMode);

  agentMessageEl.innerText = `${message} (${reason})`;
  contextModeEl.innerText = `Context: ${contextMode} (confidence ${confidence.toFixed(2)})`;
  lockStatusEl.innerText = formatLock(payload.lockUntil);
  renderMicroTasks(payload.microTasks || []);
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

// Tab navigation
document.querySelectorAll('.tab-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    const tabName = btn.getAttribute('data-tab');
    
    // Hide all tabs
    document.querySelectorAll('.tab-content').forEach(tab => {
      tab.classList.remove('active');
    });
    
    // Deactivate all buttons
    document.querySelectorAll('.tab-btn').forEach(b => {
      b.classList.remove('active');
    });
    
    // Show selected tab
    const tabEl = document.getElementById(tabName);
    if (tabEl) {
      tabEl.classList.add('active');
    }
    
    // Activate button
    btn.classList.add('active');
    
    // Load logs when switching to logs tab
    if (tabName === 'logs') {
      loadEventLog();
    }
  });
});

// Settings management
function loadSettings() {
  ipcRenderer.send('get-settings');
}

function saveSettings() {
  const switchThreshold = parseInt(document.getElementById('switch-threshold').value);
  const lockDuration = parseInt(document.getElementById('lock-duration').value);
  const confidenceThreshold = parseFloat(document.getElementById('confidence-threshold').value);
  
  ipcRenderer.send('update-setting', 'switchCountThreshold', switchThreshold);
  ipcRenderer.send('update-setting', 'defaultLockMinutes', lockDuration);
  ipcRenderer.send('update-setting', 'confidenceThreshold', confidenceThreshold);
  
  alert('Settings saved!');
}

ipcRenderer.on('settings-data', (event, settings) => {
  document.getElementById('switch-threshold').value = settings.switchCountThreshold || 8;
  document.getElementById('lock-duration').value = settings.defaultLockMinutes || 2;
  document.getElementById('confidence-threshold').value = settings.confidenceThreshold || 0.75;
  document.getElementById('confidence-display').innerText = (settings.confidenceThreshold || 0.75).toFixed(2);
});

document.getElementById('confidence-threshold').addEventListener('input', (e) => {
  document.getElementById('confidence-display').innerText = parseFloat(e.target.value).toFixed(2);
});

document.getElementById('save-settings').addEventListener('click', saveSettings);

// Event log management
function loadEventLog() {
  ipcRenderer.send('get-event-log');
}

function formatEventEntry(entry) {
  const time = new Date(entry.timestamp).toLocaleTimeString();
  const trigger = entry.trigger || 'unknown';
  const action = entry.intervention?.action || 'none';
  const reason = entry.intervention?.reason || entry.context?.reason || '';
  
  const html = `
    <div class="event-log-entry">
      <div class="event-timestamp">${time}</div>
      <div><span class="event-trigger">Trigger:</span> ${trigger}</div>
      <div><span class="event-action">Action:</span> ${action}</div>
      ${reason ? `<div class="event-reason">Reason: ${reason}</div>` : ''}
    </div>
  `;
  
  return html;
}

ipcRenderer.on('event-log-data', (event, logs) => {
  const logContainer = document.getElementById('event-log');
  
  if (!logs || logs.length === 0) {
    logContainer.innerHTML = '<div class="no-logs">No events logged yet.</div>';
    return;
  }
  
  logContainer.innerHTML = logs.map(formatEventEntry).join('');
});

ipcRenderer.on('event-logged', (event, entry) => {
  const logContainer = document.getElementById('event-log');
  if (logContainer.innerHTML.includes('no-logs')) {
    logContainer.innerHTML = '';
  }
  
  const newEntry = document.createElement('div');
  newEntry.innerHTML = formatEventEntry(entry);
  logContainer.insertBefore(newEntry.firstElementChild, logContainer.firstChild);
  
  // Limit visible entries
  while (logContainer.children.length > 50) {
    logContainer.removeChild(logContainer.lastChild);
  }
});

document.getElementById('refresh-logs').addEventListener('click', loadEventLog);

document.getElementById('clear-logs').addEventListener('click', () => {
  if (confirm('Are you sure you want to clear the event log?')) {
    ipcRenderer.send('clear-event-log');
  }
});

// Load settings on startup
loadSettings();