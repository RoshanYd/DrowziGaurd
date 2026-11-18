# 🛡️ DrowsiGuard Web Application (Next.js 16 Edge AI)

The frontend client of **DrowsiGuard**, a mission-critical, real-time driver fatigue monitoring platform built with Next.js 16 (App Router), React 19, Tailwind CSS, MediaPipe Face Mesh, and ONNX Runtime Web.

---

## 🚀 Key Features

### 1. Driver Cabin (`/driver`)
- **Sub-10ms Edge AI Inference**: Computes facial landmarks directly in the browser via WebAssembly (WASM SIMD) with zero server latency.
- **Smart Blink vs. Micro-Sleep Filtering**:
  - Differentiates between normal rapid blinks (100–300ms) and micro-sleep / drowsiness episodes (>1.5s continuous closure).
  - Eliminates false positives when drivers naturally look or blink normally.
- **Yawn vs. Speaking Detection**: Evaluates Mouth Aspect Ratio (MAR) sustained across time window to catch real fatigue yawns while ignoring normal speech.
- **Camera Controls (Start / Stop)**: Allows drivers to pause or resume camera monitoring at any time.
- **Alert Volume Slider (0% - 100%)**:
  - Full volume adjustment with live preview sound test.
  - Quick mute toggle (`VolumeX`) and level indicators (`Volume1`, `Volume2`).
- **Responsive Cross-Device Layout**: Fully optimized and tested for mobile devices, tablets, in-cabin touchscreens, and desktop displays.
- **Gold-Standard Vitals**: Real-time HUD displaying EAR (Eye Aspect Ratio), MAR (Mouth Aspect Ratio), PERCLOS (% Eye Closure), and rolling blink counter.

### 2. Fleet Manager Radar (`/manager`)
- **Live Fleet Tracking**: Displays active vehicles on interactive tactical radar map.
- **Incident Stream**: Real-time event log streaming micro-sleeps, yawning events, and fatigue risk escalations via Supabase WebSockets.
- **Compliance Audit & PDF Export**: Directly requests DOT-compliant driver safety reports generated on-the-fly by the FastAPI analytics microservice.

### 3. Authentication & Security
- **Supabase Auth**: Dedicated driver and manager sign-in/registration flows.
- **Row-Level Security (RLS)**: Enforces driver data privacy at the PostgreSQL engine level.
- **Seamless Local Demo Fallback**: Functions cleanly even without external database credentials configured.

---

## 🛠️ Technology Stack

| Layer | Technology |
|---|---|
| **Framework** | Next.js 16.4.2 (App Router) |
| **UI Library** | React 19 + Tailwind CSS |
| **Vision AI** | MediaPipe Face Mesh (468 3D Landmarks via WASM) |
| **Neural Inference** | ONNX Runtime Web (`onnxruntime-web`) |
| **Audio Alert** | Web Audio API (Piercing synthesized alarm `<10ms`) |
| **Realtime Sync** | Supabase Realtime WebSockets |

---

## 📦 Getting Started

### Prerequisites
- Node.js 18+ or 20+
- npm or pnpm

### Installation
```bash
cd apps/web
npm install
```

### Environment Variables
Copy `.env.local.example` to `.env.local`:
```bash
cp .env.local.example .env.local
```

Configured keys in `.env.local`:
```env
NEXT_PUBLIC_SUPABASE_URL=https://your-supabase-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-supabase-anon-key
NEXT_PUBLIC_ANALYTICS_URL=http://localhost:8000
```
*(Note: If Supabase keys are left as demo placeholders, the app gracefully operates in Local Demo Mode).*

### Running Locally
```bash
npm run dev
```

Visit:
- **Landing Page**: [http://localhost:3000](http://localhost:3000)
- **Driver Cabin**: [http://localhost:3000/driver](http://localhost:3000/driver)
- **Fleet Manager Dashboard**: [http://localhost:3000/manager](http://localhost:3000/manager)
- **Authentication**: [http://localhost:3000/login](http://localhost:3000/login)

---

## 🧪 Testing Edge Detection in the Driver Cabin

1. Navigate to `/driver`.
2. Allow webcam permissions when prompted by your browser.
3. Observe the **EAR (Eye Aspect Ratio)** and **MAR (Mouth Aspect Ratio)** meters react dynamically to facial movement.
4. **Blink Test**: Blink naturally; notice the blink counter increments while NO alert is triggered.
5. **Drowsiness Test**: Close eyes for >1.5 seconds; notice the high-frequency piercing Web Audio alarm and red cabin overlay flash.
6. **Volume Test**: Adjust the volume slider or click **Test Sound** to verify comfortable hearing levels.
7. **Stop Camera Test**: Click **Stop Cam** to halt the camera stream and pause tracking.
