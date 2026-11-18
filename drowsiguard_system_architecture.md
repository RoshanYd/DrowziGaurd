# DrowsiGuard — Real-Time Driver Fatigue Monitor
## System Architecture & Technical Specifications

---

## 1. System Topology & Architecture

DrowsiGuard isolates heavy computer vision inference to the browser while leveraging **Supabase** for persistence/real-time streaming, **Next.js Server Actions** for core application API handlers, and **FastAPI** for asynchronous statistical analytics and PDF report generation.

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
└───────────────────────────────────────────────────┬─────────────────────────────┘
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

## 2. Directory & Repository Structure

```text
drowsiguard/
├── apps/
│   ├── web/                         # Next.js 15 PWA Application
│   │   ├── app/
│   │   │   ├── (auth)/              # Login / Register pages
│   │   │   ├── driver/              # Driver Cabin View (Webcam + Edge ML)
│   │   │   │   ├── page.tsx
│   │   │   │   └── actions.ts       # Server Actions for Driver Telemetry
│   │   │   ├── manager/             # Fleet Manager Dashboard
│   │   │   │   ├── page.tsx
│   │   │   │   └── actions.ts       # Server Actions for Fleet Operations
│   │   │   └── api/
│   │   │       └── analytics/       # Proxy routes to FastAPI microservice
│   │   ├── components/
│   │   │   ├── WebcamMonitor.tsx    # MediaPipe + ONNX Web integration
│   │   │   ├── AlertOverlay.tsx     # Audio/Visual Fatigue Alarms
│   │   │   └── FleetMap.tsx         # Real-time WebSocket Map view
│   │   ├── public/
│   │   │   └── models/
│   │   │       └── drowsiness_lstm.onnx # Quantized Edge Model
│   │   └── lib/
│   │       └── supabase/            # Client & Server Supabase SDK wrappers
│   │
│   └── analytics-service/           # FastAPI Microservice (Python)
│       ├── main.py                  # FastAPI Entrypoint
│       ├── services/
│       │   ├── risk_calculator.py   # Statistical risk modeling
│       │   └── pdf_generator.py     # ReportLab PDF exporter
│       ├── requirements.txt
│       └── Dockerfile
│
├── ml-pipeline/                     # Offline Training Pipeline (Colab/Local)
│   ├── extract_features.py          # Convert CEW & YawDD to EAR/MAR CSV
│   ├── train_lstm.py                # PyTorch LSTM Model Training
│   └── export_onnx.py               # PyTorch -> ONNX Quantized Export
│
└── supabase/
    └── migrations/                  # PostgreSQL Schemas, Policies & Triggers
```

---

## 3. End-to-End System Workflow

### 1. Driver Session Initialization
1. Driver logs into the Next.js PWA using **Supabase Auth**.
2. Driver clicks **"Start Shift"**, triggering a Next.js Server Action (`startShiftAction`).
3. Next.js creates an active record in the `shifts` table in **Supabase**.
4. The driver cabin interface loads, initializes the local browser canvas, and fetches the lightweight `drowsiness_lstm.onnx` file (~1.2MB) into local memory.

### 2. Edge Inference Loop (Local Browser Execution)
```text
Frame Captured (30 FPS) ──► MediaPipe ──► Extract 468 Landmarks
                                               │
                                               ▼
                                 Calculate EAR & MAR Values
                                               │
                                               ▼
                              Push to 150-frame Rolling Ring Buffer
                                               │
                                               ▼
                          ONNX Runtime Web Executes LSTM Model (In-Browser)
                                               │
                   ┌───────────────────────────┴───────────────────────────┐
                   ▼                                                       ▼
        Prediction: ALERT (0)                                  Prediction: DROWSY (1)
                   │                                                       │
        Reset Alarm Counters                                     Execute Alarm Response
```

