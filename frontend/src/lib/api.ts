/**
 * Typed client for the AgriOrbit FastAPI backend (same-origin via Vite proxy).
 */

export interface DailyRow {
  date: string
  code: number | null
  tmax: number | null
  tmin: number | null
  precip: number | null
  precip_prob: number | null
  precip_hours: number | null
  et0: number | null
  radiation: number | null
  wind: number | null
  rh: number | null
  pressure: number | null
  sm0_1: number | null
  sm3_9: number | null
  sm9_27: number | null
  sm27_81: number | null
}

export interface ClimateInfo {
  window_days: number
  period: { start: string; end: string }
  observed_mm: number
  normal_mm: number
  anomaly_pct: number
  percentile: number
  dry_streak_days: number
  classification: "near-normal" | "below-normal" | "above-normal" | "severe-deficit"
  climatology_period: string
  monthly_normals: number[]
  recent: { date: string; precip: number }[]
}

export interface AlertItem {
  level: "warning" | "watch" | "info"
  title: string
  detail: string
  day: string | null
}

export interface AdvisoryAction {
  day: string
  action: string
  reason: string
}

export interface AdvisoryBody {
  summary: string
  actions: AdvisoryAction[]
  cautions: string[]
  confidence?: string
  metrics?: { rain_7d_mm: number; et0_7d_mm: number; water_deficit_mm: number }
}

export interface Dashboard {
  location: { lat: number; lon: number; elevation: number | null; timezone: string }
  crop: string
  generated_at: string
  current: {
    temperature_2m?: number
    relative_humidity_2m?: number
    apparent_temperature?: number
    precipitation?: number
    weather_code?: number
    wind_speed_10m?: number
    is_day?: number
  }
  daily: DailyRow[]
  climate: ClimateInfo
  alerts: AlertItem[]
  base_advisory: AdvisoryBody
}

export interface AdvisoryResponse {
  crop: string
  source: "granite" | "rules"
  advisory: AdvisoryBody | null
  base_advisory: AdvisoryBody
  alerts: AlertItem[]
}

export interface MLForecast {
  model_id: string
  horizon_days: number
  trained_on: string
  available: boolean
  reason?: string | null
  rain_probabilities?: { date: string; probability: number }[]
  expected_total_mm?: number
  uncertainty?: string
  metrics?: Record<string, number | string>
}

export interface ModelInfo {
  model_id: string
  available: boolean
  error: string | null
  architecture: string
  input_window_days: number
  features: string[]
  training: Record<string, string | number>
  metrics: Record<string, number | string | number[]>
  notes: string
}

export interface GeocodeResult {
  name: string
  admin1: string | null
  country: string | null
  country_code: string | null
  latitude: number
  longitude: number
}

export interface ChatReply {
  reply: string
  source: "granite" | "rules"
  kb_refs: string[]
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`/api${path}`, init)
  if (!res.ok) {
    let detail = `HTTP ${res.status}`
    try {
      const body = await res.json()
      if (body?.detail) detail = typeof body.detail === "string" ? body.detail : JSON.stringify(body.detail)
    } catch {
      /* keep default */
    }
    throw new Error(detail)
  }
  return (await res.json()) as T
}

export const api = {
  health: () =>
    request<{ status: string; llm_configured: boolean; ml_model_available: boolean }>("/health"),

  geocode: (q: string) => request<{ results: GeocodeResult[] }>(`/geocode?q=${encodeURIComponent(q)}`),

  dashboard: (lat: number, lon: number, crop: string) =>
    request<Dashboard>(`/dashboard?lat=${lat}&lon=${lon}&crop=${encodeURIComponent(crop)}`),

  mlforecast: (lat: number, lon: number) =>
    request<MLForecast>(`/mlforecast?lat=${lat}&lon=${lon}`),

  modelinfo: () => request<ModelInfo>("/modelinfo"),

  advisory: (lat: number, lon: number, crop: string) =>
    request<AdvisoryResponse>("/advisory", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ lat, lon, crop }),
    }),

  chat: (messages: { role: string; content: string }[], lat: number | null, lon: number | null, crop: string) =>
    request<ChatReply>("/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ messages, lat, lon, crop }),
    }),
}
