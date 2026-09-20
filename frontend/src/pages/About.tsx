import * as React from "react"
import { ShieldCheck } from "lucide-react"

import { api, type ModelInfo } from "@/lib/api"
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Separator } from "@/components/ui/separator"
import { Skeleton } from "@/components/ui/skeleton"

const SDGS = [
  {
    id: "SDG 2",
    name: "Zero Hunger",
    role: "Primary",
    color: "#DDA63A", // official UN SDG 2 colour
    targets: [
      "2.3 — double the productivity and incomes of small-scale food producers",
      "2.4 — resilient agricultural practices that strengthen capacity to adapt to extreme weather, drought and flooding",
    ],
    why: "Smallholder farmers produce a third of the world's food on <2 ha plots, yet have the least access to weather intelligence. AgriOrbit puts satellite-grade timing on their phones.",
  },
  {
    id: "SDG 13",
    name: "Climate Action",
    role: "Secondary",
    color: "#48773E", // official UN SDG 13 colour
    targets: ["13.1 — strengthen resilience and adaptive capacity to climate-related hazards and natural disasters"],
    why: "Erratic monsoons, heatwaves and unseasonal rain are climate hazards. Predicting them locally, and comparing against a 30-year baseline, is exactly 'strengthening resilience'.",
  },
]

const STACK = [
  { name: "Open-Meteo", desc: "ECMWF IFS + NOAA GFS numerical forecasts (16 days), keyless API" },
  { name: "ERA5 / ERA5-Land", desc: "Copernicus satellite-assimilated reanalysis, 1991–present" },
  { name: "IBM Granite 3.3", desc: "Advisory phrasing + conversational assistant via NVIDIA's OpenAI-compatible API" },
  { name: "PyTorch → ONNX", desc: "Custom LSTM rain model trained on 28 Indian stations (T4 GPU, Colab)" },
  { name: "OpenStreetMap", desc: "Free basemap tiles for field picking" },
  { name: "shadcn/ui + ReactBits", desc: "All interface components, incl. animations, from pre-built registries" },
]

const RESPONSIBLE_AI = [
  {
    q: "Fairness",
    a: "Predictions depend only on physical weather features — never on a farmer's identity, land size, caste, gender or income. Training stations span every major Indian agro-climatic zone to avoid regional bias.",
  },
  {
    q: "Transparency",
    a: "Every advice card shows its source (IBM Granite or rules engine), the raw numbers behind it, and the neural model's measured validation accuracy next to a climatology baseline users can compare against.",
  },
  {
    q: "Ethics",
    a: "Advisory language is assistive, not directive; chemical-dosage questions are always redirected to agronomists. The neural model is labelled a 'second opinion' alongside the official forecast — never a replacement.",
  },
  {
    q: "Privacy",
    a: "No accounts, no personal data, nothing stored server-side. The only location used is the farm coordinate the user picks, held in their own browser's local storage.",
  },
]

