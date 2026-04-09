const videoElement = document.getElementById('webcam');
const canvasElement = document.getElementById('canvas_output');
const canvasCtx = canvasElement.getContext('2d');
const eyeCanvas = document.createElement('canvas');
const eyeCtx = eyeCanvas.getContext('2d', { willReadFrequently: true });
eyeCanvas.width = 64;
eyeCanvas.height = 64;

let camera;
let frameCounter = 0;
let attentionEMA = 1;
let distractionStreak = 0;
let lastPenaltyTs = 0;
let workerBusy = false;
let modelReady = false;
let modelScore = 1;

const CONFIG = {
  inferEveryNFrames: 3,
  emaAlpha: 0.22,
  minDistractionFrames: 20,
  penaltyCooldownMs: 7000,
  noFaceGraceMs: 1800,
  recoverStep: 2,
  cameraWidth: 960,
  cameraHeight: 720
};

const thresholds = {
  low: 0.48,
  high: 0.55,
  earFloor: 0.2,
  poseFloor: 0.5,
  modelFloor: 0.5
};

const calibration = {
  active: false,
  calibrated: false,
  startTs: 0,
  durationMs: 12000,
  samples: []
};

let noFaceDurationMs = 0;
let lastFrameTs = Date.now();
let distractedState = false;

let cvWorker = null;

async function initWorker() {
  try {
    let modelPath = '../assets/models/distraction_model.onnx';
    let runtimeModelAvailable = true;

    if (window.focusGuardian?.invoke) {
      const runtimeConfig = await window.focusGuardian.invoke('get-runtime-config');
      if (runtimeConfig) {
        runtimeModelAvailable = !!runtimeConfig.modelAvailable;
      }
    }

    if (!runtimeModelAvailable) {
      console.warn('Strict model-path check failed: ONNX model missing.');
      return;
    }

    cvWorker = new Worker('../../ai/cvWorker.js');
    cvWorker.postMessage({
      type: 'init',
      modelPath
    });

    cvWorker.onmessage = (event) => {
      const { type, score } = event.data || {};

      if (type === 'ready') {
        modelReady = true;
      }

      if (type === 'result') {
        modelScore = Number.isFinite(score) ? score : modelScore;
        workerBusy = false;
      }

      if (type === 'error') {
        console.warn('CV worker error:', event.data.message);
        workerBusy = false;
      }
    };
  } catch (error) {
    console.warn('Could not initialize CV worker:', error.message);
  }
}

initWorker();

const faceMesh = new FaceMesh({locateFile: (file) => {
  return `https://cdn.jsdelivr.net/npm/@mediapipe/face_mesh/${file}`;
}});

faceMesh.setOptions({
  maxNumFaces: 1,
  refineLandmarks: true,
  minDetectionConfidence: 0.5,
  minTrackingConfidence: 0.5
});

faceMesh.onResults(onResults);

window.startCvCalibration = (durationMs = 12000) => {
  calibration.active = true;
  calibration.calibrated = false;
  calibration.startTs = Date.now();
  calibration.durationMs = Math.max(5000, durationMs);
  calibration.samples = [];
};

