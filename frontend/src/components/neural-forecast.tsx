import * as React from "react"
import { FlaskConical } from "lucide-react"
import { toast } from "sonner"
import { Bar, BarChart, CartesianGrid, XAxis } from "recharts"

import { api, type DailyRow, type MLForecast } from "@/lib/api"
import { useFarm } from "@/lib/location"
import { Badge } from "@/components/ui/badge"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart"
import { Empty, EmptyContent, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@/components/ui/empty"
import { Skeleton } from "@/components/ui/skeleton"

const chartConfig = {
  model: { label: "Neural model", color: "var(--chart-1)" },
  official: { label: "NWP forecast", color: "var(--chart-2)" },
} satisfies ChartConfig

export function NeuralForecast({ daily }: { daily: DailyRow[] }) {
  const { lat, lon } = useFarm()
  const [data, setData] = React.useState<MLForecast | null>(null)
  const [loading, setLoading] = React.useState(true)

  React.useEffect(() => {
    let cancelled = false
    setLoading(true)
    api
      .mlforecast(lat, lon)
      .then((res) => !cancelled && setData(res))
      .catch((err) => !cancelled && toast.error(err instanceof Error ? err.message : "ML forecast failed"))
      .finally(() => !cancelled && setLoading(false))
    return () => {
      cancelled = true
    }
  }, [lat, lon])

  const officialByDate = React.useMemo(
    () => new Map(daily.map((d) => [d.date, d.precip_prob ?? 0])),
    [daily]
  )

  const chartData = React.useMemo(() => {
    if (!data?.rain_probabilities) return []
    return data.rain_probabilities.map((p) => ({
      day: p.date.slice(5),
      model: Math.round(p.probability * 100),
      official: officialByDate.get(p.date) ?? null,
    }))
  }, [data, officialByDate])

  const metrics = data?.metrics ?? {}

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-wrap items-center gap-2">
          <CardTitle>Neural rain model</CardTitle>
          <Badge variant={data?.available ? "default" : "secondary"}>
            {data?.available ? "LSTM · ONNX · ERA5-trained" : "awaiting training"}
          </Badge>
          {data?.available && (
            <Badge variant="outline">Trained on {data.trained_on}</Badge>
          )}
        </div>
        <CardDescription>
          AgriOrbit’s own PyTorch model vs the official numerical forecast — next 7 days rain probability (%).
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        {loading && <Skeleton className="h-48 w-full" />}

        {!loading && data && !data.available && (
          <Empty>
            <EmptyHeader>
              <EmptyMedia variant="icon">
                <FlaskConical />
              </EmptyMedia>
              <EmptyTitle>Model artifacts not installed yet</EmptyTitle>
              <EmptyDescription>
                Run <code className="rounded bg-muted px-1 py-0.5">notebooks/train_agriorbit_colab.ipynb</code> on
                Google Colab (free T4 GPU), then drop the downloaded
                <code className="rounded bg-muted px-1 py-0.5">rain_model.onnx</code> +{" "}
                <code className="rounded bg-muted px-1 py-0.5">scaler.json</code> into{" "}
                <code className="rounded bg-muted px-1 py-0.5">backend/ml/artifacts/</code>.
              </EmptyDescription>
            </EmptyHeader>
            <EmptyContent />
          </Empty>
        )}

        {!loading && data?.available && (
          <>
            <ChartContainer config={chartConfig} className="h-48 w-full">
              <BarChart data={chartData} barGap={2}>
                <CartesianGrid vertical={false} />
                <XAxis dataKey="day" tickLine={false} axisLine={false} tickMargin={8} />
                <ChartTooltip content={<ChartTooltipContent />} />
                <Bar dataKey="model" fill="var(--color-model)" radius={[4, 4, 0, 0]} />
                <Bar dataKey="official" fill="var(--color-official)" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ChartContainer>
            <div className="flex flex-wrap items-center gap-2 text-sm">
              <Badge variant="outline">
                Expected rain next 7 days: {data.expected_total_mm} mm
              </Badge>
              {typeof metrics.accuracy_at_50pct === "number" && (
                <Badge variant="outline">Val accuracy {(Number(metrics.accuracy_at_50pct) * 100).toFixed(0)}%</Badge>
              )}
              {typeof metrics.brier_score === "number" && (
                <Badge variant="outline">Brier {String(metrics.brier_score)}</Badge>
              )}
              {typeof metrics.brier_baseline_climatology === "number" && (
                <Badge variant="outline">Baseline {String(metrics.brier_baseline_climatology)}</Badge>
              )}
            </div>
            <p className="text-xs text-muted-foreground">
              Statistical second opinion trained on 30+ years of satellite reanalysis. Accuracy decays with lead
              time — always cross-check against the official forecast (blue).
            </p>
          </>
        )}
      </CardContent>
    </Card>
  )
}
