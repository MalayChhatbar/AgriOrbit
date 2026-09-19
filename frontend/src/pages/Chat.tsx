import * as React from "react"
import { BookOpen, SendHorizonal, Sprout, User } from "lucide-react"
import { toast } from "sonner"

import { api } from "@/lib/api"
import { useFarm } from "@/lib/location"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Spinner } from "@/components/ui/spinner"
import { Textarea } from "@/components/ui/textarea"

interface ChatMsg {
  role: "user" | "assistant"
  content: string
  source?: "granite" | "rules"
  refs?: string[]
}

const GREETING: ChatMsg = {
  role: "assistant",
  content:
    "Namaste! I'm AgriOrbit's farm advisor. Ask me about rainfall, irrigation timing to your crop, sowing windows, or what an alert means. I answer with your field's live satellite data.",
}

const QUICK_PROMPTS = [
  "When should I irrigate this week?",
  "Is it safe to spray tomorrow morning?",
  "What does the climate anomaly mean for my crop?",
  "When is the best sowing window ahead?",
]

export default function ChatPage() {
  const { lat, lon, crop, name } = useFarm()
  const [messages, setMessages] = React.useState<ChatMsg[]>([GREETING])
  const [input, setInput] = React.useState("")
  const [sending, setSending] = React.useState(false)
  const endRef = React.useRef<HTMLDivElement>(null)

  React.useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" })
  }, [messages, sending])

  const send = async (preset?: string) => {
    const text = (preset ?? input).trim()
    if (!text || sending) return
    const history = [...messages.filter((m) => m.role === "user" || m.source).map((m) => ({ role: m.role, content: m.content }))]
    const withUser: ChatMsg[] = [...messages, { role: "user", content: text }]
    setMessages(withUser)
    setInput("")
    setSending(true)
    try {
      const res = await api.chat([...history, { role: "user", content: text }], lat, lon, crop)
      setMessages([...withUser, { role: "assistant", content: res.reply, source: res.source, refs: res.kb_refs }])
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Chat failed")
    } finally {
      setSending(false)
    }
  }

  return (
    <div className="mx-auto flex h-[calc(100svh-10.5rem)] max-w-3xl flex-col gap-3">
      <Card className="flex min-h-0 flex-1 flex-col">
        <CardHeader className="border-b pb-3">
          <div className="flex flex-wrap items-center gap-2">
            <CardTitle className="text-base">Ask the advisor</CardTitle>
            <Badge variant="outline" className="truncate">{name}</Badge>
            <Badge variant="secondary" className="capitalize">{crop}</Badge>
          </div>
        </CardHeader>
        <CardContent className="flex min-h-0 flex-1 flex-col gap-0 p-0">
          <ScrollArea className="min-h-0 flex-1">
            <div className="flex flex-col gap-4 p-4">
              {messages.map((m, i) => (
                <div key={i} className={`flex items-start gap-3 ${m.role === "user" ? "flex-row-reverse" : ""}`}>
                  <Avatar className="size-8">
                    <AvatarFallback>
                      {m.role === "user" ? <User className="size-4" /> : <Sprout className="size-4" />}
                    </AvatarFallback>
                  </Avatar>
                  <div
                    className={`max-w-[85%] rounded-xl border px-3.5 py-2.5 text-sm leading-relaxed whitespace-pre-wrap ${
                      m.role === "user"
                        ? "bg-primary text-primary-foreground"
                        : "bg-muted/50"
                    }`}
                  >
                    {m.content}
                    {m.refs && m.refs.length > 0 && m.role === "assistant" && (
                      <div className="mt-2 flex flex-wrap gap-1.5">
                        {m.refs.map((r) => (
                          <Badge key={r} variant="outline" className="gap-1 text-[10px]">
                            <BookOpen className="size-3" />
                            {r}
                          </Badge>
                        ))}
                      </div>
                    )}
                    {m.source === "granite" && (
                      <div className="mt-2">
                        <Badge variant="secondary" className="text-[10px]">IBM Granite</Badge>
                      </div>
                    )}
                  </div>
                </div>
              ))}
              {sending && (
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Spinner /> Thinking…
                </div>
              )}
              <div ref={endRef} />
            </div>
          </ScrollArea>

          <div className="flex flex-col gap-2 border-t p-3">
            <div className="flex flex-wrap gap-1.5">
              {QUICK_PROMPTS.map((q) => (
                <Button
                  key={q}
                  variant="outline"
                  size="sm"
                  className="h-7 text-xs"
                  disabled={sending}
                  onClick={() => void send(q)}
                >
                  {q}
                </Button>
              ))}
            </div>
            <div className="flex items-end gap-2">
            <Textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault()
                  void send()
                }
              }}
              placeholder="e.g. When should I irrigate my wheat this week?"
              rows={1}
              className="max-h-32 min-h-9 flex-1 resize-none"
            />
            <Button onClick={() => void send()} disabled={sending || !input.trim()}>
              <SendHorizonal data-icon="inline-start" />
              Send
            </Button>
            </div>
          </div>
        </CardContent>
      </Card>
      <p className="text-center text-xs text-muted-foreground">
        Guidance is generated from weather data and general agronomy — always confirm chemical decisions with
        your local agriculture officer.
      </p>
    </div>
  )
}
