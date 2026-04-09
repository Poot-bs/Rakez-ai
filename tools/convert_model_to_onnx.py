import tensorflow as tf
import tf2onnx
import tempfile
import os
import subprocess
import sys

# Update this path if you clone the upstream repository elsewhere.
SOURCE_MODEL = "third_party/distraction_detection/src/cnn/distraction_model.hdf5"
TARGET_MODEL = "assets/models/distraction_model.onnx"


def build_legacy_cnn():
    model = tf.keras.Sequential([
        tf.keras.layers.Input(shape=(64, 64, 3), name='input'),
        tf.keras.layers.Conv2D(32, (3, 3), activation='relu'),
        tf.keras.layers.MaxPooling2D(pool_size=(2, 2)),
        tf.keras.layers.Conv2D(32, (3, 3), activation='relu'),
        tf.keras.layers.MaxPooling2D(pool_size=(2, 2)),
        tf.keras.layers.Conv2D(64, (3, 3), activation='relu'),
        tf.keras.layers.MaxPooling2D(pool_size=(2, 2)),
        tf.keras.layers.Flatten(),
        tf.keras.layers.Dense(64, activation='relu'),
        tf.keras.layers.Dropout(0.5),
        tf.keras.layers.Dense(1, activation='sigmoid')
    ])
    return model


def main():
    model = build_legacy_cnn()
    model.load_weights(SOURCE_MODEL, by_name=False, skip_mismatch=False)

    with tempfile.TemporaryDirectory() as tmp_dir:
        saved_model_dir = os.path.join(tmp_dir, 'saved_model')
        model.export(saved_model_dir)

        subprocess.run([
            sys.executable,
            '-m',
            'tf2onnx.convert',
            '--saved-model',
            saved_model_dir,
            '--opset',
            '17',
            '--output',
            TARGET_MODEL,
        ], check=True)

    print(f"Exported ONNX model to: {TARGET_MODEL}")


if __name__ == "__main__":
    main()
