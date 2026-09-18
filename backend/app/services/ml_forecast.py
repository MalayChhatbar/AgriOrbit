"""Neural rain model — ONNX inference of the LSTM trained in
notebooks/train_agriorbit_colab.ipynb on 1991-2024 ERA5 data from 28 Indian
agro-climatic stations.

The backend never trains and never needs PyTorch: it only loads the exported
`rain_model.onnx` + `scaler.json` from ml/artifacts/. When artifacts are missing
(e.g. before the first training run) every function degrades gracefully and the
API reports available=false, so the product keeps working on rules alone.
"""

from __future__ import annotations

import json
import math
from datetime import date, timedelta
from pathlib import Path
from typing import Any

import numpy as np

from ..config import get_settings
from . import openmeteo

MODEL_ID = "agriorbit-lstm-v1"
MODEL_NAME = "rain_model.onnx"
SCALER_NAME = "scaler.json"
METRICS_NAME = "metrics.json"

_state: dict[str, Any] = {
    "loaded": False,
    "session": None,
    "input_name": None,
    "output_names": None,
    "scaler": None,
    "metrics": None,
    "error": None,
}


def _artifacts() -> Path:
    return Path(get_settings().artifacts_dir)


def reload_model() -> None:
    """(Re)load artifacts. Called lazily on first use and by tests."""
    _state.update(loaded=True, session=None, scaler=None, metrics=None, error=None)
    art = _artifacts()
    model_path, scaler_path, metrics_path = (
        art / MODEL_NAME,
        art / SCALER_NAME,
        art / METRICS_NAME,
    )
    if not model_path.exists() or not scaler_path.exists():
        _state["error"] = f"artifacts not found in {art}"
        return
    try:
        import onnxruntime as ort

        sess = ort.InferenceSession(str(model_path), providers=["CPUExecutionProvider"])
        scaler = json.loads(scaler_path.read_text(encoding="utf-8"))
        metrics = (
            json.loads(metrics_path.read_text(encoding="utf-8")) if metrics_path.exists() else None
        )
        _state.update(
            session=sess,
            input_name=sess.get_inputs()[0].name,
            output_names=[o.name for o in sess.get_outputs()],
            scaler=scaler,
            metrics=metrics,
        )
    except Exception as exc:  # pragma: no cover - defensive
        _state["error"] = f"failed to load artifacts: {exc}"


def _ensure_loaded() -> None:
    if not _state["loaded"]:
        reload_model()


def model_available() -> bool:
    _ensure_loaded()
    return _state["session"] is not None


def model_info() -> dict[str, Any]:
    """Everything the UI's model card needs (read from metrics.json at load)."""
    _ensure_loaded()
    scaler = _state["scaler"] or {}
    return {
        "model_id": MODEL_ID,
        "available": model_available(),
        "error": _state["error"],
        "architecture": "2-layer LSTM (hidden 128) → 7-day rain-probability head + rainfall-amount head",
        "input_window_days": scaler.get("lookback", 30),
        "features": scaler.get("feature_names", []),
        "training": (_state["metrics"] or {}).get("training", {}),
        "metrics": (_state["metrics"] or {}).get("metrics", {}),
        "notes": (_state["metrics"] or {}).get("notes", ""),
    }


def _sigmoid(x: np.ndarray) -> np.ndarray:
    return 1.0 / (1.0 + np.exp(-x))


def predict(matrix: list[list[float]]) -> dict[str, Any]:
    """matrix: [lookback][n_features] raw (unscaled) daily values."""
    _ensure_loaded()
    if _state["session"] is None:
        raise RuntimeError("model not available")
    scaler = _state["scaler"]
    mean = np.asarray(scaler["mean"], dtype=np.float32)
    std = np.asarray(scaler["std"], dtype=np.float32)
    x = (np.asarray(matrix, dtype=np.float32) - mean) / std
    outputs = _state["session"].run(
        _state["output_names"], {_state["input_name"]: x[None, :, :]}
    )
    logits = np.asarray(outputs[0]).reshape(-1)          # [7] rain logits (BCE training)
    total_mm = float(np.asarray(outputs[1]).reshape(-1)[0])
    probs = _sigmoid(logits)
    start = date.today() + timedelta(days=1)
    return {
        "rain_probabilities": [
            {"date": (start + timedelta(days=i)).isoformat(), "probability": round(float(p), 3)}
            for i, p in enumerate(probs[:7])
        ],
        "expected_total_mm": round(max(total_mm, 0.0), 1),
    }


def ml_forecast(lat: float, lon: float) -> dict[str, Any]:
    """Full pipeline: build the 30-day window for a location and run the model."""
    _ensure_loaded()
    base: dict[str, Any] = {
        "model_id": MODEL_ID,
        "horizon_days": 7,
        "trained_on": "ERA5 reanalysis 1991-2024, 28 Indian agro-climatic stations",
    }
    if _state["session"] is None:
        return {**base, "available": False, "reason": _state["error"]}
    matrix = openmeteo.fetch_ml_window(lat, lon)
    pred = predict(matrix)
    spread = [p["probability"] for p in pred["rain_probabilities"]]
    uncertainty = "high" if (max(spread) - min(spread)) < 0.15 else "normal"
    return {
        **base,
        "available": True,
        **pred,
        "uncertainty": uncertainty,
        "metrics": (_state["metrics"] or {}).get("metrics", {}),
    }
