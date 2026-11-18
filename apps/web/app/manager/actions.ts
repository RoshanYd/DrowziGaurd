"use server";

import { createClient } from "@/lib/supabase/server";
import { Shift, FatigueEvent, Profile } from "@/types/database";

export interface FleetVehicleDetail {
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

export async function getActiveFleetAction(): Promise<{
  success: boolean;
  vehicles: FleetVehicleDetail[];
  events: FatigueEvent[];
  error?: string;
}> {
  try {
    const supabase = await createClient();

    // Fetch active shifts with driver profiles
    const { data: shiftsData, error: shiftsError } = await supabase
      .from("shifts")
      .select("*, profiles:driver_id(full_name)")
      .eq("status", "active")
      .order("start_time", { ascending: false });

    // Fetch recent fatigue events (last 24 hours)
    const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    const { data: eventsData, error: eventsError } = await supabase
      .from("fatigue_events")
      .select("*")
      .gte("created_at", yesterday)
      .order("created_at", { ascending: false })
      .limit(50);

    if (shiftsData && shiftsData.length > 0) {
      const vehicles: FleetVehicleDetail[] = shiftsData.map((shift, idx) => {
        const shiftEvents = (eventsData || []).filter((e) => e.shift_id === shift.id);
        const lastEvent = shiftEvents[0];

        const hasMicrosleep = shiftEvents.some((e) => e.event_type === "microsleep");
        const hasYawn = shiftEvents.some((e) => e.event_type === "yawn");

        const status = hasMicrosleep ? "critical" : hasYawn ? "alert" : "active";

        return {
          shiftId: shift.id,
          driverId: shift.driver_id,
          driverName: shift.profiles?.full_name || `Driver ${idx + 1}`,
          vehiclePlate: shift.vehicle_plate,
          status,
          lastEvent,
          perclos: lastEvent ? lastEvent.perclos_score : 0.04,
          lat: lastEvent?.location_lat || 28.6139 + (idx - 1) * 0.03,
          lng: lastEvent?.location_lng || 77.2090 + (idx - 1) * 0.04,
          speedKmH: Math.floor(45 + Math.random() * 35),
          shiftStartTime: shift.start_time,
        };
      });

      return {
        success: true,
        vehicles,
        events: eventsData || [],
      };
    }

    // Default simulated fleet data for testing & demo out-of-the-box
    const demoVehicles: FleetVehicleDetail[] = [
      {
        shiftId: "demo-v1",
        driverId: "drv-101",
        driverName: "Vikram Sharma",
        vehiclePlate: "DL-01-AX-9942",
        status: "active",
        perclos: 0.08,
        lat: 28.625,
        lng: 77.215,
        speedKmH: 62,
        shiftStartTime: new Date(Date.now() - 3.5 * 3600 * 1000).toISOString(),
      },
      {
        shiftId: "demo-v2",
        driverId: "drv-102",
        driverName: "Rajesh Kumar",
        vehiclePlate: "HR-26-BR-4109",
        status: "alert",
        perclos: 0.28,
        lat: 28.59,
        lng: 77.18,
        speedKmH: 54,
        shiftStartTime: new Date(Date.now() - 5.2 * 3600 * 1000).toISOString(),
        lastEvent: {
          id: "evt-yawn-1",
          shift_id: "demo-v2",
          driver_id: "drv-102",
          event_type: "yawn",
          perclos_score: 0.28,
          location_lat: 28.59,
          location_lng: 77.18,
          created_at: new Date(Date.now() - 4 * 60 * 1000).toISOString(),
        },
      },
      {
        shiftId: "demo-v3",
        driverId: "drv-103",
        driverName: "Amitabh Verma",
        vehiclePlate: "UP-16-CZ-8821",
        status: "critical",
        perclos: 0.44,
        lat: 28.64,
        lng: 77.24,
        speedKmH: 38,
        shiftStartTime: new Date(Date.now() - 6.8 * 3600 * 1000).toISOString(),
        lastEvent: {
          id: "evt-micro-1",
          shift_id: "demo-v3",
          driver_id: "drv-103",
          event_type: "microsleep",
          perclos_score: 0.44,
          location_lat: 28.64,
          location_lng: 77.24,
          created_at: new Date(Date.now() - 1 * 60 * 1000).toISOString(),
        },
      },
      {
        shiftId: "demo-v4",
        driverId: "drv-104",
        driverName: "Sanjay Patel",
        vehiclePlate: "MH-12-PQ-3301",
        status: "active",
        perclos: 0.05,
        lat: 28.605,
        lng: 77.23,
        speedKmH: 70,
        shiftStartTime: new Date(Date.now() - 2.1 * 3600 * 1000).toISOString(),
      },
    ];

    const demoEvents: FatigueEvent[] = [
      {
        id: "evt-micro-1",
        shift_id: "demo-v3",
        driver_id: "drv-103",
        event_type: "microsleep",
        perclos_score: 0.44,
        location_lat: 28.64,
        location_lng: 77.24,
        created_at: new Date(Date.now() - 1 * 60 * 1000).toISOString(),
      },
      {
        id: "evt-yawn-1",
        shift_id: "demo-v2",
        driver_id: "drv-102",
        event_type: "yawn",
        perclos_score: 0.28,
        location_lat: 28.59,
        location_lng: 77.18,
        created_at: new Date(Date.now() - 4 * 60 * 1000).toISOString(),
      },
      {
        id: "evt-dist-1",
        shift_id: "demo-v2",
        driver_id: "drv-102",
        event_type: "distraction",
        perclos_score: 0.22,
        location_lat: 28.58,
        location_lng: 77.17,
        created_at: new Date(Date.now() - 22 * 60 * 1000).toISOString(),
      },
    ];

    return {
      success: true,
      vehicles: demoVehicles,
      events: demoEvents,
    };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Failed to load fleet data";
    return { success: false, vehicles: [], events: [], error: message };
  }
}
