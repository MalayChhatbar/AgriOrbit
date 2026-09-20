"""Weather, climate and geocoding endpoints."""

from __future__ import annotations

from datetime import datetime, timezone

from fastapi import APIRouter, HTTPException, Query

from app.config import get_settings
from app.services import climate as climate_svc
from app.services import growth as growth_svc
from app.services import ml_forecast, openmeteo, pest, rules

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
    risks = pest.pest_risks(forecast["daily"], climate, crop)

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
        "pest_risks": risks,
        "base_advisory": advisory,
    }


@router.get("/growth")
def crop_growth(
    lat: float = Query(ge=-90, le=90),
    lon: float = Query(ge=-180, le=180),
    crop: str = "other",
    sowing_date: str = Query(pattern=r"^\d{4}-\d{2}-\d{2}$"),
) -> dict:
    """GDD-based growth tracker: accumulated thermal time since sowing, stage
    progress and projected stage ETAs from the live forecast."""
    from datetime import date as _date

    sow = _date.fromisoformat(sowing_date)
    today = _date.today()
    if sow > today:
        raise HTTPException(status_code=422, detail="Sowing date cannot be in the future")
    if (today - sow).days > 400:
        raise HTTPException(status_code=422, detail="Sowing date looks too far in the past (max 400 days)")
    try:
        return growth_svc.growth_status(lat, lon, crop, sow, today)
    except openmeteo.OpenMeteoError as exc:
        raise HTTPException(status_code=502, detail=str(exc)) from exc
