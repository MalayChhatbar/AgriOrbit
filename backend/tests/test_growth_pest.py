"""Tests for the GDD growth tracker and the pest/disease risk engine (offline)."""

from __future__ import annotations

from datetime import date, timedelta

from app.services import growth as growth_svc
from app.services import openmeteo, pest
from tests.conftest import make_forecast_payload

# --------------------------------------------------------------------------- #
# growth tracker
# --------------------------------------------------------------------------- #
def _fake_archive(monkeypatch, tmax=30.0, tmin=20.0):
    def fake(lat, lon, start, end, variables, cache_ttl=0):
        s, e = date.fromisoformat(start), date.fromisoformat(end)
        days, cur = [], s
        while cur <= e:
            days.append(cur.isoformat())
            cur += timedelta(days=1)
        n = len(days)
        return {
            "time": days,
            "temperature_2m_max": [tmax] * n,
            "temperature_2m_min": [tmin] * n,
        }

    monkeypatch.setattr(openmeteo, "fetch_archive_daily", fake)


def _fake_forecast(monkeypatch):
    payload = make_forecast_payload(days=16)
    monkeypatch.setattr(
        openmeteo,
        "fetch_forecast",
        lambda lat, lon, forecast_days=16: {
            "latitude": payload["latitude"],
            "longitude": payload["longitude"],
            "elevation": payload["elevation"],
            "timezone": payload["timezone"],
            "current": payload["current"],
            "daily": openmeteo.aggregate_daily(payload),
        },
    )


def test_growth_status_wheat_reaches_grain_filling(monkeypatch):
    _fake_archive(monkeypatch)
    _fake_forecast(monkeypatch)
    today = date(2026, 9, 19)
    out = growth_svc.growth_status(28.6, 77.2, "wheat", date(2026, 7, 1), today)
    # 75 archive days × 25 GDD + today's forecast row (28.5) ≈ 1903
    assert out["current_stage"] == "Grain filling"
    assert out["base_temp_c"] == 0
    assert out["accumulated_gdd"] > 1800
    assert 0 < out["progress_pct"] <= 100
    reached = [s for s in out["stages"] if s["reached"]]
    assert reached[-1]["name"] == "Grain filling"
    assert out["stages"][-1]["reached"] is False
    assert out["forecast_gdd_7d"] > 0


def test_growth_status_unknown_crop_uses_generic_model(monkeypatch):
    _fake_archive(monkeypatch)
    _fake_forecast(monkeypatch)
    out = growth_svc.growth_status(28.6, 77.2, "quinoa", date(2026, 8, 1), date(2026, 9, 19))
    assert out["base_temp_c"] == 10
    assert out["stages"][0]["name"] == "Establishment"


def _pest_week(**overrides):
    base = {
        "precip": 0.0, "precip_hours": 0, "precip_prob": 10, "rh": 60.0,
        "tmax": 28.0, "tmin": 18.0, "wind": 10.0, "et0": 4.0, "date": "2026-09-19",
    }
    return [{**base, **overrides} for _ in range(7)]


def test_pest_fungal_high_on_leaf_wetness():
    week = _pest_week()
    for i in (0, 2):
        week[i] = {**week[i], "precip_hours": 6, "rh": 85, "tmax": 25, "precip": 8}
    risks = {r["id"]: r for r in pest.pest_risks(week, {"dry_streak_days": 0}, "wheat")}
    assert risks["fungal"]["risk"] == "high"
    assert "leaf" in risks["fungal"]["reason"] or "rain-hours" in risks["fungal"]["reason"]


def test_pest_sucking_pests_high_on_dry_warm_calm_streak():
    week = _pest_week()
    risks = {r["id"]: r for r in pest.pest_risks(week, {"dry_streak_days": 12}, "cotton")}
    assert risks["sucking-pests"]["risk"] == "high"


def test_pest_rice_blast_flagged():
    week = _pest_week(rh=90.0, tmin=20.0)
    risks = [r for r in pest.pest_risks(week, {"dry_streak_days": 0, "classification": "near-normal"}, "rice")]
    ids = [r["id"] for r in risks]
    assert "blast" in ids
    # highest-severity risks first
    order = {"low": 0, "moderate": 1, "high": 2}
    severities = [order[r["risk"]] for r in risks]
    assert severities == sorted(severities, reverse=True)


def test_pest_low_risk_week():
    week = _pest_week(precip=5.0, precip_hours=1, wind=30.0, rh=55.0, tmax=18.0)
    risks = {r["id"]: r for r in pest.pest_risks(week, {"dry_streak_days": 0}, "maize")}
    assert risks["fungal"]["risk"] == "low"
    assert risks["sucking-pests"]["risk"] == "low"
