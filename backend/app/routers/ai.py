"""AI endpoints — advisory generation and chat.

Always guaranteed by the deterministic rules engine; once NVIDIA_API_KEY is
configured, IBM Granite rephrases/extends the same structured output via the
services.granite client. The rules output is always returned alongside so the
LLM can never silently replace the safety floor.
"""

from __future__ import annotations

from fastapi import APIRouter, HTTPException

from app.models import AdvisoryRequest, ChatRequest
from app.services import climate as climate_svc
from app.services import granite, kb, ml_forecast, openmeteo, rules

router = APIRouter()


def _build_context(lat: float, lon: float, crop: str, stage: str = "vegetative") -> dict:
    forecast = openmeteo.fetch_forecast(lat, lon)
    climate = climate_svc.compute_climate(lat, lon)
    alerts = rules.build_alerts(forecast["daily"], climate)
    base = rules.base_advisory(crop, forecast["daily"], climate, forecast.get("current"), stage)
    ctx = {
        "forecast": forecast,
        "climate": climate,
        "alerts": alerts,
        "base_advisory": base,
        "stage": stage,
    }
    # fold in the neural model's view when artifacts are installed
    if ml_forecast.model_available():
        try:
            ctx["ml"] = ml_forecast.ml_forecast(lat, lon)
        except openmeteo.OpenMeteoError:
            pass  # advisory must never fail because of the model window
    return ctx


@router.post("/advisory")
def advisory(req: AdvisoryRequest) -> dict:
    try:
        ctx = _build_context(req.lat, req.lon, req.crop, req.stage)
    except openmeteo.OpenMeteoError as exc:
        raise HTTPException(status_code=502, detail=str(exc)) from exc

    result = granite.generate_advisory(ctx, req.crop, req.language)
    return {
        "crop": req.crop,
        "stage": req.stage,
        "language": req.language,
        "source": result["source"],
        "advisory": result["advisory"],
        "base_advisory": ctx["base_advisory"],
        "alerts": ctx["alerts"],
    }


@router.post("/chat")
def chat(req: ChatRequest) -> dict:
    kb_refs = kb.retrieve(req.messages[-1].content, top_k=3)

    context: dict | None = None
    if req.lat is not None and req.lon is not None:
        try:
            context = _build_context(req.lat, req.lon, req.crop)
        except openmeteo.OpenMeteoError:
            context = None  # chat keeps working without live data

    reply = granite.chat(
        messages=[m.model_dump() for m in req.messages],
        context=context,
        kb_refs=kb_refs,
        crop=req.crop,
    )
    return {
        "reply": reply["text"],
        "source": reply["source"],
        "kb_refs": [r["title"] for r in kb_refs],
    }
