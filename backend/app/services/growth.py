"""Crop growth tracking via Growing Degree Days (GDD).

The classic agronomy instrument (shipped by every established ag-weather platform):
temperature accumulated above a crop's base threshold, mapped to phenological stages.
Stage GDD targets are indicative mid-points from agronomy literature — actual values
vary by variety and sowing time, which we state openly in the UI.
"""

from __future__ import annotations

from datetime import date, timedelta

from . import openmeteo

# (name, cumulative GDD from sowing to end of stage) — indicative values
CROP_GDD: dict[str, dict] = {
    "wheat": {
        "base": 0.0,
        "stages": [
            ("Emergence", 120),
            ("Tillering", 450),
            ("Jointing / boot", 900),
            ("Heading / flowering", 1350),
            ("Grain filling", 1900),
            ("Maturity", 2400),
        ],
    },
    "rice": {
        "base": 10.0,
        "stages": [
            ("Seedling", 200),
            ("Tillering", 700),
            ("Panicle initiation", 1100),
            ("Flowering", 1600),
            ("Grain filling", 2100),
            ("Maturity", 2600),
        ],
    },
    "maize": {
        "base": 10.0,
        "stages": [
            ("Emergence", 125),
            ("V6 (knee-high)", 475),
            ("Tasseling", 900),
            ("Silking", 1000),
            ("Grain filling", 1450),
            ("Maturity", 1650),
        ],
    },
    "cotton": {
        "base": 15.5,
        "stages": [
            ("Emergence", 180),
            ("Squaring", 550),
            ("Flowering", 950),
            ("Boll development", 1500),
            ("Boll opening", 1900),
            ("Maturity", 2200),
        ],
    },
    "soybean": {
        "base": 10.0,
        "stages": [
            ("Emergence", 130),
            ("V3", 400),
            ("Flowering (R1)", 750),
            ("Pod fill (R4)", 1150),
            ("R6 full seed", 1450),
            ("Maturity", 1700),
        ],
    },
    "mustard": {
        "base": 5.0,
        "stages": [
            ("Emergence", 120),
            ("Rosette", 400),
            ("Bolting", 700),
            ("Flowering", 1050),
            ("Siliqua fill", 1350),
            ("Maturity", 1600),
        ],
    },
    "groundnut": {
        "base": 10.0,
        "stages": [
            ("Emergence", 150),
            ("Vegetative", 500),
            ("Flowering", 800),
            ("Pegging", 1050),
            ("Pod fill", 1400),
            ("Maturity", 1700),
        ],
    },
}

GENERIC_GDD = {
    "base": 10.0,
    "stages": [
        ("Establishment", 150),
        ("Vegetative growth", 500),
        ("Flowering", 900),
        ("Product formation", 1300),
        ("Maturity", 1600),
    ],
}

ARCHIVE_LAG_DAYS = 6


def _daily_gdd(tmax: float | None, tmin: float | None, base: float) -> float:
    if tmax is None or tmin is None:
        return 0.0
    return max(0.0, (tmax + tmin) / 2.0 - base)


def growth_status(
    lat: float, lon: float, crop: str, sowing_date: date, today: date | None = None
) -> dict:
    today = today or date.today()
    model = CROP_GDD.get(crop, GENERIC_GDD)
    base = model["base"]

    # observed past: ERA5 archive from sowing to the last complete reanalysis day
    past_end = today - timedelta(days=ARCHIVE_LAG_DAYS)
    past_start = min(sowing_date, past_end)
    past = openmeteo.fetch_archive_daily(
        lat,
        lon,
        past_start.isoformat(),
        past_end.isoformat(),
        ("temperature_2m_max", "temperature_2m_min"),
    )

    # forward: numerical forecast (already includes today)
    forecast = openmeteo.fetch_forecast(lat, lon, forecast_days=16)

    observed_days: list[tuple[date, float]] = []
    for d, tmax, tmin in zip(
        past["time"], past["temperature_2m_max"], past["temperature_2m_min"]
    ):
        if d >= sowing_date.isoformat():
            observed_days.append((date.fromisoformat(d), _daily_gdd(tmax, tmin, base)))
    # fill the archive-lag gap with the forecast's recent days (past_days covers it)
    fc_daily = forecast["daily"]
    for row in fc_daily:
        d = date.fromisoformat(row["date"])
        if past_end < d <= today:
            observed_days.append((d, _daily_gdd(row.get("tmax"), row.get("tmin"), base)))

    observed_days.sort(key=lambda t: t[0])
    accumulated = sum(g for _, g in observed_days)

    # project forecast GDD day by day to estimate stage ETAs
    future: list[tuple[date, float]] = []
    run = accumulated
    for row in fc_daily:
        d = date.fromisoformat(row["date"])
        if d <= today:
            continue
        g = _daily_gdd(row.get("tmax"), row.get("tmin"), base)
        future.append((d, g))
        run += g

    stages_out: list[dict] = []
    for name, target in model["stages"]:
        reached = accumulated >= target
        eta: str | None = None
        if not reached:
            run2 = accumulated
            for d, g in future:
                run2 += g
                if run2 >= target:
                    eta = d.isoformat()
                    break
        stages_out.append(
            {
                "name": name,
                "target_gdd": target,
                "reached": reached,
                "eta": eta,
            }
        )

    current_stage = next(
        (s["name"] for s in reversed(stages_out) if s["reached"]), "Pre-emergence"
    )
    next_stage = next((s["name"] for s in stages_out if not s["reached"]), None)
    total_target = model["stages"][-1][1]
    forecast_gdd_7d = round(sum(g for _, g in future[:7]), 1)

    return {
        "crop": crop,
        "base_temp_c": base,
        "sowing_date": sowing_date.isoformat(),
        "days_since_sowing": max(0, (today - sowing_date).days),
        "accumulated_gdd": round(accumulated, 1),
        "maturity_gdd": total_target,
        "progress_pct": round(min(accumulated / total_target, 1.0) * 100, 1),
        "current_stage": current_stage,
        "next_stage": next_stage,
        "stages": stages_out,
        "forecast_gdd_7d": forecast_gdd_7d,
        "note": (
            "GDD stage targets are indicative mid-points from agronomy literature; "
            "actual timing varies with variety and sowing window."
        ),
    }
