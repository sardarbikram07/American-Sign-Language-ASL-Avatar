"use client";

import React from "react";
import io from "socket.io-client";
import { useEffect, useRef, useState } from "react";

import Camera from "./components/Camera";
import Checkbox from "@/ui/components/Checkbox";
import Transcription from "./components/Transcription";
import Visualization from "./components/Visualization";

// Add to your globals.css:
// @import url('https://fonts.googleapis.com/css2?family=Share+Tech+Mono&family=Orbitron:wght@400;700;900&display=swap');
//
// @keyframes scanbeam {
//   0% { top: -4px; }
//   100% { top: 100%; }
// }
// @keyframes cornerpulse {
//   0%, 100% { opacity: 0.35; }
//   50% { opacity: 1; }
// }
// @keyframes ringpulse {
//   0% { transform: scale(1); opacity: 0.7; }
//   100% { transform: scale(2); opacity: 0; }
// }
// @keyframes blink {
//   0%, 100% { opacity: 1; }
//   50% { opacity: 0; }
// }
// @keyframes screentick {
//   0%, 97%, 100% { opacity: 1; }
//   98% { opacity: 0.88; }
//   99% { opacity: 0.95; }
// }
// @keyframes gridmove {
//   from { background-position: 0 0; }
//   to { background-position: 0 48px; }
// }

declare global {
  interface Window {
    SpeechRecognition: any;
    webkitSpeechRecognition: any;
  }
}

const socket = io("ws://localhost:1234");

// ─── Panel Component ──────────────────────────────────────────────────────────

type PanelColor = "green" | "cyan";

