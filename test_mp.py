import sys
print(f"Python: {sys.version}")

# Test protobuf
try:
    import google.protobuf
    print(f"Protobuf: {google.protobuf.__version__}")
except Exception as e:
    print(f"Protobuf import error: {e}")

# Test tensorflow  
try:
    import tensorflow as tf
    print(f"TensorFlow: {tf.__version__}")
except Exception as e:
    print(f"TensorFlow import error: {e}")

# Test mediapipe
try:
    import mediapipe as mp
    print(f"MediaPipe OK, has solutions: {hasattr(mp, 'solutions')}")
except Exception as e:
    print(f"MediaPipe import error: {e}")
    import traceback
    traceback.print_exc()
