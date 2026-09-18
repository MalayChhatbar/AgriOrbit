"""Shared fixtures: synthetic Open-Meteo payloads (no network in tests)."""

from __future__ import annotations

from datetime import date, timedelta

import pytest

from app.services import openmeteo


def make_forecast_payload(days: int = 16, precip_by_day: dict[int, float] | None = None) -> dict:
    start = date(2026, 9, 19)
    daily_dates = [(start + timedelta(days=i)).isoformat() for i in range(days)]
    hourly_times = [
        f"{(start + timedelta(days=d)).isoformat()}T{h:02d}:00"
        for d in range(days)
        for h in range(24)
    ]
    precip = [
        (precip_by_day or {}).get(i, 0.0 if i % 3 else 2.0) for i in range(days)
    ]
    n_h = len(hourly_times)
    return {
        "latitude": 28.61,
        "longitude": 77.2,
        "elevation": 220.0,
        "timezone": "Asia/Kolkata",
        "utc_offset_seconds": 19800,
        "current": {
            "time": f"{start.isoformat()}T10:00",
            "temperature_2m": 31.4,
            "relative_humidity_2m": 62,
            "apparent_temperature": 34.1,
            "precipitation": 0.0,
            "weather_code": 2,
            "wind_speed_10m": 11.2,
            "is_day": 1,
        },
        "daily": {
            "time": daily_dates,
            "weather_code": [1 if p == 0 else 61 for p in precip],
            "temperature_2m_max": [33.0] * days,
            "temperature_2m_min": [24.0] * days,
            "precipitation_sum": precip,
            "precipitation_probability_max": [20 if p == 0 else 70 for p in precip],
            "precipitation_hours": [0 if p == 0 else 3 for p in precip],
            "et0_fao_evapotranspiration": [4.5] * days,
            "shortwave_radiation_sum": [20.0] * days,
            "wind_speed_10m_max": [14.0] * days,
            "relative_humidity_2m_mean": [60.0] * days,
            "surface_pressure_mean": [990.0] * days,
            "soil_moisture_0_to_7cm_mean": [0.28] * days,
            "soil_moisture_7_to_28cm_mean": [0.30] * days,
        },
        "hourly": {
            "time": hourly_times,
            "relative_humidity_2m": [60.0] * n_h,
            "surface_pressure": [990.0] * n_h,
            "soil_moisture_0_to_1cm": [0.28] * n_h,
            "soil_moisture_3_to_9cm": [0.30] * n_h,
            "soil_moisture_9_to_27cm": [0.31] * n_h,
            "soil_moisture_27_to_81cm": [0.33] * n_h,
        },
    }


def make_archive_payload(
    start: date, end: date, precip_fn=2.0
) -> dict[str, list]:
    times, values = [], []
    cur = start
    while cur <= end:
        times.append(cur.isoformat())
        values.append(precip_fn(cur) if callable(precip_fn) else precip_fn)
        cur += timedelta(days=1)
    return {"time": times, "precipitation_sum": values}


@pytest.fixture(autouse=True)
def _clear_service_cache():
    openmeteo.clear_cache()
    yield
    openmeteo.clear_cache()


@pytest.fixture
def forecast_rows():
    return openmeteo.aggregate_daily(make_forecast_payload())
