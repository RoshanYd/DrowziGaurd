"""
DrowsiGuard — PDF Report Generator
====================================
Generates professional PDF compliance reports using ReportLab.
Reports include driver summary, event breakdown, risk assessment,
and shift timeline visualization.
"""

from io import BytesIO
from datetime import datetime
from typing import Optional

from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.units import mm, inch
from reportlab.lib.colors import HexColor
from reportlab.platypus import (
    SimpleDocTemplate,
    Paragraph,
    Spacer,
    Table,
    TableStyle,
    PageBreak,
)
from reportlab.lib.enums import TA_CENTER, TA_LEFT, TA_RIGHT
import numpy as np


# ─── Brand Colors ───
PRIMARY = HexColor("#0F172A")       # Dark navy
ACCENT = HexColor("#3B82F6")        # Blue
SUCCESS = HexColor("#22C55E")       # Green
WARNING = HexColor("#F59E0B")       # Amber
DANGER = HexColor("#EF4444")        # Red
CRITICAL = HexColor("#DC2626")      # Dark red
LIGHT_BG = HexColor("#F8FAFC")      # Light background
BORDER = HexColor("#E2E8F0")        # Border gray


def get_risk_color(risk_level: str) -> HexColor:
    colors = {
        "LOW": SUCCESS,
        "MEDIUM": WARNING,
        "HIGH": DANGER,
        "CRITICAL": CRITICAL,
    }
    return colors.get(risk_level, BORDER)


