"""Open-Meteo client — single point of contact with the satellite-era weather APIs.

Data sources (all free, keyless, non-commercial):
  * Forecast API  — ECMWF IFS / GFS numerical weather prediction, 16-day outlook
  * Archive API   — ERA5 / ERA5-Land reanalysis (satellite-assimilated), 1940 → present
  * Geocoding API — place search

The same hourly/daily variable names are used in the forecast and archive APIs,
which lets the ML feature builder (ml_window) stay perfectly in sync with the
training pipeline in notebooks/train_agriorbit_colab.ipynb.
"""

from __future__ import annotations

import time
from typing import Any, Iterable

import httpx

FORECAST_URL = "https://api.open-meteo.com/v1/forecast"
ARCHIVE_URL = "https://archive-api.open-meteo.com/v1/archive"
GEOCODE_URL = "https://geocoding-api.open-meteo.com/v1/search"

TIMEOUT = 45.0

# Weather variables requested for the dashboard
DAILY_VARS = [
    "weather_code",
    "temperature_2m_max",
    "temperature_2m_min",
    "precipitation_sum",
    "precipitation_probability_max",
    "precipitation_hours",
    "et0_fao_evapotranspiration",
    "shortwave_radiation_sum",
    "wind_speed_10m_max",
]
HOURLY_VARS = [
    "relative_humidity_2m",
    "surface_pressure",
    "soil_moisture_0_to_1cm",
    "soil_moisture_3_to_9cm",
    "soil_moisture_9_to_27cm",
    "soil_moisture_27_to_81cm",
]
CURRENT_VARS = [
    "temperature_2m",
    "relative_humidity_2m",
    "apparent_temperature",
    "precipitation",
    "weather_code",
    "wind_speed_10m",
    "is_day",
]

# Feature schema shared by the Colab training notebook and inference.
# Order matters — the ONNX model consumes exactly this vector per day.
FEATURE_NAMES = [
    "tmax",       # temperature_2m_max          °C
    "tmin",       # temperature_2m_min          °C
    "precip",     # precipitation_sum           mm
    "et0",        # et0_fao_evapotranspiration  mm
    "radiation",  # shortwave_radiation_sum     MJ/m²
    "wind",       # wind_speed_10m_max          km/h
    "rh",         # relative_humidity_2m        %   (hourly → daily mean)
    "pressure",   # surface_pressure            hPa (hourly → daily mean)
    "sm0_1",      # soil_moisture_0_to_1cm      m³/m³ (hourly → daily mean)
    "sm3_9",      # soil_moisture_3_to_9cm      m³/m³ (hourly → daily mean)
]
ML_DAILY_VARS = [
    "temperature_2m_max",
    "temperature_2m_min",
    "precipitation_sum",
    "et0_fao_evapotranspiration",
    "shortwave_radiation_sum",
    "wind_speed_10m_max",
]
ML_HOURLY_VARS = [
    "relative_humidity_2m",
    "surface_pressure",
    "soil_moisture_0_to_1cm",
    "soil_moisture_3_to_9cm",
]

_HOURLY_TO_FIELD = {
    "relative_humidity_2m": "rh",
    "surface_pressure": "pressure",
    "soil_moisture_0_to_1cm": "sm0_1",
    "soil_moisture_3_to_9cm": "sm3_9",
    "soil_moisture_9_to_27cm": "sm9_27",
    "soil_moisture_27_to_81cm": "sm27_81",
}
_DAILY_TO_FIELD = {
    "weather_code": "code",
    "temperature_2m_max": "tmax",
    "temperature_2m_min": "tmin",
    "precipitation_sum": "precip",
    "precipitation_probability_max": "precip_prob",
    "precipitation_hours": "precip_hours",
    "et0_fao_evapotranspiration": "et0",
    "shortwave_radiation_sum": "radiation",
    "wind_speed_10m_max": "wind",
}


class OpenMeteoError(RuntimeError):
    pass


# --------------------------------------------------------------------------- #
# tiny in-memory TTL cache (climate calls are expensive + repeat constantly)
# --------------------------------------------------------------------------- #
_cache: dict[str, tuple[float, Any]] = {}


def _cached(key: str, ttl: int, fn):
    hit = _cache.get(key)
    if hit and time.time() - hit[0] < ttl:
        return hit[1]
    value = fn()
    _cache[key] = (time.time(), value)
    return value


def clear_cache() -> None:
    _cache.clear()


# --------------------------------------------------------------------------- #
# low level
# --------------------------------------------------------------------------- #
def _get(url: str, params: dict[str, Any]) -> dict[str, Any]:
    try:
        with httpx.Client(timeout=TIMEOUT) as client:
            resp = client.get(url, params=params)
            resp.raise_for_status()
            return resp.json()
    except httpx.HTTPError as exc:  # network or HTTP error
        raise OpenMeteoError(f"Open-Meteo request failed: {exc}") from exc


def _mean(values: Iterable[float | None]) -> float | None:
    vals = [v for v in values if v is not None]
    if not vals:
        return None
    return sum(vals) / len(vals)


