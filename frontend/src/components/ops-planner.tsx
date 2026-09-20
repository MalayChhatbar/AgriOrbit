import { OP_LEVEL_LABEL, opsMatrix, type OpLevel } from "@/lib/ops"
import type { DailyRow } from "@/lib/api"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"
import { cn } from "@/lib/utils"

const LEVEL_CLASS: Record<OpLevel, string> = {
  good: "bg-primary text-primary-foreground",
  ok: "bg-muted text-muted-foreground",
  bad: "bg-muted/50 text-muted-foreground/50",
}

/** 7-day × 4-activity matrix: which day is right for which field operation. */
export function OpsPlanner({ daily }: { daily: DailyRow[] }) {
  const rows = opsMatrix(daily)
  const days = daily.slice(0, 7)

  return (
    <Card>
      <CardHeader>
        <CardTitle>Operations planner</CardTitle>
        <CardDescription>
          Best day for each field operation over the coming week — derived from forecast rain,
          wind and evapotranspiration demand.
        </CardDescription>
      </CardHeader>
      <CardContent className="overflow-x-auto">
        <table className="w-full min-w-[36rem] border-separate border-spacing-y-1 text-sm">
          <thead>
            <tr>
              <th className="w-44 text-left text-xs font-medium text-muted-foreground">Activity</th>
              {days.map((d, i) => (
                <th key={d.date} className="text-center text-xs font-medium text-muted-foreground">
                  {i === 0
                    ? "Today"
                    : new Date(`${d.date}T00:00:00`).toLocaleDateString("en-IN", { weekday: "short" })}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.key}>
                <td className="flex items-center gap-2 pr-2 text-xs font-medium">
                  <row.icon className="size-3.5 text-muted-foreground" />
                  {row.label}
                </td>
                {row.days.map((day) => (
                  <td key={day.date} className="text-center">
                    <Tooltip>
                      <TooltipTrigger
                        render={
                          <span
                            className={cn(
                              "inline-flex size-6 cursor-default items-center justify-center rounded-md text-[10px] font-semibold uppercase",
                              LEVEL_CLASS[day.level]
                            )}
                          >
                            {day.level === "good" ? "✓" : day.level === "bad" ? "×" : "~"}
                          </span>
                        }
                      />
                      <TooltipContent>
                        {OP_LEVEL_LABEL[day.level]} for {row.label.toLowerCase()} ·{" "}
                        {new Date(`${day.date}T00:00:00`).toLocaleDateString("en-IN", {
                          day: "numeric",
                          month: "short",
                        })}
                      </TooltipContent>
                    </Tooltip>
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
        <div className="mt-3 flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
          <span className="flex items-center gap-1.5">
            <Badge className="size-3.5 rounded-[4px] p-0" /> good window
          </span>
          <span className="flex items-center gap-1.5">
            <Badge variant="secondary" className="size-3.5 rounded-[4px] p-0" /> fair
          </span>
          <span className="flex items-center gap-1.5">
            <Badge variant="outline" className="size-3.5 rounded-[4px] p-0" /> avoid
          </span>
          <span className="ml-auto">Chemical decisions → confirm dosage with your agri officer.</span>
        </div>
      </CardContent>
    </Card>
  )
}
