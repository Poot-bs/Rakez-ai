let isFocusMode = false;
const toggleBtn = document.getElementById('toggle-focus');
const calibrateBtn = document.getElementById('calibrate-focus');
const buyShieldBtn = document.getElementById('buy-shield');
const coinEl = document.getElementById('coin-count');
const distractionEl = document.getElementById('distraction-count');
const focusTimeEl = document.getElementById('focus-time');
const shieldTimeEl = document.getElementById('shield-time');
const statusText = document.getElementById('status-text');
const statusPill = document.getElementById('status-pill');
const activeAppEl = document.getElementById('active-app');
const alertSound = document.getElementById('alert-sound');
const focusRing = document.getElementById('focus-ring');
const latestAlertEl = document.getElementById('latest-alert');
const logListEl = document.getElementById('log-list');
const calibrationStatusEl = document.getElementById('calibration-status');
const calibrationProgressEl = document.getElementById('calibration-progress');
let lastCalibrationSignature = '';
const agentMessageEl = document.getElementById('agent-message');
const contextModeEl = document.getElementById('context-mode');
const lockStatusEl = document.getElementById('lock-status');
const microTaskListEl = document.getElementById('micro-task-list');

function updateFocusButton(active) {
  toggleBtn.innerText = active ? 'Stop Focus Session' : 'Start Focus Session';
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
  if (!microTaskListEl) return;
  microTaskListEl.innerHTML = '';
  if (!Array.isArray(steps) || !steps.length) return;

  for (const step of steps) {
    const li = document.createElement('li');
    li.innerText = step;
    microTaskListEl.appendChild(li);
  }
}

function formatDuration(seconds) {
  const safe = Math.max(0, Number(seconds) || 0);
  const mm = Math.floor(safe / 60).toString().padStart(2, '0');
  const ss = (safe % 60).toString().padStart(2, '0');
  return `${mm}:${ss}`;
}

function setStatus(mode, text) {
  statusPill.className = `status-pill ${mode}`;
  statusPill.innerText = mode === 'focused' ? 'Focused' : mode === 'distracted' ? 'Distracted' : 'Paused';
  statusText.innerText = text;
}

function updateFocusScore(score) {
  const pct = Math.max(0, Math.min(100, Math.round(score * 100)));
  focusRing.style.setProperty('--score', pct.toString());
  focusRing.setAttribute('data-label', `${pct}%`);
}

function formatTimestamp(ts) {
  return new Date(ts).toLocaleTimeString();
}

function appendLogEntry(entry) {
  const item = document.createElement('div');
  item.className = 'log-item';

  const scoreText = typeof entry.score === 'number' ? ` (${Math.round(entry.score * 100)}%)` : '';
  item.innerText = `${formatTimestamp(entry.ts)} - ${entry.reason}${scoreText}`;

  logListEl.prepend(item);
  while (logListEl.children.length > 20) {
    logListEl.removeChild(logListEl.lastChild);
  }
}

function renderLog(logEntries) {
  logListEl.innerHTML = '';
  logEntries.forEach((entry) => appendLogEntry(entry));
}

// Init stats
window.focusGuardian.send('get-stats');
window.focusGuardian.send('request-distraction-log');
window.focusGuardian.on('stats-data', (data) => {
  coinEl.innerText = data.coins;
  distractionEl.innerText = data.distractions;
  focusTimeEl.innerText = formatDuration(data.focusSeconds);
  shieldTimeEl.innerText = formatDuration(data.shieldRemainingSec);
  isFocusMode = Boolean(data.focusMode);
  updateFocusButton(isFocusMode);

  if (lockStatusEl) {
    lockStatusEl.innerText = formatLock(data.lockUntil);
  }

  if (buyShieldBtn) {
    buyShieldBtn.innerText = `Buy ${data.shieldDurationMinutes}m Shield (${data.shieldCost} coins)`;
    buyShieldBtn.disabled = (data.coins < data.shieldCost);
  }
});

window.focusGuardian.on('distraction-log-update', (logEntries) => {
  renderLog(logEntries || []);
});

toggleBtn.addEventListener('click', () => {
  isFocusMode = !isFocusMode;
  updateFocusButton(isFocusMode);
  
  window.focusGuardian.send('set-focus-mode', isFocusMode);
  
  if (isFocusMode) {
    setStatus('focused', 'Monitoring attention...');
    startCamera();
  } else {
    setStatus('paused', 'Paused.');
    updateFocusScore(0);
    calibrationProgressEl.style.width = '0%';
    stopCamera();
  }
});

