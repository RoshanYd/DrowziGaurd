"use client";

import { useEffect, useRef, useCallback } from "react";
import { AlertTriangle, BellOff, Volume2, VolumeX, Volume1 } from "lucide-react";
import { FatigueEventType } from "@/types/database";
import { playAlertChime, speakAlertVoice, stopAlertVoice } from "@/lib/speech";

interface AlertOverlayProps {
  isAlerting: boolean;
  eventType: FatigueEventType | null;
  perclosScore: number;
  onDismiss?: () => void;
  soundEnabled?: boolean;
  onToggleSound?: () => void;
  volume?: number; // 0.0 to 1.0
  onChangeVolume?: (vol: number) => void;
}

export default function AlertOverlay({
  isAlerting,
  eventType,
  perclosScore,
  onDismiss,
  soundEnabled = true,
  onToggleSound,
  volume = 0.8,
  onChangeVolume,
}: AlertOverlayProps) {
  const audioCtxRef = useRef<AudioContext | null>(null);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);

  // Pre-warm SpeechSynthesis voices
  useEffect(() => {
    if (typeof window !== "undefined" && "speechSynthesis" in window) {
      window.speechSynthesis.getVoices();
      window.speechSynthesis.onvoiceschanged = () => {
        window.speechSynthesis.getVoices();
      };
    }
  }, []);

  // Initialize Web Audio API
  const initAudio = useCallback(() => {
    if (!audioCtxRef.current && typeof window !== "undefined") {
      const AudioCtx =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext: typeof AudioContext })
          .webkitAudioContext;
      if (AudioCtx) {
        audioCtxRef.current = new AudioCtx();
      }
    }
    if (audioCtxRef.current && audioCtxRef.current.state === "suspended") {
      audioCtxRef.current.resume();
    }
  }, []);

  // Synchronized Alert Loop: Dual-Tone Warning Chime + Trained Female Voice
  useEffect(() => {
    if (!isAlerting || !soundEnabled || volume <= 0) {
      stopAlertVoice();
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
      return;
    }

    initAudio();

    const triggerCycle = () => {
      if (audioCtxRef.current) {
        playAlertChime(audioCtxRef.current, volume);
      }
      // Speak "Warning! Be alert!" with trained female voice offset right after the chime
      setTimeout(() => {
        speakAlertVoice("Warning! Be alert!", volume);
      }, 150);
    };

    triggerCycle();
    intervalRef.current = setInterval(triggerCycle, 1800);

    return () => {
      stopAlertVoice();
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };
  }, [isAlerting, soundEnabled, volume, initAudio]);

  if (!isAlerting) return null;

  const eventLabel =
    eventType === "microsleep"
      ? "DROWSINESS DETECTED — EYES CLOSED!"
      : eventType === "yawn"
      ? "FATIGUE DETECTED — EXCESSIVE YAWNING!"
      : "DRIVER DISTRACTION DETECTED!";

  return (
    <div
      className="fixed inset-0 z-50 pointer-events-auto flex items-center justify-center p-4 transition-all duration-200 animate-flash-red"
      style={{
        backgroundColor: "rgba(220, 38, 38, 0.45)",
        backdropFilter: "blur(8px)",
      }}
    >
      <div className="relative w-full max-w-lg bg-slate-950/95 border-2 border-red-500 rounded-2xl shadow-2xl shadow-red-950/80 p-5 sm:p-8 text-center glow-red">
        {/* Pulsing hazard icon */}
        <div className="mx-auto w-16 h-16 sm:w-20 sm:h-20 rounded-full bg-red-500/20 border-2 border-red-500 flex items-center justify-center mb-3 sm:mb-4 animate-bounce">
          <AlertTriangle className="w-9 h-9 sm:w-12 sm:h-12 text-red-500" />
        </div>

        {/* Alarm Title */}
        <h2 className="text-xl sm:text-2xl md:text-3xl font-black tracking-wider text-red-500 uppercase mb-2 animate-pulse-alert">
          {eventLabel}
        </h2>

        <p className="text-slate-300 text-xs sm:text-sm mb-4 leading-relaxed">
          Immediate attention required. Please maintain eyes on the road or pull over safely.
        </p>

        {/* PERCLOS & Telemetry HUD */}
        <div className="grid grid-cols-2 gap-3 bg-slate-900/80 border border-slate-800 rounded-xl p-3 mb-4">
          <div className="text-left">
            <span className="text-[10px] text-slate-400 uppercase tracking-wider block">
              PERCLOS Index
            </span>
            <span className="text-base sm:text-lg font-mono font-bold text-red-400">
              {(perclosScore * 100).toFixed(1)}%
            </span>
          </div>
          <div className="text-right">
            <span className="text-[10px] text-slate-400 uppercase tracking-wider block">
              Alert Latency
            </span>
            <span className="text-base sm:text-lg font-mono font-bold text-emerald-400">
              &lt; 10ms (Edge)
            </span>
          </div>
        </div>

        {/* Volume Adjustment Control Inside Alert Modal */}
        <div className="bg-slate-900/90 border border-slate-800 rounded-xl p-3 mb-5 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2 text-xs font-semibold text-slate-300">
            {volume === 0 || !soundEnabled ? (
              <VolumeX className="w-4 h-4 text-red-400 shrink-0" />
            ) : volume < 0.5 ? (
              <Volume1 className="w-4 h-4 text-amber-400 shrink-0" />
            ) : (
              <Volume2 className="w-4 h-4 text-emerald-400 shrink-0" />
            )}
            <span className="text-[11px] sm:text-xs">
              Alarm Volume: {soundEnabled ? `${Math.round(volume * 100)}%` : "Muted"}
            </span>
          </div>

          <div className="flex items-center gap-2 flex-1 max-w-[180px]">
            <input
              type="range"
              min="0"
              max="1"
              step="0.05"
              value={soundEnabled ? volume : 0}
              onChange={(e) => {
                const val = parseFloat(e.target.value);
                if (onChangeVolume) onChangeVolume(val);
                if (val > 0 && !soundEnabled && onToggleSound) {
                  onToggleSound();
                }
              }}
              className="w-full accent-blue-500 cursor-pointer h-1.5 bg-slate-800 rounded-lg"
            />
          </div>
        </div>

        {/* Action Controls */}
        <div className="flex flex-col sm:flex-row items-center justify-center gap-2.5 sm:gap-3">
          {onToggleSound && (
            <button
              onClick={onToggleSound}
              className="w-full sm:w-auto px-4 py-2.5 rounded-xl border border-slate-700 bg-slate-900 hover:bg-slate-800 text-slate-300 text-xs font-medium flex items-center justify-center gap-2 transition"
            >
              {soundEnabled ? (
                <>
                  <VolumeX className="w-4 h-4 text-amber-400" /> Mute Voice &amp; Siren
                </>
              ) : (
                <>
                  <Volume2 className="w-4 h-4 text-emerald-400" /> Unmute Voice &amp; Siren
                </>
              )}
            </button>
          )}

          {onDismiss && (
            <button
              onClick={onDismiss}
              className="w-full sm:w-auto px-6 py-2.5 rounded-xl bg-red-600 hover:bg-red-500 text-white font-semibold text-xs tracking-wide shadow-lg shadow-red-900/50 flex items-center justify-center gap-2 transition"
            >
              <BellOff className="w-4 h-4" /> Acknowledge &amp; Dismiss
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
