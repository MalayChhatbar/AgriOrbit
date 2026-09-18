import { StrictMode } from "react"
import { createRoot } from "react-dom/client"

import "./index.css"
import App from "./App.tsx"
import { ThemeProvider } from "@/components/theme-provider.tsx"
import { FarmProvider } from "@/lib/location"

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <ThemeProvider defaultTheme="dark" storageKey="agriorbit-theme">
      <FarmProvider>
        <App />
      </FarmProvider>
    </ThemeProvider>
  </StrictMode>
)
