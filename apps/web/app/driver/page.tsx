"use client";

import { useState, useEffect, useRef } from "react";
import Link from "next/link";
import {
  Shield,
  Truck,
  Play,
  Square,
  AlertTriangle,
  Clock,
  Activity,
  Volume2,
  VolumeX,
  Volume1,
  ArrowLeft,
  CheckCircle,
  Eye,
  Maximize2,
  Smartphone,
  Info,
  Video,
  VideoOff,
  Sliders,
  BellRing,
} from "lucide-react";
import WebcamMonitor from "@/components/WebcamMonitor";
import AlertOverlay from "@/components/AlertOverlay";
import { startShiftAction, stopShiftAction } from "./actions";
import { FatigueEventType, Shift } from "@/types/database";

export default function DriverCabinPage() {
  const [vehiclePlate, setVehiclePlate] = useState("DL-01-AX-9942");
  const [activeShift, setActiveShift] = useState<Shift | null>(null);
  const [isStartingShift, setIsStartingShift] = useState(false);
  const [shiftDurationSeconds, setShiftDurationSeconds] = useState(0);

  // Camera active state (Pause / Resume Camera)
  const [isCameraActive, setIsCameraActive] = useState(true);

  // Fatigue alert state & volume
  const [isAlerting, setIsAlerting] = useState(false);
  const [currentAlertEventType, setCurrentAlertEventType] = useState<FatigueEventType | null>(null);
  const [currentPerclos, setCurrentPerclos] = useState(0);
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [alertVolume, setAlertVolume] = useState(0.8); // 0.0 to 1.0 (80% default)
  const [showVolumePopup, setShowVolumePopup] = useState(false);

  // Real-time telemetry stats
  const [telemetry, setTelemetry] = useState({
    ear: 0.32,
    mar: 0.14,
    perclos: 0.0,
    fps: 30,
    drowsyProb: 0.05,
    blinkCount: 0,
    stateLabel: "ALERT",
  });

  const [eventHistory, setEventHistory] = useState<
    Array<{ type: FatigueEventType; timestamp: string; perclos: number }>
  >([]);

  // Shift duration counter
  useEffect(() => {
    let interval: NodeJS.Timeout | null = null;
    if (activeShift) {
      interval = setInterval(() => {
        setShiftDurationSeconds((prev) => prev + 1);
      }, 1000);
    } else {
      setShiftDurationSeconds(0);
    }
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [activeShift]);

  const formatDuration = (totalSec: number) => {
    const hrs = Math.floor(totalSec / 3600);
    const mins = Math.floor((totalSec % 3600) / 60);
    const secs = totalSec % 60;
    return `${hrs.toString().padStart(2, "0")}:${mins
      .toString()
      .padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
  };

  const handleStartShift = async () => {
    if (!vehiclePlate.trim()) return;
    setIsStartingShift(true);
    setIsCameraActive(true);
    try {
      const res = await startShiftAction(vehiclePlate);
      if (res.success && res.data) {
        setActiveShift(res.data);
      }
    } finally {
      setIsStartingShift(false);
    }
  };

  const handleStopShift = async () => {
    if (!activeShift) return;
    try {
      await stopShiftAction(activeShift.id);
      setActiveShift(null);
      setIsAlerting(false);
    } catch (e) {
      console.error(e);
    }
  };

  const handleAlertTriggered = (eventType: FatigueEventType, perclosScore: number) => {
    setIsAlerting(true);
    setCurrentAlertEventType(eventType);
    setCurrentPerclos(perclosScore);

    setEventHistory((prev) => [
      {
        type: eventType,
        timestamp: new Date().toLocaleTimeString(),
        perclos: perclosScore,
      },
      ...prev.slice(0, 19),
    ]);
  };

  const handleClearAlert = () => {
    setIsAlerting(false);
    setCurrentAlertEventType(null);
  };

  // Mobile Fullscreen Toggle
  const toggleFullScreen = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().catch(() => {});
    } else {
      document.exitFullscreen().catch(() => {});
    }
  };

  // Preview / Test Alarm Sound Beep
  const testAlarmBeep = () => {
    if (!soundEnabled || alertVolume <= 0) return;
    try {
      const AudioCtx =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext: typeof AudioContext })
          .webkitAudioContext;
      if (!AudioCtx) return;
      const ctx = new AudioCtx();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = "sawtooth";
      osc.frequency.setValueAtTime(880, ctx.currentTime);
      osc.frequency.setValueAtTime(1200, ctx.currentTime + 0.08);

      const targetGain = Math.max(0.01, alertVolume * 0.35);
      gain.gain.setValueAtTime(targetGain, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.2);

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start(ctx.currentTime);
      osc.stop(ctx.currentTime + 0.2);
    } catch (e) {
      console.warn("Audio test failed:", e);
    }
  };

  return (
    <div className="min-h-screen bg-[hsl(222,47%,4%)] text-slate-100 flex flex-col selection:bg-blue-600">
      {/* Top Header - Responsive */}
      <header className="border-b border-slate-800 bg-slate-950/90 backdrop-blur-md sticky top-0 z-40 px-3 sm:px-6 py-2.5 sm:py-3 flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2 sm:gap-3">
          <Link
            href="/"
            className="p-2 rounded-xl border border-slate-800 hover:bg-slate-900 text-slate-400 hover:text-white transition"
          >
            <ArrowLeft className="w-4 h-4" />
          </Link>
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-blue-600/20 border border-blue-500/40 flex items-center justify-center">
              <Shield className="w-4 h-4 sm:w-5 sm:h-5 text-blue-400" />
            </div>
            <div>
              <h1 className="font-bold text-xs sm:text-base leading-tight">
                DrowsiGuard <span className="text-blue-400">Driver Cabin</span>
              </h1>
              <p className="text-[10px] text-slate-400 hidden xs:block">
                Blink-Differentiated Edge AI
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-1.5 sm:gap-2">
          {activeShift && (
            <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-xs font-mono">
              <div className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
              <span>Shift: {formatDuration(shiftDurationSeconds)}</span>
            </div>
          )}

          {/* Quick Stop/Start Camera Button */}
          <button
            onClick={() => setIsCameraActive(!isCameraActive)}
            title={isCameraActive ? "Pause Camera Feed" : "Resume Camera Feed"}
            className={`p-2 rounded-xl border text-xs font-medium transition flex items-center gap-1.5 ${
              isCameraActive
                ? "bg-slate-900 border-slate-700 text-slate-300 hover:bg-slate-800"
                : "bg-amber-500/10 border-amber-500/30 text-amber-400 hover:bg-amber-500/20"
            }`}
          >
            {isCameraActive ? (
              <VideoOff className="w-4 h-4 text-slate-300" />
            ) : (
              <Video className="w-4 h-4 text-emerald-400" />
            )}
            <span className="hidden md:inline">
              {isCameraActive ? "Stop Cam" : "Start Cam"}
            </span>
          </button>

          {/* Volume Control Button & Popover */}
          <div className="relative">
            <button
              onClick={() => setShowVolumePopup(!showVolumePopup)}
              className={`p-2 rounded-xl border text-xs font-medium transition flex items-center gap-1.5 ${
                !soundEnabled || alertVolume === 0
                  ? "bg-red-500/10 border-red-500/30 text-red-400"
                  : alertVolume < 0.5
                  ? "bg-slate-900 border-slate-700 text-amber-400 hover:bg-slate-800"
                  : "bg-slate-900 border-slate-700 text-slate-200 hover:bg-slate-800"
              }`}
              title="Adjust Alarm Volume"
            >
              {!soundEnabled || alertVolume === 0 ? (
                <VolumeX className="w-4 h-4" />
              ) : alertVolume < 0.5 ? (
                <Volume1 className="w-4 h-4" />
              ) : (
                <Volume2 className="w-4 h-4" />
              )}
              <span className="hidden sm:inline font-mono text-[11px]">
                {soundEnabled ? `${Math.round(alertVolume * 100)}%` : "Off"}
              </span>
            </button>

            {/* Floating Volume Adjustment Popover */}
            {showVolumePopup && (
              <div className="absolute right-0 top-12 z-50 w-64 bg-slate-950/95 border border-slate-800 rounded-2xl p-4 shadow-2xl backdrop-blur-xl animate-fade-in-up">
                <div className="flex items-center justify-between mb-3">
                  <span className="text-xs font-bold text-white flex items-center gap-1.5">
                    <Sliders className="w-3.5 h-3.5 text-blue-400" /> Alarm Sound Level
                  </span>
                  <span className="text-xs font-mono font-bold text-blue-400">
                    {soundEnabled ? `${Math.round(alertVolume * 100)}%` : "Muted"}
                  </span>
                </div>

                {/* Slider */}
                <input
                  type="range"
                  min="0"
                  max="1"
                  step="0.05"
                  value={soundEnabled ? alertVolume : 0}
                  onChange={(e) => {
                    const val = parseFloat(e.target.value);
                    setAlertVolume(val);
                    if (val > 0 && !soundEnabled) setSoundEnabled(true);
                  }}
                  className="w-full accent-blue-500 cursor-pointer h-2 bg-slate-800 rounded-lg mb-4"
                />

                {/* Quick Presets */}
                <div className="grid grid-cols-4 gap-1.5 mb-3 text-[10px] font-mono">
                  {[
                    { label: "Mute", val: 0 },
                    { label: "Low", val: 0.3 },
                    { label: "Med", val: 0.65 },
                    { label: "Max", val: 1.0 },
                  ].map((preset) => (
                    <button
                      key={preset.label}
                      onClick={() => {
                        if (preset.val === 0) {
                          setSoundEnabled(false);
                        } else {
                          setSoundEnabled(true);
                          setAlertVolume(preset.val);
                        }
                      }}
                      className="py-1 px-1.5 rounded-lg border border-slate-800 bg-slate-900/80 hover:bg-slate-800 text-slate-300 text-center transition"
                    >
                      {preset.label}
                    </button>
                  ))}
                </div>

                {/* Test Beep Button */}
                <button
                  onClick={testAlarmBeep}
                  className="w-full py-1.5 rounded-xl border border-blue-500/40 bg-blue-600/20 hover:bg-blue-600/30 text-blue-300 text-xs font-semibold flex items-center justify-center gap-1.5 transition"
                >
                  <BellRing className="w-3.5 h-3.5" /> Test Alarm Volume
                </button>
              </div>
            )}
          </div>

          <button
            onClick={toggleFullScreen}
            className="p-2 rounded-xl border border-slate-800 bg-slate-900 hover:bg-slate-800 text-slate-400 hover:text-white transition hidden sm:flex"
            title="Toggle Fullscreen"
          >
            <Maximize2 className="w-4 h-4" />
          </button>
        </div>
      </header>

      {/* Main Responsive Grid Layout */}
      <main className="flex-1 p-3 sm:p-4 md:p-6 max-w-7xl mx-auto w-full grid grid-cols-1 lg:grid-cols-12 gap-3 sm:gap-5">
        {/* Left Column: Edge Webcam & Controls (7 cols on desktop, full width on mobile) */}
        <section className="lg:col-span-7 flex flex-col gap-4">
          {/* Webcam Monitor */}
          <div className="relative w-full">
            <WebcamMonitor
              shiftId={activeShift?.id || "preview-shift"}
              isCameraActive={isCameraActive}
              onToggleCameraActive={(active) => setIsCameraActive(active)}
              onAlert={handleAlertTriggered}
              onClearAlert={handleClearAlert}
              onTelemetryUpdate={(metrics) => setTelemetry(metrics)}
            />
          </div>

          {/* Shift Controller & Camera Toggle Card */}
          <div className="bg-slate-900/60 border border-slate-800 rounded-2xl p-3.5 sm:p-4 backdrop-blur-md">
            <div className="flex flex-col sm:flex-row items-center justify-between gap-3">
              <div className="flex items-center gap-3 w-full sm:w-auto">
                <Truck className="w-5 h-5 text-slate-400 shrink-0" />
                <div className="flex-1 sm:flex-initial">
                  <label className="text-[10px] uppercase font-bold text-slate-400 block mb-0.5">
                    Vehicle Registration Plate
                  </label>
                  <input
                    type="text"
                    disabled={!!activeShift}
                    value={vehiclePlate}
                    onChange={(e) => setVehiclePlate(e.target.value.toUpperCase())}
                    placeholder="DL-01-AX-9942"
                    className="w-full sm:w-48 bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-xs sm:text-sm font-mono text-white focus:outline-none focus:border-blue-500 disabled:opacity-60"
                  />
                </div>
              </div>

              {/* Action Buttons: Start/Stop Shift + Stop/Start Camera */}
              <div className="flex flex-col xs:flex-row items-stretch xs:items-center gap-2 w-full sm:w-auto">
                <button
                  onClick={() => setIsCameraActive(!isCameraActive)}
                  className={`flex-1 sm:flex-initial px-4 py-3 rounded-xl border text-xs font-bold flex items-center justify-center gap-1.5 transition ${
                    isCameraActive
                      ? "bg-slate-900 border-slate-700 text-slate-300 hover:bg-slate-800"
                      : "bg-emerald-600/20 border-emerald-500/40 text-emerald-300 hover:bg-emerald-600/30"
                  }`}
                >
                  {isCameraActive ? (
                    <>
                      <VideoOff className="w-4 h-4 text-rose-400" />
                      <span>Stop Camera</span>
                    </>
                  ) : (
                    <>
                      <Video className="w-4 h-4 text-emerald-400" />
                      <span>Resume Camera</span>
                    </>
                  )}
                </button>

                {!activeShift ? (
                  <button
                    onClick={handleStartShift}
                    disabled={isStartingShift || !vehiclePlate.trim()}
                    className="flex-1 sm:flex-initial px-5 py-3 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs sm:text-sm flex items-center justify-center gap-2 transition glow-blue disabled:opacity-50"
                  >
                    <Play className="w-4 h-4 fill-white" /> Start Shift
                  </button>
                ) : (
                  <button
                    onClick={handleStopShift}
                    className="flex-1 sm:flex-initial px-5 py-3 rounded-xl bg-rose-600 hover:bg-rose-500 text-white font-bold text-xs sm:text-sm flex items-center justify-center gap-2 transition shadow-lg shadow-rose-950"
                  >
                    <Square className="w-4 h-4 fill-white" /> End Shift
                  </button>
                )}
              </div>
            </div>
          </div>

          {/* Quick Hardware & Audio Controls Panel */}
          <div className="bg-slate-900/60 border border-slate-800 rounded-2xl p-4 backdrop-blur-md flex flex-col sm:flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-3 w-full sm:w-auto">
              <div className="w-10 h-10 rounded-xl bg-slate-950 border border-slate-800 flex items-center justify-center text-blue-400 shrink-0">
                <Volume2 className="w-5 h-5" />
              </div>
              <div>
                <span className="text-xs font-bold text-slate-200 block">
                  Alert Volume Control
                </span>
                <span className="text-[11px] text-slate-400">
                  Current level: {soundEnabled ? `${Math.round(alertVolume * 100)}%` : "Muted"}
                </span>
              </div>
            </div>

            <div className="flex items-center gap-3 w-full sm:w-auto flex-1 max-w-xs">
              <input
                type="range"
                min="0"
                max="1"
                step="0.05"
                value={soundEnabled ? alertVolume : 0}
                onChange={(e) => {
                  const val = parseFloat(e.target.value);
                  setAlertVolume(val);
                  if (val > 0 && !soundEnabled) setSoundEnabled(true);
                }}
                className="w-full accent-blue-500 cursor-pointer h-2 bg-slate-800 rounded-lg"
              />
              <button
                onClick={testAlarmBeep}
                className="px-3 py-1.5 rounded-lg border border-slate-700 bg-slate-800 hover:bg-slate-700 text-[11px] font-medium text-slate-200 shrink-0 transition"
              >
                Test Sound
              </button>
            </div>
          </div>

          {/* Clinical Rule Notice */}
          <div className="p-3 rounded-xl bg-blue-950/30 border border-blue-900/40 text-blue-300 text-xs flex items-start gap-2.5">
            <Info className="w-4 h-4 shrink-0 text-blue-400 mt-0.5" />
            <div className="leading-relaxed text-[11px] sm:text-xs">
              <span className="font-semibold text-white">Smart Eye-Closure Differentiation:</span>{" "}
              Normal blinks (<span className="font-mono text-sky-400">100ms–350ms</span>) are filtered automatically as healthy ocular activity.
              The emergency fatigue alarm triggers <strong>only</strong> when eyes remain closed continuously for{" "}
              <span className="font-mono text-red-400">&ge; 2.0 seconds</span> (microsleep/sleep) or excessive continuous yawning (<span className="font-mono text-amber-400">&ge; 2.5s</span>).
            </div>
          </div>
        </section>

        {/* Right Column: Telemetry & Safety Meters (5 cols on desktop, full width on mobile) */}
        <section className="lg:col-span-5 flex flex-col gap-4">
          {/* Driver Risk Meter */}
          <div className="bg-slate-900/60 border border-slate-800 rounded-2xl p-4 sm:p-5 backdrop-blur-md flex flex-col gap-3.5">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Activity className="w-4 h-4 text-cyan-400" />
                <h3 className="font-semibold text-xs sm:text-sm text-slate-200">
                  Driver Vitals &amp; Fatigue Index
                </h3>
              </div>
              <div className="flex flex-col items-end gap-1">
              <span
                className={`text-[10px] font-mono px-2 py-0.5 rounded-full uppercase font-bold ${
                  !isCameraActive
                    ? "bg-slate-800 text-slate-400"
                    : telemetry.stateLabel === "ALERT"
                    ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/30"
                    : telemetry.stateLabel === "BLINKING"
                    ? "bg-sky-500/10 text-sky-400 border border-sky-500/30"
                    : telemetry.stateLabel === "DROWSY_PRECURSOR"
                    ? "bg-amber-500/10 text-amber-400 border border-amber-500/30"
                    : "bg-red-500/20 text-red-400 border border-red-500/40 animate-pulse"
                }`}
              >
                {!isCameraActive ? "PAUSED" : telemetry.stateLabel}
              </span>
              <div className="flex items-center gap-1.5 mt-1">
                <div className={`w-1.5 h-1.5 rounded-full ${telemetry.fps >= 50 ? 'bg-emerald-400' : telemetry.fps >= 30 ? 'bg-amber-400' : 'bg-red-400'} animate-pulse`} />
                <span className="text-[10px] font-mono text-slate-400">{telemetry.fps} FPS rendering</span>
              </div>
              </div>
            </div>

            {/* Metric Bars */}
            <div className="space-y-3">
              {/* Eye Aspect Ratio (EAR) */}
              <div>
                <div className="flex justify-between text-xs mb-1">
                  <span className="text-slate-400">Eye Opening (EAR)</span>
                  <span className="font-mono font-bold text-slate-200">
                    {isCameraActive ? telemetry.ear.toFixed(2) : "--"}{" "}
                    <span className="text-[10px] text-slate-500">(Closed: &lt; 0.20)</span>
                  </span>
                </div>
                <div className="w-full h-3 rounded-full bg-slate-800 overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all duration-150 ${
                      !isCameraActive
                        ? "bg-slate-700"
                        : telemetry.ear < 0.20
                        ? "bg-gradient-to-r from-red-600 to-red-400"
                        : "bg-gradient-to-r from-emerald-600 to-emerald-400"
                    }`}
                    style={{
                      width: `${isCameraActive ? Math.min(telemetry.ear / 0.45, 1) * 100 : 0}%`,
                    }}
                  />
                </div>
              </div>

              {/* Mouth Aspect Ratio (MAR) */}
              <div>
                <div className="flex justify-between text-xs mb-1">
                  <span className="text-slate-400">Mouth Opening (MAR)</span>
                  <span className="font-mono font-bold text-slate-200">
                    {isCameraActive ? telemetry.mar.toFixed(2) : "--"}{" "}
                    <span className="text-[10px] text-slate-500">(Yawn limit: &gt; 0.65)</span>
                  </span>
                </div>
                <div className="w-full h-3 rounded-full bg-slate-800 overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all duration-150 ${
                      !isCameraActive
                        ? "bg-slate-700"
                        : telemetry.mar > 0.65
                        ? "bg-gradient-to-r from-amber-600 to-amber-400"
                        : "bg-gradient-to-r from-blue-600 to-blue-400"
                    }`}
                    style={{
                      width: `${isCameraActive ? Math.min(telemetry.mar / 1.0, 1) * 100 : 0}%`,
                    }}
                  />
                </div>
              </div>

              {/* PERCLOS Index */}
              <div>
                <div className="flex justify-between text-xs mb-1">
                  <span className="text-slate-400">PERCLOS (% Eye Closure)</span>
                  <span className="font-mono font-bold text-slate-200">
                    {isCameraActive ? `${(telemetry.perclos * 100).toFixed(1)}%` : "--"}
                  </span>
                </div>
                <div className="w-full h-3 rounded-full bg-slate-800 overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all duration-150 ${
                      !isCameraActive
                        ? "bg-slate-700"
                        : telemetry.perclos > 0.40
                        ? "bg-gradient-to-r from-red-600 to-red-400"
                        : "bg-gradient-to-r from-cyan-600 to-cyan-400"
                    }`}
                    style={{
                      width: `${isCameraActive ? Math.min(telemetry.perclos, 1) * 100 : 0}%`,
                    }}
                  />
                </div>
              </div>

              {/* Natural Blinks Filtered */}
              <div className="flex items-center justify-between p-2.5 rounded-xl bg-slate-950/70 border border-slate-800">
                <div className="flex items-center gap-2">
                  <Eye className="w-4 h-4 text-sky-400" />
                  <div>
                    <span className="text-xs font-semibold text-slate-200 block">
                      Normal Blinks Filtered
                    </span>
                    <span className="text-[10px] text-slate-500">
                      Standard natural blinking (No false alarm)
                    </span>
                  </div>
                </div>
                <span className="font-mono font-bold text-sm text-sky-400">
                  {telemetry.blinkCount}
                </span>
              </div>
            </div>
          </div>

          {/* Session Telemetry History */}
          <div className="bg-slate-900/60 border border-slate-800 rounded-2xl p-4 sm:p-5 backdrop-blur-md flex flex-col">
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-semibold text-xs sm:text-sm text-slate-200">
                Verified Fatigue Incidents
              </h3>
              <span className="text-xs text-slate-400">
                {eventHistory.length} Incident{eventHistory.length !== 1 ? "s" : ""}
              </span>
            </div>

            {eventHistory.length === 0 ? (
              <div className="flex-1 min-h-[120px] flex flex-col items-center justify-center text-slate-500 text-xs text-center border border-dashed border-slate-800 rounded-xl p-4">
                <CheckCircle className="w-7 h-7 text-emerald-500/40 mb-1.5" />
                <p>No verified fatigue events recorded.</p>
                <p className="text-[10px] text-slate-600 mt-0.5">Driver is vigilant and focused.</p>
              </div>
            ) : (
              <div className="space-y-2 max-h-40 sm:max-h-56 overflow-y-auto pr-1">
                {eventHistory.map((evt, idx) => (
                  <div
                    key={idx}
                    className="flex items-center justify-between p-2 rounded-lg bg-slate-950/70 border border-slate-800 text-xs"
                  >
                    <div className="flex items-center gap-2">
                      <div
                        className={`w-2 h-2 rounded-full ${
                          evt.type === "microsleep" ? "bg-red-500 animate-pulse" : "bg-amber-500"
                        }`}
                      />
                      <span className="font-semibold capitalize text-slate-200">
                        {evt.type === "microsleep" ? "Microsleep (> 2.0s)" : evt.type}
                      </span>
                    </div>
                    <div className="flex items-center gap-3 font-mono text-slate-400 text-[11px]">
                      <span>PERCLOS: {(evt.perclos * 100).toFixed(0)}%</span>
                      <span>{evt.timestamp}</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </section>
      </main>

      {/* Instant Audio-Visual Alert Overlay */}
      <AlertOverlay
        isAlerting={isAlerting}
        eventType={currentAlertEventType}
        perclosScore={currentPerclos}
        soundEnabled={soundEnabled}
        volume={alertVolume}
        onChangeVolume={(vol) => setAlertVolume(vol)}
        onToggleSound={() => setSoundEnabled(!soundEnabled)}
        onDismiss={handleClearAlert}
      />
    </div>
  );
}
