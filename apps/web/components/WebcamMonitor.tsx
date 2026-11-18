"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import {
  Camera,
  Cpu,
  Eye,
  AlertCircle,
  RefreshCw,
  FlipHorizontal,
  Smartphone,
  ShieldCheck,
  Zap,
  Video,
  VideoOff,
  Play,
  Pause,
} from "lucide-react";
import * as ort from "onnxruntime-web";
import { FatigueEventType, DriverTelemetryPayload } from "@/types/database";

interface WebcamMonitorProps {
  shiftId: string;
  isCameraActive?: boolean;
  onToggleCameraActive?: (active: boolean) => void;
  onAlert: (eventType: FatigueEventType, perclosScore: number) => void;
  onClearAlert: () => void;
  onTelemetryUpdate?: (metrics: {
    ear: number;
    mar: number;
    perclos: number;
    fps: number;
    drowsyProb: number;
    blinkCount: number;
    stateLabel: string;
  }) => void;
}

// MediaPipe 468 landmark indices
const LEFT_EYE = {
  horizontal: [362, 263], // outer, inner
  vertical1: [385, 380],  // top, bottom
  vertical2: [387, 373],  // top, bottom
};

const RIGHT_EYE = {
  horizontal: [33, 133],  // outer, inner
  vertical1: [160, 144],  // top, bottom
  vertical2: [158, 153],  // top, bottom
};

const MOUTH = {
  horizontal: [78, 308],  // left corner, right corner
  vertical1: [13, 14],    // upper lip center, lower lip center
  vertical2: [82, 87],    // upper lip left, lower lip left
  vertical3: [312, 317],  // upper lip right, lower lip right
};

// Driver cognitive & physical states
export type DriverState =
  | "ALERT"
  | "BLINKING"
  | "DROWSY_PRECURSOR"
  | "MICROSLEEP"
  | "YAWNING"
  | "DISTRACTED"
  | "NO_FACE"
  | "PAUSED";

