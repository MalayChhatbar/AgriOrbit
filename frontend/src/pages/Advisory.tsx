import * as React from "react"
import { Droplets, Sprout, Thermometer, TriangleAlert, Wind } from "lucide-react"
import { toast } from "sonner"
import { Area, AreaChart, Bar, CartesianGrid, ComposedChart, Line, XAxis, YAxis } from "recharts"

import { api, type Dashboard } from "@/lib/api"
import { CROPS, STAGES } from "@/lib/crops"
import { useFarm } from "@/lib/location"
import { weatherInfo } from "@/lib/weather-codes"
import { AdvisoryCard } from "@/components/advisory-card"
import { FarmMap } from "@/components/farm-map"
import { GrowthCard } from "@/components/growth-card"
import { NeuralForecast } from "@/components/neural-forecast"
import { OpsPlanner } from "@/components/ops-planner"
import { PestCard } from "@/components/pest-card"
import { WeekStrip } from "@/components/week-strip"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import {
  ChartContainer,
  ChartLegend,
  ChartLegendContent,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart"
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Skeleton } from "@/components/ui/skeleton"

const rainConfig = {
  precip: { label: "Rain (mm)", color: "var(--chart-1)" },
  prob: { label: "Rain chance (%)", color: "var(--chart-2)" },
} satisfies ChartConfig

const soilConfig = {
  sm0_1: { label: "0–1 cm", color: "var(--chart-1)" },
  sm3_9: { label: "3–9 cm", color: "var(--chart-2)" },
  sm9_27: { label: "9–27 cm", color: "var(--chart-4)" },
} satisfies ChartConfig

const seasonConfig = {
  precip: { label: "Daily rain (mm)", color: "var(--chart-2)" },
  cum_obs: { label: "This season (cumulative)", color: "var(--chart-1)" },
  cum_normal: { label: "30-year normal (cumulative)", color: "var(--chart-3)" },
} satisfies ChartConfig

const CLASS_BADGE: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
  "severe-deficit": "destructive",
  "below-normal": "secondary",
  "above-normal": "outline",
  "near-normal": "default",
}

