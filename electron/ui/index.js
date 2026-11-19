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
const heatmapGridEl = document.getElementById('heatmap-grid');
const topPatternEl = document.getElementById('insight-top-pattern');
const bestHourEl = document.getElementById('insight-best-hour');
const streakEl = document.getElementById('insight-streak');
const fatigueMeterFillEl = document.getElementById('fatigue-meter-fill');
const analyticsRefreshBtn = document.getElementById('analytics-refresh');
const petStageEl = document.getElementById('pet-stage');
const petFaceEl = document.getElementById('pet-face');
const petMoodEl = document.getElementById('pet-mood');
const petTipEl = document.getElementById('pet-tip');
let lastMetricSampleTs = 0;
let latestFocusScore = 0;
let latestDistracted = false;
let fatigueIndex = 0;
let animatedCoins = 0;
let animatedDistractions = 0;

function animateNumber(from, to, onStep, duration = 380) {
  const start = performance.now();
  const safeFrom = Number(from) || 0;
  const safeTo = Number(to) || 0;

  function tick(now) {
    const progress = Math.min(1, (now - start) / duration);
    const eased = 1 - Math.pow(1 - progress, 3);
    const value = Math.round(safeFrom + (safeTo - safeFrom) * eased);
    onStep(value);
    if (progress < 1) {
      requestAnimationFrame(tick);
    }
  }

  requestAnimationFrame(tick);
}

function setVisualTheme(mode) {
  document.body.classList.remove('focus-theme', 'distracted-theme');
  if (mode === 'focused') {
    document.body.classList.add('focus-theme');
  } else if (mode === 'distracted') {
    document.body.classList.add('distracted-theme');
  }
}

function animateMotionItems(scopeEl = document) {
  const items = Array.from(scopeEl.querySelectorAll('.motion-item'));
  items.sort((a, b) => Number(a.dataset.motionOrder || 0) - Number(b.dataset.motionOrder || 0));

  items.forEach((el, idx) => {
    el.classList.remove('motion-in');
    setTimeout(() => {
      el.classList.add('motion-in');
    }, idx * 55);
  });
}

function toHeatmapLevel(score) {
  if (score >= 0.85) return 4;
  if (score >= 0.7) return 3;
  if (score >= 0.5) return 2;
  if (score > 0.2) return 1;
  return 0;
}

function formatHourLabel(hour) {
  const normalized = ((hour % 24) + 24) % 24;
  const period = normalized >= 12 ? 'PM' : 'AM';
  const display = normalized % 12 || 12;
  return `${display}${period}`;
}

function renderHeatmap(heatmap) {
  if (!heatmapGridEl) return;
  heatmapGridEl.innerHTML = '';

  const hours = Array.isArray(heatmap) ? heatmap : [];
  const source = hours.length
    ? hours
    : Array.from({ length: 24 }, (_, hour) => ({ hour, avgFocusScore: 0, samples: 0 }));

  for (const slot of source) {
    const level = toHeatmapLevel(Number(slot.avgFocusScore) || 0);
    const cell = document.createElement('div');
    cell.className = `heatmap-cell l${level}`;
    cell.innerHTML = `
      <div class="heatmap-hour">${formatHourLabel(slot.hour)}</div>
      <div class="heatmap-score">${Math.round((slot.avgFocusScore || 0) * 100)}%</div>
    `;
    cell.title = `Hour ${slot.hour}:00 | Score ${(slot.avgFocusScore || 0).toFixed(2)} | Samples ${slot.samples || 0}`;
    heatmapGridEl.appendChild(cell);
    requestAnimationFrame(() => cell.classList.add('flash'));
  }
}

function computeHighFocusStreak(heatmap) {
  let best = 0;
  let current = 0;

  for (const slot of heatmap) {
    const isHigh = (slot.samples || 0) > 0 && (slot.avgFocusScore || 0) >= 0.7;
    if (isHigh) {
      current += 1;
      best = Math.max(best, current);
    } else {
      current = 0;
    }
  }

  return best;
}

