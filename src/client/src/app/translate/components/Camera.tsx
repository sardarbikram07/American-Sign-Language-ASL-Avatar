import { Hand } from "kalidokit";
import * as cam from "@mediapipe/camera_utils";
import React, { useRef, useEffect } from "react";
import { Hands, HAND_CONNECTIONS } from "@mediapipe/hands";
import { drawConnectors, drawLandmarks } from "@mediapipe/drawing_utils";

const Camera = () => {
  const video = useRef<HTMLVideoElement>(null);
  const canvas = useRef<HTMLCanvasElement>(null);
  const ctx = useRef<CanvasRenderingContext2D | null>(null);

  useEffect(() => {
    if (!canvas.current || !video.current) return;
    
    // Make canvas scale responsively but use larger internal resolution
    canvas.current.style.width = "100%";
    canvas.current.style.height = "auto";

    const context = canvas.current.getContext("2d");
    if (!context) return;
    ctx.current = context;

    const hands = new Hands({
      locateFile: (file) => {
        return `/landmarker/${file}`;
      },
    });

    hands.setOptions({
      maxNumHands: 1,
      modelComplexity: 1,
      minDetectionConfidence: 0.5,
      minTrackingConfidence: 0.5,
    });

    hands.onResults(onResults);

    const camera = new cam.Camera(video.current, {
      onFrame: async () => {
        if (!video.current) return;
        await hands.send({ image: video.current });
      },
    });
    camera.start();

    function onResults(results: any) {
      if (!ctx.current || !canvas.current) return;
      
      ctx.current.clearRect(0, 0, canvas.current.width, canvas.current.height);
      ctx.current.drawImage(
        results.image,
        0,
        0,
        canvas.current.width,
        canvas.current.height,
      );
      if (results.multiHandLandmarks) {
        for (const landmarks of results.multiHandLandmarks) {
          drawConnectors(ctx.current, landmarks, HAND_CONNECTIONS);
          drawLandmarks(ctx.current, landmarks);
        }
      }
    }
  }, []);

  return (
    <div className="w-full max-w-[1600px] overflow-hidden rounded-xl outline outline-[5px] outline-blue-400">
      <video ref={video} style={{ display: "none" }}></video>
      {/* Larger internal canvas resolution for better detection and clearer display */}
      <canvas ref={canvas} width="1400" height="900"></canvas>
    </div>
  );
};

export default Camera;
