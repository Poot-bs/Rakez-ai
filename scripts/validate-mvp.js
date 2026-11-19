const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

function exists(relPath) {
  return fs.existsSync(path.join(root, relPath));
}

function fileContains(relPath, text) {
  const fullPath = path.join(root, relPath);
  return fs.readFileSync(fullPath, 'utf8').includes(text);
}

try {
  assert(exists('assets/models/distraction_model.onnx'), 'Missing ONNX model: assets/models/distraction_model.onnx');
  assert(exists('third_party/distraction_detection/src/cnn/distraction_model.hdf5'), 'Missing source HDF5 model in third_party/distraction_detection');

  assert(fileContains('electron/main.js', 'contextIsolation: true'), 'Electron security setting contextIsolation: true not found');
  assert(fileContains('electron/main.js', 'nodeIntegration: false'), 'Electron security setting nodeIntegration: false not found');
  assert(fileContains('electron/main.js', 'sandbox: true'), 'Electron security setting sandbox: true not found');

  assert(fileContains('electron/preload.js', 'contextBridge.exposeInMainWorld'), 'Secure preload bridge not found');
  assert(fileContains('ai/distractionDetector.js', 'window.applyCvCalibration'), 'Calibration persistence hook not found');

  console.log('MVP validation passed.');
  process.exit(0);
} catch (error) {
  console.error('MVP validation failed:', error.message);
  process.exit(1);
}