def generate_driver_pdf(
    profile: dict,
    shifts: list[dict],
    events: list[dict],
    days: int = 7,
) -> BytesIO:
    """
    Generate a comprehensive driver fatigue compliance report as PDF.
    
    Returns a BytesIO buffer ready for streaming.
    """
    buffer = BytesIO()
    doc = SimpleDocTemplate(
        buffer,
        pagesize=A4,
        leftMargin=20 * mm,
        rightMargin=20 * mm,
        topMargin=25 * mm,
        bottomMargin=20 * mm,
    )

    styles = getSampleStyleSheet()
    elements = []

    # ─── Custom Styles ───
    title_style = ParagraphStyle(
        "CustomTitle",
        parent=styles["Title"],
        fontSize=24,
        textColor=PRIMARY,
        spaceAfter=6,
    )
    subtitle_style = ParagraphStyle(
        "CustomSubtitle",
        parent=styles["Normal"],
        fontSize=12,
        textColor=HexColor("#64748B"),
        spaceAfter=20,
    )
    heading_style = ParagraphStyle(
        "CustomHeading",
        parent=styles["Heading2"],
        fontSize=16,
        textColor=PRIMARY,
        spaceBefore=20,
        spaceAfter=10,
    )
    body_style = ParagraphStyle(
        "CustomBody",
        parent=styles["Normal"],
        fontSize=10,
        textColor=HexColor("#334155"),
        spaceAfter=6,
    )

    # ═══════════════════════════════════════
    # HEADER
    # ═══════════════════════════════════════
    elements.append(Paragraph("DrowsiGuard", title_style))
    elements.append(Paragraph("Driver Fatigue Compliance Report", subtitle_style))

    report_date = datetime.utcnow().strftime("%B %d, %Y at %H:%M UTC")
    elements.append(Paragraph(f"Generated: {report_date}", body_style))
    elements.append(Paragraph(f"Analysis Period: Last {days} days", body_style))
    elements.append(Spacer(1, 15))

    # ═══════════════════════════════════════
    # DRIVER PROFILE
    # ═══════════════════════════════════════
    elements.append(Paragraph("Driver Profile", heading_style))

    profile_data = [
        ["Name", profile.get("full_name", "N/A")],
        ["Role", profile.get("role", "driver").title()],
        ["Driver ID", profile.get("id", "N/A")[:12] + "..."],
        ["Account Created", profile.get("created_at", "N/A")[:10]],
    ]

    profile_table = Table(profile_data, colWidths=[120, 350])
    profile_table.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (0, -1), LIGHT_BG),
        ("TEXTCOLOR", (0, 0), (0, -1), PRIMARY),
        ("FONTNAME", (0, 0), (0, -1), "Helvetica-Bold"),
        ("FONTSIZE", (0, 0), (-1, -1), 10),
        ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
        ("LEFTPADDING", (0, 0), (-1, -1), 10),
        ("RIGHTPADDING", (0, 0), (-1, -1), 10),
        ("TOPPADDING", (0, 0), (-1, -1), 6),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 6),
        ("GRID", (0, 0), (-1, -1), 0.5, BORDER),
    ]))
    elements.append(profile_table)
    elements.append(Spacer(1, 15))

    # ═══════════════════════════════════════
    # EVENT SUMMARY
    # ═══════════════════════════════════════
    elements.append(Paragraph("Fatigue Event Summary", heading_style))

    total_events = len(events)
    microsleep = sum(1 for e in events if e.get("event_type") == "microsleep")
    yawn = sum(1 for e in events if e.get("event_type") == "yawn")
    distraction = sum(1 for e in events if e.get("event_type") == "distraction")
    avg_perclos = np.mean([e.get("perclos_score", 0) for e in events]) if events else 0

    summary_data = [
        ["Metric", "Value"],
        ["Total Fatigue Events", str(total_events)],
        ["Microsleep Events", str(microsleep)],
        ["Yawn Events", str(yawn)],
        ["Distraction Events", str(distraction)],
        ["Average PERCLOS Score", f"{avg_perclos:.4f}"],
        ["Total Shifts", str(len(shifts))],
    ]

    summary_table = Table(summary_data, colWidths=[250, 220])
    summary_table.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, 0), PRIMARY),
        ("TEXTCOLOR", (0, 0), (-1, 0), HexColor("#FFFFFF")),
        ("FONTNAME", (0, 0), (-1, 0), "Helvetica-Bold"),
        ("BACKGROUND", (0, 1), (-1, -1), HexColor("#FFFFFF")),
        ("FONTSIZE", (0, 0), (-1, -1), 10),
        ("ALIGN", (1, 0), (1, -1), "CENTER"),
        ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
        ("LEFTPADDING", (0, 0), (-1, -1), 10),
        ("RIGHTPADDING", (0, 0), (-1, -1), 10),
        ("TOPPADDING", (0, 0), (-1, -1), 6),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 6),
        ("GRID", (0, 0), (-1, -1), 0.5, BORDER),
        ("ROWBACKGROUNDS", (0, 1), (-1, -1), [HexColor("#FFFFFF"), LIGHT_BG]),
    ]))
    elements.append(summary_table)
    elements.append(Spacer(1, 15))

    # ═══════════════════════════════════════
    # SHIFT DETAILS
    # ═══════════════════════════════════════
    if shifts:
        elements.append(Paragraph("Shift History", heading_style))

        shift_header = ["#", "Vehicle", "Status", "Start", "End", "Events"]
        shift_rows = [shift_header]

        for i, shift in enumerate(shifts[:20], 1):  # Max 20 shifts
            start = shift.get("start_time", "")[:16].replace("T", " ")
            end = (shift.get("end_time") or "Active")[:16].replace("T", " ")
            shift_events = sum(1 for e in events if e.get("shift_id") == shift["id"])
            shift_rows.append([
                str(i),
                shift.get("vehicle_plate", "N/A"),
                shift.get("status", "N/A").title(),
                start,
                end,
                str(shift_events),
            ])

        shift_table = Table(shift_rows, colWidths=[30, 80, 70, 110, 110, 60])
        shift_table.setStyle(TableStyle([
            ("BACKGROUND", (0, 0), (-1, 0), ACCENT),
            ("TEXTCOLOR", (0, 0), (-1, 0), HexColor("#FFFFFF")),
            ("FONTNAME", (0, 0), (-1, 0), "Helvetica-Bold"),
            ("FONTSIZE", (0, 0), (-1, -1), 9),
            ("ALIGN", (0, 0), (-1, -1), "CENTER"),
            ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
            ("LEFTPADDING", (0, 0), (-1, -1), 5),
            ("RIGHTPADDING", (0, 0), (-1, -1), 5),
            ("TOPPADDING", (0, 0), (-1, -1), 5),
            ("BOTTOMPADDING", (0, 0), (-1, -1), 5),
            ("GRID", (0, 0), (-1, -1), 0.5, BORDER),
            ("ROWBACKGROUNDS", (0, 1), (-1, -1), [HexColor("#FFFFFF"), LIGHT_BG]),
        ]))
        elements.append(shift_table)

    elements.append(Spacer(1, 20))

    # ═══════════════════════════════════════
    # FOOTER / DISCLAIMER
    # ═══════════════════════════════════════
    disclaimer_style = ParagraphStyle(
        "Disclaimer",
        parent=styles["Normal"],
        fontSize=8,
        textColor=HexColor("#94A3B8"),
        alignment=TA_CENTER,
    )
    elements.append(Spacer(1, 30))
    elements.append(Paragraph(
        "This report is auto-generated by DrowsiGuard Analytics Engine. "
        "Data is based on edge-computed facial landmark analysis and should be used "
        "as supplementary information alongside manual driver wellness assessments.",
        disclaimer_style,
    ))
    elements.append(Paragraph(
        f"© {datetime.utcnow().year} DrowsiGuard — Driver Fatigue Monitoring System",
        disclaimer_style,
    ))

    # Build PDF
    doc.build(elements)
    buffer.seek(0)
    return buffer
