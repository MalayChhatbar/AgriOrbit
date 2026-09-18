"""API endpoint tests (FastAPI TestClient, all external calls monkeypatched)."""

from __future__ import annotations

from fastapi.testclient import TestClient

from app.main import app
from app.services import climate as climate_svc
from app.services import openmeteo
from tests.conftest import make_forecast_payload

client = TestClient(app)

CLIMATE = {
    "window_days": 30,
    "period": {"start": "2026-08-15", "end": "2026-09-13"},
    "observed_mm": 18.0,
    "normal_mm": 60.0,
    "anomaly_pct": -70.0,
    "percentile": 0.04,
    "dry_streak_days": 21,
    "classification": "severe-deficit",
    "climatology_period": "1991-2020",
    "monthly_normals": [1.0] * 12,
    "recent": [{"date": "2026-09-13", "precip": 0.0}],
}


def _forecast_response():
    payload = make_forecast_payload()
    return {
        "latitude": payload["latitude"],
        "longitude": payload["longitude"],
        "elevation": payload["elevation"],
        "timezone": payload["timezone"],
        "utc_offset_seconds": payload["utc_offset_seconds"],
        "current": payload["current"],
        "daily": openmeteo.aggregate_daily(payload),
    }


def test_health():
    r = client.get("/api/health")
    assert r.status_code == 200
    body = r.json()
    assert body["status"] == "ok"
    assert "ml_model_available" in body and "llm_configured" in body


def test_geocode(monkeypatch):
    monkeypatch.setattr(
        openmeteo,
        "geocode",
        lambda q, count=6: [
            {"name": "Delhi", "admin1": "Delhi", "country": "India", "latitude": 28.61, "longitude": 77.20, "country_code": "IN", "population": None}
        ],
    )
    r = client.get("/api/geocode", params={"q": "del"})
    assert r.status_code == 200 and r.json()["results"][0]["name"] == "Delhi"


def test_dashboard(monkeypatch):
    monkeypatch.setattr(openmeteo, "fetch_forecast", lambda lat, lon: _forecast_response())
    monkeypatch.setattr(climate_svc, "compute_climate", lambda lat, lon: dict(CLIMATE))
    r = client.get("/api/dashboard", params={"lat": 28.6, "lon": 77.2, "crop": "wheat"})
    assert r.status_code == 200
    body = r.json()
    assert len(body["daily"]) == 16
    assert body["climate"]["classification"] == "severe-deficit"
    assert any(a["title"] == "Drought watch" for a in body["alerts"])
    assert "metrics" in body["base_advisory"]


def test_dashboard_validation():
    r = client.get("/api/dashboard", params={"lat": 28.6})  # missing lon
    assert r.status_code == 422


def test_advisory_rules_source(monkeypatch):
    monkeypatch.setattr(openmeteo, "fetch_forecast", lambda lat, lon: _forecast_response())
    monkeypatch.setattr(climate_svc, "compute_climate", lambda lat, lon: dict(CLIMATE))
    r = client.post("/api/advisory", json={"lat": 28.6, "lon": 77.2, "crop": "wheat"})
    assert r.status_code == 200
    body = r.json()
    assert body["source"] == "rules"  # no NVIDIA_API_KEY in test env
    assert body["advisory"] is None
    assert body["base_advisory"]["summary"]


def test_chat_rules_fallback():
    r = client.post(
        "/api/chat",
        json={"messages": [{"role": "user", "content": "when should I irrigate?"}]},
    )
    assert r.status_code == 200
    body = r.json()
    assert body["source"] == "rules"
    assert "NVIDIA_API_KEY" in body["reply"]
    assert body["kb_refs"]  # retrieval found relevant sections


def test_mlforecast_unavailable_without_artifacts():
    r = client.get("/api/mlforecast", params={"lat": 28.6, "lon": 77.2})
    assert r.status_code == 200
    assert r.json()["available"] is False


def test_modelinfo():
    r = client.get("/api/modelinfo")
    assert r.status_code == 200
    body = r.json()
    assert body["model_id"] == "agriorbit-lstm-v1"
    assert body["available"] is False