### 3. Alarm Execution & Telemetry Push
When the ONNX model identifies a fatigue event:
1. **Immediate Audio-Visual Response:** Web Audio API plays an intense sound alert. UI flashes red. (Latency: <10ms, No network dependency).
2. **Telemetry Dispatch:** The browser fires a non-blocking Next.js Server Action (`logFatigueEventAction`) with a minimal JSON payload.
3. **Database Persistence:** Next.js validates the JWT token and writes the event directly to Supabase's `fatigue_events` table using RLS.

### 4. Real-Time Manager Alerting
1. The PostgreSQL `INSERT` on `fatigue_events` triggers **Supabase Realtime**.
2. Supabase pushes a WebSocket event directly to active **Fleet Manager Dashboards**.
3. The dashboard highlights the affected vehicle on the map and raises an audio-visual notification flag.

### 5. Asynchronous Analytics & Reporting (FastAPI)
1. Next.js backend delegates complex processing to the **FastAPI Microservice**.
2. FastAPI connects to Supabase, executes Pandas pipelines to compute driver risk indices, and generates PDF compliance reports.

---

## 4. Data Schema & Contracts (PostgreSQL)

```sql
-- Enables UUID auto-generation
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 1. Profiles Table (Linked to Supabase Auth)
CREATE TABLE profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name TEXT NOT NULL,
  role TEXT CHECK (role IN ('driver', 'manager')) NOT NULL DEFAULT 'driver',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. Shifts Table
CREATE TABLE shifts (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  driver_id UUID REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  vehicle_plate TEXT NOT NULL,
  status TEXT CHECK (status IN ('active', 'completed')) DEFAULT 'active',
  start_time TIMESTAMPTZ DEFAULT NOW(),
  end_time TIMESTAMPTZ
);

-- 3. Fatigue Events Telemetry Table
CREATE TABLE fatigue_events (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  shift_id UUID REFERENCES shifts(id) ON DELETE CASCADE NOT NULL,
  driver_id UUID REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  event_type TEXT CHECK (event_type IN ('microsleep', 'yawn', 'distraction')) NOT NULL,
  perclos_score FLOAT NOT NULL,
  location_lat FLOAT,
  location_lng FLOAT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable Row-Level Security (RLS)
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE shifts ENABLE ROW LEVEL SECURITY;
ALTER TABLE fatigue_events ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Drivers insert own events" ON fatigue_events 
  FOR INSERT WITH CHECK (auth.uid() = driver_id);

CREATE POLICY "Managers read all fatigue events" ON fatigue_events 
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM profiles 
      WHERE profiles.id = auth.uid() AND profiles.role = 'manager'
    )
  );
```

---

## 5. Actionable Build Roadmap

### Phase 1: Machine Learning & Feature Extraction (Python)
* [ ] Write `extract_features.py` over YawDD & CEW datasets to convert video frames into `[EAR, MAR]` CSV sequences using MediaPipe.
* [ ] Train a PyTorch LSTM network on these numerical sequences.
* [ ] Export the trained model to `.onnx` and apply float16 or int8 quantization.

### Phase 2: Next.js + Supabase Foundation
* [ ] Set up Supabase project, execute migration scripts, and configure Auth.
* [ ] Build Next.js App Router layout with TailwindCSS.
* [ ] Implement Server Actions for auth, starting shifts, and logging fatigue telemetry.

### Phase 3: Client Edge Computer Vision
* [ ] Create `WebcamMonitor.tsx` using MediaPipe Face Mesh in React.
* [ ] Implement real-time EAR and MAR feature calculation inside a 150-frame ring buffer.
* [ ] Integrate `onnxruntime-web` to run inference over the ring buffer and trigger `AlertOverlay.tsx`.

### Phase 4: Manager Dashboard & FastAPI Analytics
* [ ] Implement Supabase Realtime subscriptions inside the Next.js Manager dashboard.
* [ ] Build the FastAPI microservice to ingest shift data and return cumulative risk summaries and PDF downloads.