function renderInsights(analytics) {
  const topCorrelations = Array.isArray(analytics?.topCorrelations) ? analytics.topCorrelations : [];
  const heatmap = Array.isArray(analytics?.heatmap) ? analytics.heatmap : [];

  if (topPatternEl) {
    topPatternEl.innerText = topCorrelations.length
      ? `${topCorrelations[0].pattern} (${Math.round(topCorrelations[0].confidence * 100)}%)`
      : 'Need more distraction events';
  }

  if (bestHourEl) {
    const best = heatmap
      .filter((slot) => (slot.samples || 0) > 0)
      .sort((a, b) => (b.avgFocusScore || 0) - (a.avgFocusScore || 0))[0];
    bestHourEl.innerText = best
      ? `${formatHourLabel(best.hour)} (${Math.round((best.avgFocusScore || 0) * 100)}%)`
      : 'No scored hour yet';
  }

  if (streakEl) {
    const streak = computeHighFocusStreak(heatmap);
    streakEl.innerText = `${streak} high-focus ${streak === 1 ? 'hour' : 'hours'}`;
  }

  renderHeatmap(heatmap);
}

function updateFatigueMeter() {
  if (!fatigueMeterFillEl) return;
  fatigueMeterFillEl.style.width = `${Math.max(0, Math.min(100, Math.round(fatigueIndex)))}%`;
}

function updatePetState() {
  if (!petStageEl || !petFaceEl || !petMoodEl || !petTipEl) return;

  let state = 'idle';
  let face = '(o_o)';
  let mood = 'Mood: Waiting';
  let tip = 'Start a focus session to energize your pet.';

  if (isFocusMode) {
    if (fatigueIndex >= 70) {
      state = 'sleepy';
      face = '(-_-)';
      mood = 'Mood: Sleepy';
      tip = 'You look fatigued. Take a 20-second visual break now.';
    } else if (latestDistracted || latestFocusScore < 0.45) {
      state = 'distracted';
      face = '(x_x)';
      mood = 'Mood: Worried';
      tip = 'Your pet sees drift. Reduce context switching for 5 minutes.';
    } else if (latestFocusScore >= 0.75) {
      state = 'happy';
      face = '(^_^)';
      mood = 'Mood: Thriving';
      tip = 'Great flow. Keep this rhythm and bank more coins.';
    } else {
      state = 'focused';
      face = '(._.)';
      mood = 'Mood: Focused';
      tip = 'Steady progress. Push focus score above 75%.';
    }
  }

  petStageEl.setAttribute('data-state', state);
  petFaceEl.innerText = face;
  petMoodEl.innerText = mood;
  petTipEl.innerText = tip;
}

async function refreshFocusAnalytics() {
  const analytics = await window.focusGuardian.invoke('get-focus-analytics');
  renderInsights(analytics || {});
}

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
  setVisualTheme(mode);
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
  animateNumber(animatedCoins, data.coins, (value) => {
    animatedCoins = value;
    coinEl.innerText = value;
  });

  animateNumber(animatedDistractions, data.distractions, (value) => {
    animatedDistractions = value;
    distractionEl.innerText = value;
  });

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

  updatePetState();
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

window.focusGuardian.on('fatigue-alert', (payload) => {
  if (!payload) return;
  const suggestion = payload.suggestion || 'Fatigue detected. Consider a short break.';
  latestAlertEl.innerText = suggestion;
  setStatus('distracted', 'Fatigue signal detected');
  fatigueIndex = Math.min(100, (Number(payload.blinkRate) || 0) * 2 + (Number(payload.yawnCount) || 0) * 25);
  updateFatigueMeter();
  updatePetState();
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

  latestFocusScore = Number(payload.score) || 0;
  latestDistracted = Boolean(payload.isDistracted);
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

  fatigueIndex = Math.max(0, fatigueIndex - 0.25);
  updateFatigueMeter();
  updatePetState();

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

  const now = Date.now();
  if (now - lastMetricSampleTs >= 2000) {
    lastMetricSampleTs = now;
    window.focusGuardian.send('cv-metric-sample', {
      ts: now,
      score: payload.score,
      blinkDetected: Boolean(payload.blinkDetected),
      yawnDetected: Boolean(payload.yawnDetected)
    });
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
      animateMotionItems(tabEl);
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

if (analyticsRefreshBtn) {
  analyticsRefreshBtn.addEventListener('click', refreshFocusAnalytics);
}

setInterval(() => {
  refreshFocusAnalytics();
}, 15000);

loadSettings();
refreshFocusAnalytics();
updateFatigueMeter();
updatePetState();
animateMotionItems(document);

// Make accessible to distractionDetector.js
window.triggerAlert = triggerAlert;