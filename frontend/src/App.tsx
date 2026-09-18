import * as React from "react"
import { HashRouter, Route, Routes } from "react-router-dom"
import { Satellite } from "lucide-react"

import { LocationPicker } from "@/components/location-picker"
import { AppSidebar } from "@/components/app-sidebar"
import { Separator } from "@/components/ui/separator"
import {
  SidebarInset,
  SidebarProvider,
  SidebarTrigger,
} from "@/components/ui/sidebar"
import { Skeleton } from "@/components/ui/skeleton"
import { Toaster } from "@/components/ui/sonner"
import { TooltipProvider } from "@/components/ui/tooltip"

// Route-level code splitting keeps the initial bundle light
// (recharts/leaflet load only when the Advisory page opens).
const HomePage = React.lazy(() => import("@/pages/Home"))
const AdvisoryPage = React.lazy(() => import("@/pages/Advisory"))
const ChatPage = React.lazy(() => import("@/pages/Chat"))
const AboutPage = React.lazy(() => import("@/pages/About"))

function PageFallback() {
  return (
    <div className="grid gap-4 lg:grid-cols-3">
      <Skeleton className="h-72 lg:col-span-2" />
      <Skeleton className="h-72" />
    </div>
  )
}

export default function App() {
  return (
    <HashRouter>
      <TooltipProvider>
        <SidebarProvider>
          <AppSidebar />
          <SidebarInset>
            <header className="flex h-14 shrink-0 items-center gap-3 border-b px-4">
              <SidebarTrigger />
              <Separator orientation="vertical" className="h-6" />
              <div className="flex items-center gap-2 font-semibold">
                <Satellite className="size-4 text-primary" />
                AgriOrbit
              </div>
              <div className="ml-auto">
                <LocationPicker />
              </div>
            </header>
            <main className="flex-1 overflow-x-hidden p-4 md:p-6">
              <React.Suspense fallback={<PageFallback />}>
                <Routes>
                <Route path="/" element={<HomePage />} />
                <Route path="/advisory" element={<AdvisoryPage />} />
                <Route path="/chat" element={<ChatPage />} />
                <Route path="/about" element={<AboutPage />} />
              </Routes>
              </React.Suspense>
            </main>
          </SidebarInset>
          <Toaster position="top-center" />
        </SidebarProvider>
      </TooltipProvider>
    </HashRouter>
  )
}