calibrateBtn.addEventListener('click', () => {
  if (!isFocusMode) {
    calibrationStatusEl.innerText = 'Calibration: Start focus session first';
    return;
  }

  if (typeof window.startCvCalibration === 'function') {
    window.startCvCalibration(12000);
    calibrationStatusEl.innerText = 'Calibration: Keep looking at the screen...';
    calibrationProgressEl.style.width = '0%';
  }
});

buyShieldBtn.addEventListener('click', async () => {
  const result = await window.focusGuardian.invoke('buy-focus-shield');
  if (!result?.ok) {
    latestAlertEl.innerText = result?.message || 'Could not buy shield';
    return;
  }

  latestAlertEl.innerText = `Shield active for ${formatDuration(result.shieldRemainingSec)}`;
  window.focusGuardian.send('get-stats');
  window.focusGuardian.send('request-distraction-log');
});

window.focusGuardian.on('active-app-update', (appName) => {
  activeAppEl.innerText = `Current App: ${appName}`;
});

window.focusGuardian.on('agent-decision', (payload) => {
  const contextMode = payload.context?.mode || 'unknown';
  const confidence = payload.context?.confidence || 0;
  const message = payload.intervention?.message || 'No intervention required.';
  const reason = payload.intervention?.reason || payload.context?.reason || 'No reason provided.';

  isFocusMode = Boolean(payload.focusMode);
  updateFocusButton(isFocusMode);

  if (agentMessageEl) {
    agentMessageEl.innerText = `${message} (${reason})`;
  }

  if (contextModeEl) {
    contextModeEl.innerText = `Context: ${contextMode} (confidence ${confidence.toFixed(2)})`;
  }

  if (lockStatusEl) {
    lockStatusEl.innerText = formatLock(payload.lockUntil);
  }

  renderMicroTasks(payload.microTasks || []);
});

window.focusGuardian.on('settings-data', (settings) => {
  const switchEl = document.getElementById('switch-threshold');
  const lockEl = document.getElementById('lock-duration');
  const confidenceEl = document.getElementById('confidence-threshold');
  const confidenceDisplay = document.getElementById('confidence-display');

  if (switchEl) switchEl.value = settings.switchCountThreshold || 8;
  if (lockEl) lockEl.value = settings.defaultLockMinutes || 2;
  if (confidenceEl) confidenceEl.value = settings.confidenceThreshold || 0.75;
  if (confidenceDisplay) confidenceDisplay.innerText = (settings.confidenceThreshold || 0.75).toFixed(2);
});

window.focusGuardian.on('event-log-data', (logs) => {
  const logContainer = document.getElementById('event-log');
  if (!logContainer) return;

  if (!logs || logs.length === 0) {
    logContainer.innerHTML = '<div class="no-logs">No events logged yet.</div>';
    return;
  }

  logContainer.innerHTML = logs.map(formatEventEntry).join('');
});

window.focusGuardian.on('event-logged', (entry) => {
  const logContainer = document.getElementById('event-log');
  if (!logContainer) return;

  if (logContainer.innerHTML.includes('no-logs')) {
    logContainer.innerHTML = '';
  }

  const newEntry = document.createElement('div');
  newEntry.innerHTML = formatEventEntry(entry);
  logContainer.insertBefore(newEntry.firstElementChild, logContainer.firstChild);

  while (logContainer.children.length > 50) {
    logContainer.removeChild(logContainer.lastChild);
  }
});

window.focusGuardian.on('extension-distraction', (site) => {
  if (isFocusMode) {
    triggerAlert(`Distracting site visited: ${site}`);
  }
});

function triggerAlert(reason) {
  if (!isFocusMode) return;
  
  alertSound.play();
  setStatus('distracted', `Distraction detected: ${reason}`);
  latestAlertEl.innerText = reason;
  
  setTimeout(() => {
    if (isFocusMode) {
      setStatus('focused', 'Monitoring attention...');
    }
  }, 3000);
}

