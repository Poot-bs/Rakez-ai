Place distraction_model.onnx in this folder.

Expected shape:
- Input tensor name: input
- Input shape: [1, 64, 64, 3]
- Output: single sigmoid probability where higher means focused

Conversion helper:
- tools/convert_model_to_onnx.py
