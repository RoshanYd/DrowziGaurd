# ⚡ DrowsiGuard Analytics Microservice (FastAPI)

Asynchronous Python microservice responsible for fatigue risk index calculations, driver safety scores, shift aggregations, and DOT/regulatory compliance PDF generation using ReportLab.

---

## 🎯 Core Capabilities

1. **Driver Risk Index Calculation (`/analytics/risk-score`)**:
   - Multi-factor algorithm evaluating:
     - PERCLOS (% Eye Closure duration)
     - Micro-sleep occurrences (>1.5s events)
     - Yawn frequency and sustained mouth openness
     - Continuous driving shift duration (exponential risk penalty after 4 hours)
   - Outputs a normalized `0.0 - 1.0` Risk Index and categorical safety rating (`LOW`, `MODERATE`, `HIGH`, `CRITICAL`).

2. **Shift Performance Summary (`/analytics/shift-summary/{shift_id}`)**:
   - Aggregates rolling telemetry samples into executive metrics:
     - Average EAR & MAR
     - Blink frequency per minute
     - Time spent in drowsy state vs. fully alert state
     - Safety compliance recommendation

3. **Automated Compliance PDF Export (`/reports/compliance-pdf`)**:
   - Produces high-resolution, vector-quality PDF audit reports branded with corporate and vehicle metadata.
   - Includes tabular shift chronology, timestamped incident logs, and DOT safety certifications.

---

## 🛠️ Tech Stack & Dependencies

- **FastAPI**: Modern, high-performance async web framework.
- **Uvicorn**: ASGI web server implementation.
- **Pydantic v2**: Data validation and type-safe payload models.
- **ReportLab**: Enterprise PDF rendering engine.
- **NumPy & Pandas**: Statistical analysis and rolling window aggregations.

---

## 🚀 Running the Analytics Service

### Prerequisites
- Python 3.10+ installed

### Setup & Installation
```bash
cd apps/analytics-service
python -m venv venv
# On Windows:
.\venv\Scripts\activate
# On Linux/macOS:
source venv/bin/activate

pip install -r requirements.txt
```

### Start the Service
```bash
uvicorn main:app --host 0.0.0.0 --port 8000 --reload
```

The API will be available at `http://localhost:8000`.

### Interactive API Documentation
- **Swagger UI**: [http://localhost:8000/docs](http://localhost:8000/docs)
- **ReDoc**: [http://localhost:8000/redoc](http://localhost:8000/redoc)
- **Health Check**: [http://localhost:8000/health](http://localhost:8000/health)

---

## 📋 API Endpoints Reference

| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/health` | Service health status and uptime |
| `POST` | `/analytics/risk-score` | Computes driver risk index from telemetry payload |
| `GET` | `/analytics/shift-summary/{shift_id}` | Aggregated metrics for a completed driving shift |
| `POST` | `/reports/compliance-pdf` | Generates downloadable ReportLab PDF audit document |
