function registerFocusIpc({ ipcMain, focusIntelligence, notifyRenderer }) {
  if (!ipcMain) throw new Error('ipcMain is required');

  ipcMain.on('cv-metric-sample', (_event, payload) => {
    if (!payload || typeof payload !== 'object' || !focusIntelligence) return;

    const ts = Number(payload.ts) || Date.now();
    if (typeof payload.score === 'number') {
      focusIntelligence.recordAttentionSample(payload.score, ts);
    }

    const fatigue = focusIntelligence.recordFaceSignal({
      ts,
      blinkDetected: Boolean(payload.blinkDetected),
      yawnDetected: Boolean(payload.yawnDetected)
    });

    if (fatigue?.fatigueDetected && typeof notifyRenderer === 'function') {
      notifyRenderer('fatigue-alert', {
        ts,
        suggestion: fatigue.suggestion,
        severity: fatigue.severity,
        blinkRate: fatigue.blinkRate,
        yawnCount: fatigue.yawnCount
      });
    }
  });

  ipcMain.handle('get-focus-analytics', () => {
    if (!focusIntelligence) return { generatedAt: Date.now(), topCorrelations: [], heatmap: [] };
    return focusIntelligence.getAnalyticsSnapshot();
  });
}

module.exports = { registerFocusIpc };