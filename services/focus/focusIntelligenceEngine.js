const { CorrelationEngine } = require('../analytics/correlationEngine');
const { FocusHeatmapEngine } = require('../analytics/focusHeatmapEngine');
const { FatigueDetector } = require('../fatigue/fatigueDetector');

class FocusIntelligenceEngine {
  constructor({ store } = {}) {
    this.store = store || null;
    this.correlation = new CorrelationEngine();
    this.heatmap = new FocusHeatmapEngine();
    this.fatigue = new FatigueDetector();
  }

  recordWindowSwitch(signal = {}) {
    this.correlation.recordTrigger({
      ts: signal.ts,
      app: signal.app,
      title: signal.title,
      site: signal.site
    });
  }

  recordDistraction(event = {}) {
    this.correlation.recordDistraction({
      ts: event.ts,
      source: event.source,
      site: event.site,
      title: event.title
    });
    this.heatmap.recordDistraction(event.ts);
  }

  recordAttentionSample(score, ts = Date.now()) {
    this.heatmap.recordAttention(score, ts);
  }

  recordFaceSignal(signal = {}) {
    return this.fatigue.recordSignal(signal);
  }

  getAnalyticsSnapshot() {
    const snapshot = {
      generatedAt: Date.now(),
      topCorrelations: this.correlation.getTopPatterns(8),
      heatmap: this.heatmap.getHeatmap()
    };

    if (this.store) {
      this.store.set('focusAnalytics.lastSnapshot', snapshot);
    }

    return snapshot;
  }
}

module.exports = { FocusIntelligenceEngine };