function Panel({
  children,
  flex,
  label,
  sublabel,
  tag,
  color = "green",
  noPad = false,
  style,
}: {
  children: React.ReactNode;
  flex: number;
  label: string;
  sublabel: string;
  tag: string;
  color?: PanelColor;
  noPad?: boolean;
  style?: React.CSSProperties;
}) {
  const clr = color === "green" ? "#00ff9d" : "#00e5ff";
  const clrDim = color === "green" ? "rgba(0,255,157," : "rgba(0,229,255,";

  return (
    <div
      style={{
        flex,
        display: "flex",
        flexDirection: "column",
        position: "relative",
        border: `1px solid ${clrDim}0.22)`,
        borderRadius: 3,
        background: "rgba(2,10,7,0.92)",
        overflow: "hidden",
        minWidth: 0,
        minHeight: 0,
        boxShadow: `0 0 0 1px ${clrDim}0.06), 0 0 32px ${clrDim}0.05), inset 0 0 40px ${clrDim}0.02)`,
        transition: "box-shadow 0.4s",
        ...style,
      }}
      onMouseEnter={(e) => {
        (e.currentTarget as HTMLElement).style.boxShadow =
          `0 0 0 1px ${clrDim}0.1), 0 0 48px ${clrDim}0.12), inset 0 0 40px ${clrDim}0.04)`;
      }}
      onMouseLeave={(e) => {
        (e.currentTarget as HTMLElement).style.boxShadow =
          `0 0 0 1px ${clrDim}0.06), 0 0 32px ${clrDim}0.05), inset 0 0 40px ${clrDim}0.02)`;
      }}
    >
      {/* Corner brackets */}
      {[
        { top: 0, left: 0, borderTop: `2px solid ${clr}`, borderLeft: `2px solid ${clr}` },
        { top: 0, right: 0, borderTop: `2px solid ${clr}`, borderRight: `2px solid ${clr}` },
        { bottom: 0, left: 0, borderBottom: `2px solid ${clr}`, borderLeft: `2px solid ${clr}` },
        { bottom: 0, right: 0, borderBottom: `2px solid ${clr}`, borderRight: `2px solid ${clr}` },
      ].map((s, i) => (
        <div
          key={i}
          style={{
            position: "absolute",
            width: 10,
            height: 10,
            zIndex: 3,
            animation: `cornerpulse 2.4s ease-in-out infinite ${i * 0.6}s`,
            ...s,
          }}
        />
      ))}

      {/* Header bar */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "7px 14px",
          borderBottom: `1px solid ${clrDim}0.14)`,
          background: `linear-gradient(90deg, ${clrDim}0.07), transparent 70%)`,
          flexShrink: 0,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <div
            style={{
              width: 6,
              height: 6,
              borderRadius: "50%",
              background: clr,
              boxShadow: `0 0 8px ${clr}, 0 0 16px ${clr}88`,
            }}
          />
          <span
            style={{
              fontFamily: "'Orbitron', monospace",
              fontSize: 9,
              fontWeight: 700,
              letterSpacing: "0.28em",
              color: clr,
              textTransform: "uppercase",
              textShadow: `0 0 12px ${clr}88`,
            }}
          >
            {label}
          </span>
          <span
            style={{
              fontFamily: "'Share Tech Mono', monospace",
              fontSize: 9,
              letterSpacing: "0.14em",
              color: `${clrDim}0.4)`,
              textTransform: "uppercase",
            }}
          >
            // {sublabel}
          </span>
        </div>
        <span
          style={{
            fontFamily: "'Share Tech Mono', monospace",
            fontSize: 9,
            letterSpacing: "0.18em",
            color: `${clrDim}0.3)`,
          }}
        >
          {tag}
        </span>
      </div>

      {/* Content */}
      <div
        style={{
          flex: 1,
          overflow: "hidden",
          display: "flex",
          flexDirection: "column",
          padding: noPad ? 0 : undefined,
        }}
      >
        {children}
      </div>
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function Home() {
  const wordAnimationsToPlay = useRef<any>([]);
  const [currentWord, setCurrentWord] = useState<string>("");
  const [ASLTranscription, setASLTranscription] = useState("");
  const lastSigned = useRef<string>("");
  const [spokenText, setSpokenText] = useState<string>("");
  const [isListening, setIsListening] = useState<boolean>(false);
  const [currentTime, setCurrentTime] = useState<string>("");
  const [cameraSource, setCameraSource] = useState<number>(0);
  const [cameraStatus, setCameraStatus] = useState<"ok" | "error" | "switching" | null>(null);

  useEffect(() => {
    setCurrentTime(new Date().toLocaleTimeString("en-US", { hour12: false }));
    const timer = setInterval(() => {
      setCurrentTime(new Date().toLocaleTimeString("en-US", { hour12: false }));
    }, 1000);

    socket.on("connect", () => console.log("Connected to server"));

    socket.on("R-TRANSCRIPTION", (data) => {
      // Only update if we have actual content — preserves last recognized text on screen
      if (data && data.trim()) {
        setASLTranscription(data);
        if (data.includes(" ") && data !== lastSigned.current) {
          socket.emit("E-REQUEST-ANIMATION", data);
          lastSigned.current = data;
        }
      }
    });

    socket.on("E-ANIMATION", (animations) => {
      wordAnimationsToPlay.current = [
        ...wordAnimationsToPlay.current,
        ...animations,
      ];
    });

    return () => {
      clearInterval(timer);
      socket.off("connect");
      socket.off("R-TRANSCRIPTION");
      socket.off("E-ANIMATION");
    };
  }, []);

  function getNextWord(): string | null {
    if (!wordAnimationsToPlay.current.length) return null;
    const animation = wordAnimationsToPlay.current.shift();
    setCurrentWord(animation[0]);
    return animation[1];
  }

  function clear() {
    socket.emit("R-CLEAR-TRANSCRIPTION");
    setASLTranscription("");
    lastSigned.current = "";
  }

  function signTranscription() {
    if (ASLTranscription) socket.emit("E-REQUEST-ANIMATION", ASLTranscription);
  }

  function signSpokenText() {
    if (spokenText) socket.emit("E-REQUEST-ANIMATION", spokenText);
  }

  async function handleCameraChange(e: React.ChangeEvent<HTMLSelectElement>) {
    const index = Number(e.target.value);
    setCameraStatus("switching");
    try {
      const res = await fetch("http://localhost:1234/set-camera", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ index }),
      });
      if (res.ok) {
        setCameraSource(index);
        setCameraStatus("ok");
      } else {
        setCameraStatus("error");
      }
    } catch {
      setCameraStatus("error");
    }
    setTimeout(() => setCameraStatus(null), 2000);
  }

  function startListening() {
    if (!("webkitSpeechRecognition" in window) && !("SpeechRecognition" in window)) {
      alert("Speech recognition not supported in this browser.");
      return;
    }
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    const recognition = new SR();
    recognition.continuous = false;
    recognition.interimResults = false;
    recognition.lang = "en-US";
    recognition.onstart = () => setIsListening(true);
    recognition.onresult = (event: any) => {
      const transcript = event.results[0][0].transcript;
      setSpokenText(transcript);
      socket.emit("E-REQUEST-ANIMATION", transcript);
    };
    recognition.onerror = () => setIsListening(false);
    recognition.onend = () => setIsListening(false);
    recognition.start();
  }

  return (
    <div
      style={{
        width: "100vw",
        height: "100vh",
        display: "flex",
        flexDirection: "column",
        background: "#010a06",
        fontFamily: "'Share Tech Mono', monospace",
        position: "relative",
        overflow: "hidden",
        animation: "screentick 12s infinite",
      }}
    >
      {/* ── Ambient layers ── */}

      {/* Scrolling grid */}
      <div
        style={{
          position: "fixed",
          inset: 0,
          zIndex: 0,
          pointerEvents: "none",
          backgroundImage:
            "linear-gradient(rgba(0,255,157,0.028) 1px, transparent 1px), linear-gradient(90deg, rgba(0,255,157,0.028) 1px, transparent 1px)",
          backgroundSize: "48px 48px",
          animation: "gridmove 10s linear infinite",
        }}
      />

      {/* Radial glow pools */}
      <div
        style={{
          position: "fixed",
          inset: 0,
          zIndex: 0,
          pointerEvents: "none",
          background:
            "radial-gradient(ellipse 60% 40% at 20% 50%, rgba(0,255,157,0.04) 0%, transparent 70%), radial-gradient(ellipse 50% 50% at 80% 50%, rgba(0,229,255,0.04) 0%, transparent 70%)",
        }}
      />

      {/* CRT scanline texture */}
      <div
        style={{
          position: "fixed",
          inset: 0,
          zIndex: 10,
          pointerEvents: "none",
          background:
            "repeating-linear-gradient(0deg, transparent, transparent 2px, rgba(0,0,0,0.06) 2px, rgba(0,0,0,0.06) 4px)",
        }}
      />

      {/* Sweeping scan beam */}
      <div
        style={{
          position: "fixed",
          left: 0,
          right: 0,
          height: 2,
          zIndex: 11,
          pointerEvents: "none",
          background:
            "linear-gradient(transparent, rgba(0,255,157,0.15), transparent)",
          animation: "scanbeam 7s linear infinite",
        }}
      />

      {/* ── Topbar ── */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "8px 20px",
          borderBottom: "1px solid rgba(0,255,157,0.16)",
          background:
            "linear-gradient(90deg, rgba(0,255,157,0.06), transparent 50%, rgba(0,229,255,0.04))",
          flexShrink: 0,
          zIndex: 5,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <div
            style={{
              width: 8,
              height: 8,
              borderRadius: "50%",
              background: "#00ff9d",
              boxShadow: "0 0 10px #00ff9d, 0 0 24px #00ff9d66",
            }}
          />
          <span
            style={{
              fontFamily: "'Share Tech Mono', monospace",
              fontSize: 10,
              letterSpacing: "0.28em",
              color: "rgba(0,255,157,0.45)",
              textTransform: "uppercase",
            }}
          >
            SYS::ONLINE
          </span>
        </div>

        <div style={{ textAlign: "center" }}>
          <div
            style={{
              fontFamily: "'Orbitron', monospace",
              fontSize: 15,
              fontWeight: 900,
              letterSpacing: "0.2em",
              color: "#00ff9d",
              textShadow: "0 0 24px #00ff9d99, 0 0 48px #00ff9d44",
              textTransform: "uppercase",
            }}
          >
            ASL Translation Matrix
          </div>
          <div
            style={{
              fontFamily: "'Share Tech Mono', monospace",
              fontSize: 9,
              letterSpacing: "0.22em",
              color: "rgba(0,255,157,0.3)",
              marginTop: 2,
            }}
          >
            FINGERSPELL → ENGLISH // REAL-TIME
          </div>
        </div>

        <div
          style={{
            fontFamily: "'Share Tech Mono', monospace",
            fontSize: 9,
            letterSpacing: "0.2em",
            color: "rgba(0,229,255,0.4)",
            textTransform: "uppercase",
          }}
        >
          v2.4.1 // {currentTime || "--:--:--"}
        </div>
      </div>

      {/* ── Content grid ── */}
      <div
        style={{
          flex: 1,
          display: "flex",
          flexDirection: "column",
          gap: 12,
          padding: 12,
          zIndex: 5,
          minHeight: 0,
        }}
      >
        {/* Row 1 */}
        <div style={{ flex: 5, display: "flex", gap: 12, minHeight: 0 }}>
          <Panel flex={13} label="Input Feed" sublabel="Camera · ASL Detection" tag="CAM-01" color="green" noPad>
            {/* Camera source selector bar */}
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 10,
                padding: "6px 12px",
                borderBottom: "1px solid rgba(0,255,157,0.12)",
                background: "rgba(0,255,157,0.03)",
                flexShrink: 0,
              }}
            >
              <span
                style={{
                  fontFamily: "'Share Tech Mono', monospace",
                  fontSize: 9,
                  letterSpacing: "0.22em",
                  color: "rgba(0,255,157,0.5)",
                  textTransform: "uppercase",
                  whiteSpace: "nowrap",
                  flexShrink: 0,
                }}
              >
                Camera Source
              </span>
              <div style={{ position: "relative", flex: 1 }}>
                <select
                  value={cameraSource}
                  onChange={handleCameraChange}
                  disabled={cameraStatus === "switching"}
                  style={{
                    width: "100%",
                    padding: "5px 28px 5px 10px",
                    background: "rgba(2,10,7,0.92)",
                    border: `1px solid ${
                      cameraStatus === "error"
                        ? "rgba(255,70,70,0.7)"
                        : cameraStatus === "ok"
                        ? "rgba(0,255,157,0.7)"
                        : "rgba(0,229,255,0.45)"
                    }`,
                    borderRadius: 3,
                    color: cameraStatus === "error" ? "#ff7070" : "#00e5ff",
                    fontFamily: "'Share Tech Mono', monospace",
                    fontSize: 11,
                    letterSpacing: "0.08em",
                    cursor: cameraStatus === "switching" ? "wait" : "pointer",
                    outline: "none",
                    appearance: "none",
                    boxShadow: `0 0 10px ${
                      cameraStatus === "error"
                        ? "rgba(255,70,70,0.15)"
                        : "rgba(0,229,255,0.08)"
                    }`,
                    transition: "border 0.25s, box-shadow 0.25s, color 0.25s",
                  }}
                >
                  <option value={0}>Device Camera</option>
                  <option value={1}>External Camera</option>
                </select>
                {/* Custom chevron */}
                <span
                  style={{
                    position: "absolute",
                    right: 9,
                    top: "50%",
                    transform: "translateY(-50%)",
                    pointerEvents: "none",
                    color: "rgba(0,229,255,0.55)",
                    fontSize: 10,
                  }}
                >
                  ▾
                </span>
              </div>
              {/* Status indicator */}
              {cameraStatus && (
                <span
                  style={{
                    fontFamily: "'Share Tech Mono', monospace",
                    fontSize: 8,
                    letterSpacing: "0.22em",
                    textTransform: "uppercase",
                    flexShrink: 0,
                    color:
                      cameraStatus === "error"
                        ? "#ff7070"
                        : cameraStatus === "switching"
                        ? "rgba(0,229,255,0.6)"
                        : "#00ff9d",
                    textShadow:
                      cameraStatus === "ok" ? "0 0 8px #00ff9d" : "none",
                    animation: cameraStatus === "switching" ? "blink 0.8s infinite" : "none",
                  }}
                >
                  {cameraStatus === "switching"
                    ? "SWITCHING..."
                    : cameraStatus === "ok"
                    ? "● LINKED"
                    : "✕ FAILED"}
                </span>
              )}
            </div>
            <Camera key={cameraSource} />
          </Panel>

          <Panel flex={7} label="3D Simulation" sublabel="Hand Model · Render" tag="SIM-01" color="cyan">
            <Visualization
              signingSpeed={50}
              getNextWord={getNextWord}
              currentWord={currentWord}
            />
          </Panel>
        </div>

        {/* Row 2 */}
        <div style={{ flex: 2, display: "flex", gap: 12, minHeight: 0 }}>
          {/* Transcription panel */}
          <Panel flex={13} label="Signal Output" sublabel="Transcription · Signing Engine" tag="TRX-01" color="green" noPad>
            <div style={{ flex: 1, overflow: "hidden", display: "flex", flexDirection: "column" }}>
              <Transcription
                content={ASLTranscription}
                onSign={signTranscription}
                onSpeech={(transcript: string) => {
                  setSpokenText(transcript);
                  socket.emit("E-REQUEST-ANIMATION", transcript);
                }}
              />
            </div>

            {/* Panel footer */}
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                padding: "6px 12px",
                borderTop: "1px solid rgba(0,255,157,0.12)",
                background: "rgba(0,255,157,0.03)",
                flexShrink: 0,
                gap: 8,
              }}
            >
              {/* Autocorrect toggle */}
              <label
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 7,
                  cursor: "pointer",
                }}
              >
                <Checkbox label="" />
                <span
                  style={{
                    fontFamily: "'Share Tech Mono', monospace",
                    fontSize: 8,
                    letterSpacing: "0.22em",
                    color: "rgba(0,255,157,0.45)",
                    textTransform: "uppercase",
                    userSelect: "none",
                  }}
                >
                  AUTOCORRECT
                </span>
              </label>

              {/* Speak + Sign buttons */}
              <div style={{ display: "flex", gap: 6 }}>
                <button
                  onClick={() => {
                    if (ASLTranscription) {
                      const utterance = new SpeechSynthesisUtterance(ASLTranscription);
                      window.speechSynthesis.speak(utterance);
                    }
                  }}
                  style={{
                    padding: "4px 10px",
                    fontSize: 10,
                    fontFamily: "'Share Tech Mono', monospace",
                    background: "rgba(0,255,157,0.08)",
                    border: "1px solid rgba(0,255,157,0.35)",
                    color: "rgba(0,255,157,0.8)",
                    borderRadius: 3,
                    cursor: "pointer",
                    letterSpacing: "0.12em",
                    transition: "all 0.2s",
                  }}
                  onMouseEnter={e => {
                    (e.currentTarget as HTMLElement).style.background = "rgba(0,255,157,0.18)";
                    (e.currentTarget as HTMLElement).style.color = "#00ff9d";
                  }}
                  onMouseLeave={e => {
                    (e.currentTarget as HTMLElement).style.background = "rgba(0,255,157,0.08)";
                    (e.currentTarget as HTMLElement).style.color = "rgba(0,255,157,0.8)";
                  }}
                >
                  🔊 SPEAK
                </button>
                <button
                  onClick={signTranscription}
                  style={{
                    padding: "4px 10px",
                    fontSize: 10,
                    fontFamily: "'Share Tech Mono', monospace",
                    background: "rgba(0,229,255,0.08)",
                    border: "1px solid rgba(0,229,255,0.35)",
                    color: "rgba(0,229,255,0.8)",
                    borderRadius: 3,
                    cursor: "pointer",
                    letterSpacing: "0.12em",
                    transition: "all 0.2s",
                  }}
                  onMouseEnter={e => {
                    (e.currentTarget as HTMLElement).style.background = "rgba(0,229,255,0.18)";
                    (e.currentTarget as HTMLElement).style.color = "#00e5ff";
                  }}
                  onMouseLeave={e => {
                    (e.currentTarget as HTMLElement).style.background = "rgba(0,229,255,0.08)";
                    (e.currentTarget as HTMLElement).style.color = "rgba(0,229,255,0.8)";
                  }}
                >
                  🤟 SIGN
                </button>
              </div>

              {/* Clear button */}
              <GhostButton onClick={clear} color="red">
                [ CLEAR ]
              </GhostButton>
            </div>
          </Panel>

          {/* Voice input panel */}
          <Panel flex={7} label="Voice Input" sublabel="Speech Recognition · Live" tag="MIC-01" color="cyan">
            <div
              style={{
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                justifyContent: "center",
                gap: 10,
                height: "100%",
                padding: "8px 16px",
              }}
            >
              {/* Decoded signal readout */}
              <div
                style={{
                  width: "100%",
                  padding: "7px 10px",
                  border: "1px solid rgba(0,229,255,0.18)",
                  background: "rgba(0,229,255,0.04)",
                  borderRadius: 2,
                }}
              >
                <div
                  style={{
                    fontFamily: "'Share Tech Mono', monospace",
                    fontSize: 8,
                    letterSpacing: "0.3em",
                    color: "rgba(0,229,255,0.4)",
                    textTransform: "uppercase",
                    marginBottom: 5,
                  }}
                >
                  DECODED SIGNAL
                </div>
                <div
                  style={{
                    fontFamily: "'Share Tech Mono', monospace",
                    fontSize: 11,
                    letterSpacing: "0.04em",
                    color: spokenText ? "#00e5ff" : "rgba(0,229,255,0.22)",
                    minHeight: 18,
                    wordBreak: "break-word",
                  }}
                >
                  {spokenText ? (
                    <>
                      {spokenText}
                      <span style={{ animation: "blink 1s infinite", color: "#00e5ff" }}>▌</span>
                    </>
                  ) : (
                    "_ _ _  AWAITING INPUT  _ _ _"
                  )}
                </div>
              </div>

              {/* Mic button */}
              <div style={{ position: "relative", display: "flex", alignItems: "center", justifyContent: "center" }}>
                {isListening && (
                  <>
                    <div
                      style={{
                        position: "absolute",
                        width: 56,
                        height: 56,
                        borderRadius: "50%",
                        border: "1px solid rgba(0,255,157,0.6)",
                        animation: "ringpulse 1.6s ease-out infinite",
                      }}
                    />
                    <div
                      style={{
                        position: "absolute",
                        width: 56,
                        height: 56,
                        borderRadius: "50%",
                        border: "1px solid rgba(0,255,157,0.4)",
                        animation: "ringpulse 1.6s ease-out infinite 0.55s",
                      }}
                    />
                    <div
                      style={{
                        position: "absolute",
                        width: 56,
                        height: 56,
                        borderRadius: "50%",
                        border: "1px solid rgba(0,255,157,0.2)",
                        animation: "ringpulse 1.6s ease-out infinite 1.1s",
                      }}
                    />
                  </>
                )}
                <button
                  onClick={startListening}
                  disabled={isListening}
                  style={{
                    width: 50,
                    height: 50,
                    borderRadius: "50%",
                    border: `2px solid ${isListening ? "#00ff9d" : "rgba(0,229,255,0.5)"}`,
                    background: isListening
                      ? "rgba(0,255,157,0.1)"
                      : "rgba(0,229,255,0.06)",
                    color: isListening ? "#00ff9d" : "#00e5ff",
                    fontSize: 20,
                    cursor: isListening ? "default" : "pointer",
                    boxShadow: isListening
                      ? "0 0 32px rgba(0,255,157,0.5), inset 0 0 20px rgba(0,255,157,0.1)"
                      : "0 0 16px rgba(0,229,255,0.15)",
                    transition: "all 0.3s",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    position: "relative",
                    zIndex: 1,
                  }}
                >
                  🎤
                </button>
              </div>

              <div
                style={{
                  fontFamily: "'Share Tech Mono', monospace",
                  fontSize: 9,
                  letterSpacing: "0.28em",
                  color: isListening ? "#00ff9d" : "rgba(0,229,255,0.35)",
                  textTransform: "uppercase",
                  transition: "color 0.3s",
                  textShadow: isListening ? "0 0 10px #00ff9d" : "none",
                }}
              >
                {isListening ? "● RECORDING" : "○ STANDBY"}
              </div>

              {/* Sign spoken text */}
              {spokenText && (
                <GhostButton onClick={signSpokenText} color="green" wide>
                  [ TRANSMIT → SIGN ]
                </GhostButton>
              )}
            </div>
          </Panel>
        </div>
      </div>
    </div>
  );
}

