class GamificationEngine {
  constructor({ initialCoins = 100 } = {}) {
    this.coins = initialCoins;
    this.lockedStake = 0;
  }

  rewardFocus(seconds) {
    if (seconds < 60) return { coinsDelta: 0, balance: this.coins };
    const reward = Math.floor(seconds / 60);
    this.coins += reward;
    return { coinsDelta: reward, balance: this.coins };
  }

  applyDistractionPenalty(amount = 5) {
    const penalty = Math.max(0, Math.floor(amount));
    this.coins = Math.max(0, this.coins - penalty);
    return { coinsDelta: -penalty, balance: this.coins };
  }

  lockStake(amount) {
    const stake = Math.max(0, Math.floor(amount));
    if (stake > this.coins) return { ok: false, message: 'insufficient-coins' };
    this.coins -= stake;
    this.lockedStake += stake;
    return { ok: true, balance: this.coins, lockedStake: this.lockedStake };
  }

  settleStake(success) {
    if (!this.lockedStake) return { coinsDelta: 0, balance: this.coins };

    if (success) {
      const released = this.lockedStake;
      this.coins += released;
      this.lockedStake = 0;
      return { coinsDelta: released, balance: this.coins, result: 'released' };
    }

    const burned = this.lockedStake;
    this.lockedStake = 0;
    return { coinsDelta: 0, balance: this.coins, burned, result: 'burned' };
  }

  getPetMood({ focused, fatigued }) {
    if (fatigued) return 'sleepy';
    return focused ? 'happy' : 'sad';
  }
}

module.exports = { GamificationEngine };