import path from "path"
import tailwindcss from "@tailwindcss/vite"
import react from "@vitejs/plugin-react"
import { defineConfig } from "vite"

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      "@": path.resolve(import.meta.dirname, "./src"),
    },
  },
  server: {
    proxy: {
      // AgriOrbit FastAPI backend (uv run uvicorn app.main:app --port 8000)
      "/api": {
        target: "http://localhost:8000",
        changeOrigin: true,
      },
    },
  },
})
