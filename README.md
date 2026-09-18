# 🛰️🌾 AgriOrbit

**AI satellite-weather advisory for smallholder farmers.**
Built for the 1M1B – IBM SkillsBuild *AI + Sustainability* Virtual Internship (July–Sep 2026).

AgriOrbit combines **satellite-era weather data** (ERA5 reanalysis + ECMWF/GFS forecast models via
Open-Meteo), an in-house **PyTorch LSTM rain-prediction model** (trained on 30+ years of Indian
agri-station data, exported to ONNX), and **IBM Granite** (via NVIDIA's OpenAI-compatible API) to
give smallholder farmers plain-language sow / irrigate / harvest guidance for any point on the map.

## SDG alignment

| SDG | Role | Targets |
| --- | --- | --- |
| **SDG 2 — Zero Hunger** | Primary | 2.3 (smallholder productivity & income), 2.4 (resilient, climate-adaptive agriculture) |
| **SDG 13 — Climate Action** | Secondary | 13.1 (resilience to climate-related hazards: drought, extreme rain) |

## Monorepo layout

```
backend/     FastAPI + uv (Python) — weather/climate APIs, ONNX rain model, Granite advisory & chat
frontend/    Vite + React + bun — shadcn/ui components only, ReactBits animations
notebooks/   train_agriorbit_colab.ipynb — GPU training pipeline for the LSTM rain model (Colab T4)
```

Full setup instructions are written once the build completes — see **Getting started** below.

## Quick start (summary)

```powershell
# backend
cd backend
uv run uvicorn app.main:app --reload --port 8000

# frontend (new terminal)
cd frontend
bun install
bun run dev
```

Optional: copy `backend/.env.example` → `backend/.env` and add your `NVIDIA_API_KEY`
(from https://build.nvidia.com) to enable the IBM Granite advisory/chat. Without it,
the app still works using the deterministic rules engine and the ONNX rain model.
