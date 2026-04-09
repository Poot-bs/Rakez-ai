# End-to-End QA Checklist (Beta)

## Startup and Security
1. Run `npm start` and verify app launches without console crashes.
2. Confirm `nodeIntegration` is disabled and preload bridge is active.
3. Verify ONNX model path check logs no missing-model warning.

## Camera CV Pipeline
1. Start focus session and confirm camera feed + eye boxes render.
2. Run calibration for 12 seconds while looking at screen.
3. Confirm calibration status switches to ready and persists after restart.
4. Look away for 3-5 seconds and verify distraction trigger.
5. Briefly blink/look down and verify no immediate false penalty.

## Coin Economy
1. Keep focus mode ON for 60 seconds and verify +1 coin reward.
2. Click Buy Shield button and verify coins are deducted.
3. During active shield, trigger distraction and verify penalty is skipped.
4. Wait shield countdown and verify it reaches 00:00.

## Extension Integration
1. Enable extension in Chrome.
2. With focus mode OFF, visit blocked site and verify no block.
3. With focus mode ON, visit blocked site and verify block + desktop log.

## Logs and Stats
1. Verify distraction log entries appear for CV, extension, reward, and shop events.
2. Verify coins/distractions/focus-time update in real time.

## Validation Suite
1. Run `npm run validate:mvp`.
2. Run `npm run validate:false-positives`.
3. Verify both pass before tagging beta.
