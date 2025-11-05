"use client";

import { useEffect } from "react";

export default function Transcription({ content, onSign, onSpeech }: { content: string, onSign: () => void, onSpeech: (transcript: string) => void }) {
  const speak = () => {
    if (content) {
      const utterance = new SpeechSynthesisUtterance(content);
      window.speechSynthesis.speak(utterance);
    }
  };

  return (
    <div className="flex grow w-full flex-col gap-2">
      <p className="text-5xl text-white font-light leading-relaxed drop-shadow-md">{content || "Start signing to see transcription..."}</p>
      <div className="flex gap-2">
        <button
          onClick={speak}
          className="self-start px-6 py-3 bg-gradient-to-r from-green-500 to-green-600 text-white rounded-xl hover:from-green-600 hover:to-green-700 transition-all duration-300 cursor-pointer shadow-xl font-semibold text-lg transform hover:scale-105"
        >
          🔊 Speak
        </button>
        <button
          onClick={onSign}
          className="self-start px-6 py-3 bg-gradient-to-r from-blue-500 to-blue-600 text-white rounded-xl hover:from-blue-600 hover:to-blue-700 transition-all duration-300 cursor-pointer shadow-xl font-semibold text-lg transform hover:scale-105"
        >
          🤟 Sign
        </button>
      </div>
    </div>
  );
}