# --------------------------------------------------------------------------- #
# parsing: merge open-meteo daily+hourly payload into one row per day
# --------------------------------------------------------------------------- #
def aggregate_daily(payload: dict[str, Any]) -> list[dict[str, Any]]:
    daily = payload.get("daily", {}) or {}
    hourly = payload.get("hourly", {}) or {}
    days: list[str] = daily.get("time", []) or []

    # bucket hourly values per date
    hourly_means: dict[str, dict[str, list[float | None]]] = {}
    h_times = hourly.get("time", []) or []
    for idx, ts in enumerate(h_times):
        day = ts[:10]
        bucket = hourly_means.setdefault(day, {})
        for var, field in _HOURLY_TO_FIELD.items():
            series = hourly.get(var)
            if series is not None:
                bucket.setdefault(var, []).append(series[idx])

    rows: list[dict[str, Any]] = []
    for i, day in enumerate(days):
        row: dict[str, Any] = {"date": day}
        for var, field in _DAILY_TO_FIELD.items():
            series = daily.get(var)
            row[field] = series[i] if series is not None and i < len(series) else None
        bucket = hourly_means.get(day, {})
        for var, field in _HOURLY_TO_FIELD.items():
            row[field] = _mean(bucket.get(var, [])) if var in bucket else None
        rows.append(row)
    return rows


def feature_matrix(days: list[dict[str, Any]]) -> list[list[float]] | None:
    """Convert aggregated daily rows into the ML feature matrix.

    Returns None if any required value is missing (caller decides how to react).
    """
    matrix: list[list[float]] = []
    for row in days:
        vec: list[float] = []
        for name in FEATURE_NAMES:
            value = row.get(name)
            if value is None:
                return None
            vec.append(float(value))
        matrix.append(vec)
    return matrix


# --------------------------------------------------------------------------- #
# public API
# --------------------------------------------------------------------------- #
def geocode(query: str, count: int = 6) -> list[dict[str, Any]]:
    payload = _get(
        GEOCODE_URL,
        {"name": query, "count": count, "language": "en", "format": "json"},
    )
    results = []
    for r in payload.get("results", []) or []:
        results.append(
            {
                "name": r.get("name"),
                "admin1": r.get("admin1"),
                "country": r.get("country"),
                "country_code": r.get("country_code"),
                "latitude": r.get("latitude"),
                "longitude": r.get("longitude"),
                "population": r.get("population"),
            }
        )
    return results


def fetch_forecast(lat: float, lon: float, forecast_days: int = 16) -> dict[str, Any]:
    payload = _get(
        FORECAST_URL,
        {
            "latitude": lat,
            "longitude": lon,
            "daily": ",".join(DAILY_VARS),
            "hourly": ",".join(HOURLY_VARS),
            "current": ",".join(CURRENT_VARS),
            "forecast_days": forecast_days,
            "timezone": "auto",
        },
    )
    return {
        "latitude": payload.get("latitude"),
        "longitude": payload.get("longitude"),
        "elevation": payload.get("elevation"),
        "timezone": payload.get("timezone"),
        "utc_offset_seconds": payload.get("utc_offset_seconds"),
        "current": payload.get("current", {}) or {},
        "daily": aggregate_daily(payload),
    }


def fetch_ml_window(lat: float, lon: float, past_days: int = 30) -> list[list[float]]:
    """Feature matrix of the last `past_days` complete days — model input at inference."""
    payload = _get(
        FORECAST_URL,
        {
            "latitude": lat,
            "longitude": lon,
            "daily": ",".join(ML_DAILY_VARS),
            "hourly": ",".join(ML_HOURLY_VARS),
            "past_days": past_days + 1,
            "forecast_days": 1,
            "timezone": "GMT",
        },
    )
    rows = aggregate_daily(payload)
    # drop the (incomplete) current day, keep exactly past_days complete days
    rows = [r for r in rows if r.get("tmax") is not None][:-1][-past_days:]
    matrix = feature_matrix(rows)
    if matrix is None or len(matrix) < past_days:
        raise OpenMeteoError("Incomplete model window from Open-Meteo")
    return matrix


def fetch_archive_daily(
    lat: float,
    lon: float,
    start: str,
    end: str,
    variables: tuple[str, ...] = ("precipitation_sum",),
    cache_ttl: int = 1800,
) -> dict[str, list]:
    """Daily ERA5 archive series between two ISO dates (inclusive)."""

    def _call():
        payload = _get(
            ARCHIVE_URL,
            {
                "latitude": lat,
                "longitude": lon,
                "start_date": start,
                "end_date": end,
                "daily": ",".join(variables),
                "timezone": "GMT",
            },
        )
        daily = payload.get("daily", {}) or {}
        return {"time": daily.get("time", []), **{v: daily.get(v, []) for v in variables}}

    key = f"archive|{round(lat, 2)}|{round(lon, 2)}|{start}|{end}|{','.join(variables)}"
    return _cached(key, cache_ttl, _call)
