"use client";

import { useState } from "react";
import { Navigation, ShieldAlert, CheckCircle2, AlertTriangle, Truck, Compass, Layers } from "lucide-react";
import { Shift, FatigueEvent } from "@/types/database";

export interface FleetVehicle {
  shiftId: string;
  driverId: string;
  driverName: string;
  vehiclePlate: string;
  status: "active" | "alert" | "critical";
  lastEvent?: FatigueEvent;
  perclos: number;
  lat: number;
  lng: number;
  speedKmH: number;
  shiftStartTime: string;
}

interface FleetMapProps {
  vehicles: FleetVehicle[];
  selectedVehicleId: string | null;
  onSelectVehicle: (shiftId: string) => void;
}

export default function FleetMap({
  vehicles,
  selectedVehicleId,
  onSelectVehicle,
}: FleetMapProps) {
  const [mapLayer, setMapLayer] = useState<"dark" | "radar">("radar");

  // Center coordinates (simulated metropolitan bounds)
  const mapCenter = { lat: 28.6139, lng: 77.2090 };

  // Convert GPS (lat, lng) to SVG percentage coordinates (0 - 100%)
  const toSvgCoords = (lat: number, lng: number) => {
    const latSpan = 0.12;
    const lngSpan = 0.16;
    const x = ((lng - (mapCenter.lng - lngSpan / 2)) / lngSpan) * 100;
    const y = ((mapCenter.lat + latSpan / 2 - lat) / latSpan) * 100;
    return {
      x: Math.max(8, Math.min(92, x)),
      y: Math.max(8, Math.min(92, y)),
    };
  };

  return (
    <div className="relative w-full h-[420px] md:h-[500px] rounded-2xl overflow-hidden bg-slate-950 border border-slate-800 shadow-2xl flex flex-col">
      {/* Top Map Control Bar */}
      <div className="absolute top-4 left-4 right-4 z-20 flex items-center justify-between pointer-events-none">
        <div className="pointer-events-auto flex items-center gap-2 px-3 py-1.5 rounded-xl bg-slate-950/85 border border-slate-700/80 backdrop-blur-md shadow-lg">
          <Navigation className="w-4 h-4 text-blue-400 animate-spin-slow" />
          <span className="text-xs font-semibold text-slate-200">
            Live Fleet Radar ({vehicles.length} Active Units)
          </span>
        </div>

        <div className="pointer-events-auto flex items-center gap-1.5 p-1 rounded-xl bg-slate-950/85 border border-slate-700/80 backdrop-blur-md">
          <button
            onClick={() => setMapLayer(mapLayer === "radar" ? "dark" : "radar")}
            className="px-2.5 py-1 rounded-lg text-xs font-medium text-slate-300 hover:text-white flex items-center gap-1.5 transition hover:bg-slate-800"
          >
            <Layers className="w-3.5 h-3.5 text-cyan-400" />
            {mapLayer === "radar" ? "Radar Grid" : "Tactical"}
          </button>
        </div>
      </div>

      {/* SVG Interactive Map Canvas */}
      <div className="relative flex-1 w-full h-full overflow-hidden select-none">
        <svg
          className="w-full h-full"
          viewBox="0 0 100 100"
          preserveAspectRatio="none"
        >
          {/* Tactical Grid Background */}
          <defs>
            <pattern
              id="grid-pattern"
              width="10"
              height="10"
              patternUnits="userSpaceOnUse"
            >
              <path
                d="M 10 0 L 0 0 0 10"
                fill="none"
                stroke="rgba(51, 65, 85, 0.25)"
                strokeWidth="0.3"
              />
            </pattern>
            <radialGradient id="radar-sweep" cx="50%" cy="50%" r="50%">
              <stop offset="0%" stopColor="rgba(56, 189, 248, 0.15)" />
              <stop offset="100%" stopColor="rgba(15, 23, 42, 0)" />
            </radialGradient>
          </defs>

          {/* Background Grid */}
          <rect width="100" height="100" fill="url(#grid-pattern)" />

          {/* Simulated Highway / Route Networks */}
          <g stroke="rgba(71, 85, 105, 0.4)" strokeWidth="0.6" strokeDasharray="1,1" fill="none">
            <path d="M 10 20 Q 40 35 90 25" />
            <path d="M 20 80 Q 50 60 85 85" />
            <path d="M 50 10 L 50 90" stroke="rgba(59, 130, 246, 0.25)" strokeWidth="0.8" />
            <path d="M 10 50 L 90 50" stroke="rgba(59, 130, 246, 0.25)" strokeWidth="0.8" />
          </g>

          {/* Radar Sweep Circle */}
          {mapLayer === "radar" && (
            <circle
              cx="50"
              cy="50"
              r="40"
              fill="url(#radar-sweep)"
              stroke="rgba(56, 189, 248, 0.3)"
              strokeWidth="0.3"
            />
          )}

          {/* Vehicle Markers */}
          {vehicles.map((v) => {
            const { x, y } = toSvgCoords(v.lat, v.lng);
            const isSelected = selectedVehicleId === v.shiftId;
            const isCritical = v.status === "critical";
            const isAlert = v.status === "alert";

            const pinColor = isCritical
              ? "#ef4444"
              : isAlert
              ? "#f59e0b"
              : "#22c55e";

            return (
              <g
                key={v.shiftId}
                className="cursor-pointer transition-transform hover:scale-125"
                onClick={() => onSelectVehicle(v.shiftId)}
              >
                {/* Pulsing ring for alerts */}
                {(isCritical || isAlert || isSelected) && (
                  <circle
                    cx={x}
                    cy={y}
                    r={isSelected ? "4.5" : "3.5"}
                    fill="none"
                    stroke={pinColor}
                    strokeWidth="0.4"
                    opacity="0.8"
                    className="animate-ping"
                  />
                )}

                {/* Inner vehicle dot */}
                <circle
                  cx={x}
                  cy={y}
                  r="2"
                  fill={pinColor}
                  stroke="#0f172a"
                  strokeWidth="0.5"
                />

                {/* Vehicle Plate Tag */}
                <text
                  x={x}
                  y={y - 3}
                  textAnchor="middle"
                  fill="#f1f5f9"
                  fontSize="2.2"
                  fontWeight="bold"
                  fontFamily="monospace"
                >
                  {v.vehiclePlate}
                </text>
              </g>
            );
          })}
        </svg>

        {/* Selected Vehicle Floating HUD Card */}
        {selectedVehicleId && (() => {
          const v = vehicles.find((item) => item.shiftId === selectedVehicleId);
          if (!v) return null;
          return (
            <div className="absolute bottom-4 left-4 right-4 md:right-auto md:w-80 bg-slate-900/90 border border-slate-700/80 backdrop-blur-xl rounded-xl p-3.5 shadow-2xl animate-fade-in-up">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <Truck className="w-4 h-4 text-blue-400" />
                  <span className="font-mono font-bold text-sm text-white">
                    {v.vehiclePlate}
                  </span>
                </div>
                <span
                  className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                    v.status === "critical"
                      ? "bg-red-500/20 text-red-400 border border-red-500/40"
                      : v.status === "alert"
                      ? "bg-amber-500/20 text-amber-400 border border-amber-500/40"
                      : "bg-emerald-500/20 text-emerald-400 border border-emerald-500/40"
                  }`}
                >
                  {v.status}
                </span>
              </div>

              <div className="grid grid-cols-2 gap-2 text-xs text-slate-300">
                <div>
                  <span className="text-[10px] text-slate-500 block">Driver</span>
                  <span className="font-medium text-slate-200">{v.driverName}</span>
                </div>
                <div>
                  <span className="text-[10px] text-slate-500 block">PERCLOS Index</span>
                  <span className="font-mono font-bold text-slate-200">
                    {(v.perclos * 100).toFixed(1)}%
                  </span>
                </div>
                <div>
                  <span className="text-[10px] text-slate-500 block">Speed</span>
                  <span className="font-mono text-slate-200">{v.speedKmH} km/h</span>
                </div>
                <div>
                  <span className="text-[10px] text-slate-500 block">Status</span>
                  <span className="text-slate-200">
                    {v.lastEvent ? `Last: ${v.lastEvent.event_type}` : "Normal Ops"}
                  </span>
                </div>
              </div>
            </div>
          );
        })()}
      </div>

      {/* Bottom Map Legend */}
      <div className="px-4 py-2 border-t border-slate-800/80 bg-slate-950/90 flex items-center justify-between text-xs text-slate-400">
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-1.5">
            <div className="w-2 h-2 rounded-full bg-emerald-400" />
            <span>Normal</span>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="w-2 h-2 rounded-full bg-amber-400" />
            <span>Yawn / Warning</span>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="w-2 h-2 rounded-full bg-red-500" />
            <span>Critical Microsleep</span>
          </div>
        </div>
        <div className="font-mono text-[11px] text-slate-500">
          Supabase Realtime Stream &bull; &lt;50ms
        </div>
      </div>
    </div>
  );
}
