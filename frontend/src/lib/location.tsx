import * as React from "react"

export interface RecentField {
  lat: number
  lon: number
  name: string
}

export interface FarmLocation {
  lat: number
  lon: number
  name: string
  crop: string
  stage: string
  lang: "en" | "hi"
  sowingDate: string | null
  recents: RecentField[]
}

interface FarmContextValue extends FarmLocation {
  setLocation: (lat: number, lon: number, name?: string) => void
  setCrop: (crop: string) => void
  setStage: (stage: string) => void
  setLang: (lang: "en" | "hi") => void
  setSowingDate: (d: string | null) => void
}

const DEFAULT_FARM: FarmLocation = {
  lat: 28.6139,
  lon: 77.209,
  name: "New Delhi, India",
  crop: "wheat",
  stage: "vegetative",
  lang: "en",
  sowingDate: null,
  recents: [],
}

const STORAGE_KEY = "agriorbit.farm"

const FarmContext = React.createContext<FarmContextValue | undefined>(undefined)

function loadInitial(): FarmLocation {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (raw) {
      const parsed = JSON.parse(raw)
      if (typeof parsed.lat === "number" && typeof parsed.lon === "number") {
        return { ...DEFAULT_FARM, ...parsed, recents: parsed.recents ?? [] }
      }
    }
  } catch {
    /* corrupted storage — fall back to default */
  }
  return DEFAULT_FARM
}

export function FarmProvider({ children }: { children: React.ReactNode }) {
  const [farm, setFarm] = React.useState<FarmLocation>(loadInitial)

  React.useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(farm))
  }, [farm])

  const setLocation = React.useCallback((lat: number, lon: number, name?: string) => {
    setFarm((f) => {
      const nextName = name ?? `${lat.toFixed(3)}, ${lon.toFixed(3)}`
      const key = (r: { lat: number; lon: number }) =>
        `${r.lat.toFixed(2)}:${r.lon.toFixed(2)}`
      const entry = { lat, lon, name: nextName }
      const recents = [entry, ...f.recents.filter((r) => key(r) !== key(entry))].slice(0, 5)
      return {
        ...f,
        lat: Math.round(lat * 10000) / 10000,
        lon: Math.round(lon * 10000) / 10000,
        name: nextName,
        recents,
      }
    })
  }, [])

  const setCrop = React.useCallback((crop: string) => setFarm((f) => ({ ...f, crop })), [])
  const setStage = React.useCallback((stage: string) => setFarm((f) => ({ ...f, stage })), [])
  const setLang = React.useCallback((lang: "en" | "hi") => setFarm((f) => ({ ...f, lang })), [])
  const setSowingDate = React.useCallback(
    (d: string | null) => setFarm((f) => ({ ...f, sowingDate: d })),
    []
  )

  const value = React.useMemo(
    () => ({ ...farm, setLocation, setCrop, setStage, setLang, setSowingDate }),
    [farm, setLocation, setCrop, setStage, setLang, setSowingDate]
  )

  return <FarmContext.Provider value={value}>{children}</FarmContext.Provider>
}

// eslint-disable-next-line react-refresh/only-export-components
export function useFarm() {
  const ctx = React.useContext(FarmContext)
  if (!ctx) throw new Error("useFarm must be used inside FarmProvider")
  return ctx
}