export default function AdvisoryPage() {
  const { lat, lon, crop, setCrop, stage, setStage } = useFarm()
  const [data, setData] = React.useState<Dashboard | null>(null)
  const [loading, setLoading] = React.useState(true)

  React.useEffect(() => {
    let cancelled = false
    setLoading(true)
    api
      .dashboard(lat, lon, crop, stage)
      .then((res) => !cancelled && setData(res))
      .catch((err) => !cancelled && toast.error(err instanceof Error ? err.message : "Failed to load dashboard"))
      .finally(() => !cancelled && setLoading(false))
    return () => {
      cancelled = true
    }
  }, [lat, lon, crop, stage])

  if (loading && !data) {
    return (
      <div className="grid gap-4 lg:grid-cols-3">
        <Skeleton className="h-96 lg:col-span-2" />
        <Skeleton className="h-96" />
        <Skeleton className="h-72 lg:col-span-2" />
        <Skeleton className="h-72" />
      </div>
    )
  }
  if (!data) return null

  const today = data.daily[0]
  const info = weatherInfo(data.current.weather_code)
  const CurrentIcon = info.icon
  const rainChart = data.daily.map((d) => ({
    day: d.date.slice(5),
    precip: d.precip ?? 0,
    prob: d.precip_prob ?? 0,
  }))
  const soilChart = data.daily.map((d) => ({
    day: d.date.slice(5),
    sm0_1: d.sm0_1,
    sm3_9: d.sm3_9,
    sm9_27: d.sm9_27,
  }))
  const clim = data.climate
  const gdd7 = data.daily
    .slice(0, 7)
    .reduce((s, d) => s + Math.max(0, ((d.tmax ?? 0) + (d.tmin ?? 0)) / 2 - 5), 0)

  return (
    <div className="flex flex-col gap-4">
      <div className="grid gap-4 lg:grid-cols-3">
        {/* Map */}
        <Card className="lg:col-span-2">
          <CardHeader className="pb-3">
            <div className="flex flex-wrap items-center gap-3">
              <CardTitle>Your field</CardTitle>
              <Badge variant="outline">{data.location.timezone}</Badge>
            </div>
          </CardHeader>
          <CardContent>
            <FarmMap />
            <p className="mt-2 text-xs text-muted-foreground">
              {data.location.lat.toFixed(4)}, {data.location.lon.toFixed(4)} · elevation{" "}
              {data.location.elevation?.toFixed(0) ?? "—"} m · click anywhere to move the pin
            </p>
          </CardContent>
        </Card>

        {/* Current conditions + crop */}
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between gap-2">
              <CardTitle>Right now</CardTitle>
              <div className="flex flex-col gap-1.5">
                <Select value={crop} onValueChange={(v) => v && setCrop(v)}>
                  <SelectTrigger className="w-44">
                    <SelectValue placeholder="Crop" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectGroup>
                      {CROPS.map((c) => (
                        <SelectItem key={c.id} value={c.id}>
                          {c.name}
                        </SelectItem>
                      ))}
                    </SelectGroup>
                  </SelectContent>
                </Select>
                <Select value={stage} onValueChange={(v) => v && setStage(v)}>
                  <SelectTrigger className="w-44">
                    <SelectValue placeholder="Crop stage" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectGroup>
                      {STAGES.map((s) => (
                        <SelectItem key={s.id} value={s.id}>
                          {s.name}
                        </SelectItem>
                      ))}
                    </SelectGroup>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            <div className="flex items-center gap-4">
              <CurrentIcon className="size-12 text-primary" />
              <div>
                <p className="text-3xl font-bold tracking-tight">
                  {Math.round(data.current.temperature_2m ?? 0)}°C
                </p>
                <p className="text-sm text-muted-foreground">{info.label}</p>
              </div>
            </div>
            <div className="flex flex-col gap-2 text-sm">
              <span className="flex items-center gap-2 text-muted-foreground">
                <Thermometer className="size-4" />
                Feels like {Math.round(data.current.apparent_temperature ?? 0)}° · today{" "}
                {Math.round(today.tmin ?? 0)}°–{Math.round(today.tmax ?? 0)}°
              </span>
              <span className="flex items-center gap-2 text-muted-foreground">
                <Droplets className="size-4" />
                Humidity {Math.round(data.current.relative_humidity_2m ?? 0)}% · topsoil moisture{" "}
                {today.sm0_1 != null ? today.sm0_1.toFixed(2) : "—"} m³/m³
              </span>
              <span className="flex items-center gap-2 text-muted-foreground">
                <Wind className="size-4" />
                Wind {Math.round(data.current.wind_speed_10m ?? 0)} km/h · max today{" "}
                {Math.round(today.wind ?? 0)} km/h
              </span>
              <span className="flex items-center gap-2 text-muted-foreground">
                <Sprout className="size-4" />
                ≈{gdd7.toFixed(0)} °C·d growing-degree-days expected this week
              </span>
            </div>
            <p className="border-t pt-3 text-xs text-muted-foreground">
              {data.base_advisory.stage_hint}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Week at a glance */}
      <WeekStrip daily={data.daily} />

      {/* Alerts */}
      {data.alerts.length > 0 && (
        <div className="grid gap-3 md:grid-cols-2">
          {data.alerts.map((a, i) => (
            <Alert key={i} variant={a.level === "warning" ? "destructive" : "default"}>
              <TriangleAlert />
              <AlertTitle>{a.title}</AlertTitle>
              <AlertDescription>{a.detail}</AlertDescription>
            </Alert>
          ))}
        </div>
      )}

      <div className="grid gap-4 lg:grid-cols-3">
        {/* Rain forecast */}
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>16-day rainfall forecast</CardTitle>
          </CardHeader>
          <CardContent>
            <ChartContainer config={rainConfig} className="h-56 w-full">
              <ComposedChart data={rainChart}>
                <CartesianGrid vertical={false} />
                <XAxis dataKey="day" tickLine={false} axisLine={false} interval={1} tickMargin={8} />
                <YAxis yAxisId="l" tickLine={false} axisLine={false} width={32} />
                <YAxis yAxisId="r" orientation="right" domain={[0, 100]} tickLine={false} axisLine={false} width={32} />
                <ChartTooltip content={<ChartTooltipContent />} />
                <ChartLegend content={<ChartLegendContent />} />
                <Bar yAxisId="l" dataKey="precip" fill="var(--color-precip)" radius={[4, 4, 0, 0]} />
                <Line yAxisId="r" dataKey="prob" stroke="var(--color-prob)" strokeWidth={2} dot={false} />
              </ComposedChart>
            </ChartContainer>
          </CardContent>
        </Card>

        {/* Climate anomaly */}
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <CardTitle>Climate context</CardTitle>
              <Badge variant={CLASS_BADGE[clim.classification] ?? "secondary"}>
                {clim.classification.replace("-", " ")}
              </Badge>
            </div>
          </CardHeader>
          <CardContent className="flex flex-col gap-3">
            <p className="text-3xl font-bold tracking-tight">
              {clim.anomaly_pct > 0 ? "+" : ""}
              {clim.anomaly_pct}%
            </p>
            <p className="text-sm text-muted-foreground">
              Last 30 days: {clim.observed_mm} mm vs {clim.normal_mm} mm normal ({clim.climatology_period} ERA5
              climatology). {clim.dry_streak_days} consecutive dry days.
            </p>
            <div className="flex flex-wrap gap-2">
              <Badge variant="outline">Top {Math.round(clim.percentile * 100)}% wettest window</Badge>
              <Badge variant="outline">{clim.period.start} → {clim.period.end}</Badge>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Season so far vs climatology */}
      <Card>
        <CardHeader>
          <div className="flex flex-wrap items-center gap-2">
            <CardTitle>This season vs 30-year normal</CardTitle>
            <Badge variant="outline">ERA5 reanalysis</Badge>
          </div>
        </CardHeader>
        <CardContent>
          <ChartContainer config={seasonConfig} className="h-52 w-full">
            <ComposedChart data={clim.recent}>
              <CartesianGrid vertical={false} />
              <XAxis
                dataKey="date"
                tickLine={false}
                axisLine={false}
                interval={6}
                tickMargin={8}
                tickFormatter={(v: string) => v.slice(5)}
              />
              <YAxis yAxisId="l" tickLine={false} axisLine={false} width={30} />
              <YAxis yAxisId="r" orientation="right" tickLine={false} axisLine={false} width={36} />
              <ChartTooltip content={<ChartTooltipContent />} />
              <ChartLegend content={<ChartLegendContent />} />
              <Bar yAxisId="l" dataKey="precip" fill="var(--color-precip)" radius={[1, 1, 0, 0]} />
              <Line yAxisId="r" dataKey="cum_obs" stroke="var(--color-cum_obs)" strokeWidth={2.2} dot={false} />
              <Line
                yAxisId="r"
                dataKey="cum_normal"
                stroke="var(--color-cum_normal)"
                strokeWidth={1.8}
                strokeDasharray="5 4"
                dot={false}
              />
            </ComposedChart>
          </ChartContainer>
          <p className="mt-2 text-xs text-muted-foreground">
            Bars: each day’s measured rain. Green solid line: how much rain actually fell this season so far.
            Amber dashed line: what an average year delivers by the same date — the gap is the drought signal.
          </p>
        </CardContent>
      </Card>

      {/* Soil moisture */}
      <Card>
        <CardHeader>
          <CardTitle>Soil moisture by depth (m³/m³)</CardTitle>
        </CardHeader>
        <CardContent>
          <ChartContainer config={soilConfig} className="h-48 w-full">
            <AreaChart data={soilChart}>
              <CartesianGrid vertical={false} />
              <XAxis dataKey="day" tickLine={false} axisLine={false} interval={1} tickMargin={8} />
              <YAxis tickLine={false} axisLine={false} width={34} />
              <ChartTooltip content={<ChartTooltipContent />} />
              <ChartLegend content={<ChartLegendContent />} />
              <Area dataKey="sm9_27" stroke="var(--color-sm9_27)" fill="var(--color-sm9_27)" fillOpacity={0.18} />
              <Area dataKey="sm3_9" stroke="var(--color-sm3_9)" fill="var(--color-sm3_9)" fillOpacity={0.22} />
              <Area dataKey="sm0_1" stroke="var(--color-sm0_1)" fill="var(--color-sm0_1)" fillOpacity={0.28} />
            </AreaChart>
          </ChartContainer>
        </CardContent>
      </Card>

      {/* Operations planner */}
      <OpsPlanner daily={data.daily} />

      {/* Pest risks + growth tracker */}
      <div className="grid gap-4 lg:grid-cols-2">
        <PestCard risks={data.pest_risks} />
        <GrowthCard />
      </div>

      {/* Neural model + AI advisory */}
      <div className="grid gap-4 lg:grid-cols-2">
        <NeuralForecast daily={data.daily} />
        <AdvisoryCard />
      </div>
    </div>
  )
}
