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
  toggleBtn.innerText = isFocusMode ? 'Stop Focus Session' : 'Start Focus Session';
  toggleBtn.className = isFocusMode ? 'btn active' : 'btn';
  
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

// Make accessible to distractionDetector.js
window.triggerAlert = triggerAlert;