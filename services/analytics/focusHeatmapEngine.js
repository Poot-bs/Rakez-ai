function toHourBucket(ts) {
  return new Date(ts).getHours();
}

class FocusHeatmapEngine {
  constructor() {
    this.hourly = Array.from({ length: 24 }, () => ({
      samples: 0,
      totalScore: 0,
      distractions: 0
    }));
  }

  recordAttention(score, ts = Date.now()) {
    if (typeof score !== 'number' || Number.isNaN(score)) return;

    const bucket = this.hourly[toHourBucket(ts)];
    const clamped = Math.max(0, Math.min(1, score));
    bucket.samples += 1;
    bucket.totalScore += clamped;
  }

  recordDistraction(ts = Date.now()) {
    this.hourly[toHourBucket(ts)].distractions += 1;
  }

  getHeatmap() {
    return this.hourly.map((slot, hour) => {
      const avg = slot.samples ? slot.totalScore / slot.samples : 0;
      return {
        hour,
        samples: slot.samples,
        avgFocusScore: Number(avg.toFixed(2)),
        distractionCount: slot.distractions
      };
    });
  }
}

module.exports = { FocusHeatmapEngine };