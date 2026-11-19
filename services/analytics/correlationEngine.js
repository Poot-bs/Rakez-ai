class CorrelationEngine {
  constructor(options = {}) {
    this.windowMs = options.windowMs || 5 * 60 * 1000;
    this.retentionMs = options.retentionMs || 24 * 60 * 60 * 1000;
    this.triggers = [];
    this.distractions = [];
    this.patternCounts = new Map();
    this.triggerCounts = new Map();
  }

  recordTrigger(trigger) {
    const event = {
      ts: Number(trigger?.ts) || Date.now(),
      app: trigger?.app || 'unknown',
      title: trigger?.title || '',
      site: trigger?.site || ''
    };

    this.triggers.push(event);
    this._incrementMap(this.triggerCounts, this._triggerKey(event));
    this._pruneOld();
  }

  recordDistraction(distraction) {
    const event = {
      ts: Number(distraction?.ts) || Date.now(),
      source: distraction?.source || 'unknown',
      site: distraction?.site || '',
      title: distraction?.title || ''
    };

    this.distractions.push(event);
    this._linkRecentTriggers(event);
    this._pruneOld();
  }

  getTopPatterns(limit = 5) {
    const rows = Array.from(this.patternCounts.entries()).map(([key, count]) => {
      const triggerCount = this.triggerCounts.get(key) || count;
      const confidence = triggerCount > 0 ? count / triggerCount : 0;
      return {
        pattern: `${key} -> distraction <= 5m`,
        count,
        confidence: Number(confidence.toFixed(2))
      };
    });

    rows.sort((a, b) => b.count - a.count || b.confidence - a.confidence);
    return rows.slice(0, Math.max(1, limit));
  }

  _linkRecentTriggers(distraction) {
    const cutoff = distraction.ts - this.windowMs;
    const seen = new Set();

    for (let i = this.triggers.length - 1; i >= 0; i -= 1) {
      const trigger = this.triggers[i];
      if (trigger.ts < cutoff) break;

      const key = this._triggerKey(trigger);
      if (seen.has(key)) continue;
      seen.add(key);
      this._incrementMap(this.patternCounts, key);
    }
  }

  _triggerKey(trigger) {
    const app = (trigger.app || 'unknown').trim();
    const site = (trigger.site || '').trim();
    return site ? `${app} [${site}]` : app;
  }

  _incrementMap(map, key) {
    map.set(key, (map.get(key) || 0) + 1);
  }

  _pruneOld() {
    const threshold = Date.now() - this.retentionMs;
    while (this.triggers.length && this.triggers[0].ts < threshold) {
      this.triggers.shift();
    }
    while (this.distractions.length && this.distractions[0].ts < threshold) {
      this.distractions.shift();
    }
  }
}

module.exports = { CorrelationEngine };