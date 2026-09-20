"""Weather-driven pest & disease risk — the second pillar of every serious
ag-weather platform (disease-risk modeling à la WeatherQuick / Cropengine).

Rules of thumb from plant-protection literature, computed from the 7-day
forecast: leaf-wetness proxies (rain hours + humidity) for fungal disease,
warm-dry-calm spells for sucking pests, humid warm nights for rice blast.
Deliberately transparent: every risk line carries its weather reason.
"""

from __future__ import annotations

LEVELS = {"low": 0, "moderate": 1, "high": 2}


def _fungal_wet_days(week: list[dict]) -> int:
    return sum(
        1
        for d in week
        if (d.get("precip_hours") or 0) >= 4
        and (d.get("rh") or 0) >= 78
        and 18 <= (d.get("tmax") or 0) <= 30
    )


def _dry_warm_streak(week: list[dict]) -> int:
    streak = 0
    for d in week:
        if (d.get("precip") or 0) < 1 and 25 <= (d.get("tmax") or 0) <= 33 and (d.get("wind") or 99) < 15:
            streak += 1
        else:
            break
    return streak


def _humid_nights(week: list[dict]) -> int:
    return sum(1 for d in week if (d.get("rh") or 0) >= 85 and (d.get("tmin") or 0) >= 18)


def pest_risks(daily: list[dict], climate: dict, crop: str) -> list[dict]:
    week = daily[:7]
    risks: list[dict] = []

    # ── fungal disease pressure (blights, rusts, mildews) ──────────────────
    wet = _fungal_wet_days(week)
    if wet >= 2:
        fungal = {
            "id": "fungal",
            "name": "Fungal disease pressure (blight / rust / mildew)",
            "kind": "disease",
            "risk": "high",
            "reason": f"{wet} of the next 7 days combine 4+ rain-hours with humidity ≥78% and 18–30°C — the classic leaf-wetness infection window.",
            "tip": "Scout weekly; if a protective spray is due, use the driest low-wind day. Improve air movement where possible.",
        }
    elif wet == 1:
        fungal = {
            "id": "fungal",
            "name": "Fungal disease pressure (blight / rust / mildew)",
            "kind": "disease",
            "risk": "moderate",
            "reason": "One infection-favourable day (prolonged leaf wetness with mild temperatures) in the coming week.",
            "tip": "Keep scouting; no urgent action if the crop is currently clean.",
        }
    else:
        fungal = {
            "id": "fungal",
            "name": "Fungal disease pressure (blight / rust / mildew)",
            "kind": "disease",
            "risk": "low",
            "reason": "No prolonged leaf-wetness windows expected — conditions stay unfavourable for infection.",
            "tip": "",
        }
    risks.append(fungal)

    # ── sucking pests (aphids / thrips / mites) ────────────────────────────
    streak = _dry_warm_streak(week)
    dry_context = climate.get("dry_streak_days", 0) >= 10
    if streak >= 4 or (streak >= 3 and dry_context):
        sucking = {
            "id": "sucking-pests",
            "name": "Aphid / thrip / mite build-up",
            "kind": "pest",
            "risk": "high",
            "reason": f"{streak} consecutive warm, dry, calm days forecast — sucking pests multiply fastest in exactly this weather.",
            "tip": "Check undersides of new leaves; spray only in the calm early-morning window (see spray planner).",
        }
    elif streak >= 2:
        sucking = {
            "id": "sucking-pests",
            "name": "Aphid / thrip / mite build-up",
            "kind": "pest",
            "risk": "moderate",
            "reason": "A short warm-dry-calm spell is developing — watch new growth.",
            "tip": "Scout twice this week.",
        }
    else:
        sucking = {
            "id": "sucking-pests",
            "name": "Aphid / thrip / mite build-up",
            "kind": "pest",
            "risk": "low",
            "reason": "Rain or wind will interrupt pest build-up weather.",
            "tip": "",
        }
    risks.append(sucking)

    # ── crop-specific signals ───────────────────────────────────────────────
    if crop == "rice":
        nights = _humid_nights(week)
        if nights >= 2 and (climate.get("classification") in ("above-normal", "near-normal")):
            risks.insert(
                0,
                {
                    "id": "blast",
                    "name": "Rice blast risk",
                    "kind": "disease",
                    "risk": "high" if nights >= 3 else "moderate",
                    "reason": f"{nights} humid nights (≥85% RH, min ≥18°C) ahead — blast spores germinate on wet leaves overnight.",
                    "tip": "Drain excess standing water where possible; avoid excess nitrogen; scout lower leaves for eye-shaped lesions.",
                },
            )
    if crop == "cotton":
        hot = sum(1 for d in week if (d.get("tmax") or 0) >= 35)
        if hot >= 3:
            risks.append(
                {
                    "id": "bollworm",
                    "name": "Pink bollworm heat stress window",
                    "kind": "pest",
                    "risk": "moderate",
                    "reason": f"{hot} days ≥35°C — heat pushes rapid bollworm cycles on young bolls.",
                    "tip": "Inspect rosette flowers and green bolls; destroy affected bolls.",
                }
            )
    if crop == "wheat":
        warm_humid = sum(
            1
            for d in week
            if (d.get("tmax") or 0) >= 25 and (d.get("precip") or 0) >= 2
        )
        if warm_humid >= 2:
            risks.insert(
                0,
                {
                    "id": "rust",
                    "name": "Wheat yellow/brown rust watch",
                    "kind": "disease",
                    "risk": "moderate",
                    "reason": "Warm (≥25°C) showery days ahead — rust spreads fast on a wet canopy in warm weather.",
                    "tip": "Scout the flag leaf; a protective spray is most effective before the flag-leaf stage.",
                },
            )

    risks.sort(key=lambda r: LEVELS[r["risk"]], reverse=True)
    return risks
