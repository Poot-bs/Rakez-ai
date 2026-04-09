# CV Integration Guide

## Runtime
- Face tracking: MediaPipe Face Mesh in renderer
- Model inference: ONNX Runtime Web in worker
- Decision logic: EMA smoothing + debounce + cooldown

## Files
- ai/distractionDetector.js
- ai/cvWorker.js
- electron/ui/index.js
- electron/ui/index.html
- electron/ui/styles.css
- electron/main.js

## Model Setup
1. Clone upstream model source.
2. Run conversion script in tools/convert_model_to_onnx.py.
3. Place generated model at assets/models/distraction_model.onnx.

### Exact Source Used
- Source repository folder: third_party/distraction_detection
- Source weight file: third_party/distraction_detection/src/cnn/distraction_model.hdf5
- Runtime model artifact: assets/models/distraction_model.onnx

The ONNX model is generated from the exact HDF5 weights above. The runtime decision boundary follows the original project semantics: eye classifier probability around 0.5 separates focused and distracted.

## Event Flow
1. Renderer reads webcam frames.
2. Landmark-based score is calculated each frame.
3. Eye crops are sent to worker every N frames for model scoring.
4. Scores are merged and smoothed.
5. Low-attention streak emits cv-distraction-event.
6. Main process applies coin penalty and updates log.

## Tuning Knobs
- DETECTION_INTERVAL in ai/distractionDetector.js controls frame skipping.
- DISTRACT_THRESHOLD controls sensitivity.
- DISTRACT_FRAMES_TO_TRIGGER controls debounce.
- PENALTY_COOLDOWN_MS avoids repeated penalties.

## Notes
- If ONNX model is missing, app continues with heuristic-only scoring.
- Keep camera at 640x480 for low CPU usage.
