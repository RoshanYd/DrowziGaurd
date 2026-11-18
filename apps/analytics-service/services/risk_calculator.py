"""
DrowsiGuard — Risk Calculator Service
======================================
Statistical risk modeling for driver fatigue assessment.
"""

import numpy as np
from datetime import datetime, timedelta
from typing import Optional


class RiskCalculator:
    """
    Multi-factor risk assessment engine for driver drowsiness.
    
    Risk factors:
    1. Event frequency (events per hour)
    2. Event severity weighting (microsleep > distraction > yawn)
    3. PERCLOS score trends
    4. Time-of-day risk (higher risk during 2-6 AM)
    5. Cumulative shift duration fatigue
    """

    # Severity weights for different event types
    EVENT_WEIGHTS = {
        "microsleep": 3.0,
        "distraction": 2.0,
        "yawn": 1.0,
    }

    # Time-of-day risk multipliers
    TIME_RISK = {
        range(0, 6): 1.5,    # Midnight to 6 AM — highest risk
        range(6, 10): 1.0,   # Morning
        range(10, 14): 0.8,  # Midday — lowest risk
        range(14, 17): 1.0,  # Afternoon
        range(17, 21): 0.9,  # Evening
        range(21, 24): 1.3,  # Late night
    }

    @classmethod
    def compute_comprehensive_risk(
        cls,
        events: list[dict],
        shift_start: datetime,
        shift_end: Optional[datetime] = None,
    ) -> dict:
        """
        Compute a comprehensive risk assessment for a driver's shift.
        
        Returns dict with risk_score (0-100), risk_level, and component breakdown.
        """
        if shift_end is None:
            shift_end = datetime.utcnow()

        duration_hours = max((shift_end - shift_start).total_seconds() / 3600, 0.1)

        if not events:
            return {
                "risk_score": 0.0,
                "risk_level": "LOW",
                "frequency_score": 0.0,
                "severity_score": 0.0,
                "perclos_score": 0.0,
                "duration_score": 0.0,
                "time_score": 0.0,
                "total_events": 0,
            }

        # 1. Frequency score (0-25)
        events_per_hour = len(events) / duration_hours
        frequency_score = min(events_per_hour * 8, 25)

        # 2. Severity-weighted score (0-30)
        weighted_sum = sum(
            cls.EVENT_WEIGHTS.get(e.get("event_type", "yawn"), 1.0)
            for e in events
        )
        max_possible = len(events) * 3.0
        severity_ratio = weighted_sum / max_possible
        severity_score = severity_ratio * 30

        # 3. PERCLOS trend score (0-25)
        perclos_values = [e.get("perclos_score", 0) for e in events]
        avg_perclos = np.mean(perclos_values)
        # Recent PERCLOS trend (is it getting worse?)
        if len(perclos_values) >= 3:
            recent = np.mean(perclos_values[-3:])
            trend_factor = 1.0 + max(0, (recent - avg_perclos) * 2)
        else:
            trend_factor = 1.0
        perclos_score = min(avg_perclos * 30 * trend_factor, 25)

        # 4. Duration fatigue score (0-15)
        # Risk increases exponentially after 4 hours
        if duration_hours <= 4:
            duration_score = (duration_hours / 4) * 5
        else:
            duration_score = 5 + min((duration_hours - 4) ** 1.3, 10)

        # 5. Time-of-day risk score (multiplier)
        time_multiplier = 1.0
        for time_range, multiplier in cls.TIME_RISK.items():
            if shift_start.hour in time_range:
                time_multiplier = multiplier
                break

        # Composite score
        raw_score = (frequency_score + severity_score + perclos_score + duration_score) * time_multiplier
        risk_score = min(round(raw_score, 1), 100.0)

        # Risk level
        if risk_score >= 75:
            level = "CRITICAL"
        elif risk_score >= 50:
            level = "HIGH"
        elif risk_score >= 25:
            level = "MEDIUM"
        else:
            level = "LOW"

        return {
            "risk_score": risk_score,
            "risk_level": level,
            "frequency_score": round(frequency_score, 1),
            "severity_score": round(severity_score, 1),
            "perclos_score": round(perclos_score, 1),
            "duration_score": round(duration_score, 1),
            "time_multiplier": time_multiplier,
            "total_events": len(events),
            "events_per_hour": round(events_per_hour, 2),
            "avg_perclos": round(float(avg_perclos), 4),
        }
