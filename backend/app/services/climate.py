"""Climate context: compare recent rainfall with the 1991-2020 ERA5 climatology.

This is the "satellite history" half of the product: the current spell of weather
is scored against 30 years of reanalysis, producing the drought/ surplus signals
that drive alerts and advisory confidence.
"""

from __future__ import annotations

from datetime import date, timedelta

from . import openmeteo

CLIMATOLOGY_START = "1991-01-01"
CLIMATOLOGY_END = "2020-12-31"
ARCHIVE_LAG_DAYS = 6  # ERA5 archive lags real time by ~5-6 days


def _parse(d: str) -> date:
    return date.fromisoformat(d)


def compute_climate(
    lat: float,
    lon: float,
    today: date | None = None,
    recent_days: int = 92,
    window: int = 30,
) -> dict:
    today = today or date.today()
    end = today - timedelta(days=ARCHIVE_LAG_DAYS)
    start = end - timedelta(days=recent_days - 1)

    hist = openmeteo.fetch_archive_daily(
        lat, lon, start.isoformat(), end.isoformat(), ("precipitation_sum",)
    )
    clim = openmeteo.fetch_archive_daily(
        lat, lon, CLIMATOLOGY_START, CLIMATOLOGY_END, ("precipitation_sum",)
    )

    hist_pairs = [
        (_parse(d), float(v if v is not None else 0.0))
        for d, v in zip(hist["time"], hist["precipitation_sum"])
    ]
    clim_pairs = [
        (_parse(d), float(v if v is not None else 0.0))
        for d, v in zip(clim["time"], clim["precipitation_sum"])
    ]

    # --- 30-day window vs climatology ---------------------------------------
    window_dates = hist_pairs[-window:]
    window_keys = {(d.month, d.day) for d, _ in window_dates}
    observed = sum(v for _, v in window_dates)

    per_year: dict[int, float] = {}
    for d, v in clim_pairs:
        if (d.month, d.day) in window_keys:
            per_year[d.year] = per_year.get(d.year, 0.0) + v
    yearly_totals = list(per_year.values())
    normal = sum(yearly_totals) / len(yearly_totals) if yearly_totals else 0.0
    anomaly_pct = (observed - normal) / normal * 100 if normal > 0.5 else 0.0
    below = sum(1 for t in yearly_totals if t <= observed)
    percentile = below / len(yearly_totals) if yearly_totals else 0.5

    # --- dry streak (consecutive days < 1 mm ending at `end`) ----------------
    dry_streak = 0
    for _, v in reversed(hist_pairs):
        if v < 1.0:
            dry_streak += 1
        else:
            break

    # --- monthly normals (mean daily precip per calendar month, mm/day) -----
    month_sum: dict[int, float] = {m: 0.0 for m in range(1, 13)}
    month_cnt: dict[int, int] = {m: 0 for m in range(1, 13)}
    for d, v in clim_pairs:
        month_sum[d.month] += v
        month_cnt[d.month] += 1
    monthly_normals = [
        round(month_sum[m] / month_cnt[m], 2) if month_cnt[m] else 0.0 for m in range(1, 13)
    ]

    # --- per-day climatological mean precip, for cumulative comparisons -----
    md_sum: dict[tuple[int, int], float] = {}
    md_cnt: dict[tuple[int, int], int] = {}
    for d, v in clim_pairs:
        key = (d.month, d.day)
        md_sum[key] = md_sum.get(key, 0.0) + v
        md_cnt[key] = md_cnt.get(key, 0) + 1
    normal_for_day = lambda d: md_sum[(d.month, d.day)] / md_cnt[(d.month, d.day)] if md_cnt.get((d.month, d.day)) else 0.0

    # recent 60 days annotated with cumulative observed vs cumulative normal
    recent: list[dict] = []
    cum_obs = 0.0
    cum_norm = 0.0
    for d, v in hist_pairs[-60:]:
        cum_obs += v
        cum_norm += normal_for_day(d)
        recent.append(
            {
                "date": d.isoformat(),
                "precip": round(v, 1),
                "cum_obs": round(cum_obs, 1),
                "cum_normal": round(cum_norm, 1),
            }
        )

    if anomaly_pct <= -40:
        classification = "severe-deficit"
    elif anomaly_pct <= -20:
        classification = "below-normal"
    elif anomaly_pct >= 20:
        classification = "above-normal"
    else:
        classification = "near-normal"

    return {
        "window_days": window,
        "period": {"start": window_dates[0][0].isoformat(), "end": window_dates[-1][0].isoformat()},
        "observed_mm": round(observed, 1),
        "normal_mm": round(normal, 1),
        "anomaly_pct": round(anomaly_pct, 1),
        "percentile": round(percentile, 2),
        "dry_streak_days": dry_streak,
        "classification": classification,
        "climatology_period": f"{CLIMATOLOGY_START[:4]}-{CLIMATOLOGY_END[:4]}",
        "monthly_normals": monthly_normals,
        "recent": recent,
    }
