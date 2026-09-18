import * as React from "react"

export interface FarmLocation {
  lat: number
  lon: number
  name: string
  crop: string
}

interface FarmContextValue extends FarmLocation {
  setLocation: (lat: number, lon: number, name?: string) => void
  setCrop: (crop: string) => void
}

const DEFAULT_FARM: FarmLocation = {
  lat: 28.6139,
  lon: 77.209,
  name: "New Delhi, India",
  crop: "wheat",
}

const STORAGE_KEY = "agriorbit.farm"

const FarmContext = React.createContext<FarmContextValue | undefined>(undefined)

function loadInitial(): FarmLocation {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (raw) {
      const parsed = JSON.parse(raw)
      if (typeof parsed.lat === "number" && typeof parsed.lon === "number") {
        return { ...DEFAULT_FARM, ...parsed }
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
    setFarm((f) => ({
      ...f,
      lat: Math.round(lat * 10000) / 10000,
      lon: Math.round(lon * 10000) / 10000,
      name: name ?? `${lat.toFixed(3)}, ${lon.toFixed(3)}`,
    }))
  }, [])

  const setCrop = React.useCallback((crop: string) => setFarm((f) => ({ ...f, crop })), [])

  const value = React.useMemo(
    () => ({ ...farm, setLocation, setCrop }),
    [farm, setLocation, setCrop]
  )

  return <FarmContext.Provider value={value}>{children}</FarmContext.Provider>
}

// eslint-disable-next-line react-refresh/only-export-components
export function useFarm() {
  const ctx = React.useContext(FarmContext)
  if (!ctx) throw new Error("useFarm must be used inside FarmProvider")
  return ctx
}
