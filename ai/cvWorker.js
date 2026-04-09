/* global ort */

let modelSession = null;

self.onmessage = async (event) => {
  const payload = event.data || {};

  if (payload.type === 'init') {
    try {
      if (!self.ort) {
        importScripts('../node_modules/onnxruntime-web/dist/ort.min.js');
      }

      ort.env.wasm.simd = true;
      ort.env.wasm.numThreads = Math.min(4, self.navigator?.hardwareConcurrency || 2);

      modelSession = await ort.InferenceSession.create(payload.modelPath, {
        executionProviders: ['wasm']
      });

      self.postMessage({ type: 'ready' });
    } catch (error) {
      self.postMessage({
        type: 'error',
        message: `Failed to load ONNX model: ${error.message}`
      });
    }

    return;
  }

  if (payload.type !== 'infer') {
    return;
  }

  if (!modelSession) {
    self.postMessage({ type: 'result', score: 0.5 });
    return;
  }

  try {
    const leftTensor = toTensor(payload.leftEye);
    const rightTensor = toTensor(payload.rightEye);

    const leftScore = await inferFocusedProbability(leftTensor);
    const rightScore = await inferFocusedProbability(rightTensor);

    self.postMessage({
      type: 'result',
      score: (leftScore + rightScore) / 2
    });
  } catch (error) {
    self.postMessage({
      type: 'error',
      message: `Inference failed: ${error.message}`
    });
    self.postMessage({ type: 'result', score: 0.5 });
  }
};

function toTensor(rgbBytes) {
  const data = new Float32Array(64 * 64 * 3);

  for (let i = 0; i < rgbBytes.length; i += 3) {
    data[i] = rgbBytes[i] / 255;
    data[i + 1] = rgbBytes[i + 1] / 255;
    data[i + 2] = rgbBytes[i + 2] / 255;
  }

  return new ort.Tensor('float32', data, [1, 64, 64, 3]);
}

async function inferFocusedProbability(inputTensor) {
  const feeds = { input: inputTensor };
  const outputs = await modelSession.run(feeds);
  const outputName = Object.keys(outputs)[0];
  const raw = outputs[outputName].data[0];

  return Number.isFinite(raw) ? Math.max(0, Math.min(1, raw)) : 0.5;
}
