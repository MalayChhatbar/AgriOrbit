import * as React from "react"
import { Brain, Download, Sparkles, TriangleAlert } from "lucide-react"
import { toast } from "sonner"

import { api, type AdvisoryResponse } from "@/lib/api"
import { CROPS, labelFor, STAGES } from "@/lib/crops"
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
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Spinner } from "@/components/ui/spinner"

function toMarkdown(
  data: AdvisoryResponse,
  farm: { name: string; lat: number; lon: number }
): string {
  const a = data.advisory ?? data.base_advisory
  const lines = [
    `# AgriOrbit Advisory — ${farm.name}`,
    ``,
    `Generated: ${new Date().toLocaleString()}  `,
    `Coordinates: ${farm.lat.toFixed(4)}, ${farm.lon.toFixed(4)}  `,
    `Crop: ${labelFor(CROPS, data.crop)} · Stage: ${labelFor(STAGES, data.stage)}  `,
    `Source: ${data.source === "granite" ? "IBM Granite (rules-grounded)" : "AgriOrbit rules engine"}`,
    ``,
    `## Summary`,
    a.summary,
    ``,
    `## Recommended actions`,
    ...a.actions.map((x) => `- **${x.day}** — ${x.action}. _${x.reason}_`),
    ``,
    `## Cautions`,
    ...a.cautions.map((c) => `- ${c}`),
  ]
  if (a.metrics) {
    lines.push(
      ``,
      `7-day rain: ${a.metrics.rain_7d_mm} mm · ET₀: ${a.metrics.et0_7d_mm} mm · water deficit: ${a.metrics.water_deficit_mm} mm`
    )
  }
  lines.push(
    ``,
    `---`,
    `_AgriOrbit (SDG 2 / SDG 13). Advisory is guidance, not an instruction — verify chemical and dosage decisions with your local agriculture officer._`
  )
  return lines.join("\n")
}

export function AdvisoryCard() {
  const { lat, lon, crop, stage, lang, setLang, name } = useFarm()
  const [data, setData] = React.useState<AdvisoryResponse | null>(null)
  const [loading, setLoading] = React.useState(false)

  const generate = async () => {
    setLoading(true)
    try {
      const res = await api.advisory(lat, lon, crop, stage, lang)
      setData(res)
      if (res.source === "rules" && lang === "hi") {
        toast.info("हिंदी लिखने के लिए IBM Granite चाहिए — NVIDIA_API_KEY सेट करें")
      } else if (res.source === "rules") {
        toast.info("Showing rules-engine advisory — add NVIDIA_API_KEY for IBM Granite phrasing")
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Advisory failed")
    } finally {
      setLoading(false)
    }
  }

  // stale advice must never linger after the farm/stage/language changes
  React.useEffect(() => setData(null), [lat, lon, crop, stage, lang])

  const download = () => {
    if (!data) return
    const blob = new Blob([toMarkdown(data, { name, lat, lon })], {
      type: "text/markdown;charset=utf-8",
    })
    const url = URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url
    a.download = `agriorbit-advisory-${new Date().toISOString().slice(0, 10)}.md`
    a.click()
    URL.revokeObjectURL(url)
    toast.success("Advisory saved — ready to share")
  }

  const shown = data ? (data.advisory ?? data.base_advisory) : null

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
          <Select value={lang} onValueChange={(v) => v && setLang(v as "en" | "hi")}>
            <SelectTrigger className="ml-auto w-32">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectGroup>
                <SelectItem value="en">English</SelectItem>
                <SelectItem value="hi">हिंदी</SelectItem>
              </SelectGroup>
            </SelectContent>
          </Select>
        </div>
        <CardDescription>
          Plain-language advice for <span className="capitalize">{labelFor(CROPS, crop)}</span> at{" "}
          <span className="lowercase">{labelFor(STAGES, stage)}</span> stage — built from the live forecast,
          climate anomaly and rule checks. Granite only rephrases rules output; it cannot invent weather data.
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

            <div className="flex flex-wrap gap-2">
              <Button variant="outline" size="sm" onClick={generate}>
                Regenerate
              </Button>
              <Button variant="outline" size="sm" onClick={download}>
                <Download data-icon="inline-start" />
                Download as Markdown
              </Button>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  )
}
