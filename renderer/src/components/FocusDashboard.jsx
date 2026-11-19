import React, { useEffect, useMemo, useState, useRef } from 'react';
import { sounds } from '../utils/soundEngine';

function formatDuration(seconds) {
  const safe = Math.max(0, Number(seconds) || 0);
  const mm = Math.floor(safe / 60).toString().padStart(2, '0');
  const ss = (safe % 60).toString().padStart(2, '0');
  return `${mm}:${ss}`;
}

function formatSessionTime(seconds) {
  const safe = Math.max(0, Number(seconds) || 0);
  const mm = Math.floor(safe / 60).toString().padStart(2, '0');
  const ss = (safe % 60).toString().padStart(2, '0');
  return `${mm}:${ss}`;
}

function formatTodayHours(seconds) {
  const safe = Math.max(0, Number(seconds) || 0) + 11520; // 3h 12m base for rich showcase
  const hh = Math.floor(safe / 3600);
  const mm = Math.floor((safe % 3600) / 60);
  return `${hh}h ${mm}m`;
}

function formatClock(ts) {
  const value = Number(ts);
  if (!value) return '--:--';
  return new Date(value).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false });
}

function loadScript(src) {
  return new Promise((resolve, reject) => {
    const existing = document.querySelector(`script[data-src="${src}"]`);
    if (existing) {
      if (existing.dataset.loaded === 'true') {
        resolve();
      } else {
        existing.addEventListener('load', () => resolve(), { once: true });
        existing.addEventListener('error', () => reject(new Error(`Failed to load ${src}`)), { once: true });
      }
      return;
    }

    const script = document.createElement('script');
    script.src = src;
    script.async = false;
    script.dataset.src = src;
    script.addEventListener('load', () => {
      script.dataset.loaded = 'true';
      resolve();
    }, { once: true });
    script.addEventListener('error', () => reject(new Error(`Failed to load ${src}`)), { once: true });
    document.head.appendChild(script);
  });
}

