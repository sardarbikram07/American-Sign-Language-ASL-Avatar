print("server.py: Importing OS and core libs")
import os
import cv2
import json
import logging
print("server.py: Importing dotenv")
from dotenv import load_dotenv
print("server.py: Importing flask")
from flask import Flask, Response, request, jsonify
from flask_socketio import SocketIO, emit

print("server.py: Checking database libs")
try:
    import psycopg2
    from pgvector.psycopg2 import register_vector
    PSYCOPG2_AVAILABLE = True
except ImportError:
    PSYCOPG2_AVAILABLE = False
    print("psycopg2/pgvector not installed - database features disabled")

try:
    from sentence_transformers import SentenceTransformer
    SENTENCE_TRANSFORMER_AVAILABLE = True
except ImportError:
    SENTENCE_TRANSFORMER_AVAILABLE = False
    print("sentence-transformers not installed - database features disabled")

print("server.py: Importing custom utils")
print("server.py: Importing LLM")
from utils.llm import LLM
print("server.py: Importing Store")
from utils.store import Store
print("server.py: Importing Recognition")
from utils.recognition import Recognition
print("server.py: Finished custom imports")

# Configuration
load_dotenv()
log = logging.getLogger("werkzeug")
log.setLevel(logging.ERROR)

# Initialization
print("Initializing LLM...")
llm = LLM()
app = Flask(__name__)
print("Initializing Recognition...")
recognition = Recognition()
current_camera_index = 0
print("Connecting to WebCam at index 0 (laptop camera)...")
camera = cv2.VideoCapture(0)  # 0 = laptop/built-in webcam
print("Configuring WebCam...")
camera.set(cv2.CAP_PROP_FRAME_WIDTH, 1280)
camera.set(cv2.CAP_PROP_FRAME_HEIGHT, 720)
print("Initializing SocketIO...")
socketio = SocketIO(app, cors_allowed_origins="*")
# Database setup (commented out if not available)
DB_AVAILABLE = False
if PSYCOPG2_AVAILABLE and SENTENCE_TRANSFORMER_AVAILABLE:
    try:
        embedding_model = SentenceTransformer("all-MiniLM-L6-v2")
        conn = psycopg2.connect(
            database="signs",
            host="localhost",
            user="postgres",
            password=os.getenv("POSTGRES_PASSWORD"),
            port=5432,
        )
        register_vector(conn)
        DB_AVAILABLE = True
    except Exception as e:
        print(f"Database not available: {e}")
        embedding_model = None
        conn = None
else:
    print("Database features disabled (missing psycopg2 or sentence-transformers)")
    embedding_model = None
    conn = None

# Store Fingerspelling Animations
alphabet_frames = {}
for letter in "ABCDEFGHIJKLMNOPQRSTUVWXYZ":
    file_path = os.path.join("alphabets", f"{letter}.json")
    with open(file_path, "r") as file:
        alphabet_frames[letter] = json.load(file)


# Stream video feed for iframe
@app.route("/")
def stream():
    return Response(recognize(), mimetype="multipart/x-mixed-replace; boundary=frame")


@app.route("/set-camera", methods=["POST"])
def set_camera():
    """Switch the active camera by index (0 = device/built-in, 1 = external USB)"""
    global camera, current_camera_index
    data = request.get_json()
    index = int(data.get("index", 0))
    if index == current_camera_index:
        return jsonify({"status": "ok", "camera": current_camera_index})
    # Release existing camera and open new one
    camera.release()
    camera = cv2.VideoCapture(index)
    if not camera.isOpened():
        # Fall back to previous camera on failure
        camera = cv2.VideoCapture(current_camera_index)
        return jsonify({"status": "error", "message": f"Could not open camera at index {index}"}), 400
    camera.set(cv2.CAP_PROP_FRAME_WIDTH, 1280)
    camera.set(cv2.CAP_PROP_FRAME_HEIGHT, 720)
    current_camera_index = index
    print(f"Switched to camera index {index}")
    return jsonify({"status": "ok", "camera": current_camera_index})


def recognize():
    """Recognizes ASL fingerpselling within video stream"""

    while camera.isOpened():
        success, image = camera.read()
        if not success:
            continue

        # image = cv2.flip(image, 1)
        image, updated, points = recognition.process(image)

        # image = cv2.resize(image, (image.shape[1] // 2, image.shape[0] // 2))

        _, buffer = cv2.imencode(".jpg", image)
        frame = buffer.tobytes()

        if updated:
            socketio.emit("R-TRANSCRIPTION", Store.parsed)

        yield (b"--frame\r\n" b"Content-Type: image/jpeg\r\n\r\n" + frame + b"\r\n")


@socketio.on("connect")
def on_connect():
    """Triggered when client-server SocketIO connection is established"""

    print("Connected to client")
    emit("R-TRANSCRIPTION", Store.parsed)

    # Send hello sign
    # cursor = conn.cursor()
    # animations = []
    # embedding = embedding_model.encode("hello")
    # cursor.execute(
    #     "SELECT word, points, (embedding <=> %s) AS cosine_similarity FROM signs ORDER BY cosine_similarity ASC LIMIT 1",
    #     (embedding,),
    # )
    # result = cursor.fetchone()
    # if result and 1 - result[2] > 0.70:
    #     animations.append(("hello", result[1]))

    # emit("E-ANIMATION", animations)

    # cursor.close()


@socketio.on("R-CLEAR-TRANSCRIPTION")
def on_clear_transcription():
    """Triggered when client requests to clear the receptive transcription"""

    Store.reset()
    emit("R-TRANSCRIPTION", Store.parsed)
    log.log(logging.INFO, "STORE RESET")


@socketio.on("E-REQUEST-ANIMATION")
def on_request_animation(words: str):
    """Triggered when client requests an expressive animation for a word or sentence"""

    animations = []
    words = words.strip()

    if not words:
        return

    # Gloss the words
    words = llm.gloss(words)
    # words = words.split()

    # If database is not available, just fingerspell everything
    if not DB_AVAILABLE:
        for word in words:
            word = word.strip()
            if not word:
                continue
            animation = []
            for letter in word:
                animation.extend(alphabet_frames.get(letter.upper(), []))
            for i in range(len(animation)):
                animation[i][0] = i
            animations.append((f"fs-{word.upper()}", animation))
    else:
        cursor = conn.cursor()
        for word in words:
            word = word.strip()
            if not word:
                continue

            embedding = embedding_model.encode(word)
            cursor.execute(
                "SELECT word, points, (embedding <=> %s) AS cosine_similarity FROM signs ORDER BY cosine_similarity ASC LIMIT 1",
                (embedding,),
            )
            result = cursor.fetchone()

            # Add sign to animation
            if result and 1 - result[2] > 0.70:
                animations.append((word, result[1]))
            else:  # Add fingerspell to animation
                animation = []
                for letter in word:
                    animation.extend(alphabet_frames.get(letter.upper(), []))

                for i in range(len(animation)):
                    animation[i][0] = i
                animations.append((f"fs-{word.upper()}", animation))

            if "." in word:
                space = []
                last_frame = animations[-1][1][-1]
                for i in range(50):
                    space.append(last_frame)
                    space[-1][0] = i
                animations.append(("", space))

        cursor.close()

    emit("E-ANIMATION", animations)


@socketio.on("disconnect")
def on_disconnect():
    log.log(logging.INFO, "Disconnected from client")


if __name__ == "__main__":
    socketio.run(app, debug=False, port=1234, allow_unsafe_werkzeug=True)
