import Link from "next/link";

// Clean inline SVGs to avoid React 19 / Turbopack barrel import dispatcher mismatches
function ShieldIcon({ className = "w-5 h-5" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
    </svg>
  );
}

function EyeIcon({ className = "w-4 h-4" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  );
}

function TruckIcon({ className = "w-4 h-4" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M14 18V6a2 2 0 0 0-2-2H4a2 2 0 0 0-2 2v11a1 1 0 0 0 1 1h2" />
      <path d="M15 18H9" />
      <path d="M19 18h2a1 1 0 0 0 1-1v-3.65a1 1 0 0 0-.22-.624l-3.48-4.35A1 1 0 0 0 17.52 8H14" />
      <circle cx="17" cy="18" r="2" />
      <circle cx="7" cy="18" r="2" />
    </svg>
  );
}

function ArrowRightIcon({ className = "w-4 h-4" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M5 12h14" />
      <path d="m12 5 7 7-7 7" />
    </svg>
  );
}

function ZapIcon({ className = "w-3 h-3" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" />
    </svg>
  );
}

function CpuIcon({ className = "w-3 h-3" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect width="16" height="16" x="4" y="4" rx="2" />
      <rect width="6" height="6" x="9" y="9" rx="1" />
      <path d="M15 2v2" />
      <path d="M15 20v2" />
      <path d="M2 15h2" />
      <path d="M2 9h2" />
      <path d="M20 15h2" />
      <path d="M20 9h2" />
      <path d="M9 2v2" />
      <path d="M9 20v2" />
    </svg>
  );
}

function RadioIcon({ className = "w-3 h-3" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="2" />
      <path d="M16.24 7.76a6 6 0 0 1 0 8.49m-8.48-.01a6 6 0 0 1 0-8.49m11.31-2.82a10 10 0 0 1 0 14.14m-14.14 0a10 10 0 0 1 0-14.14" />
    </svg>
  );
}

function FileTextIcon({ className = "w-8 h-8" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7Z" />
      <path d="M14 2v4a2 2 0 0 0 2 2h4" />
      <path d="M10 9H8" />
      <path d="M16 13H8" />
      <path d="M16 17H8" />
    </svg>
  );
}

