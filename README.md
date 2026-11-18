# 🛡️ DrowsiGuard — Real-Time Driver Fatigue Monitoring Platform

[![Next.js](https://img.shields.io/badge/Next.js-16.4.2-black?logo=next.js)](https://nextjs.org/)
[![React](https://img.shields.io/badge/React-19-blue?logo=react)](https://react.dev/)
[![FastAPI](https://img.shields.io/badge/FastAPI-0.110+-009688?logo=fastapi)](https://fastapi.tiangolo.com/)
[![ONNX Runtime](https://img.shields.io/badge/ONNX_Runtime_Web-173KB-blueviolet?logo=onnx)](https://onnxruntime.ai/)
[![MediaPipe](https://img.shields.io/badge/MediaPipe-468_Landmarks-brightgreen?logo=google)](https://developers.google.com/mediapipe)

**DrowsiGuard** is an AI-powered driver fatigue detection platform that executes heavy computer vision and neural network inference directly inside the browser edge at sub-10ms latency. Real-time telemetry streams over Supabase WebSockets (<50ms) to a fleet management radar, supported by an asynchronous Python microservice for DOT compliance reports and risk scoring.

---

## 🏛️ System Architecture

```text
┌─────────────────────────────────────────────────────────────────────────────────┐
│                              CLIENT / EDGE DEVICE                               │
│                                                                                 │
│  [ HTML5 WebRTC Webcam Feed ] ──► [ MediaPipe Face Mesh (WASM) ]                 │
│                                           │ (Extracts 468 3D Landmarks)         │
│                                           ▼                                     │
│                                  [ Calculate EAR & MAR ]                        │
│                                           │ (Vector Array: 150 Frames / 5s)     │
│                                           ▼                                     │
│                                [ ONNX Runtime Web (LSTM) ]                      │
│                                           │                                     │
│                         ┌─────────────────┴─────────────────┐                   │
│                         │                                   │                   │
│                 (LOCAL ALERT)                     (TELEMETRY PAYLOAD)           │
│                         ▼                                   ▼                   │
│               [ Web Audio API Alarm ]             [ Next.js Server Action ]     │
│                     (<10ms)                                 │                   │
└─────────────────────────────────────────────────────────────┼───────────────────┘
                                                              │
                                                              │ HTTP / Serverless
                                                              ▼
┌─────────────────────────────────────────────────────────────────────────────────┐
│                                 BACKEND LAYER                                   │
│                                                                                 │
│       ┌───────────────────────────────────────────┐                             │
│       │          Next.js Server Actions           │                             │
│       │  - Authentication Verification (JWT)      │                             │
│       │  - Shift Start / Stop Handlers            │                             │
│       │  - Lightweight Telemetry Ingestion        │                             │
│       └─────────────────────┬─────────────────────┘                             │
│                             │                                                   │
│                             ├────────────────────────────────┐                  │
│                             ▼                                ▼                  │
│               ┌───────────────────────────┐    ┌───────────────────────────┐    │
│               │   Supabase (PostgreSQL)   │    │    FastAPI Microservice   │    │
│               │ - Row Level Security (RLS)│    │ - Async Analytics Engine  │    │
│               │ - Supabase Auth           │    │ - Risk Score Computation  │    │
│               │ - Supabase Realtime WS    │    │ - PDF Report Generator    │    │
│               └─────────────┬─────────────┘    └───────────────────────────┘    │
└─────────────────────────────┼───────────────────────────────────────────────────┘
                              │
                              │ WebSocket Stream (<50ms)
                              ▼
┌─────────────────────────────────────────────────────────────────────────────────┐
│                             FLEET MANAGER DASHBOARD                             │
│                                                                                 │
│               [ Live Map Pins + Alert Feed + Driver Safety Metrics ]            │
└─────────────────────────────────────────────────────────────────────────────────┘
```

---

## ✨ Features & Enhancements

### 1. 👁️ Intelligent Blink vs. Drowsiness vs. Yawn Differentiation
- **Natural Blink Filtering**: Eye blinks are rapid (100–300ms) physiological events. The system tracks closure duration and increments a clean blink counter without false alarms.
- **Micro-Sleep Detection**: Drowsiness alerts are ONLY triggered when Eye Aspect Ratio (EAR) falls below threshold for a sustained period (>1.5s), accurately capturing genuine micro-sleeps.
- **Yawn vs. Speech Detection**: Analyzes Mouth Aspect Ratio (MAR) across temporal rolling windows to distinguish natural speech from actual prolonged fatigue yawns.

### 2. 🎛️ Driver Controls
- **Stop / Resume Camera**: Easily pause or stop the camera stream anytime using the dedicated **Stop Cam** toggle.
- **Alert Volume Slider (0% - 100%)**: Smooth slider control with mute indicator (`VolumeX`), dynamic sound levels (`Volume1`, `Volume2`), and a **Test Sound** button.

### 3. 📱 Mobile, Tablet & Desktop Responsive
- Fluid, touch-friendly UI designed for vehicle mounts, dashboard tablets, smartphones, and large operation monitors.
- Full dark glassmorphism aesthetic with high contrast for night driving safety.

### 4. 🛰️ Fleet Manager Radar
- Live tactical radar showing vehicles, driver shift status, and immediate notification of safety incidents.
- Downloadable DOT compliance safety audit PDF reports generated by the Python analytics service.

---

## 📂 Project Directory Structure

```text
Drowzigaurd/
├── apps/
│   ├── web/                         # Next.js 16 Web Application (App Router, React 19)
│   │   ├── app/
│   │   │   ├── (auth)/              # Driver & Manager Login / Registration
│   │   │   ├── driver/              # Driver Cabin HUD (Camera + AI Vitals + Controls)
│   │   │   ├── manager/             # Fleet Manager Operations Dashboard
│   │   │   ├── api/analytics/       # Next.js Proxy Routes to Python Microservice
│   │   │   ├── layout.tsx           # Global App Layout with Theme & Shims
│   │   │   └── page.tsx             # Landing Page with Interactive Architecture
│   │   ├── components/
│   │   │   ├── WebcamMonitor.tsx    # MediaPipe Face Mesh + ONNX Web AI Vision
│   │   │   ├── AlertOverlay.tsx     # Web Audio API (<10ms) Alarm + Visual Strobe
│   │   │   └── FleetMap.tsx         # Tactical Fleet Radar Map
│   │   ├── public/
│   │   │   ├── env-shim.js          # Synchronous Global Runtime Shim
│   │   │   └── models/
│   │   │       ├── drowsiness_lstm.onnx # 173KB Quantized Edge Bi-LSTM Model
│   │   │       └── inference_metadata.json
│   │   └── README.md
│   │
│   └── analytics-service/           # FastAPI Asynchronous Microservice
│       ├── main.py                  # API Routes (Risk Scoring, Shift Audit, PDF)
│       ├── services/
│       │   ├── risk_calculator.py   # Multi-Factor Driver Risk Index
│       │   └── pdf_generator.py     # ReportLab DOT Compliance PDF Generator
│       ├── requirements.txt
│       └── README.md
│
├── ml-pipeline/                     # Machine Learning Training Pipeline
│   ├── extract_features.py          # MediaPipe 468 Landmark Geometric Extractor
│   ├── train_lstm.py                # PyTorch Bidirectional LSTM Trainer (92.4% Val Acc)
│   ├── export_onnx.py               # ONNX Runtime Int8 Quantizer (173 KB Model)
│   ├── data/                        # Extracted EAR / MAR Features
│   ├── models/                      # Trained Weights & Evaluation Curves
│   ├── requirements.txt
│   └── README.md
│
├── supabase/
│   └── migrations/
│       └── 001_initial_schema.sql   # PostgreSQL Tables, RLS Policies & Realtime Pub
│
├── Drowziness-dataset/              # Raw Dataset (Train, Val, Test)
└── drowsiguard_system_architecture.md
```

---

## 🚀 How to Run the Entire Platform

### Step 1: Start the FastAPI Analytics Service (Port 8000)
```bash
cd apps/analytics-service
# Activate your python virtual environment
python -m uvicorn main:app --host 0.0.0.0 --port 8000 --reload
```
* API Docs: [http://localhost:8000/docs](http://localhost:8000/docs)
* Health: [http://localhost:8000/health](http://localhost:8000/health)

### Step 2: Start the Next.js Web Application (Port 3000)
```bash
cd apps/web
npm run dev
```
* Landing Page: [http://localhost:3000](http://localhost:3000)
* Driver Cabin: [http://localhost:3000/driver](http://localhost:3000/driver)
* Fleet Radar: [http://localhost:3000/manager](http://localhost:3000/manager)

---

## 🧪 Testing the Driver Safety System

1. Open **[http://localhost:3000/driver](http://localhost:3000/driver)**.
2. Grant webcam access. The AI Face Mesh initializes in ~1–2 seconds.
3. Observe real-time vitals:
   - **EAR (Eye Aspect Ratio)**: Normal open eyes ~0.28 – 0.35.
   - **MAR (Mouth Aspect Ratio)**: Normal mouth ~0.10 – 0.25.
   - **PERCLOS**: Percentage of eye closure over rolling window.
4. **Blink Detection**: Blink normally; notice the blink counter advances without setting off alarms.
5. **Drowsiness Alert**: Close eyes for >1.5s; hear the immediate audio alarm and see the red alert overlay.
6. **Adjust Sound**: Drag the volume slider to adjust alarm loudness or click **Test Sound**.
7. **Pause/Resume**: Click **Stop Cam** to freeze or halt monitoring.

---

## 📄 License & Safety Standard
Designed in compliance with DOT FMCSA Driver Fatigue Mitigation guidelines and aviation PERCLOS monitoring standards.
