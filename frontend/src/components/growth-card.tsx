import * as React from "react"
import { CalendarCheck, Circle, CircleCheck } from "lucide-react"
import { toast } from "sonner"

import { api, type GrowthStatus } from "@/lib/api"
import { useFarm } from "@/lib/location"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Progress } from "@/components/ui/progress"
import { Spinner } from "@/components/ui/spinner"

/** GDD growth tracker — enter the sowing date, watch thermal-time stages progress. */
export function GrowthCard() {
  const { lat, lon, crop, sowingDate, setSowingDate } = useFarm()
  const [status, setStatus] = React.useState<GrowthStatus | null>(null)
  const [loading, setLoading] = React.useState(false)
  const inputId = React.useId()

  const track = async (dateStr: string) => {
    setLoading(true)
    try {
      setStatus(await api.growth(lat, lon, crop, dateStr))
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Growth tracking failed")
    } finally {
      setLoading(false)
    }
  }

  // auto-refresh when inputs change and a date is already picked
  React.useEffect(() => {
    if (sowingDate) void track(sowingDate)
    else setStatus(null)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lat, lon, crop, sowingDate])

  const onChange = (v: string) => {
    setSowingDate(v || null)
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-wrap items-center gap-2">
          <CardTitle>Growth tracker (GDD)</CardTitle>
          {status && <Badge variant="secondary">{status.current_stage}</Badge>}
        </div>
        <CardDescription>
          Growing Degree Days since sowing — the thermal clock every agronomist uses to know
          where the crop really is.
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <div className="flex flex-wrap items-center gap-2">
          <Input
            id={inputId}
            type="date"
            className="w-44"
            max={new Date().toISOString().slice(0, 10)}
            value={sowingDate ?? ""}
            onChange={(e) => onChange(e.target.value)}
          />
          {sowingDate && (
            <Button variant="ghost" size="sm" onClick={() => setSowingDate(null)}>
              Clear
            </Button>
          )}
          {loading && <Spinner className="text-muted-foreground" />}
        </div>

        {!status && !loading && (
          <p className="text-xs text-muted-foreground">
            Pick your sowing date to see accumulated thermal time, the current growth stage and
            projected stage dates from the live forecast.
          </p>
        )}

        {status && !loading && (
          <>
            <div className="flex flex-col gap-1">
              <div className="flex items-baseline justify-between text-sm">
                <span className="font-semibold tabular-nums">
                  {status.accumulated_gdd} °C·d
                </span>
                <span className="text-muted-foreground tabular-nums">
                  {status.days_since_sowing} days since sowing · {status.progress_pct}% to maturity
                </span>
              </div>
              <Progress value={status.progress_pct} />
            </div>

            <div className="flex flex-col gap-1.5">
              {status.stages.map((s) => (
                <div key={s.name} className="flex items-center gap-2 text-sm">
                  {s.reached ? (
                    <CircleCheck className="size-4 shrink-0 text-primary" />
                  ) : (
                    <Circle className="size-4 shrink-0 text-muted-foreground/50" />
                  )}
                  <span className={s.reached ? "font-medium" : "text-muted-foreground"}>
                    {s.name}
                  </span>
                  <span className="ml-auto flex items-center gap-1.5 text-xs text-muted-foreground">
                    {s.reached ? (
                      "done"
                    ) : s.eta ? (
                      <>
                        <CalendarCheck className="size-3" />
                        ~{" "}
                        {new Date(`${s.eta}T00:00:00`).toLocaleDateString("en-IN", {
                          day: "numeric",
                          month: "short",
                        })}
                      </>
                    ) : (
                      "beyond 16-day outlook"
                    )}
                  </span>
                </div>
              ))}
            </div>

            <p className="text-xs text-muted-foreground">{status.note}</p>
          </>
        )}
      </CardContent>
    </Card>
  )
}