export default function HomePage() {
  return (
    <div className="min-h-screen bg-[hsl(222,47%,4%)] text-slate-100 flex flex-col selection:bg-blue-600 selection:text-white">
      {/* Navigation */}
      <header className="border-b border-slate-800/80 bg-slate-950/70 backdrop-blur-xl sticky top-0 z-50 px-6 py-4">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-blue-600 to-cyan-400 p-[1px] shadow-lg shadow-blue-500/20">
              <div className="w-full h-full bg-slate-950 rounded-[11px] flex items-center justify-center">
                <ShieldIcon className="w-5 h-5 text-blue-400" />
              </div>
            </div>
            <div>
              <span className="font-black text-lg tracking-tight text-white flex items-center gap-1.5">
                DrowsiGuard
                <span className="text-[10px] uppercase font-bold px-2 py-0.5 rounded-full bg-blue-500/10 border border-blue-500/30 text-blue-400">
                  Edge AI 2.0
                </span>
              </span>
              <p className="text-[11px] text-slate-400">Real-Time Driver Fatigue Monitor</p>
            </div>
          </div>

          <div className="flex items-center gap-2 sm:gap-3">
            <Link
              href="/driver"
              className="hidden sm:flex px-4 py-2 rounded-xl border border-slate-700 bg-slate-900/60 hover:bg-slate-800 text-slate-200 text-xs font-semibold items-center gap-1.5 transition"
            >
              <EyeIcon className="w-3.5 h-3.5 text-blue-400" /> Driver Cabin
            </Link>
            <Link
              href="/manager"
              className="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-[11px] sm:text-xs font-semibold flex items-center gap-1.5 transition shadow-lg shadow-blue-900/40 glow-blue"
            >
              <TruckIcon className="w-3.5 h-3.5" /> Fleet Dashboard
            </Link>
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <main className="flex-1 flex flex-col">
        <section className="relative px-6 pt-16 pb-20 md:pt-24 md:pb-28 overflow-hidden">
          {/* Ambient Glows */}
          <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[300px] bg-blue-600/15 blur-[120px] rounded-full pointer-events-none" />
          <div className="absolute top-1/3 left-1/3 w-[350px] h-[200px] bg-cyan-500/10 blur-[100px] rounded-full pointer-events-none" />

          <div className="max-w-5xl mx-auto text-center relative z-10 flex flex-col items-center">
            {/* Tech Badge */}
            <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-slate-900/90 border border-slate-700/80 backdrop-blur-md mb-6 shadow-xl">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
              <span className="text-xs font-medium text-slate-300">
                MediaPipe 468 Face Mesh + In-Browser Quantized LSTM
              </span>
            </div>

            {/* Headline */}
            <h1 className="text-3xl sm:text-5xl md:text-6xl lg:text-7xl font-black tracking-tight text-white mb-6 leading-[1.1]">
              Sub-10ms Edge AI for{" "}
              <span className="gradient-text">Driver Fatigue Detection</span>
            </h1>

            {/* Subtitle */}
            <p className="max-w-2xl text-sm sm:text-base md:text-lg text-slate-300 leading-relaxed mb-10">
              Eliminate catastrophic road accidents caused by driver fatigue.
              DrowsiGuard runs lightweight neural inference entirely inside the driver cabin
              browser, dispatching instant audio alarms with zero cloud latency.
            </p>

            {/* Action Buttons */}
            <div className="flex flex-col sm:flex-row items-center gap-4 w-full sm:w-auto">
              <Link
                href="/driver"
                className="w-full sm:w-auto px-8 py-4 rounded-2xl bg-blue-600 hover:bg-blue-500 text-white font-bold text-sm tracking-wide flex items-center justify-center gap-2.5 shadow-xl shadow-blue-900/50 transition transform hover:-translate-y-0.5 glow-blue"
              >
                <EyeIcon className="w-4 h-4" /> Open Driver Cabin
                <ArrowRightIcon className="w-4 h-4" />
              </Link>
              <Link
                href="/manager"
                className="w-full sm:w-auto px-8 py-4 rounded-2xl bg-slate-900/80 hover:bg-slate-800 border border-slate-700 text-slate-200 font-bold text-sm tracking-wide flex items-center justify-center gap-2.5 transition transform hover:-translate-y-0.5"
              >
                <TruckIcon className="w-4 h-4 text-cyan-400" /> Fleet Manager Radar
              </Link>
            </div>
          </div>
        </section>

        {/* System Topology / Pipeline Architecture */}
        <section className="px-6 py-16 border-y border-slate-800/80 bg-slate-950/40 relative">
          <div className="max-w-6xl mx-auto">
            <div className="text-center mb-12">
              <span className="text-xs font-mono uppercase text-blue-400 tracking-wider">
                System Topology &amp; Latency Profile
              </span>
              <h2 className="text-2xl md:text-4xl font-extrabold text-white mt-1">
                Zero Cloud-Dependency at the Edge
              </h2>
            </div>

            {/* Interactive 4-Stage Flow Diagram */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {/* Step 1 */}
              <div className="p-5 rounded-2xl bg-slate-900/60 border border-slate-800 flex flex-col justify-between">
                <div>
                  <div className="w-10 h-10 rounded-xl bg-blue-600/10 border border-blue-500/30 flex items-center justify-center text-blue-400 mb-4 font-mono font-bold">
                    01
                  </div>
                  <h3 className="font-bold text-base text-white mb-2">WebRTC Video</h3>
                  <p className="text-xs text-slate-400 leading-relaxed">
                    HTML5 video stream captured at 30 FPS inside browser memory. Zero frame data transmitted outside device.
                  </p>
                </div>
                <div className="mt-4 pt-3 border-t border-slate-800 font-mono text-[11px] text-emerald-400 flex items-center gap-1">
                  <ZapIcon className="w-3 h-3" /> 0ms Latency
                </div>
              </div>

              {/* Step 2 */}
              <div className="p-5 rounded-2xl bg-slate-900/60 border border-slate-800 flex flex-col justify-between">
                <div>
                  <div className="w-10 h-10 rounded-xl bg-cyan-600/10 border border-cyan-500/30 flex items-center justify-center text-cyan-400 mb-4 font-mono font-bold">
                    02
                  </div>
                  <h3 className="font-bold text-base text-white mb-2">MediaPipe Mesh</h3>
                  <p className="text-xs text-slate-400 leading-relaxed">
                    Extracts 468 3D landmarks via WebAssembly. Computes EAR (Eye Aspect Ratio) and MAR (Mouth Aspect Ratio).
                  </p>
                </div>
                <div className="mt-4 pt-3 border-t border-slate-800 font-mono text-[11px] text-cyan-400 flex items-center gap-1">
                  <CpuIcon className="w-3 h-3" /> WASM SIMD
                </div>
              </div>

              {/* Step 3 */}
              <div className="p-5 rounded-2xl bg-slate-900/60 border border-slate-800 flex flex-col justify-between">
                <div>
                  <div className="w-10 h-10 rounded-xl bg-amber-600/10 border border-amber-500/30 flex items-center justify-center text-amber-400 mb-4 font-mono font-bold">
                    03
                  </div>
                  <h3 className="font-bold text-base text-white mb-2">LSTM Inference</h3>
                  <p className="text-xs text-slate-400 leading-relaxed">
                    150-frame rolling ring buffer feeds ONNX Runtime Web. Quantized Bidirectional LSTM classifies fatigue state.
                  </p>
                </div>
                <div className="mt-4 pt-3 border-t border-slate-800 font-mono text-[11px] text-amber-400 flex items-center gap-1">
                  <ZapIcon className="w-3 h-3" /> &lt; 10ms Inference
                </div>
              </div>

              {/* Step 4 */}
              <div className="p-5 rounded-2xl bg-slate-900/60 border border-slate-800 flex flex-col justify-between">
                <div>
                  <div className="w-10 h-10 rounded-xl bg-rose-600/10 border border-rose-500/30 flex items-center justify-center text-rose-400 mb-4 font-mono font-bold">
                    04
                  </div>
                  <h3 className="font-bold text-base text-white mb-2">Dual Action</h3>
                  <p className="text-xs text-slate-400 leading-relaxed">
                    Immediate piercing Web Audio API alarm locally. Non-blocking Supabase telemetry push to Fleet Radar.
                  </p>
                </div>
                <div className="mt-4 pt-3 border-t border-slate-800 font-mono text-[11px] text-rose-400 flex items-center gap-1">
                  <RadioIcon className="w-3 h-3" /> &lt; 50ms Realtime
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Feature Grid */}
        <section className="px-6 py-16">
          <div className="max-w-6xl mx-auto grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-6">
            <div className="p-6 rounded-2xl bg-slate-900/50 border border-slate-800/80 backdrop-blur-md">
              <EyeIcon className="w-8 h-8 text-blue-400 mb-4" />
              <h3 className="text-lg font-bold text-white mb-2">PERCLOS Metrics</h3>
              <p className="text-xs text-slate-400 leading-relaxed">
                Computes Percentage of Eye Closure over time, the gold-standard metric validated in aviation and commercial transportation fatigue studies.
              </p>
            </div>

            <div className="p-6 rounded-2xl bg-slate-900/50 border border-slate-800/80 backdrop-blur-md">
              <RadioIcon className="w-8 h-8 text-cyan-400 mb-4" />
              <h3 className="text-lg font-bold text-white mb-2">Supabase Realtime</h3>
              <p className="text-xs text-slate-400 leading-relaxed">
                Row-Level Security (RLS) policies guarantee driver privacy while WebSocket streaming delivers live incident telemetry to operations commanders.
              </p>
            </div>

            <div className="p-6 rounded-2xl bg-slate-900/50 border border-slate-800/80 backdrop-blur-md">
              <FileTextIcon className="w-8 h-8 text-emerald-400 mb-4" />
              <h3 className="text-lg font-bold text-white mb-2">FastAPI Compliance PDF</h3>
              <p className="text-xs text-slate-400 leading-relaxed">
                Asynchronous Python microservice computes driver risk score indices and exports branded PDF compliance reports for DOT and safety audits.
              </p>
            </div>
          </div>
        </section>
      </main>

      {/* Footer */}
      <footer className="border-t border-slate-800/80 bg-slate-950 px-6 py-8 text-center text-xs text-slate-500">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4">
          <p>© 2026 DrowsiGuard. Built for driver safety and zero-fatigue transit.</p>
          <div className="flex items-center gap-6">
            <Link href="/driver" className="hover:text-slate-300 transition">
              Driver Cabin
            </Link>
            <Link href="/manager" className="hover:text-slate-300 transition">
              Fleet Radar
            </Link>
            <span className="font-mono text-emerald-500">Edge System Ready</span>
          </div>
        </div>
      </footer>
    </div>
  );
}
