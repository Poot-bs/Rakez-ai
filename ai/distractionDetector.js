const videoElement = document.getElementById('webcam');
const canvasElement = document.getElementById('canvas_output');
const canvasCtx = canvasElement.getContext('2d');

let camera;
let noFaceFrames = 0;

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

function isLookingAway(landmarks) {
  // Simple heuristic: compare nose x position relative to eyes
  const nose = landmarks[1];
  const leftEye = landmarks[33];
  const rightEye = landmarks[263];

  const eyeDistance = Math.abs(rightEye.x - leftEye.x);
  
  if (eyeDistance === 0) return true;

  // Nose should be between the eyes, with x ratio around 0.5
  // Left eye is on the right side of the screen image (mirrored), but let's just use raw x coords
  const noseRatio = (nose.x - Math.min(leftEye.x, rightEye.x)) / eyeDistance;

  // A ratio outside 0.2 to 0.8 indicates turning head significantly
  if (noseRatio < 0.2 || noseRatio > 0.8) {
    console.log("Looking away horizontally (noseRatio:", noseRatio.toFixed(2), ")");
    return true; // looking away horizontally
  }

  // Vertical check - nose to chin vs nose to forehead
  const topFace = landmarks[10];
  const bottomFace = landmarks[152];
  const faceHeight = Math.abs(bottomFace.y - topFace.y);

  if (faceHeight === 0) return true;

  const verticalRatio = (nose.y - topFace.y) / faceHeight;

  // Normally nose is roughly in the middle (~0.5 - 0.6)
  if (verticalRatio < 0.3 || verticalRatio > 0.85) {
    console.log("Looking away vertically (verticalRatio:", verticalRatio.toFixed(2), ")");
    return true; // looking up or down
  }

  return false;
}

function onResults(results) {
  canvasCtx.save();
  canvasCtx.clearRect(0, 0, canvasElement.width, canvasElement.height);
  
  if (results.multiFaceLandmarks && results.multiFaceLandmarks.length > 0) {
    const landmarks = results.multiFaceLandmarks[0];
    const away = isLookingAway(landmarks);

    // Also check if face is completely missing
    if (away) {
      noFaceFrames++;
    } else {
      noFaceFrames = 0;
    }
  } else {
    noFaceFrames++;
  }
  
  // If no face or looking away for ~3 seconds (approx 90 frames at 30fps)
  if (noFaceFrames > 90) {
    if (typeof window.triggerAlert === 'function') {
      window.triggerAlert("Look at the screen!");
    } else if (typeof triggerAlert === 'function') {
      triggerAlert("Look at the screen!");
    }
    noFaceFrames = 0; // Reset after alert
  }

  canvasCtx.restore();
}

function startCamera() {
  if (!camera) {
    camera = new Camera(videoElement, {
      onFrame: async () => {
        await faceMesh.send({image: videoElement});
      },
      width: 640,
      height: 480
    });
  }
  camera.start();
}

function stopCamera() {
  if (camera) {
    camera.stop();
  }
}