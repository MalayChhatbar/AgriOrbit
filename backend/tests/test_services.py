"""Unit tests for the service layer (offline — all external calls monkeypatched)."""

from __future__ import annotations

from datetime import date

from app.services import climate as climate_svc
from app.services import kb, openmeteo, rules
from app.services import granite
from tests.conftest import make_archive_payload, make_forecast_payload


# --------------------------------------------------------------------------- #
# openmeteo parsing
# --------------------------------------------------------------------------- #
def test_aggregate_daily_merges_hourly_and_daily():
    rows = openmeteo.aggregate_daily(make_forecast_payload(days=3))
    assert len(rows) == 3
    for row in rows:
        assert row["tmax"] == 33.0 and row["tmin"] == 24.0
        assert row["rh"] == 60.0  # hourly values reduced to daily mean
        assert row["sm0_1"] == 0.28
        assert row["pressure"] == 990.0


def test_feature_matrix_complete():
    rows = openmeteo.aggregate_daily(make_forecast_payload(days=5))
    matrix = openmeteo.feature_matrix(rows)
    assert matrix is not None
    assert len(matrix) == 5 and len(matrix[0]) == len(openmeteo.FEATURE_NAMES)


def test_feature_matrix_rejects_missing_values():
    payload = make_forecast_payload(days=2)
    payload["daily"]["temperature_2m_max"] = [33.0, None]
    rows = openmeteo.aggregate_daily(payload)
    assert openmeteo.feature_matrix(rows) is None


# --------------------------------------------------------------------------- #
# climate anomaly
# --------------------------------------------------------------------------- #
def _patch_archive(monkeypatch, recent_fn, clim_fn=2.0):
    def fake(lat, lon, start, end, variables, cache_ttl=0):
        s, e = date.fromisoformat(start), date.fromisoformat(end)
        fn = clim_fn if s.year <= 1991 else recent_fn
        return make_archive_payload(s, e, fn)

    monkeypatch.setattr(openmeteo, "fetch_archive_daily", fake)


def test_climate_severe_deficit(monkeypatch):
    _patch_archive(monkeypatch, recent_fn=0.0, clim_fn=2.0)
    result = climate_svc.compute_climate(28.6, 77.2, today=date(2026, 9, 19))
    assert result["observed_mm"] == 0.0
    assert result["normal_mm"] == 60.0  # 30 days × 2 mm
    assert result["anomaly_pct"] == -100.0
    assert result["classification"] == "severe-deficit"
    assert result["dry_streak_days"] >= 30
    assert len(result["monthly_normals"]) == 12


def test_climate_above_normal(monkeypatch):
    _patch_archive(monkeypatch, recent_fn=3.0, clim_fn=2.0)
    result = climate_svc.compute_climate(28.6, 77.2, today=date(2026, 9, 19))
    assert result["anomaly_pct"] == 50.0
    assert result["classification"] == "above-normal"
    assert result["dry_streak_days"] == 0


# --------------------------------------------------------------------------- #
# rules engine
# --------------------------------------------------------------------------- #
def _climate(**overrides):
    base = {
        "observed_mm": 40.0,
        "normal_mm": 50.0,
        "anomaly_pct": -20.0,
        "classification": "below-normal",
        "dry_streak_days": 0,
    }
    base.update(overrides)
    return base


def test_heavy_rain_alert(forecast_rows):
    payload = make_forecast_payload(precip_by_day={2: 55.0})
    rows = openmeteo.aggregate_daily(payload)
    alerts = rules.build_alerts(rows, _climate())
    assert any(a["title"] == "Heavy rain expected" for a in alerts)


def test_drought_watch_alert(forecast_rows):
    clim = _climate(dry_streak_days=15, classification="below-normal", anomaly_pct=-35.0)
    zero = [dict(r, precip=0.0) for r in forecast_rows]
    alerts = rules.build_alerts(zero, clim)
    assert any(a["title"] == "Drought watch" for a in alerts)


def test_base_advisory_structure(forecast_rows):
    advisory = rules.base_advisory("wheat", forecast_rows, _climate(), None)
    assert {"summary", "actions", "cautions", "confidence", "metrics"} <= advisory.keys()
    assert advisory["metrics"]["rain_7d_mm"] >= 0


# --------------------------------------------------------------------------- #
# kb + granite fallbacks
# --------------------------------------------------------------------------- #
def test_kb_retrieval_scores_relevant_chunk():
    refs = kb.retrieve("when should I irrigate wheat before frost?")
    assert refs and any("rigat" in r["title"].lower() or "frost" in r["title"].lower() for r in refs)


def test_ml_predict_with_fake_session(monkeypatch):
    """predict() applies sigmoid to logits and expm1 to the log-total."""
    import math

    import numpy as np

    from app.services import ml_forecast

    class FakeSession:
        def get_inputs(self):
            class I: name = "features"
            return [I()]

        def get_outputs(self):
            class O:  # noqa: D401 - tiny stub
                def __init__(self, n): self.name = n
            return [O("rain_logits"), O("log_total_mm")]

        def run(self, outs, feed):
            x = next(iter(feed.values()))
            assert x.shape == (1, 30, 10)
            return [np.zeros((1, 7), dtype=np.float32), np.array([[math.log1p(12.0)]], dtype=np.float32)]

    monkeypatch.setattr(ml_forecast, "_state", {
        "loaded": True,
        "session": FakeSession(),
        "input_name": "features",
        "output_names": ["rain_logits", "log_total_mm"],
        "scaler": {"mean": [0.0] * 10, "std": [1.0] * 10, "feature_names": openmeteo.FEATURE_NAMES},
        "metrics": None,
        "error": None,
    })
    out = ml_forecast.predict([[0.0] * 10] * 30)
    assert len(out["rain_probabilities"]) == 7
    assert all(p["probability"] == 0.5 for p in out["rain_probabilities"])
    assert out["expected_total_mm"] == 12.0


def test_granite_falls_back_without_key():
    ctx = {
        "forecast": {"daily": openmeteo.aggregate_daily(make_forecast_payload())},
        "climate": _climate(),
        "alerts": [],
        "base_advisory": {"summary": "s", "actions": [], "cautions": []},
    }
    result = granite.generate_advisory(ctx, "wheat")
    assert result["source"] == "rules" and result["advisory"] is None
    reply = granite.chat([{"role": "user", "content": "how much rain?"}], None, [], "wheat")
    assert reply["source"] == "rules"