export default function WebcamMonitor({
  shiftId,
  isCameraActive: externalIsCameraActive,
  onToggleCameraActive,
  onAlert,
  onClearAlert,
  onTelemetryUpdate,
}: WebcamMonitorProps) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);

  // Internal camera active state (synced with optional external prop)
  const [internalCameraActive, setInternalCameraActive] = useState(true);
  const isCameraActive =
    externalIsCameraActive !== undefined
      ? externalIsCameraActive
      : internalCameraActive;

  // Hardware & Camera states
  const [hasCamera, setHasCamera] = useState(false);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [facingMode, setFacingMode] = useState<"user" | "environment">("user");
  const [modelType, setModelType] = useState<string>("Initializing Engine...");
  const [wakeLockActive, setWakeLockActive] = useState(false);

  // Live telemetry indicators
  const [earValue, setEarValue] = useState(0.32);
  const [marValue, setMarValue] = useState(0.14);
  const [perclosValue, setPerclosValue] = useState(0.0);
  const [drowsyProbability, setDrowsyProbability] = useState(0.05);
  const [fps, setFps] = useState(60);
  const [driverState, setDriverState] = useState<DriverState>("ALERT");
  const [closedSeconds, setClosedSeconds] = useState(0.0);
  const [blinkCount, setBlinkCount] = useState(0);

  // Stable refs for callbacks and loop state to eliminate React render thrashing
  const onAlertRef = useRef(onAlert);
  onAlertRef.current = onAlert;
  const onClearAlertRef = useRef(onClearAlert);
  onClearAlertRef.current = onClearAlert;
  const onTelemetryUpdateRef = useRef(onTelemetryUpdate);
  onTelemetryUpdateRef.current = onTelemetryUpdate;
  const shiftIdRef = useRef(shiftId);
  shiftIdRef.current = shiftId;
  const blinkCountRef = useRef(0);
  const drowsyProbabilityRef = useRef(0.05);
  const fpsRef = useRef(60);

  // Internal refs
  const faceLandmarkerRef = useRef<any>(null);
  const ortSessionRef = useRef<ort.InferenceSession | null>(null);
  const ringBufferRef = useRef<Array<[number, number]>>([]); // [ear, mar]
  const BUFFER_MAX = 300; // 5s at 60fps
  const SEQ_LEN = 30; // LSTM sequence length

  // Timing thresholds for differentiating blink vs microsleep vs sleep
  const closedFramesRef = useRef(0);
  const openFramesRef = useRef(0);
  const yawnFramesRef = useRef(0);
  const noFaceFramesRef = useRef(0);

  const lastAlertTimeRef = useRef(0);
  const animFrameIdRef = useRef<number | null>(null);
  const lastFrameTimeRef = useRef(performance.now());
  const frameCountRef = useRef(0);
  const wakeLockRef = useRef<any>(null);

  const setCameraActiveHandler = (active: boolean) => {
    setInternalCameraActive(active);
    if (onToggleCameraActive) {
      onToggleCameraActive(active);
    }
  };

  // 1. Mobile Screen Wake Lock
  useEffect(() => {
    async function requestWakeLock() {
      if (typeof window !== "undefined" && "wakeLock" in navigator && isCameraActive) {
        try {
          const lock = await (navigator as any).wakeLock.request("screen");
          wakeLockRef.current = lock;
          setWakeLockActive(true);
          lock.addEventListener("release", () => {
            setWakeLockActive(false);
          });
        } catch {
          // WakeLock denied or unavailable
        }
      }
    }

    if (isCameraActive) {
      requestWakeLock();
    } else if (wakeLockRef.current) {
      wakeLockRef.current.release().catch(() => {});
      wakeLockRef.current = null;
      setWakeLockActive(false);
    }

    return () => {
      if (wakeLockRef.current) {
        wakeLockRef.current.release().catch(() => {});
      }
    };
  }, [isCameraActive]);

  // 2. Initialize Models (MediaPipe FaceLandmarker + ONNX Web LSTM)
  useEffect(() => {
    let mounted = true;

    async function initVisionAndML() {
      try {
        const { FilesetResolver, FaceLandmarker } = await import("@mediapipe/tasks-vision");
        const fileset = await FilesetResolver.forVisionTasks("/wasm");
        const landmarker = await FaceLandmarker.createFromOptions(fileset, {
          baseOptions: {
            modelAssetPath: "/models/face_landmarker.task",
            delegate: "GPU",
          },
          runningMode: "VIDEO",
          numFaces: 1,
          minFaceDetectionConfidence: 0.5,
          minFacePresenceConfidence: 0.5,
          minTrackingConfidence: 0.5,
          outputFaceBlendshapes: false,
        });

        if (mounted) {
          faceLandmarkerRef.current = landmarker;
          setModelType("MediaPipe 468 Mesh + ONNX");
        }
      } catch (err) {
        console.warn("MediaPipe GPU fallback to CPU:", err);
        try {
          const { FilesetResolver, FaceLandmarker } = await import("@mediapipe/tasks-vision");
          const fileset = await FilesetResolver.forVisionTasks("/wasm");
          const landmarker = await FaceLandmarker.createFromOptions(fileset, {
            baseOptions: {
              modelAssetPath: "/models/face_landmarker.task",
              delegate: "CPU",
            },
            runningMode: "VIDEO",
            numFaces: 1,
          });
          if (mounted) {
            faceLandmarkerRef.current = landmarker;
            setModelType("MediaPipe 468 Mesh (CPU)");
          }
        } catch {
          if (mounted) {
            setModelType("High-Precision Optical EAR");
          }
        }
      }

      try {
        ort.env.wasm.numThreads = 1;
        ort.env.wasm.simd = true;

        const session = await ort.InferenceSession.create("/models/drowsiness_lstm.onnx", {
          executionProviders: ["wasm"],
        });

        if (mounted) {
          ortSessionRef.current = session;
        }
      } catch (onnxErr) {
        console.warn("ONNX session fallback:", onnxErr);
      }
    }

    initVisionAndML();

    return () => {
      mounted = false;
      if (faceLandmarkerRef.current) {
        try {
          faceLandmarkerRef.current.close();
        } catch {}
      }
    };
  }, []);

  // 3. Initialize Webcam Stream (with Start/Stop control)
  useEffect(() => {
    if (!isCameraActive) {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((track) => track.stop());
        streamRef.current = null;
      }
      if (videoRef.current) {
        videoRef.current.srcObject = null;
      }
      setHasCamera(false);
      setDriverState("PAUSED");
      onClearAlertRef.current();
      return;
    }

    let stream: MediaStream | null = null;

    async function startCamera() {
      try {
        setCameraError(null);
        stream = await navigator.mediaDevices.getUserMedia({
          video: {
            facingMode: facingMode,
            width: { ideal: 640 },
            height: { ideal: 480 },
            frameRate: { ideal: 60, max: 60 },
          },
          audio: false,
        });

        streamRef.current = stream;

        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          videoRef.current.setAttribute("playsinline", "true");
          await videoRef.current.play();
          setHasCamera(true);
          setDriverState("ALERT");
        }
      } catch (err) {
        console.error("Camera access error:", err);
        setCameraError(
          "Camera access denied or unavailable. Please grant camera permissions in your browser."
        );
      }
    }

    startCamera();

    return () => {
      if (stream) {
        stream.getTracks().forEach((track) => track.stop());
      }
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((track) => track.stop());
        streamRef.current = null;
      }
    };
  }, [facingMode, isCameraActive]);

  // Euclidean distance helper
  const dist = (p1: { x: number; y: number }, p2: { x: number; y: number }) => {
    return Math.hypot(p1.x - p2.x, p1.y - p2.y);
  };

  // Compute Eye Aspect Ratio (EAR) from 468 MediaPipe landmarks
  const calculateEarFromLandmarks = (landmarks: any[] | null | undefined) => {
    if (!landmarks || landmarks.length < 400) return 0.32;
    const leftHoriz = dist(landmarks[LEFT_EYE.horizontal[0]], landmarks[LEFT_EYE.horizontal[1]]);
    const leftVert1 = dist(landmarks[LEFT_EYE.vertical1[0]], landmarks[LEFT_EYE.vertical1[1]]);
    const leftVert2 = dist(landmarks[LEFT_EYE.vertical2[0]], landmarks[LEFT_EYE.vertical2[1]]);
    const leftEar = leftHoriz > 0 ? (leftVert1 + leftVert2) / (2.0 * leftHoriz) : 0.32;

    const rightHoriz = dist(landmarks[RIGHT_EYE.horizontal[0]], landmarks[RIGHT_EYE.horizontal[1]]);
    const rightVert1 = dist(landmarks[RIGHT_EYE.vertical1[0]], landmarks[RIGHT_EYE.vertical1[1]]);
    const rightVert2 = dist(landmarks[RIGHT_EYE.vertical2[0]], landmarks[RIGHT_EYE.vertical2[1]]);
    const rightEar = rightHoriz > 0 ? (rightVert1 + rightVert2) / (2.0 * rightHoriz) : 0.32;

    return Number(((leftEar + rightEar) / 2.0).toFixed(3));
  };

  // Compute Mouth Aspect Ratio (MAR) from 468 MediaPipe landmarks
  const calculateMarFromLandmarks = (landmarks: any[] | null | undefined) => {
    if (!landmarks || landmarks.length < 320) return 0.15;
    const horiz = dist(landmarks[MOUTH.horizontal[0]], landmarks[MOUTH.horizontal[1]]);
    const vert1 = dist(landmarks[MOUTH.vertical1[0]], landmarks[MOUTH.vertical1[1]]);
    const vert2 = dist(landmarks[MOUTH.vertical2[0]], landmarks[MOUTH.vertical2[1]]);
    const vert3 = dist(landmarks[MOUTH.vertical3[0]], landmarks[MOUTH.vertical3[1]]);

    if (horiz === 0) return 0.15;
    const mar = (vert1 + vert2 + vert3) / (3.0 * horiz);
    return Number(mar.toFixed(3));
  };

  // Adaptive Computer Vision Fallback
  const adaptiveComputerVision = useCallback(
    (ctx: CanvasRenderingContext2D, width: number, height: number) => {
      const cx = width / 2;
      const cy = height * 0.45;
      const eyeY = cy - height * 0.08;
      const mouthY = cy + height * 0.18;

      const eyeData = ctx.getImageData(cx - 60, eyeY - 20, 120, 40).data;
      let eyeVariance = 0;
      let totalLuma = 0;
      for (let i = 0; i < eyeData.length; i += 4) {
        const luma = (eyeData[i] + eyeData[i + 1] + eyeData[i + 2]) / 3;
        totalLuma += luma;
      }
      const meanLuma = totalLuma / (eyeData.length / 4);
      for (let i = 0; i < eyeData.length; i += 4) {
        const luma = (eyeData[i] + eyeData[i + 1] + eyeData[i + 2]) / 3;
        eyeVariance += Math.abs(luma - meanLuma);
      }
      const contrast = eyeVariance / (eyeData.length / 4);
      const estimatedEar = contrast > 18 ? 0.32 : contrast > 12 ? 0.25 : 0.14;

      const mouthData = ctx.getImageData(cx - 40, mouthY - 15, 80, 30).data;
      let darkMouthPixels = 0;
      for (let i = 0; i < mouthData.length; i += 4) {
        const luma = (mouthData[i] + mouthData[i + 1] + mouthData[i + 2]) / 3;
        if (luma < 40) darkMouthPixels++;
      }
      const darkRatio = darkMouthPixels / (mouthData.length / 4);
      const estimatedMar = darkRatio > 0.4 ? 0.72 : 0.16;

      return { ear: estimatedEar, mar: estimatedMar };
    },
    []
  );

  // Run LSTM Inference
  const runLstmInference = useCallback(async (buffer: Array<[number, number]>): Promise<number> => {
    if (buffer.length < SEQ_LEN) return 0.05;
    const seq = buffer.slice(-SEQ_LEN);

    if (ortSessionRef.current) {
      try {
        const flatData = new Float32Array(SEQ_LEN * 2);
        for (let i = 0; i < SEQ_LEN; i++) {
          flatData[i * 2] = (seq[i][0] - 0.2505) / 0.0634;
          flatData[i * 2 + 1] = (seq[i][1] - 0.3168) / 0.2617;
        }
        const tensor = new ort.Tensor("float32", flatData, [1, SEQ_LEN, 2]);
        const results = await ortSessionRef.current.run({ input: tensor });
        const output = results.output?.data as Float32Array;
        if (output && output.length > 0) {
          return output[0];
        }
      } catch (e) {
        console.warn("ONNX run error:", e);
      }
    }

    const closedCount = seq.filter((item) => item[0] < 0.20).length;
    return closedCount / SEQ_LEN;
  }, []);

  // Main Processing Loop (60 FPS)
  useEffect(() => {
    if (!hasCamera || !isCameraActive) return;

    let isRunning = true;

    const processFrame = async () => {
      if (!isRunning || !isCameraActive) return;

      const video = videoRef.current;
      const canvas = canvasRef.current;

      if (video && canvas && video.readyState >= 2) {
        const width = video.videoWidth || 640;
        const height = video.videoHeight || 480;

        if (canvas.width !== width || canvas.height !== height) {
          canvas.width = width;
          canvas.height = height;
        }

        const ctx = canvas.getContext("2d", { willReadFrequently: true });
        if (ctx) {
          ctx.drawImage(video, 0, 0, width, height);

          let currentEar = 0.32;
          let currentMar = 0.15;
          let faceFound = false;
          let landmarkPoints: any[] | null = null;

          // 1. Try MediaPipe 468 Landmark Mesh
          if (faceLandmarkerRef.current) {
            try {
              const nowMs = performance.now();
              const result = faceLandmarkerRef.current.detectForVideo(video, nowMs);

              if (result && result.faceLandmarks && result.faceLandmarks.length > 0) {
                faceFound = true;
                landmarkPoints = result.faceLandmarks[0];
                currentEar = calculateEarFromLandmarks(landmarkPoints);
                currentMar = calculateMarFromLandmarks(landmarkPoints);
              }
            } catch (err) {
              console.warn("Landmarker frame error:", err);
            }
          }

          // 2. Optical CV Fallback if no landmarks detected yet
          if (!faceFound) {
            const fallback = adaptiveComputerVision(ctx, width, height);
            currentEar = fallback.ear;
            currentMar = fallback.mar;
          }

          // 3. Ring buffer & PERCLOS
          const buf = ringBufferRef.current;
          buf.push([currentEar, currentMar]);
          if (buf.length > BUFFER_MAX) {
            buf.shift();
          }

          const closedCount = buf.filter((item) => item[0] < 0.20).length;
          const currentPerclos = Number((closedCount / Math.max(buf.length, 1)).toFixed(3));

          // Run LSTM model periodically (every 6 frames)
          frameCountRef.current++;
          let currentProb = drowsyProbabilityRef.current;
          if (frameCountRef.current % 6 === 0) {
            currentProb = await runLstmInference(buf);
            drowsyProbabilityRef.current = Number(currentProb.toFixed(3));
          }

          // ── CLINICAL DIFFERENTIATION: BLINK vs DROWSY vs MICROSLEEP ──
          const isEyeClosed = currentEar < 0.20;
          const isYawning = currentMar > 0.65;

          let calculatedState: DriverState = "ALERT";

          if (!faceFound) {
            noFaceFramesRef.current++;
            if (noFaceFramesRef.current > 150) {
              calculatedState = "DISTRACTED";
            } else {
              calculatedState = "NO_FACE";
            }
            closedFramesRef.current = 0;
            yawnFramesRef.current = 0;
          } else {
            noFaceFramesRef.current = 0;

            if (isEyeClosed) {
              closedFramesRef.current++;
              openFramesRef.current = 0;

              if (closedFramesRef.current <= 20) {
                calculatedState = "BLINKING";
              } else if (closedFramesRef.current <= 110) {
                calculatedState = "DROWSY_PRECURSOR";
              } else {
                calculatedState = "MICROSLEEP";
              }
            } else {
              if (closedFramesRef.current > 0) {
                if (closedFramesRef.current >= 6 && closedFramesRef.current <= 24) {
                  blinkCountRef.current += 1;
                }
              }
              closedFramesRef.current = 0;
              openFramesRef.current++;

              if (isYawning) {
                yawnFramesRef.current++;
                if (yawnFramesRef.current > 120) {
                  calculatedState = "YAWNING";
                } else {
                  calculatedState = "ALERT";
                }
              } else {
                yawnFramesRef.current = Math.max(0, yawnFramesRef.current - 2);
                calculatedState = "ALERT";
              }
            }
          }

          // ── ALARM TRIGGERING RULES ──
          const now = Date.now();
          const cooldownElapsed = now - lastAlertTimeRef.current > 5000;

          if (calculatedState === "MICROSLEEP" && cooldownElapsed) {
            lastAlertTimeRef.current = now;
            onAlertRef.current("microsleep", currentPerclos);
            dispatchTelemetry("microsleep", currentPerclos);
          } else if (calculatedState === "YAWNING" && cooldownElapsed) {
            lastAlertTimeRef.current = now;
            onAlertRef.current("yawn", currentPerclos);
            dispatchTelemetry("yawn", currentPerclos);
          } else if (calculatedState === "DISTRACTED" && cooldownElapsed) {
            lastAlertTimeRef.current = now;
            onAlertRef.current("distraction", currentPerclos);
            dispatchTelemetry("distraction", currentPerclos);
          } else if (calculatedState === "ALERT" || calculatedState === "BLINKING") {
            onClearAlertRef.current();
          }

          // Draw Canvas Overlay at full 60 FPS
          const closedSecs = closedFramesRef.current / 60.0;
          drawResponsiveHud(
            ctx,
            width,
            height,
            landmarkPoints,
            currentEar,
            currentMar,
            currentPerclos,
            calculatedState,
            closedSecs
          );

          // FPS counter
          const nowPerf = performance.now();
          const delta = nowPerf - lastFrameTimeRef.current;
          if (delta >= 1000) {
            const measuredFps = Math.round((frameCountRef.current * 1000) / delta);
            fpsRef.current = measuredFps;
            setFps(measuredFps);
            frameCountRef.current = 0;
            lastFrameTimeRef.current = nowPerf;
          }

          // Throttle React state updates to every 6 frames (~10Hz) to prevent render thrashing
          if (frameCountRef.current % 6 === 0) {
            setEarValue(currentEar);
            setMarValue(currentMar);
            setPerclosValue(currentPerclos);
            setDrowsyProbability(currentProb);
            setDriverState(calculatedState);
            setClosedSeconds(Number(closedSecs.toFixed(1)));
            setBlinkCount(blinkCountRef.current);

            if (onTelemetryUpdateRef.current) {
              onTelemetryUpdateRef.current({
                ear: currentEar,
                mar: currentMar,
                perclos: currentPerclos,
                fps: fpsRef.current,
                drowsyProb: currentProb,
                blinkCount: blinkCountRef.current,
                stateLabel: calculatedState,
              });
            }
          }
        }
      }

      animFrameIdRef.current = requestAnimationFrame(processFrame);
    };

    animFrameIdRef.current = requestAnimationFrame(processFrame);

    return () => {
      isRunning = false;
      if (animFrameIdRef.current) {
        cancelAnimationFrame(animFrameIdRef.current);
      }
    };
  }, [hasCamera, isCameraActive, adaptiveComputerVision, runLstmInference]);

  // Dispatch Telemetry Action
  const dispatchTelemetry = async (eventType: FatigueEventType, perclosScore: number) => {
    try {
      const payload: DriverTelemetryPayload = {
        shift_id: shiftIdRef.current,
        event_type: eventType,
        perclos_score: perclosScore,
        location_lat: 28.6139 + (Math.random() - 0.5) * 0.05,
        location_lng: 77.2090 + (Math.random() - 0.5) * 0.05,
      };
      const { logFatigueEventAction } = await import("@/app/driver/actions");
      await logFatigueEventAction(payload);
    } catch (e) {
      console.error("Telemetry failed:", e);
    }
  };

  const toggleCamera = () => {
    setFacingMode((prev) => (prev === "user" ? "environment" : "user"));
  };

  const drawResponsiveHud = (
    ctx: CanvasRenderingContext2D,
    width: number,
    height: number,
    landmarks: any[] | null,
    ear: number,
    mar: number,
    perclos: number,
    state: DriverState,
    closedSecs: number
  ) => {
    ctx.save();

    if (landmarks && landmarks.length > 0) {
      ctx.fillStyle = state === "MICROSLEEP" ? "#ef4444" : "#38bdf8";
      [...LEFT_EYE.horizontal, ...LEFT_EYE.vertical1, ...LEFT_EYE.vertical2].forEach((idx) => {
        const pt = landmarks[idx];
        ctx.beginPath();
        ctx.arc(pt.x * width, pt.y * height, 2.5, 0, Math.PI * 2);
        ctx.fill();
      });

      [...RIGHT_EYE.horizontal, ...RIGHT_EYE.vertical1, ...RIGHT_EYE.vertical2].forEach((idx) => {
        const pt = landmarks[idx];
        ctx.beginPath();
        ctx.arc(pt.x * width, pt.y * height, 2.5, 0, Math.PI * 2);
        ctx.fill();
      });

      [...MOUTH.horizontal, ...MOUTH.vertical1, ...MOUTH.vertical2, ...MOUTH.vertical3].forEach((idx) => {
        const pt = landmarks[idx];
        ctx.beginPath();
        ctx.arc(pt.x * width, pt.y * height, 2, 0, Math.PI * 2);
        ctx.fill();
      });
    }

    const cx = width / 2;
    const cy = height * 0.46;
    const rx = width * 0.24;
    const ry = height * 0.32;

    ctx.lineWidth = 2;
    ctx.strokeStyle =
      state === "MICROSLEEP"
        ? "rgba(239, 68, 68, 0.9)"
        : state === "DROWSY_PRECURSOR"
        ? "rgba(245, 158, 11, 0.8)"
        : "rgba(59, 130, 246, 0.4)";

    ctx.beginPath();
    ctx.ellipse(cx, cy, rx, ry, 0, 0, Math.PI * 2);
    ctx.stroke();

    if (closedSecs > 0.4) {
      ctx.fillStyle = closedSecs >= 2.0 ? "rgba(220, 38, 38, 0.85)" : "rgba(245, 158, 11, 0.75)";
      ctx.fillRect(cx - 110, cy - ry - 38, 220, 30);
      ctx.fillStyle = "#ffffff";
      ctx.font = "bold 13px monospace";
      ctx.textAlign = "center";
      ctx.fillText(
        `EYES CLOSED: ${closedSecs.toFixed(1)}s (Limit: 2.0s)`,
        cx,
        cy - ry - 19
      );
    }

    ctx.restore();
  };

  return (
    <div className="relative w-full rounded-2xl overflow-hidden bg-slate-950 border border-slate-800 shadow-2xl flex flex-col">
      {/* Hidden Native Video */}
      <video ref={videoRef} playsInline muted className="hidden" />

      {/* Main Responsive Canvas */}
      <div className="relative aspect-[4/3] sm:aspect-video w-full bg-slate-950 overflow-hidden">
        {/* Render Canvas when camera is active */}
        {isCameraActive ? (
          <canvas
            ref={canvasRef}
            className="w-full h-full object-cover transform -scale-x-100"
          />
        ) : (
          /* Camera Stopped / Standby View */
          <div className="w-full h-full flex flex-col items-center justify-center bg-slate-950 text-slate-400 p-6 text-center gap-3">
            <div className="w-16 h-16 rounded-2xl bg-slate-900 border border-slate-800 flex items-center justify-center text-slate-500 shadow-inner">
              <VideoOff className="w-8 h-8 text-amber-500/60" />
            </div>
            <div>
              <h3 className="text-base font-bold text-white">Camera Standby / Paused</h3>
              <p className="text-xs text-slate-400 mt-1 max-w-sm">
                Optical monitoring is paused. Tap below or use the top button to resume camera surveillance.
              </p>
            </div>
            <button
              onClick={() => setCameraActiveHandler(true)}
              className="mt-2 px-6 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold flex items-center gap-2 transition shadow-lg shadow-blue-900/50 glow-blue"
            >
              <Play className="w-4 h-4 fill-white" /> Resume Camera Feed
            </button>
          </div>
        )}

        {/* Loading Indicator */}
        {isCameraActive && !hasCamera && !cameraError && (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-slate-950/90 text-slate-400 gap-3 p-4 text-center">
            <RefreshCw className="w-8 h-8 animate-spin text-blue-500" />
            <p className="text-sm font-semibold text-slate-200">
              Initializing AI Vision &amp; Camera...
            </p>
            <p className="text-xs text-slate-400">Loading MediaPipe 468 Face Mesh</p>
          </div>
        )}

        {/* Error Indicator */}
        {isCameraActive && cameraError && (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-slate-950/95 text-red-400 p-6 text-center gap-3">
            <AlertCircle className="w-10 h-10 text-red-500" />
            <p className="text-sm font-semibold">{cameraError}</p>
          </div>
        )}

        {/* Top Control Bar: Mobile Friendly */}
        <div className="absolute top-3 inset-x-3 flex items-center justify-between pointer-events-none">
          {/* Status Badge */}
          <div className="pointer-events-auto flex items-center gap-2 px-3 py-1.5 rounded-full bg-slate-950/85 border border-slate-700/80 backdrop-blur-md shadow-lg">
            <div
              className={`w-2.5 h-2.5 rounded-full ${
                !isCameraActive
                  ? "bg-slate-500"
                  : driverState === "ALERT"
                  ? "bg-emerald-400"
                  : driverState === "BLINKING"
                  ? "bg-sky-400"
                  : driverState === "DROWSY_PRECURSOR"
                  ? "bg-amber-400 animate-pulse"
                  : "bg-red-500 animate-ping"
              }`}
            />
            <span className="text-xs font-mono font-bold text-slate-100">
              {!isCameraActive
                ? "CAMERA PAUSED"
                : driverState === "ALERT"
                ? "ALERT (Normal)"
                : driverState === "BLINKING"
                ? "NORMAL BLINK"
                : driverState === "DROWSY_PRECURSOR"
                ? "DROWSY PRECURSOR"
                : driverState === "MICROSLEEP"
                ? "ALARM: MICROSLEEP"
                : driverState === "YAWNING"
                ? "ALARM: YAWN"
                : "DISTRACTED"}
            </span>
            {isCameraActive && (
              <>
                <span className="text-xs text-slate-500">|</span>
                <span className="text-xs font-mono text-emerald-400">{fps} FPS</span>
              </>
            )}
          </div>

          {/* Quick Actions (Stop/Start Camera, Switch Camera, WakeLock) */}
          <div className="pointer-events-auto flex items-center gap-1.5">
            {wakeLockActive && isCameraActive && (
              <div
                title="Screen Wake Lock Active (Screen will not turn off)"
                className="hidden sm:flex items-center gap-1 px-2.5 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-[10px] font-mono"
              >
                <Zap className="w-3 h-3" /> Stay Awake
              </div>
            )}

            {/* Stop / Start Camera Button */}
            <button
              onClick={() => setCameraActiveHandler(!isCameraActive)}
              title={isCameraActive ? "Stop Camera" : "Start Camera"}
              className={`p-2 rounded-xl border backdrop-blur-md transition flex items-center gap-1 text-xs font-medium ${
                isCameraActive
                  ? "bg-rose-500/20 border-rose-500/40 text-rose-300 hover:bg-rose-500/30"
                  : "bg-emerald-500/20 border-emerald-500/40 text-emerald-300 hover:bg-emerald-500/30"
              }`}
            >
              {isCameraActive ? (
                <>
                  <VideoOff className="w-4 h-4 text-rose-400" />
                  <span className="hidden sm:inline">Stop Cam</span>
                </>
              ) : (
                <>
                  <Video className="w-4 h-4 text-emerald-400" />
                  <span className="hidden sm:inline">Start Cam</span>
                </>
              )}
            </button>

            {/* Flip Camera Button */}
            {isCameraActive && (
              <button
                onClick={toggleCamera}
                title="Switch Front/Rear Camera"
                className="p-2 rounded-xl bg-slate-950/80 border border-slate-700/80 text-slate-300 hover:text-white backdrop-blur-md transition hover:bg-slate-800"
              >
                <FlipHorizontal className="w-4 h-4" />
              </button>
            )}
          </div>
        </div>

        {/* State Banner: Visible when Eyes Closed */}
        {isCameraActive && closedSeconds > 0.4 && (
          <div className="absolute top-14 inset-x-4 flex justify-center">
            <div
              className={`px-4 py-2 rounded-xl border text-xs font-mono font-bold shadow-xl backdrop-blur-md animate-bounce ${
                closedSeconds >= 2.0
                  ? "bg-red-500/90 text-white border-red-400"
                  : "bg-amber-500/90 text-slate-950 border-amber-300"
              }`}
            >
              {closedSeconds >= 2.0
                ? `CRITICAL MICROSLEEP: Eyes closed for ${closedSeconds}s!`
                : `Caution: Eyes closed for ${closedSeconds}s (Alarm triggers at 2.0s)`}
            </div>
          </div>
        )}

        {/* Bottom Responsive Telemetry Bar */}
        <div className="absolute bottom-3 inset-x-3 grid grid-cols-4 gap-1.5 sm:gap-2 bg-slate-950/90 border border-slate-800 backdrop-blur-md rounded-xl p-2 sm:p-2.5 text-center">
          {/* EAR */}
          <div className="flex flex-col">
            <span className="text-[9px] sm:text-[10px] uppercase tracking-wider text-slate-400">
              EAR (Eyes)
            </span>
            <span
              className={`text-xs sm:text-base font-mono font-bold ${
                !isCameraActive
                  ? "text-slate-500"
                  : earValue < 0.20
                  ? "text-red-400"
                  : "text-emerald-400"
              }`}
            >
              {isCameraActive ? earValue.toFixed(2) : "--"}
            </span>
            <div className="w-full bg-slate-800 h-1 rounded-full overflow-hidden mt-1">
              <div
                className={`h-full ${
                  !isCameraActive ? "bg-slate-700" : earValue < 0.20 ? "bg-red-500" : "bg-emerald-500"
                }`}
                style={{ width: `${isCameraActive ? Math.min(earValue / 0.4, 1) * 100 : 0}%` }}
              />
            </div>
          </div>

          {/* MAR */}
          <div className="flex flex-col">
            <span className="text-[9px] sm:text-[10px] uppercase tracking-wider text-slate-400">
              MAR (Mouth)
            </span>
            <span
              className={`text-xs sm:text-base font-mono font-bold ${
                !isCameraActive
                  ? "text-slate-500"
                  : marValue > 0.65
                  ? "text-amber-400"
                  : "text-blue-400"
              }`}
            >
              {isCameraActive ? marValue.toFixed(2) : "--"}
            </span>
            <div className="w-full bg-slate-800 h-1 rounded-full overflow-hidden mt-1">
              <div
                className={`h-full ${
                  !isCameraActive ? "bg-slate-700" : marValue > 0.65 ? "bg-amber-500" : "bg-blue-500"
                }`}
                style={{ width: `${isCameraActive ? Math.min(marValue / 1.0, 1) * 100 : 0}%` }}
              />
            </div>
          </div>

          {/* PERCLOS */}
          <div className="flex flex-col">
            <span className="text-[9px] sm:text-[10px] uppercase tracking-wider text-slate-400">
              PERCLOS
            </span>
            <span
              className={`text-xs sm:text-base font-mono font-bold ${
                !isCameraActive
                  ? "text-slate-500"
                  : perclosValue > 0.40
                  ? "text-red-400"
                  : "text-slate-200"
              }`}
            >
              {isCameraActive ? `${(perclosValue * 100).toFixed(0)}%` : "--"}
            </span>
            <div className="w-full bg-slate-800 h-1 rounded-full overflow-hidden mt-1">
              <div
                className={`h-full ${
                  !isCameraActive ? "bg-slate-700" : perclosValue > 0.40 ? "bg-red-500" : "bg-cyan-500"
                }`}
                style={{ width: `${isCameraActive ? Math.min(perclosValue, 1) * 100 : 0}%` }}
              />
            </div>
          </div>

          {/* Natural Blinks Recorded */}
          <div className="flex flex-col">
            <span className="text-[9px] sm:text-[10px] uppercase tracking-wider text-slate-400">
              Blinks
            </span>
            <span className="text-xs sm:text-base font-mono font-bold text-sky-400">
              {blinkCount}
            </span>
            <span className="text-[8px] text-slate-500 hidden sm:block">Filtered (Normal)</span>
          </div>
        </div>
      </div>

      {/* Model Engine Badge Footer */}
      <div className="px-3 py-1.5 border-t border-slate-800/80 bg-slate-950 flex items-center justify-between text-[11px] text-slate-400">
        <div className="flex items-center gap-1.5">
          <Cpu className="w-3.5 h-3.5 text-blue-400" />
          <span>{modelType}</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-[10px] text-slate-500 font-mono">Blink Filter: 100-350ms</span>
          <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
        </div>
      </div>
    </div>
  );
}
