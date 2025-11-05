import os
import cv2
import json
import logging
import psycopg2
from dotenv import load_dotenv
from flask import Flask, Response
from flask_socketio import SocketIO, emit
from pgvector.psycopg2 import register_vector
from sentence_transformers import SentenceTransformer

# Force CPU usage for TensorFlow (optimization for no GPU)
os.environ['CUDA_VISIBLE_DEVICES'] = '-1'
os.environ['TF_CPP_MIN_LOG_LEVEL'] = '2'  # Reduce TensorFlow logging

from utils.llm import LLM
from utils.store import Store
from utils.recognition import Recognition

# Configuration
load_dotenv()
log = logging.getLogger("werkzeug")
log.setLevel(logging.ERROR)

# Initialization
llm = LLM()
app = Flask(__name__)
recognition = Recognition()
camera = cv2.VideoCapture(0)
camera.set(cv2.CAP_PROP_FRAME_WIDTH, 1280)
camera.set(cv2.CAP_PROP_FRAME_HEIGHT, 720)
socketio = SocketIO(app, cors_allowed_origins="*")
# Database setup (commented out if not available)
DB_AVAILABLE = False
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
    socketio.run(app, debug=False, port=1234)
