"use client";

import { useState, useEffect } from "react";
import io from "socket.io-client";

import Camera from "./Camera";

const socket = io("ws://localhost:1234");

export default function Receptive() {
  const [ASLTranscription, setASLTranscription] = useState("");

  useEffect(() => {
    socket.on("connect", () => {
      console.log("Connected to server");
    });

    socket.on("R-TRANSCRIPTION", (data) => {
      setASLTranscription(data);
    });
  }, []);

  const speak = () => {
    if (ASLTranscription) {
      const utterance = new SpeechSynthesisUtterance(ASLTranscription);
      window.speechSynthesis.speak(utterance);
    }
  };

  return (
    <div className="flex h-full flex-col">
      <div className="flex flex-1">
        <div className="flex-1">
          <Camera />
        </div>
        <div className="flex-1 flex flex-col bg-white bg-opacity-10 p-4">
          <div className="flex-1">
            <p className="text-4xl text-white">{ASLTranscription}</p>
          </div>
          <button
            onClick={speak}
            className="mt-4 px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-700"
          >
            Speak
          </button>
        </div>
      </div>
    </div>
  );
}
