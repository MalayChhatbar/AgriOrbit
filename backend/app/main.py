"""AgriOrbit API — entry point.

Run:  uv run uvicorn app.main:app --reload --port 8000
Docs: http://localhost:8000/docs
"""

from __future__ import annotations

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.config import get_settings
from app.routers import ai, ml, weather

settings = get_settings()

app = FastAPI(
    title="AgriOrbit API",
    version="0.1.0",
    description="AI satellite-weather advisory for smallholder farmers. SDG 2 (primary) · SDG 13 (secondary).",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.origin_list,
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(weather.router, prefix="/api")
app.include_router(ml.router, prefix="/api")
app.include_router(ai.router, prefix="/api")