window.onCvMetrics = (payload) => {
  if (!isFocusMode) return;

  updateFocusScore(payload.score);

  if (payload.calibration) {
    if (payload.calibration.active) {
      calibrationStatusEl.innerText = 'Calibration: capturing baseline...';
      calibrationProgressEl.style.width = `${Math.round(payload.calibration.progress * 100)}%`;
      calibrateBtn.disabled = true;
    } else {
      calibrateBtn.disabled = false;
      calibrationProgressEl.style.width = payload.calibration.calibrated ? '100%' : '0%';
      calibrationStatusEl.innerText = payload.calibration.calibrated
        ? `Calibration: ready (${Math.round(payload.calibration.threshold * 100)}% threshold)`
        : 'Calibration: not ready';

      if (payload.calibration.calibrated && payload.calibration.profile) {
        const signature = JSON.stringify(payload.calibration.profile);
        if (signature !== lastCalibrationSignature) {
          lastCalibrationSignature = signature;
          window.focusGuardian.invoke('save-calibration', payload.calibration.profile);
        }
      }
    }
  }

  if (payload.isDistracted) {
    setStatus('distracted', payload.reason || 'Attention score dropped');
  } else {
    setStatus('focused', 'Monitoring attention...');
  }

  if (payload.shouldPenalty) {
    latestAlertEl.innerText = payload.reason || 'Low attention detected';
    appendLogEntry({
      ts: Date.now(),
      reason: payload.reason || 'Low attention detected',
      score: payload.score
    });

    window.focusGuardian.send('cv-distraction-event', {
      reason: payload.reason || 'Low attention detected',
      score: payload.score,
      ts: Date.now()
    });

    triggerAlert(payload.reason || 'Low attention detected');
  }
};

window.focusGuardian.invoke('get-calibration').then((profile) => {
  if (profile && typeof window.applyCvCalibration === 'function') {
    window.applyCvCalibration(profile);
    calibrationStatusEl.innerText = profile.savedAt
      ? `Calibration: loaded (${new Date(profile.savedAt).toLocaleString()})`
      : 'Calibration: loaded';
    calibrationProgressEl.style.width = '100%';
  }
});

function loadSettings() {
  window.focusGuardian.send('get-settings');
}

function saveSettings() {
  const switchThreshold = parseInt(document.getElementById('switch-threshold').value, 10);
  const lockDuration = parseInt(document.getElementById('lock-duration').value, 10);
  const confidenceThreshold = parseFloat(document.getElementById('confidence-threshold').value);

  window.focusGuardian.send('update-setting', ['switchCountThreshold', switchThreshold]);
  window.focusGuardian.send('update-setting', ['defaultLockMinutes', lockDuration]);
  window.focusGuardian.send('update-setting', ['confidenceThreshold', confidenceThreshold]);

  latestAlertEl.innerText = 'Settings saved.';
}

function loadEventLog() {
  window.focusGuardian.send('get-event-log');
}

function formatEventEntry(entry) {
  const time = new Date(entry.timestamp).toLocaleTimeString();
  const trigger = entry.trigger || 'unknown';
  const action = entry.intervention?.action || 'none';
  const reason = entry.intervention?.reason || entry.context?.reason || '';

  return `
    <div class="event-log-entry">
      <div class="event-timestamp">${time}</div>
      <div><span class="event-trigger">Trigger:</span> ${trigger}</div>
      <div><span class="event-action">Action:</span> ${action}</div>
      ${reason ? `<div class="event-reason">Reason: ${reason}</div>` : ''}
    </div>
  `;
}

document.querySelectorAll('.tab-btn').forEach((btn) => {
  btn.addEventListener('click', () => {
    const tabName = btn.getAttribute('data-tab');

    document.querySelectorAll('.tab-content').forEach((tab) => tab.classList.remove('active'));
    document.querySelectorAll('.tab-btn').forEach((b) => b.classList.remove('active'));

    const tabEl = document.getElementById(tabName);
    if (tabEl) {
      tabEl.classList.add('active');
    }

    btn.classList.add('active');

    if (tabName === 'logs') {
      loadEventLog();
    }
  });
});

const confidenceEl = document.getElementById('confidence-threshold');
if (confidenceEl) {
  confidenceEl.addEventListener('input', (e) => {
    const display = document.getElementById('confidence-display');
    if (display) {
      display.innerText = parseFloat(e.target.value).toFixed(2);
    }
  });
}

const saveSettingsBtn = document.getElementById('save-settings');
if (saveSettingsBtn) {
  saveSettingsBtn.addEventListener('click', saveSettings);
}

const refreshLogsBtn = document.getElementById('refresh-logs');
if (refreshLogsBtn) {
  refreshLogsBtn.addEventListener('click', loadEventLog);
}

const clearLogsBtn = document.getElementById('clear-logs');
if (clearLogsBtn) {
  clearLogsBtn.addEventListener('click', () => {
    window.focusGuardian.send('clear-event-log');
  });
}

loadSettings();

// Make accessible to distractionDetector.js
window.triggerAlert = triggerAlert;