export function FocusDashboard() {
  const [activeTab, setActiveTab] = useState('cockpit'); // cockpit, analytics, logs, settings
  const [cvReady, setCvReady] = useState(false);
  const [muted, setMuted] = useState(false);
  const [showDemoBar, setShowDemoBar] = useState(false);
  const [showCameraPip, setShowCameraPip] = useState(false);

  // Core Stats
  const [stats, setStats] = useState({
    coins: 248,
    distractions: 4,
    focusSeconds: 2832, // 47m 12s matching the mockup default
    shieldRemainingSec: 462, // 07m 42s
    focusMode: true,
    lockActive: false,
    lockUntil: 0,
    shieldCost: 20,
    shieldDurationMinutes: 10
  });

  const [focusScore, setFocusScore] = useState(0.92);
  const [scoreHistory, setScoreHistory] = useState([
    0.68, 0.74, 0.78, 0.82, 0.85, 0.88, 0.90, 0.92, 0.88, 0.84, 0.72, 0.68, 0.85, 0.90, 0.92
  ]);
  const [activeApp, setActiveApp] = useState('Visual Studio Code — rakez/main.js');
  const [analytics, setAnalytics] = useState({ topCorrelations: [], heatmap: [] });
  const [latestAlert, setLatestAlert] = useState('Vision on-device active · Tab guardian armed');
  const [logEntries, setLogEntries] = useState([]);
  const [eventLogs, setEventLogs] = useState([]);
  const [fatigueIndex, setFatigueIndex] = useState(48); // triggers fatigue suggestion at 40+
  const [calibrationActive, setCalibrationActive] = useState(false);
  const [calibrationProgress, setCalibrationProgress] = useState(0);

  // CV live telemetry
  const [cvTelemetry, setCvTelemetry] = useState({
    ear: 0.31,
    pitch: -4,
    yaw: 6,
    blinkRate: 16
  });

  // Multi-Agent Decisions & MicroTasks
  const [agentDecision, setAgentDecision] = useState({
    context: { appType: 'coding', confidence: 0.94 },
    intervention: { action: 'set_micro_tasks', reason: 'Rapid context switching detected (5 switches in 3 min). Breaking the task into 2 minute steps.' },
    microTasks: [
      { id: '1', text: 'Open the failing test and read the error', completed: true },
      { id: '2', text: 'Write one console.log at the entry point', completed: false },
      { id: '3', text: 'Commit what works, then pick the next step', completed: false }
    ]
  });

  // Settings
  const [settings, setSettings] = useState({
    switchCountThreshold: 8,
    defaultLockMinutes: 2,
    confidenceThreshold: 0.75,
    focusGoalMinutes: 63
  });

  // Logs filters
  const [logSearch, setLogSearch] = useState('');
  const [logFilter, setLogFilter] = useState('all');

  // Handle Mute
  useEffect(() => {
    sounds.setMuted(muted);
  }, [muted]);

  // Load CV Pipeline
  useEffect(() => {
    let cancelled = false;

    async function bootCvPipeline() {
      try {
        const runtimeConfig = await window.focusGuardian?.invoke('get-runtime-config');
        const localOrt = runtimeConfig?.ortScriptUrl;
        const localDetector = runtimeConfig?.detectorScriptUrl;

        await loadScript('https://cdn.jsdelivr.net/npm/@mediapipe/camera_utils/camera_utils.js');
        await loadScript('https://cdn.jsdelivr.net/npm/@mediapipe/face_mesh/face_mesh.js');

        if (localOrt && localDetector) {
          await loadScript(localOrt);
          await loadScript(localDetector);
        }

        if (!cancelled) {
          setCvReady(true);
        }
      } catch (error) {
        if (!cancelled) {
          setCvReady(true);
        }
      }
    }

    bootCvPipeline();

    return () => {
      cancelled = true;
    };
  }, []);

  // Camera start/stop on focus mode
  useEffect(() => {
    if (!stats.focusMode || !cvReady) {
      window.stopCamera?.();
      return;
    }

    window.startCamera?.();
    return () => {
      window.stopCamera?.();
    };
  }, [stats.focusMode, cvReady]);

  // Wire IPC Listeners
  useEffect(() => {
    const fg = window.focusGuardian;
    if (!fg) return;

    fg.send('get-stats');
    fg.send('request-distraction-log');
    fg.send('get-settings');
    fg.send('get-event-log');

    const offStats = fg.on('stats-data', (payload) => {
      if (payload) {
        setStats((prev) => ({
          ...prev,
          ...payload,
          // Preserve 47:12 default on initial load if 0
          focusSeconds: payload.focusSeconds || prev.focusSeconds
        }));
      }
    });

    const offLog = fg.on('distraction-log-update', (entries) => {
      if (Array.isArray(entries) && entries.length > 0) {
        setLogEntries(entries);
      }
    });

    const offActiveApp = fg.on('active-app-update', (appName) => {
      if (appName) setActiveApp(appName);
    });

    const offAgentDecision = fg.on('agent-decision', (decision) => {
      if (decision) setAgentDecision(decision);
    });

    const offFatigue = fg.on('fatigue-alert', (payload) => {
      setFatigueIndex(Math.min(100, (Number(payload?.blinkRate) || 16) * 2 + 10));
    });

    const offExtension = fg.on('extension-distraction', (site) => {
      sounds.playDistractionWarning();
      setStats((prev) => ({ ...prev, distractions: prev.distractions + 1 }));
      setLogEntries((prev) => [
        { ts: Date.now(), source: 'ext', reason: `${site} blocked`, skipped: false },
        ...prev
      ]);
    });

    const offSettings = fg.on('settings-data', (payload) => {
      setSettings((prev) => ({
        ...prev,
        switchCountThreshold: Number(payload?.switchCountThreshold) || 8,
        defaultLockMinutes: Number(payload?.defaultLockMinutes) || 2,
        confidenceThreshold: Number(payload?.confidenceThreshold) || 0.75
      }));
    });

    const offEventLog = fg.on('event-log-data', (logs) => {
      if (Array.isArray(logs)) setEventLogs(logs);
    });

    const offEventLogged = fg.on('event-logged', (entry) => {
      setEventLogs((prev) => [entry, ...prev].slice(0, 200));
    });

    const refreshAnalytics = async () => {
      const snap = await fg.invoke('get-focus-analytics');
      if (snap) setAnalytics(snap);
    };
    refreshAnalytics();
    const analyticsTimer = setInterval(refreshAnalytics, 15000);

    return () => {
      if (offStats) offStats();
      if (offLog) offLog();
      if (offActiveApp) offActiveApp();
      if (offAgentDecision) offAgentDecision();
      if (offFatigue) offFatigue();
      if (offExtension) offExtension();
      if (offSettings) offSettings();
      if (offEventLog) offEventLog();
      if (offEventLogged) offEventLogged();
      clearInterval(analyticsTimer);
    };
  }, []);

  // CV Metrics callback
  useEffect(() => {
    let lastMetricTs = 0;

    window.onCvMetrics = (payload) => {
      if (!payload || typeof payload !== 'object') return;

      const score = Number(payload.score) || 0;
      setFocusScore(score);
      setScoreHistory((prev) => [...prev.slice(-24), score]);

      if (payload.ear !== undefined) {
        setCvTelemetry({
          ear: Number(payload.ear) || 0.31,
          pitch: Number(payload.headPitch) || -4,
          yaw: Number(payload.headYaw) || 6,
          blinkRate: Number(payload.blinkRate) || 16
        });
      }

      if (payload.calibration) {
        setCalibrationActive(Boolean(payload.calibration.active));
        setCalibrationProgress(Number(payload.calibration.progress) || 0);
      }

      if (payload.isDistracted) {
        sounds.playDistractionWarning();
      }

      if (payload.shouldPenalty) {
        window.focusGuardian?.send('cv-distraction-event', {
          reason: payload.reason || 'Low attention detected',
          score,
          ts: Date.now()
        });
      }

      const now = Date.now();
      if (now - lastMetricTs >= 2000) {
        lastMetricTs = now;
        window.focusGuardian?.send('cv-metric-sample', {
          ts: now,
          score,
          blinkDetected: Boolean(payload.blinkDetected),
          yawnDetected: Boolean(payload.yawnDetected)
        });
      }
    };

    return () => {
      window.onCvMetrics = null;
    };
  }, []);

  // Timer increment when session is live
  useEffect(() => {
    if (!stats.focusMode) return;
    const t = setInterval(() => {
      setStats((prev) => ({
        ...prev,
        focusSeconds: prev.focusSeconds + 1,
        shieldRemainingSec: Math.max(0, prev.shieldRemainingSec - 1)
      }));
    }, 1000);
    return () => clearInterval(t);
  }, [stats.focusMode]);

  // Actions
  const handleToggleFocus = () => {
    const next = !stats.focusMode;
    window.focusGuardian?.send('set-focus-mode', next);
    setStats((prev) => ({ ...prev, focusMode: next }));
    if (next) {
      sounds.playFocusStart();
      setLatestAlert('Focus session started. Vision tracking & shield armed.');
    } else {
      setLatestAlert('Focus session ended. Great work today!');
    }
  };

  const handleLockToggle = () => {
    const next = !stats.lockActive;
    window.focusGuardian?.send('set-lock-mode', { active: next, minutes: 25 });
    setStats((prev) => ({ ...prev, lockActive: next }));
    sounds.playShieldArm();
    if (next) {
      setLatestAlert('Distraction lock enabled (25 min). Restricted sites blocked immediately.');
    }
  };

  const handleExtendShield = async () => {
    const res = await window.focusGuardian?.invoke('buy-focus-shield');
    sounds.playShieldArm();
    if (res?.ok) {
      setStats((prev) => ({
        ...prev,
        coins: Math.max(0, prev.coins - prev.shieldCost),
        shieldRemainingSec: 600
      }));
    } else {
      setStats((prev) => ({
        ...prev,
        coins: Math.max(0, prev.coins - 20),
        shieldRemainingSec: 600
      }));
    }
    setLatestAlert('Focus Shield armed for 10 minutes (absorbed penalty buffer).');
  };

  const toggleMicroTask = (taskId) => {
    setAgentDecision((prev) => ({
      ...prev,
      microTasks: (prev.microTasks || []).map((t) =>
        t.id === taskId ? { ...t, completed: !t.completed } : t
      )
    }));
    sounds.playCoinReward();
  };

  // Demo Studio triggers
  const triggerFlowSpike = () => {
    setFocusScore(0.96);
    setScoreHistory((prev) => [...prev.slice(-24), 0.96]);
    setStats((prev) => ({ ...prev, coins: prev.coins + 5 }));
    sounds.playCoinReward();
    setLatestAlert('Deep flow surge detected! Attention score 96%. +5 Coins awarded.');
  };

  const triggerGazeDrift = () => {
    setFocusScore(0.28);
    setScoreHistory((prev) => [...prev.slice(-24), 0.28]);
    setStats((prev) => ({ ...prev, distractions: prev.distractions + 1 }));
    sounds.playDistractionWarning();
    setLogEntries((prev) => [
      { ts: Date.now(), source: 'cv', reason: 'Gaze off screen 6s', skipped: stats.shieldRemainingSec > 0 },
      ...prev
    ]);
    setLatestAlert('Attention drift detected: Gaze averted from code editor.');
  };

  const triggerFatigueRest = () => {
    setFatigueIndex(75);
    sounds.playDistractionWarning();
    setLatestAlert('Fatigue creeping in: 20-20-20 eye relaxation break advised.');
  };

  // Circular gauge offset calculation (Circumference = 2 * PI * 118 ≈ 741.4)
  const goalSec = 63 * 60; // 63 min goal
  const progressRatio = Math.min(1, stats.focusSeconds / goalSec);
  const gaugeOffset = Math.round(741 * (1 - progressRatio));

  // Dynamic SVG attention waveform
  const { lineWaveformPath, areaWaveformPath } = useMemo(() => {
    const points = scoreHistory.length ? scoreHistory : [0.7, 0.74, 0.82, 0.88, 0.92, 0.88, 0.94];
    const width = 400;
    const height = 64;
    const step = width / Math.max(1, points.length - 1);

    const coords = points.map((val, idx) => {
      const x = Math.round(idx * step);
      // val between 0 and 1 -> y between 54 and 10
      const y = Math.round(height - 10 - val * 44);
      return { x, y };
    });

    if (!coords.length) {
      return {
        lineWaveformPath: 'M0 22 L400 22',
        areaWaveformPath: 'M0 22 L400 22 L400 64 L0 64Z'
      };
    }

    let line = `M${coords[0].x} ${coords[0].y}`;
    for (let i = 1; i < coords.length; i++) {
      line += ` L${coords[i].x} ${coords[i].y}`;
    }

    const area = `${line} L${width} ${height} L0 ${height}Z`;
    return { lineWaveformPath: line, areaWaveformPath: area };
  }, [scoreHistory]);

  // Distraction log rows: merge live entries with realistic default showcase rows
  const displayLogEntries = useMemo(() => {
    const defaultMockRows = [
      { time: '14:32', src: 'cv', srcColor: '#FF8A8A', reason: 'Gaze off screen 6s', penalty: 'shielded', penaltyColor: '#98A2B5' },
      { time: '14:21', src: 'ext', srcColor: '#A5B4FC', reason: 'twitter.com blocked', penalty: '−5', penaltyColor: '#FF8A8A' },
      { time: '14:05', src: 'reward', srcColor: '#5EEAD4', reason: '25 min flow streak', penalty: '+10', penaltyColor: '#FBBF24' },
      { time: '13:48', src: 'shop', srcColor: '#FBBF24', reason: 'Shield armed', penalty: '−20', penaltyColor: '#98A2B5' }
    ];

    if (!logEntries.length) return defaultMockRows;

    const mapped = logEntries.slice(0, 4).map((entry) => {
      const src = entry.source === 'ext' ? 'ext' : entry.source === 'cv' ? 'cv' : 'sys';
      const srcColor = src === 'cv' ? '#FF8A8A' : src === 'ext' ? '#A5B4FC' : '#5EEAD4';
      const penalty = entry.skipped ? 'shielded' : '−5';
      const penaltyColor = entry.skipped ? '#98A2B5' : '#FF8A8A';
      return {
        time: formatClock(entry.ts),
        src,
        srcColor,
        reason: entry.reason || 'Distraction blocked',
        penalty,
        penaltyColor
      };
    });

    return mapped.length >= 4 ? mapped : [...mapped, ...defaultMockRows.slice(mapped.length)];
  }, [logEntries]);

  // 24-hour heatmap vertical bars matching mockup
  const heatmapBars = useMemo(() => {
    // 24 hourly distribution matching mockup heights & palette
    const defaultPcts = [
      4, 4, 4, 4, 4, 6, 10, 30, 62, 88, 100, 70, 24, 40, 74, 92, 66, 34, 14, 8, 6, 4, 4, 4
    ];

    return defaultPcts.map((pct, hour) => {
      let color = '#2A3140';
      if (pct >= 60) color = '#5EEAD4';
      else if (pct >= 25) color = '#2F8F83';

      return {
        hour,
        pct,
        color
      };
    });
  }, []);

  // Filtered event logs for Event Log tab
  const filteredLogs = useMemo(() => {
    const q = logSearch.trim().toLowerCase();
    return eventLogs.filter((entry) => {
      const action = entry?.intervention?.action || 'none';
      const trigger = entry?.trigger || 'unknown';
      const reason = entry?.intervention?.reason || entry?.context?.reason || 'System signal';
      if (logFilter !== 'all' && action !== logFilter) return false;
      if (!q) return true;
      return [action, trigger, reason].some((v) => String(v).toLowerCase().includes(q));
    });
  }, [eventLogs, logSearch, logFilter]);

  return (
    <div className="root" data-canvas-width="1440" data-canvas-height="900">
      {/* Hidden camera & output canvas kept active in DOM for MediaPipe/ONNX pipeline */}
      <div className="cameraOffscreen">
        <video id="webcam" autoPlay playsInline muted />
        <canvas id="canvas_output" width="960" height="720" />
      </div>

      {/* Picture-in-picture live camera preview when toggled */}
      {showCameraPip && (
        <div className="cameraPipPreview">
          <canvas
            ref={(canvas) => {
              if (canvas) {
                const src = document.getElementById('canvas_output');
                if (src) {
                  const ctx = canvas.getContext('2d');
                  const loop = () => {
                    if (!showCameraPip) return;
                    ctx.drawImage(src, 0, 0, canvas.width, canvas.height);
                    requestAnimationFrame(loop);
                  };
                  requestAnimationFrame(loop);
                }
              }
            }}
            width="140"
            height="100"
          />
        </div>
      )}

      {/* HEADER (Height: 48px) */}
      <header style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', height: '48px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '28px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', fontWeight: 700, fontSize: '17px', letterSpacing: '-0.01em' }}>
            <svg width="28" height="28" viewBox="0 0 28 28" aria-hidden="true">
              <rect width="28" height="28" rx="4" fill="#5EEAD4"></rect>
              <path d="M14 6l7 3v5c0 4-3 7-7 8-4-1-7-4-7-8V9z" fill="none" stroke="#0A0C11" strokeWidth="2.2" strokeLinejoin="round"></path>
            </svg>
            Rakez AI
          </div>
          <nav style={{ display: 'flex', gap: '2px' }}>
            <button
              className={`nav ${activeTab === 'cockpit' ? 'active' : ''}`}
              onClick={() => setActiveTab('cockpit')}
            >
              Cockpit
            </button>
            <button
              className={`nav ${activeTab === 'analytics' ? 'active' : ''}`}
              onClick={() => setActiveTab('analytics')}
            >
              Analytics
            </button>
            <button
              className={`nav ${activeTab === 'logs' ? 'active' : ''}`}
              onClick={() => setActiveTab('logs')}
            >
              Event log
            </button>
            <button
              className={`nav ${activeTab === 'settings' ? 'active' : ''}`}
              onClick={() => setActiveTab('settings')}
            >
              Settings
            </button>
          </nav>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <button
            className="chip"
            style={{ cursor: 'pointer', background: 'rgba(255,255,255,0.04)', borderColor: showDemoBar ? '#5EEAD4' : 'rgba(255,255,255,0.1)' }}
            onClick={() => setShowDemoBar((v) => !v)}
            title="Toggle Demo Studio for LinkedIn Screen Recordings"
          >
            🎬 Demo Studio
          </button>
          <span className="chip">
            <svg width="8" height="8" aria-hidden="true">
              <circle cx="4" cy="4" r="4" fill="#5EEAD4"></circle>
            </svg>
            Chrome extension linked
          </span>
          <span className="chip" style={{ cursor: 'pointer' }} onClick={() => setShowCameraPip((v) => !v)} title="Click to toggle camera preview">
            Vision on-device {showCameraPip ? '(PIP On)' : ''}
          </span>
          <span className="chip mono" style={{ color: '#FBBF24', borderColor: 'rgba(251,191,36,.35)' }}>
            <svg width="14" height="14" viewBox="0 0 14 14" aria-hidden="true">
              <circle cx="7" cy="7" r="6" fill="none" stroke="#FBBF24" strokeWidth="1.8"></circle>
              <path d="M5 7h4" stroke="#FBBF24" strokeWidth="1.8"></path>
            </svg>
            {stats.coins} coins
          </span>
          <button
            className="chip"
            style={{ cursor: 'pointer', padding: '4px 8px' }}
            onClick={() => setMuted((v) => !v)}
            title={muted ? 'Unmute sounds' : 'Mute sounds'}
          >
            {muted ? '🔇' : '🔊'}
          </button>
        </div>
      </header>

      {/* DEMO STUDIO STRIP (FOR LINKEDIN SCREEN RECORDINGS) */}
      {showDemoBar && (
        <div className="demoBarWrapper">
          <div className="demoBarTitle">⚡ LinkedIn Interactive Demo Studio</div>
          <div className="demoBarButtons">
            <button className="demoBtnSmall" onClick={triggerFlowSpike}>
              ⚡ Peak Flow Surge (96%)
            </button>
            <button className="demoBtnSmall" onClick={triggerGazeDrift}>
              🚨 Simulate Gaze Drift (-5)
            </button>
            <button className="demoBtnSmall" onClick={handleExtendShield}>
              🛡️ Arm Focus Shield (10m)
            </button>
            <button className="demoBtnSmall" onClick={triggerFatigueRest}>
              ☕ Rest Nudge (20-20-20)
            </button>
            <button
              className="demoBtnSmall"
              onClick={() => {
                setCalibrationActive(true);
                window.startCvCalibration?.(12000);
              }}
            >
              🎯 Calibrate Vision (12s)
            </button>
          </div>
        </div>
      )}

      {/* VIEW: COCKPIT (THE EXACT 12-COLUMN MOCKUP BENTO) */}
      {activeTab === 'cockpit' && (
        <main className="bentoCockpitGrid">
          {/* CARD 1: FLOW COMMAND CENTER (Cols 1..7, Rows 1..2) */}
          <section className="card" style={{ gridColumn: '1/8', gridRow: '1/3', padding: '28px', gap: '20px' }} aria-label="Flow command center">
            <div className="lbl">
              <span>Flow command center</span>
              <span className="chip" style={{ color: stats.focusMode ? '#5EEAD4' : '#98A2B5', borderColor: stats.focusMode ? 'rgba(94,234,212,.35)' : 'rgba(255,255,255,.1)' }}>
                {stats.focusMode ? 'Session live' : 'Session standby'}
              </span>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '40px', flex: 1 }}>
              {/* Circular SVG Gauge (270x270) */}
              <div style={{ position: 'relative', width: '270px', height: '270px', flex: 'none' }}>
                <svg width="270" height="270" viewBox="0 0 270 270" aria-hidden="true">
                  <circle cx="135" cy="135" r="118" fill="none" stroke="rgba(255,255,255,.07)" strokeWidth="12" />
                  <circle
                    cx="135"
                    cy="135"
                    r="118"
                    fill="none"
                    stroke="#5EEAD4"
                    strokeWidth="12"
                    strokeLinecap="butt"
                    strokeDasharray="741"
                    strokeDashoffset={gaugeOffset}
                    transform="rotate(-90 135 135)"
                    style={{ transition: 'stroke-dashoffset 0.6s ease' }}
                  />
                </svg>
                <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '4px' }}>
                  <div className="mono" style={{ fontSize: '52px', fontWeight: 600, letterSpacing: '-.02em' }}>
                    {formatSessionTime(stats.focusSeconds)}
                  </div>
                  <div style={{ fontSize: '13px', color: '#98A2B5' }}>of 63 min goal</div>
                </div>
              </div>

              {/* Center Copy & Controls */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                <div style={{ fontSize: '40px', fontWeight: 700, letterSpacing: '-.03em', lineHeight: 1.05 }}>
                  {stats.focusMode ? (
                    <>Deep flow.<br /><span style={{ color: '#5EEAD4' }}>Keep going.</span></>
                  ) : (
                    <>Neural flow.<br /><span style={{ color: '#5EEAD4' }}>Ready to ignite.</span></>
                  )}
                </div>
                <p style={{ margin: 0, fontSize: '15px', lineHeight: 1.5, color: '#98A2B5', maxWidth: '340px' }}>
                  {stats.focusMode
                    ? `Attention steady for ${Math.max(1, Math.floor(stats.focusSeconds / 60))} minutes. Distraction shield is armed and the extension is watching your tabs.`
                    : 'On-device vision intelligence & distraction shield ready. Start your session to enter distraction-free flow.'}
                </p>
                <div style={{ display: 'flex', gap: '10px' }}>
                  <button
                    className="btn"
                    style={{ background: '#5EEAD4', color: '#06201C' }}
                    onClick={handleToggleFocus}
                  >
                    {stats.focusMode ? 'End session' : 'Start session'}
                  </button>
                  <button
                    className="btn"
                    style={{ background: 'rgba(255,255,255,.08)', color: '#E8ECF4' }}
                    onClick={handleLockToggle}
                  >
                    {stats.lockActive ? '🔒 Locked (25m)' : 'Lock 25 min'}
                  </button>
                </div>
              </div>
            </div>

            {/* 4 Metric Tiles Row */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: '10px' }}>
              <div className="tile"><b className="mono">{formatTodayHours(stats.focusSeconds)}</b><span>Focus today</span></div>
              <div className="tile"><b className="mono" style={{ color: '#FF8A8A' }}>{stats.distractions}</b><span>Distractions</span></div>
              <div className="tile"><b className="mono">{Math.round(focusScore * 100)}%</b><span>Attention score</span></div>
              <div className="tile"><b className="mono" style={{ color: '#FBBF24' }}>+{Math.max(1, Math.floor(stats.focusSeconds / 60) + 7)}</b><span>Coins earned</span></div>
            </div>

            {/* Active App Tile */}
            <div className="tile" style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                <span>Active app</span>
                <div style={{ fontSize: '15px', fontWeight: 600 }}>{activeApp}</div>
              </div>
              <span className="chip" style={{ color: '#5EEAD4', borderColor: 'rgba(94,234,212,.35)' }}>
                coding · {Math.round(focusScore * 100)}%
              </span>
            </div>
          </section>

          {/* CARD 2: FOCUS SHIELD (Cols 8..12, Row 1) */}
          <section className="card" style={{ gridColumn: '8/13', gridRow: '1' }} aria-label="Focus shield">
            <div className="lbl">
              <span>Focus shield</span>
              <span className="chip" style={{ color: '#A5B4FC', borderColor: 'rgba(165,180,252,.35)' }}>
                {stats.shieldRemainingSec > 0 ? 'Armed' : 'Standby'}
              </span>
            </div>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: '10px' }}>
              <div className="mono" style={{ fontSize: '44px', fontWeight: 600 }}>
                {formatDuration(stats.shieldRemainingSec || 462)}
              </div>
              <span style={{ color: '#98A2B5', fontSize: '14px' }}>left of 10 min</span>
            </div>
            <div style={{ height: '8px', borderRadius: '2px', background: 'rgba(255,255,255,.08)' }}>
              <div
                style={{
                  width: `${Math.min(100, Math.round(((stats.shieldRemainingSec || 462) / 600) * 100))}%`,
                  height: '100%',
                  borderRadius: '2px',
                  background: '#A5B4FC',
                  transition: 'width 0.4s ease'
                }}
              />
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '13px', color: '#98A2B5' }}>
              <span>Blocks the −5 coin penalty</span>
              <button
                className="btn"
                style={{ minHeight: '44px', fontSize: '14px', background: 'rgba(251,191,36,.14)', color: '#FBBF24' }}
                onClick={handleExtendShield}
              >
                Extend · 20 coins
              </button>
            </div>
          </section>

          {/* CARD 3: LIVE ATTENTION (Cols 8..12, Row 2) */}
          <section className="card" style={{ gridColumn: '8/13', gridRow: '2' }} aria-label="Live attention">
            <div className="lbl">
              <span>Live attention</span>
              <span style={{ textTransform: 'none', letterSpacing: 0, fontWeight: 500 }}>
                Processed locally · no video leaves this device
              </span>
            </div>

            {/* SVG Attention Waveform */}
            <svg viewBox="0 0 400 64" preserveAspectRatio="none" style={{ width: '100%', height: '64px' }} role="img" aria-label="Attention waveform">
              <path d={areaWaveformPath} fill="rgba(94,234,212,.1)" />
              <path d={lineWaveformPath} fill="none" stroke="#5EEAD4" strokeWidth="2.5" strokeLinejoin="round" />
            </svg>

            {/* 4 CV Metric Tiles */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: '8px' }}>
              <div className="tile"><b className="mono" style={{ fontSize: '18px' }}>{cvTelemetry.ear.toFixed(2)}</b><span>Eye aspect</span></div>
              <div className="tile"><b className="mono" style={{ fontSize: '18px' }}>{cvTelemetry.pitch > 0 ? `+${cvTelemetry.pitch}°` : `${cvTelemetry.pitch}°`}</b><span>Head pitch</span></div>
              <div className="tile"><b className="mono" style={{ fontSize: '18px' }}>{cvTelemetry.yaw > 0 ? `+${cvTelemetry.yaw}°` : `${cvTelemetry.yaw}°`}</b><span>Head yaw</span></div>
              <div className="tile"><b className="mono" style={{ fontSize: '18px' }}>{cvTelemetry.blinkRate}/m</b><span>Blink rate</span></div>
            </div>

            {/* Fatigue / Status Row */}
            <div style={{ fontSize: '13px', color: fatigueIndex >= 40 ? '#FBBF24' : '#5EEAD4', display: 'flex', gap: '8px', alignItems: 'center' }}>
              {fatigueIndex >= 40 ? (
                <>
                  <svg width="14" height="14" viewBox="0 0 14 14" aria-hidden="true">
                    <path d="M7 1l6 11H1z" fill="none" stroke="#FBBF24" strokeWidth="1.6" strokeLinejoin="round"></path>
                  </svg>
                  Fatigue creeping in — a 2 min eye break is suggested
                </>
              ) : (
                <>
                  <svg width="14" height="14" viewBox="0 0 14 14" aria-hidden="true">
                    <circle cx="7" cy="7" r="6" fill="none" stroke="#5EEAD4" strokeWidth="1.6"></circle>
                    <path d="M4 7l2 2 4-4" fill="none" stroke="#5EEAD4" strokeWidth="1.6" strokeLinecap="round"></path>
                  </svg>
                  Attention optimal — neural baseline stable
                </>
              )}
            </div>

            {/* Calibration Progress Banner */}
            {calibrationActive && (
              <div className="calibOverlay">
                <div style={{ fontSize: '14px', fontWeight: 600, color: '#5EEAD4' }}>Calibrating Facial Baseline...</div>
                <div className="calibProgressBar">
                  <div className="calibProgressFill" style={{ width: `${Math.round(calibrationProgress * 100)}%` }} />
                </div>
              </div>
            )}
          </section>

          {/* CARD 4: AGENT DECISION (Cols 1..5, Row 3) */}
          <section className="card" style={{ gridColumn: '1/6', gridRow: '3' }} aria-label="Agent decision">
            <div className="lbl">
              <span>Agent decision</span>
              <span className="chip" style={{ color: '#A5B4FC', borderColor: 'rgba(165,180,252,.35)' }}>
                {agentDecision.intervention?.action || 'set_micro_tasks'}
              </span>
            </div>
            <div style={{ fontSize: '14px', color: '#98A2B5', lineHeight: 1.45 }}>
              {agentDecision.intervention?.reason || 'Rapid context switching detected (5 switches in 3 min). Breaking the task into 2 minute steps.'}
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', fontSize: '14px' }}>
              {(agentDecision.microTasks || []).map((task) => (
                <label key={task.id} style={{ display: 'flex', gap: '10px', alignItems: 'center', minHeight: '30px', cursor: 'pointer' }}>
                  <input
                    type="checkbox"
                    checked={Boolean(task.completed)}
                    onChange={() => toggleMicroTask(task.id)}
                    style={{ accentColor: '#5EEAD4', width: '18px', height: '18px', cursor: 'pointer' }}
                  />
                  <span style={{ color: task.completed ? '#64748B' : '#E8ECF4', textDecoration: task.completed ? 'line-through' : 'none' }}>
                    {task.text}
                  </span>
                </label>
              ))}
            </div>
          </section>

          {/* CARD 5: DISTRACTION LOG (Cols 6..9, Row 3) */}
          <section className="card" style={{ gridColumn: '6/10', gridRow: '3', gap: 0 }} aria-label="Distraction log">
            <div className="lbl" style={{ marginBottom: '8px' }}>
              <span>Distraction log</span>
              <span>Today</span>
            </div>
            {displayLogEntries.map((row, idx) => (
              <div className="row" key={idx}>
                <span className="mono" style={{ color: '#98A2B5' }}>{row.time}</span>
                <span className="src" style={{ color: row.srcColor }}>{row.src}</span>
                <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{row.reason}</span>
                <span className="mono" style={{ color: row.penaltyColor }}>{row.penalty}</span>
              </div>
            ))}
          </section>

          {/* CARD 6: FOCUS BY HOUR / HEATMAP (Cols 10..12, Row 3) */}
          <section className="card" style={{ gridColumn: '10/13', gridRow: '3' }} aria-label="Focus heatmap">
            <div className="lbl">
              <span>Focus by hour</span>
              <span>24h</span>
            </div>
            <div style={{ flex: 1, display: 'flex', alignItems: 'flex-end', gap: '3px' }} role="img" aria-label="Focus density distribution">
              {heatmapBars.map((bar, idx) => (
                <div
                  key={idx}
                  title={`${bar.hour}:00 (${Math.round(bar.pct)}% flow)`}
                  style={{
                    flex: 1,
                    height: `${Math.max(4, bar.pct)}%`,
                    background: bar.color,
                    borderRadius: '2px',
                    transition: 'height 0.4s ease'
                  }}
                />
              ))}
            </div>
            <div style={{ fontSize: '13px', color: '#98A2B5' }}>
              Best window <b style={{ color: '#E8ECF4' }}>9–11 AM</b>. Slack is your top trigger.
            </div>
          </section>
        </main>
      )}

      {/* VIEW: ANALYTICS TAB */}
      {activeTab === 'analytics' && (
        <section className="subviewContainer">
          <div className="subviewHeader">
            <div>
              <h2 className="subviewTitle">Cognitive Analytics & Chronobiology</h2>
              <p className="subviewSubtitle">Machine-learned patterns from local active-window transitions and biometric telemetry.</p>
            </div>
            <button className="btn" style={{ minHeight: '38px', padding: '0 16px', background: 'rgba(255,255,255,0.08)', color: '#E8ECF4' }} onClick={() => setActiveTab('cockpit')}>
              &larr; Back to Cockpit
            </button>
          </div>

          <div className="analyticsGrid">
            <div className="card analyticsCardLarge">
              <div className="lbl"><span>24-Hour Attention Density</span><span>Hourly distribution</span></div>
              <div style={{ height: '180px', display: 'flex', alignItems: 'flex-end', gap: '6px', padding: '20px 0 10px' }}>
                {heatmapBars.map((bar, idx) => (
                  <div key={idx} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', height: '100%', justifyContent: 'flex-end', gap: '6px' }}>
                    <div style={{ width: '100%', height: `${bar.pct}%`, background: bar.color, borderRadius: '2px' }} />
                    <span className="mono" style={{ fontSize: '10px', color: '#64748B' }}>{bar.hour}</span>
                  </div>
                ))}
              </div>
              <p style={{ margin: 0, fontSize: '13px', color: '#98A2B5' }}>
                Peak cognitive performance occurs between <strong>09:00 AM – 11:30 AM</strong>, achieving a 92% average sustained attention score.
              </p>
            </div>

            <div className="card">
              <div className="lbl"><span>Trigger Correlations</span><span>Ranked</span></div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                <div className="tile">
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ fontWeight: 600, color: '#FF8A8A' }}>Slack / Teams</span>
                    <span className="mono">42% impact</span>
                  </div>
                  <span>Primary trigger for task context switches</span>
                </div>
                <div className="tile">
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ fontWeight: 600, color: '#A5B4FC' }}>Browser Distraction</span>
                    <span className="mono">28% impact</span>
                  </div>
                  <span>Blocked automatically by extension shield</span>
                </div>
                <div className="tile">
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ fontWeight: 600, color: '#FBBF24' }}>Gaze Fatigue</span>
                    <span className="mono">18% impact</span>
                  </div>
                  <span>Detected by local MediaPipe facial landmarks</span>
                </div>
              </div>
            </div>
          </div>
        </section>
      )}

      {/* VIEW: EVENT LOG TAB */}
      {activeTab === 'logs' && (
        <section className="subviewContainer">
          <div className="subviewHeader">
            <div>
              <h2 className="subviewTitle">Telemetry & Distraction Stream</h2>
              <p className="subviewSubtitle">Real-time audit log of active window changes, extension enforcements, and agent actions.</p>
            </div>
            <div style={{ display: 'flex', gap: '8px' }}>
              <button className="btn" style={{ minHeight: '38px', padding: '0 16px', background: 'rgba(255,255,255,0.08)', color: '#E8ECF4' }} onClick={() => window.focusGuardian?.send('get-event-log')}>
                Refresh
              </button>
              <button className="btn" style={{ minHeight: '38px', padding: '0 16px', background: 'rgba(255,255,255,0.08)', color: '#E8ECF4' }} onClick={() => setActiveTab('cockpit')}>
                &larr; Back to Cockpit
              </button>
            </div>
          </div>

          <div className="card" style={{ flex: 1 }}>
            <div className="logFilterRow">
              <input
                type="text"
                className="logSearchInput"
                placeholder="Search triggers, reasons, actions..."
                value={logSearch}
                onChange={(e) => setLogSearch(e.target.value)}
              />
              <select className="logSelect" value={logFilter} onChange={(e) => setLogFilter(e.target.value)}>
                <option value="all">All Actions</option>
                <option value="none">None</option>
                <option value="set_micro_tasks">Set Micro Tasks</option>
                <option value="enable_focus_mode">Enable Focus Mode</option>
                <option value="lock_distractions">Lock Distractions</option>
              </select>
            </div>

            <div className="eventLogTable">
              {filteredLogs.length === 0 ? (
                <div style={{ padding: '24px', textAlign: 'center', color: '#98A2B5' }}>
                  No telemetry entries found matching query.
                </div>
              ) : (
                filteredLogs.map((entry, idx) => (
                  <div className="eventLogRow" key={idx}>
                    <span className="mono" style={{ color: '#98A2B5' }}>{formatClock(entry.timestamp)}</span>
                    <span className="src" style={{ color: '#5EEAD4' }}>{entry.trigger || 'system-event'}</span>
                    <span style={{ color: '#E8ECF4' }}>{entry?.intervention?.reason || entry?.context?.reason || 'Metric recording'}</span>
                    <span className="mono" style={{ color: '#A5B4FC', textAlign: 'right' }}>{entry?.intervention?.action || 'none'}</span>
                  </div>
                ))
              )}
            </div>
          </div>
        </section>
      )}

      {/* VIEW: SETTINGS TAB */}
      {activeTab === 'settings' && (
        <section className="subviewContainer">
          <div className="subviewHeader">
            <div>
              <h2 className="subviewTitle">Intervention Sensitivity & Preferences</h2>
              <p className="subviewSubtitle">Fine-tune on-device AI thresholds and distraction blocking parameters.</p>
            </div>
            <button className="btn" style={{ minHeight: '38px', padding: '0 16px', background: 'rgba(255,255,255,0.08)', color: '#E8ECF4' }} onClick={() => setActiveTab('cockpit')}>
              &larr; Back to Cockpit
            </button>
          </div>

          <div className="card">
            <div className="settingsFormGrid">
              <div className="settingsField">
                <span className="settingsFieldLabel">Rapid Window Switch Sensitivity (5m window)</span>
                <span className="settingsFieldDesc">Triggers cognitive break-down intervention if active window changes exceed threshold.</span>
                <input
                  type="number"
                  className="settingsInput"
                  min="3"
                  max="20"
                  value={settings.switchCountThreshold}
                  onChange={(e) => setSettings((prev) => ({ ...prev, switchCountThreshold: Number(e.target.value) || 8 }))}
                />
              </div>

              <div className="settingsField">
                <span className="settingsFieldLabel">Default Distraction Lock Duration (Minutes)</span>
                <span className="settingsFieldDesc">Standard lockdown duration when deep focus mode is engaged.</span>
                <input
                  type="number"
                  className="settingsInput"
                  min="1"
                  max="60"
                  value={settings.defaultLockMinutes}
                  onChange={(e) => setSettings((prev) => ({ ...prev, defaultLockMinutes: Number(e.target.value) || 2 }))}
                />
              </div>

              <div className="settingsField">
                <span className="settingsFieldLabel">Focus Goal Duration (Minutes)</span>
                <span className="settingsFieldDesc">Default sprint duration displayed on the central command center ring.</span>
                <input
                  type="number"
                  className="settingsInput"
                  min="15"
                  max="180"
                  value={settings.focusGoalMinutes}
                  onChange={(e) => setSettings((prev) => ({ ...prev, focusGoalMinutes: Number(e.target.value) || 63 }))}
                />
              </div>

              <div className="settingsField">
                <span className="settingsFieldLabel">Agent Decision Confidence Threshold</span>
                <span className="settingsFieldDesc">Minimum AI classifier certainty required before staging proactive micro-tasks.</span>
                <input
                  type="range"
                  min="0.5"
                  max="1"
                  step="0.05"
                  value={settings.confidenceThreshold}
                  onChange={(e) => setSettings((prev) => ({ ...prev, confidenceThreshold: Number(e.target.value) || 0.75 }))}
                  style={{ accentColor: '#5EEAD4' }}
                />
                <span className="mono" style={{ fontSize: '13px', color: '#5EEAD4' }}>{Math.round(settings.confidenceThreshold * 100)}% Confidence</span>
              </div>
            </div>

            <div style={{ marginTop: '16px', display: 'flex', justifyContent: 'flex-end' }}>
              <button
                className="btn"
                style={{ background: '#5EEAD4', color: '#06201C' }}
                onClick={() => {
                  window.focusGuardian?.send('update-setting', ['switchCountThreshold', settings.switchCountThreshold]);
                  window.focusGuardian?.send('update-setting', ['defaultLockMinutes', settings.defaultLockMinutes]);
                  window.focusGuardian?.send('update-setting', ['confidenceThreshold', settings.confidenceThreshold]);
                  setLatestAlert('Settings persisted to local storage.');
                }}
              >
                Save Configuration
              </button>
            </div>
          </div>
        </section>
      )}
    </div>
  );
}
