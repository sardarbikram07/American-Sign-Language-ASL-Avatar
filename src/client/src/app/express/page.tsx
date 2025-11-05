"use client";

import React from "react";
import io from "socket.io-client";
import "regenerator-runtime/runtime";
import { useEffect, useRef, useState } from "react";

import { Slider } from "@/ui/components/Slider";
import Visualization from "../components/Visualization";

const socket = io("ws://localhost:1234");

export default function Home() {
  const wordAnimationsToPlay = useRef<any>([]);
  const [currentWord, setCurrentWord] = useState<string>("");
  const [signingSpeed, setSigningSpeed] = useState<number>(30); // Optimized for CPU
  const [text, setText] = useState<string>("");
  const [duration, setDuration] = useState<string>("1");
  const [isListening, setIsListening] = useState<boolean>(false);
  const [speechSupported, setSpeechSupported] = useState<boolean>(false);
  const recognitionRef = useRef<any>(null);

  useEffect(() => {
    socket.on("connect", () => {
      console.log("Connected to server");
    });

    socket.on("E-ANIMATION", (animations) => {
      // if (duration != "0") {
      //   setSigningSpeed(
      //     Math.floor(animations[0][1].length / parseFloat(duration))
      //   );
      // }

      wordAnimationsToPlay.current = [
        ...wordAnimationsToPlay.current,
        ...animations,
      ];
    });

    // Initialize speech recognition
    if (typeof window !== 'undefined') {
      const SpeechRecognition = (window as any).webkitSpeechRecognition || (window as any).SpeechRecognition;
      
      if (SpeechRecognition) {
        setSpeechSupported(true);
        recognitionRef.current = new SpeechRecognition();
        recognitionRef.current.continuous = false;
        recognitionRef.current.interimResults = false;
        recognitionRef.current.lang = 'en-US';

        recognitionRef.current.onstart = () => {
          console.log('Speech recognition started');
          setIsListening(true);
        };

        recognitionRef.current.onresult = (event: any) => {
          console.log('Speech recognition result:', event);
          const transcript = event.results[0][0].transcript;
          console.log('Transcript:', transcript);
          setText(transcript);
          // Automatically trigger signing when speech is recognized
          setTimeout(() => {
            console.log('Emitting E-REQUEST-ANIMATION with:', transcript);
            socket.emit("E-REQUEST-ANIMATION", transcript);
          }, 500);
        };

        recognitionRef.current.onend = () => {
          console.log('Speech recognition ended');
          setIsListening(false);
        };

        recognitionRef.current.onerror = (event: any) => {
          console.error('Speech recognition error:', event.error, event);
          setIsListening(false);
          alert(`Speech recognition error: ${event.error}`);
        };
      } else {
        console.warn('Speech recognition not supported in this browser');
        setSpeechSupported(false);
      }
    }

    return () => {
      if (recognitionRef.current) {
        recognitionRef.current.stop();
      }
    };
  }, []);

  function getNextWord(): string | null {
    if (!wordAnimationsToPlay.current.length) {
      return null;
    }

    let animation = wordAnimationsToPlay.current.shift();
    setCurrentWord(animation[0]);

    return animation[1];
  }

  const startListening = () => {
    if (recognitionRef.current && !isListening) {
      setIsListening(true);
      recognitionRef.current.start();
    }
  };

  const stopListening = () => {
    if (recognitionRef.current && isListening) {
      recognitionRef.current.stop();
    }
  };

  return (
    <div className="flex h-screen w-screen flex-row gap-4">
      <div className="flex w-80 flex-col items-start gap-6 bg-white bg-opacity-10 px-4 py-4">
        <p className="text-4xl font-semibold text-white">Speech to ASL</p>
        {!speechSupported && (
          <p className="text-sm text-yellow-300">⚠️ Speech recognition requires Chrome or Safari</p>
        )}
        <div className="flex w-full flex-col gap-1">
          <p className="text-lg text-white">Signing Speed</p>
          <Slider
            defaultValue={[signingSpeed]}
            value={[signingSpeed]}
            onValueChange={(value) => setSigningSpeed(value[0])}
            min={20}
            max={100}
            step={1}
          />
        </div>
        <div className="flex w-full flex-col items-start justify-start gap-1">
          <p className="text-lg text-white">Duration</p>
          <input
            value={duration}
            placeholder="Enter duration (in seconds)"
            onChange={(e) => setDuration(e.target.value)}
            className="w-full rounded border border-white border-opacity-10 bg-transparent p-2 text-sm text-white placeholder-white placeholder-opacity-50 focus:outline-none"
          />
        </div>
        <div className="flex h-full w-full flex-col items-start justify-start gap-1">
          <div className="flex items-center justify-between w-full">
            <p className="text-lg text-white">Content</p>
            {speechSupported ? (
              <button
                onClick={isListening ? stopListening : startListening}
                className={`px-3 py-1 rounded text-sm transition duration-300 ${
                  isListening 
                    ? 'bg-red-600 hover:bg-red-700 text-white' 
                    : 'bg-green-600 hover:bg-green-700 text-white'
                }`}
              >
                {isListening ? '🎤 Stop' : '🎤 Speak'}
              </button>
            ) : (
              <span className="text-sm text-yellow-300">🎤 Not supported</span>
            )}
          </div>
          <textarea
            value={text}
            placeholder={speechSupported ? "Enter text to sign or click microphone to speak" : "Enter text to sign (speech recognition not supported)"}
            onChange={(e) => setText(e.target.value)}
            className="h-full w-full rounded border border-white border-opacity-10 bg-transparent p-2 text-sm text-white placeholder-white placeholder-opacity-50 focus:outline-none"
          />
        </div>
        <div
          className="flex w-full items-center justify-center rounded bg-blue-600 py-2 transition duration-300 hover:bg-blue-700"
          onClick={() => socket.emit("E-REQUEST-ANIMATION", text)}
        >
          <p className="select-none text-white">Render</p>
        </div>
      </div>
      <Visualization
        full
        signingSpeed={signingSpeed}
        getNextWord={getNextWord}
        currentWord={currentWord}
      />
    </div>
  );
}
