"""Deterministic agronomy rules engine.

Always-on decision support derived from the 16-day forecast and climate context.
It acts as (a) the safety floor of the product when no LLM is configured and
(b) the factual scaffold that Granite is asked to rephrase — never to override.
"""

from __future__ import annotations

CROPS = [
    {"id": "wheat", "name": "Wheat"},
    {"id": "rice", "name": "Rice (paddy)"},
    {"id": "maize", "name": "Maize"},
    {"id": "cotton", "name": "Cotton"},
    {"id": "sugarcane", "name": "Sugarcane"},
    {"id": "soybean", "name": "Soybean"},
    {"id": "mustard", "name": "Mustard"},
    {"id": "groundnut", "name": "Groundnut"},
    {"id": "pulses", "name": "Pulses"},
    {"id": "vegetables", "name": "Vegetables"},
    {"id": "other", "name": "Other / general"},
]

PONDING_TOLERANT = {"rice"}
FROST_SENSITIVE = {"mustard", "vegetables", "potato", "pulses"}


def _day_label(idx: int, date_str: str) -> str:
    if idx == 0:
        return "Today"
    if idx == 1:
        return "Tomorrow"
    return date_str


def build_alerts(daily: list[dict], climate: dict) -> list[dict]:
    alerts: list[dict] = []
    week = daily[:7]

    # heavy single-day rain (≥ 40 mm)
    for i, d in enumerate(week):
        if (d.get("precip") or 0) >= 40:
            alerts.append(
                {
                    "level": "warning",
                    "title": "Heavy rain expected",
                    "detail": f"~{d['precip']:.0f} mm on {_day_label(i, d['date']).lower()}. "
                    "Postpone spraying/harvest, clear field drainage.",
                    "day": d["date"],
                }
            )
            break

    # sustained wet spell (3-day rolling ≥ 90 mm)
    for i in range(len(week) - 2):
        total = sum((daily[i + k].get("precip") or 0) for k in range(3))
        if total >= 90:
            alerts.append(
                {
                    "level": "warning",
                    "title": "Prolonged wet spell",
                    "detail": f"~{total:.0f} mm over 3 days from {daily[i]['date']}. "
                    "Watch for waterlogging and fungal pressure.",
                    "day": daily[i]["date"],
                }
            )
            break

    # heat stress (tmax ≥ 38 °C for 2+ consecutive days)
    hot = 0
    for i, d in enumerate(week):
        hot = hot + 1 if (d.get("tmax") or 0) >= 38 else 0
        if hot >= 2:
            alerts.append(
                {
                    "level": "warning",
                    "title": "Heat stress window",
                    "detail": f"Daytime highs ≥ 38 °C around {d['date']}. "
                    "Irrigate early morning; avoid midday fieldwork.",
                    "day": d["date"],
                }
            )
            break

    # frost risk
    for i, d in enumerate(week):
        if (d.get("tmin") or 99) <= 4:
            alerts.append(
                {
                    "level": "watch",
                    "title": "Frost risk",
                    "detail": f"Night low ~{d['tmin']:.0f} °C on {d['date']}. "
                    "Irrigate standing crops the previous evening.",
                    "day": d["date"],
                }
            )
            break

    # high wind
    for i, d in enumerate(week):
        if (d.get("wind") or 0) >= 50:
            alerts.append(
                {
                    "level": "watch",
                    "title": "High wind",
                    "detail": f"Gusts ~{d['wind']:.0f} km/h on {d['date']}. "
                    "Secure nurseries, trellises and harvested produce.",
                    "day": d["date"],
                }
            )
            break

    # dry spell outlook
    next7_rain = sum((d.get("precip") or 0) for d in week)
    if climate.get("dry_streak_days", 0) >= 12 and climate.get("classification") in (
        "below-normal",
        "severe-deficit",
    ):
        alerts.append(
            {
                "level": "warning",
                "title": "Drought watch",
                "detail": f"No meaningful rain for {climate['dry_streak_days']} days and the last "
                f"30 days are {abs(climate['anomaly_pct']):.0f}% below the 30-year normal.",
                "day": None,
            }
        )
    elif next7_rain < 5 and climate.get("classification") in ("below-normal", "severe-deficit"):
        alerts.append(
            {
                "level": "watch",
                "title": "Dry spell continuing",
                "detail": "Less than 5 mm expected in the next 7 days while rainfall is already "
                "below the seasonal normal.",
                "day": None,
            }
        )

    return alerts[:6]


