export type UserRole = "driver" | "manager";

export interface Profile {
  id: string;
  full_name: string;
  role: UserRole;
  created_at: string;
}

export type ShiftStatus = "active" | "completed";

export interface Shift {
  id: string;
  driver_id: string;
  vehicle_plate: string;
  status: ShiftStatus;
  start_time: string;
  end_time: string | null;
}

export type FatigueEventType = "microsleep" | "yawn" | "distraction";

export interface FatigueEvent {
  id: string;
  shift_id: string;
  driver_id: string;
  event_type: FatigueEventType;
  perclos_score: number;
  location_lat: number | null;
  location_lng: number | null;
  created_at: string;
}

export interface DriverTelemetryPayload {
  shift_id: string;
  event_type: FatigueEventType;
  perclos_score: number;
  location_lat?: number;
  location_lng?: number;
}
