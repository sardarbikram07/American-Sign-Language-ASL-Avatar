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
    <div style={{ display: "flex", flexDirection: "column", width: "100%", height: "100%", minHeight: 0 }}>
      {/* Scrollable text area */}
      <div style={{ flex: 1, overflowY: "auto", padding: "10px 16px", minHeight: 0 }}>
        <p style={{ fontSize: "1.6rem", color: "white", fontWeight: 300, lineHeight: 1.4, margin: 0 }}>
          {content || "Start signing to see transcription..."}
        </p>
      </div>
    </div>
  );
}
