# AGENTS.md — working agreements for this repo

**AgriOrbit**: AI satellite-weather advisory for smallholder farmers. SDG 2 (primary) / SDG 13 (secondary).
Internship project: 1M1B × IBM SkillsBuild "AI + Sustainability".

## Layout

- `backend/` — FastAPI, Python ≥3.13, managed **exclusively with `uv`** (never pip).
- `frontend/` — Vite + React 19 + Tailwind v4, managed **exclusively with `bun`**.
- `notebooks/` — Colab training notebook for the LSTM rain model (runs on Colab T4, not locally).
- `docs/screenshots/` — verification screenshots, recaptured on UI change.

## Commands

| Where | Command | Purpose |
| --- | --- | --- |
| `backend/` | `uv run uvicorn app.main:app --reload --port 8000` | dev server (`/docs` = OpenAPI) |
| `backend/` | `uv run pytest` | offline test suite — must stay green |
| `backend/` | `uv add <pkg>` / `uv add --dev <pkg>` | dependencies |
| `frontend/` | `bun run dev` / `bun run build` | dev server (proxies `/api` → :8000) / type-check + build |
| `frontend/` | `bunx --bun shadcn@latest add <name>` | add UI — see rules below |
| repo root | `uv run --with playwright python scripts/capture_screenshots.py` | visual smoke test of all 4 routes (dev servers must be running) |

## Hard rules

- **UI comes from registries, never hand-built.** New UI = shadcn registry (project flavor
  is **base-nova** → Base UI primitives) or ReactBits registry
  (`bunx --bun shadcn@latest add "https://reactbits.dev/r/<Name>-TS-TW"`).
  Scripts/edit code may compose and configure them, but primitive styling/behavior lives in the registry file.
- **Base UI ≠ Radix.** `Button` links use `render={<Link/>} + nativeButton={false}` (no `asChild`);
  `Select.onValueChange` receives `string | null`; `Accordion` has no `type` prop. Check
  `!` errors against `@base-ui/react` docs before editing a registry file.
- **Feature schema has one source of truth:** `backend/app/services/openmeteo.py::FEATURE_NAMES`
  must match the `FEATURES` list in the notebook, in order. The model trains on archive daily
  means; recent-day gaps in `relative_humidity_2m_mean`/`surface_pressure_mean` are filled from
  hourly series at inference — do not "simplify" that.
- **No `.env` in git.** Granite needs `NVIDIA_API_KEY` in `backend/.env` (see `.env.example`).
  All LLM paths have rules-engine fallbacks; tests must pass with no key set.
- Weather calls go through `app/services/openmeteo.py` only (it caches); routers never call httpx directly.

## Conventions

- Commit style: conventional commits (`feat(backend): …`), one phase per commit.
- Money/impact claims (yield %, impact numbers) live in `frontend/src/pages/About.tsx` — keep them
  sourced and conservative; they feed the internship PPT.