function distance2D(a, b) {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

function eyeAspectRatio(landmarks, idx) {
  const p1 = landmarks[idx[0]];
  const p2 = landmarks[idx[1]];
  const p3 = landmarks[idx[2]];
  const p4 = landmarks[idx[3]];
  const p5 = landmarks[idx[4]];
  const p6 = landmarks[idx[5]];

  const vertical = distance2D(p2, p6) + distance2D(p3, p5);
  const horizontal = distance2D(p1, p4);

  if (horizontal === 0) return 0;
  return vertical / (2 * horizontal);
}

function clamp01(value) {
  return Math.max(0, Math.min(1, value));
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function estimatePoseScore(landmarks) {
  const nose = landmarks[1];
  const leftEye = landmarks[33];
  const rightEye = landmarks[263];
  const topFace = landmarks[10];
  const bottomFace = landmarks[152];

  const eyeDistance = Math.abs(rightEye.x - leftEye.x) || 1e-6;
  const faceHeight = Math.abs(bottomFace.y - topFace.y) || 1e-6;

  const noseRatioX = (nose.x - Math.min(leftEye.x, rightEye.x)) / eyeDistance;
  const noseRatioY = (nose.y - topFace.y) / faceHeight;

  const yawPenalty = Math.min(1, Math.abs(0.5 - noseRatioX) * 2.2);
  const pitchPenalty = Math.min(1, Math.abs(0.56 - noseRatioY) * 2.0);

  return clamp01(1 - ((yawPenalty + pitchPenalty) / 2));
}

function drawEyeBox(landmarks, indexes, color) {
  let minX = 1;
  let minY = 1;
  let maxX = 0;
  let maxY = 0;

  indexes.forEach((index) => {
    const point = landmarks[index];
    minX = Math.min(minX, point.x);
    minY = Math.min(minY, point.y);
    maxX = Math.max(maxX, point.x);
    maxY = Math.max(maxY, point.y);
  });

  const x = minX * canvasElement.width;
  const y = minY * canvasElement.height;
  const w = (maxX - minX) * canvasElement.width;
  const h = (maxY - minY) * canvasElement.height;

  canvasCtx.strokeStyle = color;
  canvasCtx.lineWidth = 2;
  canvasCtx.strokeRect(x, y, w, h);
}

function finalizeCalibration() {
  calibration.active = false;

  if (calibration.samples.length < 60) {
    calibration.calibrated = false;
    return;
  }

  const avg = (arr, key) => arr.reduce((sum, item) => sum + item[key], 0) / arr.length;

  const baselineScore = avg(calibration.samples, 'rawScore');
  const baselineEar = avg(calibration.samples, 'ear');
  const baselinePose = avg(calibration.samples, 'pose');
  const baselineModel = avg(calibration.samples, 'model');

  // Keep close to the original repo's binary model decision around 0.5,
  // while adding a small hysteresis band to reduce oscillation.
  thresholds.low = clamp(baselineModel - 0.08, 0.42, 0.52);
  thresholds.high = clamp(thresholds.low + 0.06, 0.48, 0.62);
  thresholds.earFloor = clamp(baselineEar * 0.72, 0.12, 0.4);
  thresholds.poseFloor = clamp(baselinePose * 0.75, 0.45, 0.85);
  thresholds.modelFloor = 0.5;

  calibration.calibrated = true;
}

window.applyCvCalibration = (profile) => {
  if (!profile || typeof profile !== 'object') return;

  thresholds.low = clamp(Number(profile.low) || thresholds.low, 0.35, 0.8);
  thresholds.high = clamp(Number(profile.high) || thresholds.high, thresholds.low + 0.02, 0.95);
  thresholds.earFloor = clamp(Number(profile.earFloor) || thresholds.earFloor, 0.1, 0.5);
  thresholds.poseFloor = clamp(Number(profile.poseFloor) || thresholds.poseFloor, 0.2, 0.95);
  thresholds.modelFloor = clamp(Number(profile.modelFloor) || thresholds.modelFloor, 0.35, 0.9);

  calibration.calibrated = true;
};

function getEyePatch(video, landmarks, indexes) {
  if (!video.videoWidth || !video.videoHeight) {
    return null;
  }

  let minX = 1;
  let minY = 1;
  let maxX = 0;
  let maxY = 0;

  indexes.forEach((index) => {
    const point = landmarks[index];
    minX = Math.min(minX, point.x);
    minY = Math.min(minY, point.y);
    maxX = Math.max(maxX, point.x);
    maxY = Math.max(maxY, point.y);
  });

  const pad = 0.3;
  const boxW = maxX - minX;
  const boxH = maxY - minY;

  const sx = Math.max(0, Math.floor((minX - boxW * pad) * video.videoWidth));
  const sy = Math.max(0, Math.floor((minY - boxH * pad) * video.videoHeight));
  const sw = Math.max(1, Math.floor((boxW + boxW * pad * 2) * video.videoWidth));
  const sh = Math.max(1, Math.floor((boxH + boxH * pad * 2) * video.videoHeight));

  eyeCtx.clearRect(0, 0, 64, 64);
  eyeCtx.drawImage(video, sx, sy, sw, sh, 0, 0, 64, 64);
  const rgba = eyeCtx.getImageData(0, 0, 64, 64).data;
  const rgb = new Uint8Array(64 * 64 * 3);

  for (let i = 0, j = 0; i < rgba.length; i += 4, j += 3) {
    rgb[j] = rgba[i];
    rgb[j + 1] = rgba[i + 1];
    rgb[j + 2] = rgba[i + 2];
  }

  return rgb;
}

function postToModel(landmarks) {
  if (!cvWorker || workerBusy || !modelReady) return;

  const leftIndexes = [33, 133, 159, 145, 153, 154, 155, 173];
  const rightIndexes = [263, 362, 386, 374, 380, 381, 382, 398];

  try {
    const leftEye = getEyePatch(videoElement, landmarks, leftIndexes);
    const rightEye = getEyePatch(videoElement, landmarks, rightIndexes);

    if (!leftEye || !rightEye) {
      return;
    }

    workerBusy = true;
    cvWorker.postMessage(
      {
        type: 'infer',
        leftEye,
        rightEye
      },
      [leftEye.buffer, rightEye.buffer]
    );
  } catch (error) {
    workerBusy = false;
  }
}

function publishCvMetrics(score, reason, shouldPenalty) {
  if (typeof window.onCvMetrics === 'function') {
    window.onCvMetrics({
      score,
      reason,
      isDistracted: distractedState,
      shouldPenalty,
      calibration: {
        active: calibration.active,
        calibrated: calibration.calibrated,
        profile: calibration.calibrated
          ? {
            low: thresholds.low,
            high: thresholds.high,
            earFloor: thresholds.earFloor,
            poseFloor: thresholds.poseFloor,
            modelFloor: thresholds.modelFloor
          }
          : null,
        progress: calibration.active
          ? clamp01((Date.now() - calibration.startTs) / calibration.durationMs)
          : (calibration.calibrated ? 1 : 0),
        threshold: thresholds.low
      }
    });
  }
}

function onResults(results) {
  const nowTs = Date.now();
  const deltaMs = nowTs - lastFrameTs;
  lastFrameTs = nowTs;

  canvasCtx.save();
  canvasCtx.clearRect(0, 0, canvasElement.width, canvasElement.height);

  const hasLandmarks = results.multiFaceLandmarks && results.multiFaceLandmarks.length > 0;
  let rawScore = attentionEMA;
  let reason = 'No face detected';
  let avgEAR = 0;
  let poseScore = 0;
  let combinedModelScore = modelReady ? modelScore : 1;

  if (hasLandmarks) {
    const landmarks = results.multiFaceLandmarks[0];
    frameCounter += 1;
    noFaceDurationMs = 0;

    const leftEAR = eyeAspectRatio(landmarks, [33, 160, 158, 133, 153, 144]);
    const rightEAR = eyeAspectRatio(landmarks, [362, 385, 387, 263, 373, 380]);
    avgEAR = (leftEAR + rightEAR) / 2;
    const blinkAwareScore = clamp01((avgEAR - thresholds.earFloor) / 0.16);

    poseScore = estimatePoseScore(landmarks);

    if (frameCounter % CONFIG.inferEveryNFrames === 0) {
      postToModel(landmarks);
    }

    combinedModelScore = modelReady ? modelScore : 1;
    // Match the cloned model's core behavior: eye model probability is primary.
    rawScore = modelReady
      ? combinedModelScore
      : clamp01(blinkAwareScore * 0.55 + poseScore * 0.45);

    drawEyeBox(landmarks, [33, 133, 159, 145, 153, 154, 155, 173], '#0ea5e9');
    drawEyeBox(landmarks, [263, 362, 386, 374, 380, 381, 382, 398], '#22c55e');

    if (calibration.active) {
      calibration.samples.push({
        rawScore,
        ear: avgEAR,
        pose: poseScore,
        model: combinedModelScore
      });

      if (nowTs - calibration.startTs >= calibration.durationMs) {
        finalizeCalibration();
      }
    }

    if (modelReady && combinedModelScore < thresholds.modelFloor) {
      reason = 'Model predicts distraction';
    } else if (poseScore < thresholds.poseFloor) {
      reason = 'Head turned away from screen';
    } else if (avgEAR < thresholds.earFloor) {
      reason = 'Eyes not focused on screen';
    } else {
      reason = 'Focused';
    }
  } else {
    noFaceDurationMs += Math.max(0, deltaMs);

    if (noFaceDurationMs < CONFIG.noFaceGraceMs) {
      rawScore = Math.max(0.4, attentionEMA * 0.98);
      reason = 'Face briefly out of frame';
    } else {
      rawScore = 0.05;
      reason = 'No face detected';
    }
  }

  attentionEMA = CONFIG.emaAlpha * rawScore + (1 - CONFIG.emaAlpha) * attentionEMA;

  if (distractedState) {
    if (attentionEMA > thresholds.high) {
      distractedState = false;
    }
  } else if (attentionEMA < thresholds.low) {
    distractedState = true;
  }

  if (distractedState) {
    distractionStreak += 1;
  } else {
    distractionStreak = Math.max(0, distractionStreak - CONFIG.recoverStep);
  }

  let shouldPenalty = false;
  const now = Date.now();
  if (
    distractionStreak >= CONFIG.minDistractionFrames
    && now - lastPenaltyTs > CONFIG.penaltyCooldownMs
    && !calibration.active
  ) {
    shouldPenalty = true;
    distractionStreak = 0;
    lastPenaltyTs = now;
  }

  publishCvMetrics(attentionEMA, reason, shouldPenalty);

  canvasCtx.restore();
}

function startCamera() {
  if (!camera) {
    camera = new Camera(videoElement, {
      onFrame: async () => {
        await faceMesh.send({image: videoElement});
      },
      width: CONFIG.cameraWidth,
      height: CONFIG.cameraHeight
    });

    canvasElement.width = CONFIG.cameraWidth;
    canvasElement.height = CONFIG.cameraHeight;
  }
  camera.start();
}

function stopCamera() {
  if (camera) {
    camera.stop();
  }

  frameCounter = 0;
  attentionEMA = 1;
  distractionStreak = 0;
  noFaceDurationMs = 0;
  distractedState = false;
}