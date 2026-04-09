function runSimulation({ low, high, alpha, distractFrames, recoverStep, iterations, distractBursts }) {
  let ema = 0.8;
  let distracted = false;
  let streak = 0;
  let penalties = 0;

  for (let i = 0; i < iterations; i += 1) {
    const noisyFocus = 0.78 + (Math.sin(i / 7) * 0.05) + ((Math.random() - 0.5) * 0.1);

    let score = noisyFocus;
    if (distractBursts.some(([start, end]) => i >= start && i <= end)) {
      score = 0.32 + ((Math.random() - 0.5) * 0.08);
    }

    ema = alpha * score + (1 - alpha) * ema;

    if (distracted) {
      if (ema > high) distracted = false;
    } else if (ema < low) {
      distracted = true;
    }

    if (distracted) {
      streak += 1;
    } else {
      streak = Math.max(0, streak - recoverStep);
    }

    if (streak >= distractFrames) {
      penalties += 1;
      streak = 0;
    }
  }

  return penalties;
}

const penalties = runSimulation({
  low: 0.48,
  high: 0.55,
  alpha: 0.22,
  distractFrames: 20,
  recoverStep: 2,
  iterations: 1200,
  distractBursts: [
    [220, 260],
    [720, 760]
  ]
});

if (penalties < 2 || penalties > 4) {
  console.error('False-positive validation failed. Unexpected penalty count:', penalties);
  process.exit(1);
}

console.log('False-positive validation passed. Penalties:', penalties);
