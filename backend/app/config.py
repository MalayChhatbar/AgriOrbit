"""Application configuration.

Reads from backend/.env (see .env.example). Everything has a safe default so
the app boots with zero configuration; Granite LLM features activate as soon
as NVIDIA_API_KEY is present.
"""

from __future__ import annotations

from functools import lru_cache
from pathlib import Path

from pydantic_settings import BaseSettings, SettingsConfigDict

BASE_DIR = Path(__file__).resolve().parent.parent  # backend/


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=BASE_DIR / ".env", extra="ignore")

    # NVIDIA OpenAI-compatible API (hosts IBM Granite models). Free key: https://build.nvidia.com
    nvidia_api_key: str = ""
    nvidia_base_url: str = "https://integrate.api.nvidia.com/v1"
    nvidia_model: str = "ibm/granite-3.3-8b-instruct"

    # Comma-separated list of allowed CORS origins (Vite dev server by default)
    cors_origins: str = "http://localhost:5173,http://127.0.0.1:5173"

    # In-memory cache TTL for expensive climate calls
    cache_ttl_seconds: int = 1800

    # Where the ONNX rain model + scaler + metrics live (dropped in after Colab training)
    artifacts_dir: str = str(BASE_DIR / "ml" / "artifacts")

    @property
    def origin_list(self) -> list[str]:
        return [o.strip() for o in self.cors_origins.split(",") if o.strip()]


@lru_cache
def get_settings() -> Settings:
    return Settings()
