import * as React from "react"
import { Link, useLocation } from "react-router-dom"
import { CloudSunRain, House, Info, MessagesSquare, Moon, Sprout, Sun } from "lucide-react"

import { api } from "@/lib/api"
import { useFarm } from "@/lib/location"
import { cn } from "@/lib/utils"
import { useTheme } from "@/components/theme-provider"
import { Badge } from "@/components/ui/badge"
import { Separator } from "@/components/ui/separator"
import { Switch } from "@/components/ui/switch"
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar"

const NAV = [
  { to: "/", label: "Overview", icon: House },
  { to: "/advisory", label: "Farm Advisory", icon: CloudSunRain },
  { to: "/chat", label: "AI Assistant", icon: MessagesSquare },
  { to: "/about", label: "SDG & Method", icon: Info },
]

function ApiStatus() {
  const [health, setHealth] = React.useState<{
    llm_configured: boolean
    ml_model_available: boolean
  } | null>(null)

  React.useEffect(() => {
    api.health().then(setHealth).catch(() => setHealth(null))
  }, [])

  return (
    <div className="flex items-center gap-1.5">
      <span
        className={cn(
          "size-1.5 rounded-full",
          health ? "bg-primary" : "bg-destructive"
        )}
      />
      <span>
        {health
          ? `API online · ${health.llm_configured ? "Granite" : "rules"} · ${
              health.ml_model_available ? "model ready" : "model untrained"
            }`
          : "API offline"}
      </span>
    </div>
  )
}

export function AppSidebar() {
  const { name, crop } = useFarm()
  const { pathname } = useLocation()
  const { theme, setTheme } = useTheme()

  return (
    <Sidebar variant="inset">
      <SidebarHeader>
        <div className="flex items-center gap-2 px-2 py-1.5">
          <span className="flex size-9 items-center justify-center rounded-lg bg-primary text-primary-foreground">
            <Sprout />
          </span>
          <div className="flex flex-col">
            <span className="font-semibold leading-tight">AgriOrbit</span>
            <span className="text-xs text-muted-foreground">
              Satellite weather for farmers
            </span>
          </div>
          <Badge variant="secondary" className="ml-auto">
            SDG 2
          </Badge>
        </div>
      </SidebarHeader>

      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>Navigate</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {NAV.map((item) => (
                <SidebarMenuItem key={item.to}>
                  <SidebarMenuButton
                    isActive={pathname === item.to}
                    render={<Link to={item.to} />}
                  >
                    <item.icon />
                    <span>{item.label}</span>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      <SidebarFooter>
        <div className="flex flex-col gap-1.5 px-2 pb-2 text-xs text-muted-foreground">
          <span className="truncate font-medium text-foreground">{name}</span>
          <span>
            Crop focus · <span className="capitalize">{crop}</span>
          </span>
          <ApiStatus />
          <Separator className="my-1" />
          <div className="flex items-center justify-between">
            <span>1M1B × IBM SkillsBuild</span>
            <span className="flex items-center gap-1.5">
              <Sun className="size-3.5" />
              <Switch
                size="sm"
                checked={theme === "dark"}
                onCheckedChange={(checked) => setTheme(checked ? "dark" : "light")}
                aria-label="Toggle dark mode"
              />
              <Moon className="size-3.5" />
            </span>
          </div>
        </div>
      </SidebarFooter>
    </Sidebar>
  )
}
