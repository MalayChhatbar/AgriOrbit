"""Neural rain model endpoints."""

from __future__ import annotations

from fastapi import APIRouter, HTTPException, Query

from app.services import ml_forecast, openmeteo

router = APIRouter()


@router.get("/mlforecast")
def get_ml_forecast(
    lat: float = Query(ge=-90, le=90),
    lon: float = Query(ge=-180, le=180),
) -> dict:
    try:
        return ml_forecast.ml_forecast(lat, lon)
    except openmeteo.OpenMeteoError as exc:
        raise HTTPException(status_code=502, detail=str(exc)) from exc


@router.get("/modelinfo")
def get_model_info() -> dict:
    return ml_forecast.model_info()
