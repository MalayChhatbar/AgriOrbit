import * as React from "react"
import { Brain, Sparkles, TriangleAlert } from "lucide-react"
import { toast } from "sonner"

import { api, type AdvisoryResponse } from "@/lib/api"
import { useFarm } from "@/lib/location"
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Empty, EmptyContent, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@/components/ui/empty"
import { Spinner } from "@/components/ui/spinner"

export function AdvisoryCard() {
  const { lat, lon, crop } = useFarm()
  const [data, setData] = React.useState<AdvisoryResponse | null>(null)
  const [loading, setLoading] = React.useState(false)

  const generate = async () => {
    setLoading(true)
    try {
      const res = await api.advisory(lat, lon, crop)
      setData(res)
      if (res.source === "rules") {
        toast.info("Showing rules-engine advisory — add NVIDIA_API_KEY for IBM Granite phrasing")
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Advisory failed")
    } finally {
      setLoading(false)
    }
  }

  // reset when the farm changes so stale advice never lingers
  React.useEffect(() => setData(null), [lat, lon, crop])

  const shown = data?.advisory ?? data?.base_advisory ?? null

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-wrap items-center gap-2">
          <CardTitle>AI crop advisory</CardTitle>
          {data && (
            <Badge variant={data.source === "granite" ? "default" : "secondary"}>
              {data.source === "granite" ? "IBM Granite" : "Rules engine"}
            </Badge>
          )}
          {shown?.confidence && <Badge variant="outline">Confidence: {shown.confidence}</Badge>}
        </div>
        <CardDescription>
          Plain-language advice for <span className="capitalize">{crop}</span>, built from the live forecast,
          climate anomaly and rule checks. Granite only rephrases rules output — it cannot invent weather data.
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        {!data && !loading && (
          <Empty>
            <EmptyHeader>
              <EmptyMedia variant="icon">
                <Brain />
              </EmptyMedia>
              <EmptyTitle>No advisory generated yet</EmptyTitle>
              <EmptyDescription>
                Combines the 16-day forecast, the 30-year climate anomaly and (when configured) IBM Granite.
              </EmptyDescription>
            </EmptyHeader>
            <EmptyContent>
              <Button onClick={generate}>
                <Sparkles data-icon="inline-start" />
                Generate advisory
              </Button>
            </EmptyContent>
          </Empty>
        )}

        {loading && (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Spinner /> Generating advisory…
          </div>
        )}

        {shown && !loading && (
          <>
            <p className="text-sm leading-relaxed">{shown.summary}</p>

            {shown.actions.length > 0 && (
              <div className="flex flex-col gap-2">
                {shown.actions.map((a, i) => (
                  <div key={i} className="flex flex-col gap-1 rounded-lg border p-3 sm:flex-row sm:items-center sm:gap-3">
                    <Badge variant="secondary" className="w-fit shrink-0">{a.day}</Badge>
                    <div>
                      <p className="text-sm font-medium">{a.action}</p>
                      <p className="text-xs text-muted-foreground">{a.reason}</p>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {shown.cautions.length > 0 && (
              <div className="flex flex-col gap-1.5">
                {shown.cautions.map((c, i) => (
                  <p key={i} className="flex items-center gap-2 text-xs text-muted-foreground">
                    <TriangleAlert className="size-3.5 shrink-0 text-primary" />
                    <span className="capitalize-first">{c}</span>
                  </p>
                ))}
              </div>
            )}

            <Accordion>
              <AccordionItem value="baseline">
                <AccordionTrigger>Why this advice? (rules baseline)</AccordionTrigger>
                <AccordionContent>
                  <p className="mb-2 text-sm">{data!.base_advisory.summary}</p>
                  <ul className="flex flex-col gap-1 text-xs text-muted-foreground">
                    {data!.base_advisory.actions.map((a, i) => (
                      <li key={i}>• {a.day}: {a.action} — {a.reason}</li>
                    ))}
                  </ul>
                </AccordionContent>
              </AccordionItem>
            </Accordion>

            <Button variant="outline" size="sm" onClick={generate} className="w-fit">
              Regenerate
            </Button>
          </>
        )}
      </CardContent>
    </Card>
  )
}
