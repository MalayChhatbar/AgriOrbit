import { Bug, Lightbulb, ShieldAlert } from "lucide-react"

import type { PestRisk } from "@/lib/api"
import { Badge } from "@/components/ui/badge"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { cn } from "@/lib/utils"

const RISK_VARIANT: Record<PestRisk["risk"], "destructive" | "secondary" | "outline"> = {
  high: "destructive",
  moderate: "secondary",
  low: "outline",
}

/** Weather-driven pest & disease outlook — the disease-risk-modeling pillar. */
export function PestCard({ risks }: { risks: PestRisk[] }) {
  const worst = risks[0]?.risk ?? "low"
  return (
    <Card>
      <CardHeader>
        <div className="flex flex-wrap items-center gap-2">
          <CardTitle>Pest & disease outlook</CardTitle>
          <Badge variant={RISK_VARIANT[worst]}>overall: {worst}</Badge>
        </div>
        <CardDescription>
          Risk levels derived from the coming week's rain-hours, humidity and temperature —
          the same signals plant-protection teams watch.
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        {risks.map((r) => (
          <div key={r.id} className="flex flex-col gap-1 border-t pt-3 first:border-t-0 first:pt-0">
            <div className="flex items-center gap-2">
              {r.kind === "disease" ? (
                <ShieldAlert className="size-4 shrink-0 text-muted-foreground" />
              ) : (
                <Bug className="size-4 shrink-0 text-muted-foreground" />
              )}
              <p className="text-sm font-medium leading-tight">{r.name}</p>
              <Badge variant={RISK_VARIANT[r.risk]} className="ml-auto capitalize">
                {r.risk}
              </Badge>
            </div>
            <p className="text-xs text-muted-foreground">{r.reason}</p>
            {r.tip && (
              <p className={cn("flex items-start gap-1.5 text-xs")}>
                <Lightbulb className="mt-0.5 size-3.5 shrink-0" />
                <span className="text-muted-foreground">{r.tip}</span>
              </p>
            )}
          </div>
        ))}
      </CardContent>
    </Card>
  )
}
