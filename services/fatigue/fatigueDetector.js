class FatigueDetector {
  constructor(options = {}) {
    this.blinkWindowMs = options.blinkWindowMs || 60 * 1000;
    this.yawnWindowMs = options.yawnWindowMs || 3 * 60 * 1000;
    this.blinkFatigueThreshold = options.blinkFatigueThreshold || 30;
    this.yawnFatigueThreshold = options.yawnFatigueThreshold || 2;
    this.cooldownMs = options.cooldownMs || 5 * 60 * 1000;

    this.blinkEvents = [];
    this.yawnEvents = [];
    this.lastAlertTs = 0;
  }

  recordSignal(signal = {}) {
    const ts = Number(signal.ts) || Date.now();

    if (signal.blinkDetected) {
      this.blinkEvents.push(ts);
    }

    if (signal.yawnDetected) {
      this.yawnEvents.push(ts);
    }

    this._prune(ts);

    const blinkRate = this.blinkEvents.length;
    const yawnCount = this.yawnEvents.length;
    const fatigueDetected = blinkRate >= this.blinkFatigueThreshold || yawnCount >= this.yawnFatigueThreshold;

    if (!fatigueDetected) {
      return {
        fatigueDetected: false,
        blinkRate,
        yawnCount,
        severity: 'low'
      };
    }

    if (ts - this.lastAlertTs < this.cooldownMs) {
      return {
        fatigueDetected: false,
        blinkRate,
        yawnCount,
        severity: 'low',
        cooldownActive: true
      };
    }

    this.lastAlertTs = ts;
    return {
      fatigueDetected: true,
      blinkRate,
      yawnCount,
      severity: yawnCount >= this.yawnFatigueThreshold ? 'high' : 'medium',
      suggestion: 'Fatigue detected. Try the 20-20-20 rule: look 20 feet away for 20 seconds.'
    };
  }

  _prune(now) {
    const blinkThreshold = now - this.blinkWindowMs;
    while (this.blinkEvents.length && this.blinkEvents[0] < blinkThreshold) {
      this.blinkEvents.shift();
    }

    const yawnThreshold = now - this.yawnWindowMs;
    while (this.yawnEvents.length && this.yawnEvents[0] < yawnThreshold) {
      this.yawnEvents.shift();
    }
  }
}

module.exports = { FatigueDetector };