def base_advisory(
    crop: str, daily: list[dict], climate: dict, current: dict | None = None
) -> dict:
    week = daily[:7]
    total_rain = sum((d.get("precip") or 0) for d in week)
    deficit = sum(max((d.get("et0") or 0) - (d.get("precip") or 0), 0) for d in week)
    anomaly = climate.get("anomaly_pct", 0.0)
    classification = climate.get("classification", "near-normal")

    actions: list[dict] = []

    # sowing window: first day with ≥50% rain chance followed by ≥8 mm over 3 days
    sow_idx = None
    for i in range(min(10, len(daily))):
        if (daily[i].get("precip_prob") or 0) >= 50:
            roll = sum((daily[i + k].get("precip") or 0) for k in range(3) if i + k < len(daily))
            if roll >= 8:
                sow_idx = i
                break
    if sow_idx is not None:
        actions.append(
            {
                "day": _day_label(sow_idx, daily[sow_idx]["date"]),
                "action": "Favourable sowing / transplanting window",
                "reason": f"Rain probability ≥ 50% with useful follow-up rain; soil profile will recharge.",
            }
        )
    elif total_rain < 5 and classification in ("below-normal", "severe-deficit"):
        actions.append(
            {
                "day": "Next 7 days",
                "action": "Hold rain-fed sowing, wait for a clearer rain signal",
                "reason": "Under 5 mm expected in the coming week and the trailing month is already below normal.",
            }
        )

    # irrigation need
    if deficit >= 20:
        actions.append(
            {
                "day": "Next 7 days",
                "action": f"Plan ~{deficit:.0f} mm of irrigation",
                "reason": "Evapotranspiration demand exceeds forecast rain; moisture reserve is being drawn down.",
            }
        )
    elif deficit <= 5 and total_rain >= 10:
        actions.append(
            {
                "day": "Next 7 days",
                "action": "Skip irrigation — rainfall covers crop demand",
                "reason": f"~{total_rain:.0f} mm expected against ~{sum((d.get('et0') or 0) for d in week):.0f} mm demand.",
            }
        )

    # best spray window: calmest dry day
    spray_candidates = [
        (i, d)
        for i, d in enumerate(week)
        if (d.get("precip") or 0) < 1 and (d.get("wind") or 99) < 20
    ]
    if spray_candidates:
        i, d = min(spray_candidates, key=lambda t: t[1].get("wind") or 99)
        actions.append(
            {
                "day": _day_label(i, d["date"]),
                "action": "Best window for spraying / fertilising",
                "reason": f"Dry day with light wind (~{d.get('wind') or 0:.0f} km/h).",
            }
        )

    # harvest drying window: 2+ consecutive dry days
    for i in range(len(week) - 1):
        if all((week[i + k].get("precip") or 0) < 1 for k in range(2)):
            actions.append(
                {
                    "day": _day_label(i, week[i]["date"]),
                    "action": "Good window for harvesting / drying produce",
                    "reason": "At least two consecutive rain-free days.",
                }
            )
            break

    cautions = [a["title"] for a in build_alerts(daily, climate)]
    if crop in PONDING_TOLERANT and total_rain >= 60:
        cautions.append("Ponding is acceptable for paddy, but drain excess beyond 5-7 cm standing water.")
    if crop in FROST_SENSITIVE and any((d.get("tmin") or 99) <= 6 for d in week):
        cautions.append("Frost-sensitive crop: keep soil moist before cold nights.")

    direction = "above" if anomaly > 0 else "below"
    summary = (
        f"Expect ~{total_rain:.0f} mm of rain over the next 7 days. The past 30 days ran "
        f"{abs(anomaly):.0f}% {direction} the 30-year normal ({classification.replace('-', ' ')})."
    )

    return {
        "summary": summary,
        "actions": actions[:5],
        "cautions": cautions[:5],
        "confidence": "medium",
        "metrics": {
            "rain_7d_mm": round(total_rain, 1),
            "et0_7d_mm": round(sum((d.get("et0") or 0) for d in week), 1),
            "water_deficit_mm": round(deficit, 1),
        },
    }