export default function AboutPage() {
  const [model, setModel] = React.useState<ModelInfo | null>(null)

  React.useEffect(() => {
    api.modelinfo().then(setModel).catch(() => setModel(null))
  }, [])

  return (
    <div className="mx-auto flex max-w-4xl flex-col gap-6">
      {/* Problem statement */}
      <Card>
        <CardHeader>
          <CardTitle>The problem</CardTitle>
          <CardDescription>Design-thinking framing, per the internship brief</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
          <p className="text-lg font-medium leading-relaxed">
            “How might we use AI to give smallholder farmers satellite-grade weather and rainfall guidance, so
            that farming becomes more climate-resilient and sustainable?”
          </p>
          <p className="text-sm text-muted-foreground">
            <span className="font-medium text-foreground">Who is affected:</span> ~120 million Indian smallholder
            farm households (and ~500 million globally) whose sowing, irrigation and harvest choices decide a
            season's income — with rain arriving ever more erratically.
          </p>
          <p className="text-sm text-muted-foreground">
            <span className="font-medium text-foreground">Why AI:</span> raw weather grids are unusable for
            decisions. Prediction (LSTM on reanalysis), anomaly analysis vs 30-year norms, and an LLM translating
            both into plain language turn data into action at near-zero marginal cost.
          </p>
        </CardContent>
      </Card>

      {/* SDGs */}
      <div className="grid gap-4 md:grid-cols-2">
        {SDGS.map((s) => (
          <Card key={s.id}>
            <CardHeader>
              <div className="flex items-center gap-2">
                <Badge style={{ backgroundColor: s.color, color: "var(--background)" }}>{s.id}</Badge>
                <CardTitle className="text-base">{s.name}</CardTitle>
                <Badge variant="outline" className="ml-auto">{s.role}</Badge>
              </div>
            </CardHeader>
            <CardContent className="flex flex-col gap-2 text-sm text-muted-foreground">
              {s.targets.map((t) => (
                <p key={t}>🎯 {t}</p>
              ))}
              <Separator />
              <p>{s.why}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Data & stack */}
      <Card>
        <CardHeader>
          <CardTitle>Data &amp; models</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-3 sm:grid-cols-2">
          {STACK.map((s) => (
            <div key={s.name} className="rounded-lg border p-3">
              <p className="text-sm font-medium">{s.name}</p>
              <p className="text-xs text-muted-foreground">{s.desc}</p>
            </div>
          ))}
        </CardContent>
      </Card>

      {/* Model card */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <CardTitle>Neural rain model — model card</CardTitle>
            {model && (
              <Badge variant={model.available ? "default" : "secondary"}>
                {model.available ? "active" : "awaiting training"}
              </Badge>
            )}
          </div>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          {!model && <Skeleton className="h-24 w-full" />}
          {model && (
            <>
              <p className="text-sm text-muted-foreground">{model.architecture}</p>
              {model.features.length > 0 && (
                <div className="flex flex-wrap gap-1.5">
                  {model.features.map((f) => (
                    <Badge key={f} variant="outline">{f}</Badge>
                  ))}
                </div>
              )}
              {Object.keys(model.training).length > 0 && (
                <div className="grid gap-2 sm:grid-cols-2">
                  {Object.entries(model.training).map(([k, v]) => (
                    <div key={k} className="text-sm">
                      <span className="text-muted-foreground">{k.replaceAll("_", " ")}:</span>{" "}
                      <span className="font-medium">{String(v)}</span>
                    </div>
                  ))}
                </div>
              )}
              {Object.keys(model.metrics).length > 0 && (
                <div className="flex flex-wrap gap-2">
                  {Object.entries(model.metrics)
                    .filter(([, v]) => typeof v === "number")
                    .map(([k, v]) => (
                      <Badge key={k} variant="secondary">
                        {k.replaceAll("_", " ")}: {String(v)}
                      </Badge>
                    ))}
                </div>
              )}
              {model.notes && <p className="text-xs text-muted-foreground">{model.notes}</p>}
              {!model.available && (
                <p className="text-sm text-muted-foreground">
                  Train it with <code className="rounded bg-muted px-1 py-0.5">notebooks/train_agriorbit_colab.ipynb</code> on
                  a free Colab T4 GPU, then drop the artifacts into <code className="rounded bg-muted px-1 py-0.5">backend/ml/artifacts/</code>.
                </p>
              )}
            </>
          )}
        </CardContent>
      </Card>

      {/* Responsible AI */}
      <Card>
        <CardHeader>
          <CardTitle>Responsible AI</CardTitle>
          <CardDescription>Mandatory section of the internship rubric — baked into the product.</CardDescription>
        </CardHeader>
        <CardContent>
          <Accordion>
            {RESPONSIBLE_AI.map((r, i) => (
              <AccordionItem key={r.q} value={`ai-${i}`}>
                <AccordionTrigger>{r.q}</AccordionTrigger>
                <AccordionContent>{r.a}</AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>
        </CardContent>
      </Card>

      {/* Impact */}
      <Alert>
        <ShieldCheck />
        <AlertTitle>Expected impact</AlertTitle>
        <AlertDescription>
          Better-timed sowing and irrigation raise smallholder yields by 10–20% in field studies of similar
          advisories, while cutting water use and crop loss from surprise rain. Zero-cost, keyless and
          hardware-free deployment means it scales to any village with a phone.
        </AlertDescription>
      </Alert>
    </div>
  )
}
