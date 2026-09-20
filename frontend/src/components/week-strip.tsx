import { CalendarDays } from "lucide-react"

import type { DailyRow } from "@/lib/api"
import { weatherInfo } from "@/lib/weather-codes"
import { Badge } from "@/components/ui/badge"
import { cn } from "@/lib/utils"

/** One-glance 7-day strip — the pattern every weather product opens with. */
export function WeekStrip({ daily }: { daily: DailyRow[] }) {
  const week = daily.slice(0, 7)
  return (
    <div className="grid grid-cols-4 gap-2 sm:grid-cols-7">
      {week.map((d, i) => {
        const info = weatherInfo(d.code)
        const Icon = info.icon
        const label = new Date(`${d.date}T00:00:00`).toLocaleDateString("en-IN", {
          weekday: "short",
        })
        return (
          <div
            key={d.date}
            className={cn(
              "flex flex-col items-center gap-1.5 rounded-lg border p-3 text-center",
              i === 0 && "border-primary/60 bg-muted/40"
            )}
          >
            <span className="text-xs font-medium">{i === 0 ? "Today" : label}</span>
            <Icon className="size-6 text-muted-foreground" />
            <span className="text-sm font-semibold tabular-nums">
              {Math.round(d.tmax ?? 0)}° <span className="font-normal text-muted-foreground">{Math.round(d.tmin ?? 0)}°</span>
            </span>
            {(d.precip_prob ?? 0) >= 20 && (
              <Badge variant="secondary" className="text-[10px] tabular-nums">
                <CalendarDays className="size-3" />
                {Math.round(d.precip_prob ?? 0)}%
              </Badge>
            )}
          </div>
        )
      })}
    </div>
  )
}
