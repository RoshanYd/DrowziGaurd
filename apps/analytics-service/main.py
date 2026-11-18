"""
DrowsiGuard — FastAPI Analytics Microservice
=============================================
Provides asynchronous analytics endpoints for:
- Driver risk score computation
- Shift summary statistics
- Fleet-wide analytics
- PDF compliance report generation

Connects to Supabase PostgreSQL for data access.
"""

import os
from datetime import datetime, timedelta
from io import BytesIO
from typing import Optional

import numpy as np
import pandas as pd
from dotenv import load_dotenv
from fastapi import FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
from pydantic import BaseModel
from supabase import create_client, Client

load_dotenv()

# ─── FastAPI App ───
app = FastAPI(
    title="DrowsiGuard Analytics Service",
    description="Asynchronous analytics engine for driver fatigue monitoring",
    version="1.0.0",
    docs_url="/docs",
    redoc_url="/redoc",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:3000",
        os.getenv("FRONTEND_URL", "http://localhost:3000"),
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ─── Supabase Client ───
def get_supabase() -> Client:
    url = os.getenv("NEXT_PUBLIC_SUPABASE_URL", "")
    key = os.getenv("SUPABASE_SERVICE_ROLE_KEY", "")
    if not url or not key:
        raise HTTPException(
            status_code=500,
            detail="Supabase configuration missing. Set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY.",
        )
    return create_client(url, key)


# ─── Pydantic Models ───
class RiskScoreResponse(BaseModel):
    driver_id: str
    driver_name: str
    risk_score: float
    risk_level: str
    total_events: int
    microsleep_count: int
    yawn_count: int
    distraction_count: int
    avg_perclos: float
    total_shift_hours: float
    events_per_hour: float


class ShiftSummary(BaseModel):
    shift_id: str
    driver_name: str
    vehicle_plate: str
    status: str
    start_time: str
    end_time: Optional[str]
    duration_hours: float
    total_events: int
    microsleep_events: int
    yawn_events: int
    distraction_events: int
    avg_perclos: float
    risk_score: float


class FleetOverview(BaseModel):
    total_drivers: int
    active_shifts: int
    total_events_today: int
    high_risk_drivers: int
    avg_fleet_risk: float
    events_by_type: dict
    hourly_distribution: list


# ─── Risk Calculation Engine ───
def compute_risk_score(
    events_per_hour: float,
    microsleep_ratio: float,
    avg_perclos: float,
    shift_duration_hours: float,
) -> tuple[float, str]:
    """
    Compute a composite driver risk score (0-100) based on:
    - Event frequency (events per hour)
    - Microsleep ratio (most dangerous event type)
    - Average PERCLOS score
    - Shift duration fatigue factor
    
    Returns (score, level) where level is LOW/MEDIUM/HIGH/CRITICAL.
    """
    # Weighted risk components
    frequency_score = min(events_per_hour * 15, 30)  # Max 30 points
    microsleep_score = microsleep_ratio * 30          # Max 30 points
    perclos_score = min(avg_perclos * 40, 25)         # Max 25 points
    
    # Duration fatigue multiplier (increases risk after 4+ hours)
    duration_factor = 1.0 + max(0, (shift_duration_hours - 4) * 0.05)
    duration_score = min((shift_duration_hours / 12) * 15, 15)  # Max 15 points
    
    raw_score = (frequency_score + microsleep_score + perclos_score + duration_score) * duration_factor
    risk_score = min(round(raw_score, 1), 100.0)
    
    # Risk level classification
    if risk_score >= 75:
        level = "CRITICAL"
    elif risk_score >= 50:
        level = "HIGH"
    elif risk_score >= 25:
        level = "MEDIUM"
    else:
        level = "LOW"
    
    return risk_score, level


# ─── API Endpoints ───

@app.get("/")
async def root():
    return {"service": "DrowsiGuard Analytics", "status": "healthy", "version": "1.0.0"}


@app.get("/health")
async def health_check():
    return {"status": "ok", "timestamp": datetime.utcnow().isoformat()}


@app.get("/api/analytics/driver/{driver_id}/risk", response_model=RiskScoreResponse)
async def get_driver_risk(
    driver_id: str,
    days: int = Query(default=7, ge=1, le=90, description="Analysis window in days"),
):
    """Compute comprehensive risk score for a specific driver."""
    supabase = get_supabase()
    
    since = (datetime.utcnow() - timedelta(days=days)).isoformat()
    
    # Fetch driver profile
    profile_res = supabase.table("profiles").select("*").eq("id", driver_id).execute()
    if not profile_res.data:
        raise HTTPException(status_code=404, detail="Driver not found")
    profile = profile_res.data[0]
    
    # Fetch shifts within time window
    shifts_res = (
        supabase.table("shifts")
        .select("*")
        .eq("driver_id", driver_id)
        .gte("start_time", since)
        .execute()
    )
    
    # Fetch fatigue events within time window
    events_res = (
        supabase.table("fatigue_events")
        .select("*")
        .eq("driver_id", driver_id)
        .gte("created_at", since)
        .execute()
    )
    
    events = events_res.data or []
    shifts = shifts_res.data or []
    
    # Calculate metrics
    total_events = len(events)
    microsleep_count = sum(1 for e in events if e["event_type"] == "microsleep")
    yawn_count = sum(1 for e in events if e["event_type"] == "yawn")
    distraction_count = sum(1 for e in events if e["event_type"] == "distraction")
    avg_perclos = np.mean([e["perclos_score"] for e in events]) if events else 0.0
    
    # Calculate total shift hours
    total_hours = 0
    for shift in shifts:
        start = datetime.fromisoformat(shift["start_time"].replace("Z", "+00:00"))
        end = (
            datetime.fromisoformat(shift["end_time"].replace("Z", "+00:00"))
            if shift.get("end_time")
            else datetime.utcnow().replace(tzinfo=start.tzinfo)
        )
        total_hours += (end - start).total_seconds() / 3600
    
    events_per_hour = total_events / max(total_hours, 0.1)
    microsleep_ratio = microsleep_count / max(total_events, 1)
    
    risk_score, risk_level = compute_risk_score(
        events_per_hour, microsleep_ratio, float(avg_perclos), total_hours
    )
    
    return RiskScoreResponse(
        driver_id=driver_id,
        driver_name=profile["full_name"],
        risk_score=risk_score,
        risk_level=risk_level,
        total_events=total_events,
        microsleep_count=microsleep_count,
        yawn_count=yawn_count,
        distraction_count=distraction_count,
        avg_perclos=round(float(avg_perclos), 4),
        total_shift_hours=round(total_hours, 1),
        events_per_hour=round(events_per_hour, 2),
    )


@app.get("/api/analytics/shift/{shift_id}/summary", response_model=ShiftSummary)
async def get_shift_summary(shift_id: str):
    """Get detailed analytics summary for a specific shift."""
    supabase = get_supabase()
    
    # Fetch shift
    shift_res = supabase.table("shifts").select("*, profiles(full_name)").eq("id", shift_id).execute()
    if not shift_res.data:
        raise HTTPException(status_code=404, detail="Shift not found")
    
    shift = shift_res.data[0]
    
    # Fetch events for this shift
    events_res = supabase.table("fatigue_events").select("*").eq("shift_id", shift_id).execute()
    events = events_res.data or []
    
    # Compute duration
    start = datetime.fromisoformat(shift["start_time"].replace("Z", "+00:00"))
    end = (
        datetime.fromisoformat(shift["end_time"].replace("Z", "+00:00"))
        if shift.get("end_time")
        else datetime.utcnow().replace(tzinfo=start.tzinfo)
    )
    duration_hours = (end - start).total_seconds() / 3600
    
    # Event breakdown
    microsleep = sum(1 for e in events if e["event_type"] == "microsleep")
    yawn = sum(1 for e in events if e["event_type"] == "yawn")
    distraction = sum(1 for e in events if e["event_type"] == "distraction")
    avg_perclos = float(np.mean([e["perclos_score"] for e in events])) if events else 0.0
    
    events_per_hour = len(events) / max(duration_hours, 0.1)
    microsleep_ratio = microsleep / max(len(events), 1)
    
    risk_score, _ = compute_risk_score(events_per_hour, microsleep_ratio, avg_perclos, duration_hours)
    
    driver_name = shift.get("profiles", {}).get("full_name", "Unknown")
    
    return ShiftSummary(
        shift_id=shift_id,
        driver_name=driver_name,
        vehicle_plate=shift["vehicle_plate"],
        status=shift["status"],
        start_time=shift["start_time"],
        end_time=shift.get("end_time"),
        duration_hours=round(duration_hours, 1),
        total_events=len(events),
        microsleep_events=microsleep,
        yawn_events=yawn,
        distraction_events=distraction,
        avg_perclos=round(avg_perclos, 4),
        risk_score=risk_score,
    )


@app.get("/api/analytics/fleet/overview", response_model=FleetOverview)
async def get_fleet_overview():
    """Get fleet-wide analytics overview for the current day."""
    supabase = get_supabase()
    
    today = datetime.utcnow().replace(hour=0, minute=0, second=0).isoformat()
    
    # Fetch all drivers
    drivers_res = supabase.table("profiles").select("id").eq("role", "driver").execute()
    total_drivers = len(drivers_res.data or [])
    
    # Active shifts
    active_shifts_res = supabase.table("shifts").select("*").eq("status", "active").execute()
    active_shifts = len(active_shifts_res.data or [])
    
    # Today's events
    events_res = supabase.table("fatigue_events").select("*").gte("created_at", today).execute()
    events = events_res.data or []
    
    events_by_type = {
        "microsleep": sum(1 for e in events if e["event_type"] == "microsleep"),
        "yawn": sum(1 for e in events if e["event_type"] == "yawn"),
        "distraction": sum(1 for e in events if e["event_type"] == "distraction"),
    }
    
    # Hourly distribution
    hourly = [0] * 24
    for e in events:
        hour = datetime.fromisoformat(e["created_at"].replace("Z", "+00:00")).hour
        hourly[hour] += 1
    
    return FleetOverview(
        total_drivers=total_drivers,
        active_shifts=active_shifts,
        total_events_today=len(events),
        high_risk_drivers=0,  # Computed asynchronously in production
        avg_fleet_risk=0.0,
        events_by_type=events_by_type,
        hourly_distribution=hourly,
    )


@app.get("/api/analytics/report/{driver_id}/pdf")
async def generate_driver_report(
    driver_id: str,
    days: int = Query(default=7, ge=1, le=90),
):
    """Generate and download a PDF compliance report for a driver."""
    from services.pdf_generator import generate_driver_pdf
    
    supabase = get_supabase()
    since = (datetime.utcnow() - timedelta(days=days)).isoformat()
    
    # Fetch data
    profile_res = supabase.table("profiles").select("*").eq("id", driver_id).execute()
    if not profile_res.data:
        raise HTTPException(status_code=404, detail="Driver not found")
    
    shifts_res = (
        supabase.table("shifts")
        .select("*")
        .eq("driver_id", driver_id)
        .gte("start_time", since)
        .execute()
    )
    
    events_res = (
        supabase.table("fatigue_events")
        .select("*")
        .eq("driver_id", driver_id)
        .gte("created_at", since)
        .execute()
    )
    
    pdf_buffer = generate_driver_pdf(
        profile=profile_res.data[0],
        shifts=shifts_res.data or [],
        events=events_res.data or [],
        days=days,
    )
    
    filename = f"drowsiguard_report_{profile_res.data[0]['full_name'].replace(' ', '_')}_{datetime.utcnow().strftime('%Y%m%d')}.pdf"
    
    return StreamingResponse(
        pdf_buffer,
        media_type="application/pdf",
        headers={"Content-Disposition": f"attachment; filename={filename}"},
    )


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000, reload=True)
