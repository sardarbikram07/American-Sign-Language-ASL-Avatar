"use client";

import React from "react";
import io from "socket.io-client";
import { useEffect, useRef, useState } from "react";

import Camera from "./components/Camera";
import Checkbox from "@/ui/components/Checkbox";
import Transcription from "./components/Transcription";
import Visualization from "./components/Visualization";

// Type declarations for Speech Recognition API
declare global {
  interface Window {
    SpeechRecognition: any;
    webkitSpeechRecognition: any;
  }
}

const socket = io("ws://localhost:1234");

export default function Home() {
  const wordAnimationsToPlay = useRef<any>([]);
  const [currentWord, setCurrentWord] = useState<string>("");
  const [ASLTranscription, setASLTranscription] = useState("");
  const lastSigned = useRef<string>("");
  const [spokenText, setSpokenText] = useState<string>("");
  const [isListening, setIsListening] = useState<boolean>(false);

  useEffect(() => {
    socket.on("connect", () => {
      console.log("Connected to server");
    });

    socket.on("R-TRANSCRIPTION", (data) => {
      setASLTranscription(data);
      // Spontaneous signing when transcription has a complete word
      if (data && data.includes(" ") && data !== lastSigned.current) {
        socket.emit("E-REQUEST-ANIMATION", data);
        lastSigned.current = data;
      }
    });

    socket.on("E-ANIMATION", (animations) => {
      wordAnimationsToPlay.current = [
        ...wordAnimationsToPlay.current,
        ...animations,
      ];
    });
  }, []);

  function getNextWord(): string | null {
    if (!wordAnimationsToPlay.current.length) {
      return null;
    }

    let animation = wordAnimationsToPlay.current.shift();
    setCurrentWord(animation[0]);

    return animation[1];
  }

  function clear() {
    socket.emit("R-CLEAR-TRANSCRIPTION");
  }

  function signTranscription() {
    if (ASLTranscription) {
      socket.emit("E-REQUEST-ANIMATION", ASLTranscription);
    }
  }

  function signSpokenText() {
    if (spokenText) {
      socket.emit("E-REQUEST-ANIMATION", spokenText);
    }
  }

  function startListening() {
    if (!('webkitSpeechRecognition' in window) && !('SpeechRecognition' in window)) {
      alert('Speech recognition not supported in this browser.');
      return;
    }

    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    const recognition = new SpeechRecognition();

    recognition.continuous = false;
    recognition.interimResults = false;
    recognition.lang = 'en-US';

    recognition.onstart = () => {
      setIsListening(true);
    };

    recognition.onresult = (event: any) => {
      const transcript = event.results[0][0].transcript;
      setSpokenText(transcript);
      // Automatically sign the spoken text
      socket.emit("E-REQUEST-ANIMATION", transcript);
    };

    recognition.onerror = (event: any) => {
      console.error('Speech recognition error:', event.error);
      setIsListening(false);
    };

    recognition.onend = () => {
      setIsListening(false);
    };

    recognition.start();
  }

  return (
    <div className="w-screen h-screen flex flex-col gap-4 p-4 bg-gradient-to-br from-gray-900 via-black to-gray-900">
      <div className="flex flex-row gap-4 flex-1">
        <div className="flex flex-col gap-3 items-center flex-[13]">
          <h1 className="text-2xl text-white font-bold drop-shadow-lg mb-2">ASL Fingerspell → English</h1>
          <div className="border-2 border-white/20 w-full h-full flex flex-col rounded-xl shadow-2xl bg-black/20 backdrop-blur-sm">
            <Camera />
          </div>
        </div>
        <div className="flex flex-col gap-3 items-center flex-[7]">
          <h1 className="text-2xl text-white font-bold drop-shadow-lg mb-2">3D Simulation</h1>
          <div className="border-2 border-white/20 w-full h-full rounded-xl shadow-2xl bg-black/20 backdrop-blur-sm">
            <Visualization
              signingSpeed={50}
              getNextWord={getNextWord}
              currentWord={currentWord}
            />
          </div>
        </div>
      </div>
      <div className="flex flex-row gap-4 flex-1">
        <div className="flex flex-col gap-3 items-center flex-[13]">
          <h1 className="text-2xl text-white font-bold drop-shadow-lg mb-2">Transcription & Signing</h1>
          <div className="border-2 border-white/20 w-full h-full flex flex-col rounded-xl shadow-2xl bg-black/20 backdrop-blur-sm">
            <Transcription content={ASLTranscription} onSign={signTranscription} onSpeech={(transcript: string) => {
              setSpokenText(transcript);
              socket.emit("E-REQUEST-ANIMATION", transcript);
            }} />
            <div className="py-4 px-4 flex items-center justify-between gap-4 bg-white/10 backdrop-blur-sm rounded-b-xl">
              <Checkbox label="Autocorrect" />
              <div
                onClick={clear}
                className="px-6 py-3 border-2 border-red-400/50 text-red-300 rounded-xl hover:bg-red-500/20 hover:border-red-400 transition-all duration-300 cursor-pointer shadow-lg hover:shadow-red-500/25"
              >
                <p className="text-base select-none font-semibold">Clear</p>
              </div>
            </div>
          </div>
        </div>
        <div className="flex flex-col gap-3 items-center flex-[7]">
          <h1 className="text-2xl text-white font-bold drop-shadow-lg mb-2">Voice Input</h1>
          <div className="border-2 border-white/20 w-full h-full rounded-xl shadow-2xl bg-black/20 backdrop-blur-sm p-4">
            <div className="flex flex-col gap-4 h-full justify-center">
              <div className="flex items-center justify-between gap-4">
                <p className="text-base text-white font-medium flex-1">Spoken Text: <span className="text-blue-300">{spokenText || 'None'}</span></p>
                <button
                  onClick={startListening}
                  disabled={isListening}
                  className={`px-8 py-4 rounded-xl font-bold text-lg transform hover:scale-105 active:scale-95 transition-all duration-300 shadow-xl hover:shadow-2xl min-w-[160px] ${
                    isListening
                      ? 'bg-red-500 hover:bg-red-600 text-white shadow-red-500/50 animate-pulse'
                      : 'bg-blue-500 hover:bg-blue-600 text-white shadow-blue-500/50'
                  }`}
                >
                  {isListening ? '🎤 Listening...' : '🎤 Speak'}
                </button>
              </div>
              {spokenText && (
                <button
                  onClick={signSpokenText}
                  className="self-center px-8 py-4 bg-green-500 hover:bg-green-600 text-white rounded-xl font-bold text-lg transform hover:scale-105 active:scale-95 transition-all duration-300 shadow-xl shadow-green-500/50 hover:shadow-green-500/75 min-w-[200px]"
                >
                  🤟 Sign Spoken Text
                </button>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
