# Beta Release v0.1.0

## Release Tags
- `mvp-baseline`
- `beta-v0.1.0`

## Included
1. Secure Electron renderer isolation (`contextIsolation: true`, `nodeIntegration: false`, `sandbox: true`).
2. Preload IPC bridge allowlist.
3. Exact `distraction_detection` source model integration (HDF5 -> ONNX conversion path).
4. Calibration persistence in local store.
5. Coin economy updates:
   - +1 coin every 60s while focus mode is active.
   - -5 coins on distraction penalties.
   - Buy 10-minute shield for 20 coins.
6. Validation suite scripts:
   - `npm run validate:mvp`
   - `npm run validate:false-positives`

## QA Status
- Automated checks passed:
  - MVP validation script
  - False-positive simulation script
  - Electron startup smoke test
- Manual checklist reference:
  - `docs/QA_CHECKLIST.md`

## Notes
- If packaging for production, verify `assets/models/distraction_model.onnx` is bundled.
- Calibration profile is loaded on startup and refreshed when recalibrated.
