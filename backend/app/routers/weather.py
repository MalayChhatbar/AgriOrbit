"""Weather, climate and geocoding endpoints."""

from __future__ import annotations

from datetime import datetime, timezone

from fastapi import APIRouter, HTTPException, Query

from app.config import get_settings
from app.services import climate as climate_svc
from app.services import ml_forecast, openmeteo, rules

router = APIRouter()


@router.get("/health")
def health() -> dict:
    settings = get_settings()
    return {
        "status": "ok",
        "service": "agriorbit-api",
        "time": datetime.now(timezone.utc).isoformat(),
        "llm_configured": bool(settings.nvidia_api_key),
        "llm_model": settings.nvidia_model if settings.nvidia_api_key else None,
        "ml_model_available": ml_forecast.model_available(),
    }


@router.get("/geocode")
def geocode(q: str = Query(min_length=2, max_length=80)) -> dict:
    try:
        return {"results": openmeteo.geocode(q)}
    except openmeteo.OpenMeteoError as exc:
        raise HTTPException(status_code=502, detail=str(exc)) from exc


@router.get("/dashboard")
def dashboard(
    lat: float = Query(ge=-90, le=90),
    lon: float = Query(ge=-180, le=180),
    crop: str = "other",
    stage: str = "vegetative",
) -> dict:
    """Everything the advisory dashboard renders, in one round trip."""
    try:
        forecast = openmeteo.fetch_forecast(lat, lon)
        climate = climate_svc.compute_climate(lat, lon)
    except openmeteo.OpenMeteoError as exc:
        raise HTTPException(status_code=502, detail=str(exc)) from exc

    alerts = rules.build_alerts(forecast["daily"], climate)
    advisory = rules.base_advisory(
        crop, forecast["daily"], climate, forecast.get("current"), stage
    )

    return {
        "location": {
            "lat": lat,
            "lon": lon,
            "resolved_lat": forecast["latitude"],
            "resolved_lon": forecast["longitude"],
            "elevation": forecast["elevation"],
            "timezone": forecast["timezone"],
        },
        "crop": crop,
        "stage": stage,
        "generated_at": datetime.now(timezone.utc).isoformat(),
        "current": forecast["current"],
        "daily": forecast["daily"],
        "climate": climate,
        "alerts": alerts,
        "base_advisory": advisory,
    }