// ─── Ghost Button ─────────────────────────────────────────────────────────────

function GhostButton({
  children,
  onClick,
  color,
  wide,
}: {
  children: React.ReactNode;
  onClick: () => void;
  color: "green" | "red" | "cyan";
  wide?: boolean;
}) {
  const palette = {
    green: {
      border: "rgba(0,255,157,0.4)",
      borderHover: "rgba(0,255,157,0.9)",
      bg: "rgba(0,255,157,0.06)",
      bgHover: "rgba(0,255,157,0.14)",
      text: "rgba(0,255,157,0.75)",
      textHover: "#00ff9d",
      glow: "rgba(0,255,157,0.25)",
    },
    red: {
      border: "rgba(255,70,70,0.4)",
      borderHover: "rgba(255,70,70,0.9)",
      bg: "rgba(255,70,70,0.05)",
      bgHover: "rgba(255,70,70,0.14)",
      text: "rgba(255,110,110,0.75)",
      textHover: "#ff7070",
      glow: "rgba(255,70,70,0.25)",
    },
    cyan: {
      border: "rgba(0,229,255,0.4)",
      borderHover: "rgba(0,229,255,0.9)",
      bg: "rgba(0,229,255,0.05)",
      bgHover: "rgba(0,229,255,0.14)",
      text: "rgba(0,229,255,0.75)",
      textHover: "#00e5ff",
      glow: "rgba(0,229,255,0.25)",
    },
  }[color];

  const [hovered, setHovered] = useState(false);

  return (
    <button
      onClick={onClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        padding: "10px 22px",
        border: `1px solid ${hovered ? palette.borderHover : palette.border}`,
        background: hovered ? palette.bgHover : palette.bg,
        color: hovered ? palette.textHover : palette.text,
        fontFamily: "'Share Tech Mono', monospace",
        fontSize: 11,
        letterSpacing: "0.22em",
        textTransform: "uppercase",
        cursor: "pointer",
        borderRadius: 2,
        boxShadow: hovered ? `0 0 20px ${palette.glow}` : "none",
        transition: "all 0.2s",
        width: wide ? "100%" : undefined,
      }}
    >
      {children}
    </button>
  );
}
