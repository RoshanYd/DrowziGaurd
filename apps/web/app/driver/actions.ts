"use server";

import { createClient } from "@/lib/supabase/server";
import { DriverTelemetryPayload, Shift } from "@/types/database";

export interface ActionResult<T> {
  success: boolean;
  data?: T;
  error?: string;
}

export async function startShiftAction(vehiclePlate: string): Promise<ActionResult<Shift>> {
  if (!vehiclePlate || vehiclePlate.trim().length === 0) {
    return { success: false, error: "Vehicle plate is required" };
  }

  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    // If Supabase is connected and user is logged in
    if (user) {
      const { data, error } = await supabase
        .from("shifts")
        .insert({
          driver_id: user.id,
          vehicle_plate: vehiclePlate.toUpperCase().trim(),
          status: "active",
        })
        .select()
        .single();

      if (error) {
        return { success: false, error: error.message };
      }
      return { success: true, data };
    }

    // Local / Demo mode fallback when running without cloud Supabase instance
    const demoShift: Shift = {
      id: "demo-shift-" + Date.now(),
      driver_id: "demo-driver-001",
      vehicle_plate: vehiclePlate.toUpperCase().trim(),
      status: "active",
      start_time: new Date().toISOString(),
      end_time: null,
    };

    return { success: true, data: demoShift };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Failed to start shift";
    return { success: false, error: message };
  }
}

export async function stopShiftAction(shiftId: string): Promise<ActionResult<{ shiftId: string }>> {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (user && !shiftId.startsWith("demo-")) {
      const { error } = await supabase
        .from("shifts")
        .update({
          status: "completed",
          end_time: new Date().toISOString(),
        })
        .eq("id", shiftId);

      if (error) {
        return { success: false, error: error.message };
      }
    }

    return { success: true, data: { shiftId } };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Failed to stop shift";
    return { success: false, error: message };
  }
}

export async function logFatigueEventAction(
  payload: DriverTelemetryPayload
): Promise<ActionResult<{ eventId: string }>> {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (user && !payload.shift_id.startsWith("demo-")) {
      const { data, error } = await supabase
        .from("fatigue_events")
        .insert({
          shift_id: payload.shift_id,
          driver_id: user.id,
          event_type: payload.event_type,
          perclos_score: payload.perclos_score,
          location_lat: payload.location_lat ?? null,
          location_lng: payload.location_lng ?? null,
        })
        .select("id")
        .single();

      if (error) {
        console.error("Supabase telemetry insert error:", error);
        return { success: false, error: error.message };
      }
      return { success: true, data: { eventId: data.id } };
    }

    // Demo/edge telemetry logging
    return {
      success: true,
      data: { eventId: "local-evt-" + Date.now() },
    };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Failed to log telemetry";
    return { success: false, error: message };
  }
}
