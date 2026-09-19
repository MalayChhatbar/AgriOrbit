"""IBM Granite via NVIDIA's OpenAI-compatible API.

- Model defaults to ibm/granite-3.3-8b-instruct (override with NVIDIA_MODEL).
- Every call is wrapped: if the key is missing or the request fails, callers
  receive the deterministic rules output instead — the app cannot hard-fail
  because of the LLM.
- The advisory path asks Granite for STRICT JSON rephrasing of the rules
  output, so the language model words the facts but cannot invent them
  (transparency / hallucination control for the Responsible AI section).
"""

from __future__ import annotations

import json
import re
from typing import Any

from ..config import get_settings

ADVISORY_SYSTEM = """You are AgriOrbit, an agricultural weather advisory assistant for smallholder farmers.

You will receive:
1. A 16-day weather forecast (daily rain, rain probability, temperature, ET0, wind),
2. A climate anomaly summary (current rain vs the 1991-2020 normal),
3. A rules-engine advisory already computed from that data.

Your job is ONLY to rephrase and lightly enrich the rules advisory into clear,
simple farmer-friendly language. You must NOT invent new weather numbers,
change any figures, or contradict the rules advisory.

Respond with STRICT JSON (no markdown fences) with exactly these keys:
{
  "summary": string,   // 2-3 plain sentences mentioning the key numbers
  "actions": [{"day": string, "action": string, "reason": string}],   // keep from rules, reworded
  "cautions": [string],   // short caution lines
  "confidence": "low" | "medium" | "high"   // how consistent the signals are
}

If the input sets "output_language" to a non-English language code (e.g. "hi"), write the
summary / actions / cautions in that language while keeping numbers, units and crop names
clear. Structure never changes."""

CHAT_SYSTEM = """You are AgriOrbit, a friendly AI farming assistant grounded in satellite weather data.

Rules you must follow:
- Answer the farmer's question simply and practically.
- When live forecast/climate context is provided below, ground your answer in it (quote the numbers).
- When knowledge-base excerpts are provided, prefer them over general memory.
- Never fabricate weather data. If you don't know, say so and suggest checking the forecast.
- For chemical dosages or regulated decisions, advise consulting the local agriculture officer.
- Keep answers under 180 words unless the user asks for detail.
- End with one concrete next step the farmer can take."""


def _client():
    settings = get_settings()
    if not settings.nvidia_api_key:
        return None
    from openai import OpenAI

    return OpenAI(base_url=settings.nvidia_base_url, api_key=settings.nvidia_api_key)


def _complete(client, system: str, user: str, max_tokens: int = 900) -> str | None:
    settings = get_settings()
    try:
        resp = client.chat.completions.create(
            model=settings.nvidia_model,
            messages=[
                {"role": "system", "content": system},
                {"role": "user", "content": user},
            ],
            temperature=0.3,
            top_p=0.9,
            max_tokens=max_tokens,
            stream=False,
        )
        return resp.choices[0].message.content
    except Exception:
        return None


def _extract_json(text: str) -> dict | None:
    match = re.search(r"\{.*\}", text, flags=re.DOTALL)
    if not match:
        return None
    try:
        data = json.loads(match.group(0))
    except json.JSONDecodeError:
        return None
    if not isinstance(data, dict) or "summary" not in data:
        return None
    data.setdefault("actions", [])
    data.setdefault("cautions", [])
    data.setdefault("confidence", "medium")
    return data


def _compact_context(ctx: dict, crop: str, language: str = "en") -> dict:
    daily = ctx["forecast"]["daily"][:10]
    climate = ctx["climate"]
    payload = {
        "crop": crop,
        "growth_stage": ctx.get("stage", "vegetative"),
        "forecast": [
            {
                "date": d["date"],
                "tmax_c": d.get("tmax"),
                "tmin_c": d.get("tmin"),
                "rain_mm": d.get("precip"),
                "rain_chance_pct": d.get("precip_prob"),
                "et0_mm": d.get("et0"),
                "wind_kmh": d.get("wind"),
            }
            for d in daily
        ],
        "climate": {
            "last_30d_rain_mm": climate["observed_mm"],
            "normal_30d_rain_mm": climate["normal_mm"],
            "anomaly_pct": climate["anomaly_pct"],
            "classification": climate["classification"],
            "dry_streak_days": climate["dry_streak_days"],
        },
        "alerts": ctx["alerts"],
        "rules_advisory": ctx["base_advisory"],
    }
    if "ml" in ctx:
        ml = ctx["ml"]
        payload["neural_model"] = {
            "next_7_days_rain_probability": [
                p["probability"] for p in ml.get("rain_probabilities", [])
            ],
            "expected_total_mm": ml.get("expected_total_mm"),
            "note": "Independent LSTM trained on ERA5 history; may diverge from the forecast above.",
        }
    if language and language != "en":
        payload["output_language"] = language
    return payload


def generate_advisory(ctx: dict, crop: str, language: str = "en") -> dict:
    client = _client()
    if client is None:
        return {"source": "rules", "advisory": None}

    payload = json.dumps(_compact_context(ctx, crop, language), indent=2)
    text = _complete(client, ADVISORY_SYSTEM, payload)
    if text is None:
        return {"source": "rules", "advisory": None}

    parsed = _extract_json(text)
    if parsed is None:
        # Granite answered in prose: keep the prose as the summary, still honest
        return {
            "source": "granite",
            "advisory": {**ctx["base_advisory"], "summary": text.strip()},
        }
    return {"source": "granite", "advisory": parsed}


def chat(
    messages: list[dict[str, str]],
    context: dict | None,
    kb_refs: list[dict],
    crop: str,
) -> dict:
    client = _client()
    if client is None:
        refs = ", ".join(r["title"] for r in kb_refs) or "the bundled guides"
        return {
            "source": "rules",
            "text": (
                "The conversational advisor activates once an NVIDIA API key is configured "
                "(NVIDIA_API_KEY in backend/.env — free at build.nvidia.com, IBM Granite models). "
                f"Meanwhile, these knowledge-base sections are relevant: {refs}."
            ),
        }

    system = CHAT_SYSTEM
    if context is not None:
        system += "\n\nLIVE CONTEXT (authoritative):\n" + json.dumps(
            _compact_context(context, crop, language="en"), indent=2
        )
    if kb_refs:
        system += "\n\nKNOWLEDGE BASE EXCERPTS:\n" + "\n\n".join(
            f"[{r['title']}]\n{r['text'][:1200]}" for r in kb_refs
        )

    trimmed = messages[-8:]
    try:
        resp = client.chat.completions.create(
            model=get_settings().nvidia_model,
            messages=[{"role": "system", "content": system}, *trimmed],
            temperature=0.4,
            top_p=0.9,
            max_tokens=700,
            stream=False,
        )
        text = resp.choices[0].message.content
        if not text:
            raise RuntimeError("empty completion")
        return {"source": "granite", "text": text.strip()}
    except Exception as exc:
        return {
            "source": "rules",
            "text": f"The AI advisor is temporarily unavailable ({exc.__class__.__name__}). "
            "The dashboard forecast, alerts and rules-based advisory remain fully available.",
        }
