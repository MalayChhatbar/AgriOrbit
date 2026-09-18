import { Link } from "react-router-dom"
import { ArrowRight, Brain, Satellite, Sprout } from "lucide-react"

import BlurText from "@/components/BlurText"
import CountUp from "@/components/CountUp"
import LightRays from "@/components/LightRays"
import ShinyText from "@/components/ShinyText"
import SplitText from "@/components/SplitText"
import SpotlightCard from "@/components/SpotlightCard"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"

const STATS = [
  { value: 28, suffix: "", label: "Indian agri stations train the model" },
  { value: 34, suffix: " yrs", label: "of ERA5 satellite reanalysis (1991–2024)" },
  { value: 16, suffix: " days", label: "official numerical-weather horizon" },
  { value: 7, suffix: " days", label: "neural rain-model horizon" },
]

const FEATURES = [
  {
    icon: Satellite,
    title: "Satellite truth, anywhere",
    body: "Tap any field on the map — ERA5 reanalysis and the ECMWF/GFS models resolve that exact point: rain, soil moisture at four depths, evapotranspiration.",
    color: "rgba(52, 211, 153, 0.18)" as const,
  },
  {
    icon: Brain,
    title: "A neural second opinion",
    body: "Our own LSTM, trained on 30+ years of Indian monsoon data, predicts the next 7 days of rain — shown beside the official forecast with honest accuracy metrics.",
    color: "rgba(96, 165, 250, 0.18)" as const,
  },
  {
    icon: Sprout,
    title: "Advice in plain language",
    body: "IBM Granite turns the numbers into sow / irrigate / spray / harvest guidance a farmer can act on — grounded in a rules engine so it can never invent weather.",
    color: "rgba(251, 191, 36, 0.18)" as const,
  },
]

const STEPS = [
  { n: 1, title: "Pick your field", body: "Search a village or tap the map. Every forecast is resolved for those exact coordinates." },
  { n: 2, title: "Read the signals", body: "16-day forecast, 30-year climate comparison, alerts, and the neural model — all in one dashboard." },
  { n: 3, title: "Act with confidence", body: "A plain-language advisory tells you when to sow, irrigate, spray and harvest — and why." },
]

export default function HomePage() {
  return (
    <div className="flex flex-col gap-10 pb-8">
      {/* ── Hero ─────────────────────────────────────────────────── */}
      <div className="relative min-h-[26rem] overflow-hidden rounded-2xl border">
        <div className="absolute inset-0">
          <LightRays
            raysOrigin="top-center"
            raysColor="#34d399"
            raysSpeed={0.9}
            lightSpread={1.1}
            rayLength={1.8}
            pulsating
            fadeDistance={1.2}
          />
        </div>
        <div className="relative z-10 flex flex-col items-center justify-center gap-5 px-6 py-20 text-center">
          <Badge variant="secondary">SDG 2 · Zero Hunger &nbsp;·&nbsp; SDG 13 · Climate Action</Badge>
          <SplitText
            text="AgriOrbit"
            tag="h1"
            className="text-5xl font-bold tracking-tight md:text-7xl"
            splitType="chars"
            delay={40}
            duration={0.7}
          />
          <ShinyText
            text="Space-grade weather intelligence for the smallest farms."
            className="max-w-xl text-base md:text-lg"
            speed={4}
          />
          <p className="max-w-2xl text-sm text-muted-foreground md:text-base">
            Satellite reanalysis, a self-trained neural rain model, and IBM Granite — combined into
            practical advice for smallholder farmers facing an unpredictable climate.
          </p>
          <div className="flex flex-wrap justify-center gap-3">
            <Button size="lg" nativeButton={false} render={<Link to="/advisory" />}>
              Open my farm advisory
              <ArrowRight data-icon="inline-end" />
            </Button>
            <Button variant="outline" size="lg" nativeButton={false} render={<Link to="/about" />}>
              How it works
            </Button>
          </div>
        </div>
      </div>

      {/* ── Stats ────────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {STATS.map((s) => (
          <Card key={s.label}>
            <CardContent className="flex flex-col gap-1 pt-6">
              <span className="text-3xl font-bold tracking-tight text-primary">
                <CountUp to={s.value} duration={1.6} separator="," />
                {s.suffix}
              </span>
              <span className="text-xs text-muted-foreground">{s.label}</span>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* ── Feature spotlights ───────────────────────────────────── */}
      <div className="flex flex-col gap-3">
        <BlurText
          text="Three instruments, one decision"
          className="text-2xl font-semibold tracking-tight md:text-3xl"
          animateBy="words"
          direction="top"
          delay={60}
        />
        <div className="grid gap-4 md:grid-cols-3">
          {FEATURES.map((f) => (
            <SpotlightCard key={f.title} className="p-6" spotlightColor={f.color}>
              <f.icon className="mb-3 size-6 text-primary" />
              <h3 className="mb-2 font-semibold leading-snug">{f.title}</h3>
              <p className="text-sm text-muted-foreground">{f.body}</p>
            </SpotlightCard>
          ))}
        </div>
      </div>

      {/* ── How it works ─────────────────────────────────────────── */}
      <Card>
        <CardHeader>
          <CardTitle>How it works</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-6 md:grid-cols-3">
          {STEPS.map((s) => (
            <div key={s.n} className="flex flex-col gap-2">
              <Badge variant="outline" className="w-fit">
                Step {s.n}
              </Badge>
              <h4 className="font-medium">{s.title}</h4>
              <p className="text-sm text-muted-foreground">{s.body}</p>
            </div>
          ))}
        </CardContent>
      </Card>

      <p className="text-center text-xs text-muted-foreground">
        AgriOrbit · AI for Sustainability Virtual Internship — 1M1B × IBM SkillsBuild · Built with
        Open-Meteo, ERA5, IBM Granite and PyTorch
      </p>
    </div>
  )
}
