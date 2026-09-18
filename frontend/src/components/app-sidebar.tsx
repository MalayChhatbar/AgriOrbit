import { Link, useLocation } from "react-router-dom"
import { CloudSunRain, House, Info, MessagesSquare, Sprout } from "lucide-react"

import { useFarm } from "@/lib/location"
import { Badge } from "@/components/ui/badge"
import { Separator } from "@/components/ui/separator"
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

export function AppSidebar() {
  const { name, crop } = useFarm()
  const { pathname } = useLocation()

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
        <div className="flex flex-col gap-1 px-2 pb-2 text-xs text-muted-foreground">
          <span className="truncate font-medium text-foreground">{name}</span>
          <span>
            Crop focus · <span className="capitalize">{crop}</span>
          </span>
          <Separator className="my-1.5" />
          <span>1M1B × IBM SkillsBuild · AI for Sustainability</span>
        </div>
      </SidebarFooter>
    </Sidebar>
  )
}
