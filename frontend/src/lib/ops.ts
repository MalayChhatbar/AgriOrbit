/**
 * 7-day operations planner — spray / irrigate / sow / harvest scored per day.
 * Pure derivation from the forecast rows (transparent, no server needed).
 */

import { Droplets, Sprout, SprayCan, Wheat, type LucideIcon } from "lucide-react"

import type { DailyRow } from "@/lib/api"

export type OpLevel = "good" | "ok" | "bad"

export interface OpDay {
  date: string
  level: OpLevel
}

export interface OpRow {
  key: string
  label: string
  icon: LucideIcon
  days: OpDay[]
}

export const OP_LEVEL_LABEL: Record<OpLevel, string> = {
  good: "Good",
  ok: "Fair",
  bad: "Poor",
}

function sprayLevel(d: DailyRow): OpLevel {
  const rain = d.precip ?? 0
  const wind = d.wind ?? 0
  if (rain >= 5 || wind >= 30) return "bad"
  if (rain < 1 && wind < 20) return "good"
  return "ok"
}

function irrigateLevel(d: DailyRow): OpLevel {
  const rain = d.precip ?? 0
  const need = (d.et0 ?? 0) - rain
  if (rain >= 10) return "bad"
  if (need > 4 && rain < 1) return "good"
  return "ok"
}

function sowLevel(d: DailyRow): OpLevel {
  const prob = d.precip_prob ?? 0
  const rain = d.precip ?? 0
  if (prob < 20) return "bad"
  if (prob >= 50 && rain >= 2) return "good"
  return "ok"
}

function harvestLevel(d: DailyRow, next: DailyRow | undefined): OpLevel {
  const rain = d.precip ?? 0
  const nextRain = next?.precip ?? 0
  if (rain >= 5) return "bad"
  if (rain < 1 && nextRain < 1) return "good"
  return "ok"
}

export function opsMatrix(daily: DailyRow[]): OpRow[] {
  const week = daily.slice(0, 7)
  return [
    {
      key: "spray",
      label: "Spraying / fertigation",
      icon: SprayCan,
      days: week.map((d) => ({ date: d.date, level: sprayLevel(d) })),
    },
    {
      key: "irrigate",
      label: "Irrigation",
      icon: Droplets,
      days: week.map((d) => ({ date: d.date, level: irrigateLevel(d) })),
    },
    {
      key: "sow",
      label: "Sowing / transplanting",
      icon: Sprout,
      days: week.map((d) => ({ date: d.date, level: sowLevel(d) })),
    },
    {
      key: "harvest",
      label: "Harvest / drying",
      icon: Wheat,
      days: week.map((d, i) => ({ date: d.date, level: harvestLevel(d, week[i + 1]) })),
    },
  ]
}
