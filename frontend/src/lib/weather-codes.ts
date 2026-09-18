import {
  CloudDrizzle,
  CloudFog,
  CloudHail,
  CloudLightning,
  CloudRain,
  CloudSnow,
  CloudSun,
  Cloudy,
  Sun,
  type LucideIcon,
} from "lucide-react"

/** WMO weather-code → label + Lucide icon (data table, not a component). */
const CODES: Record<number, { label: string; icon: LucideIcon }> = {
  0: { label: "Clear sky", icon: Sun },
  1: { label: "Mainly clear", icon: CloudSun },
  2: { label: "Partly cloudy", icon: CloudSun },
  3: { label: "Overcast", icon: Cloudy },
  45: { label: "Fog", icon: CloudFog },
  48: { label: "Rime fog", icon: CloudFog },
  51: { label: "Light drizzle", icon: CloudDrizzle },
  53: { label: "Drizzle", icon: CloudDrizzle },
  55: { label: "Dense drizzle", icon: CloudDrizzle },
  61: { label: "Light rain", icon: CloudRain },
  63: { label: "Rain", icon: CloudRain },
  65: { label: "Heavy rain", icon: CloudRain },
  66: { label: "Freezing rain", icon: CloudRain },
  67: { label: "Heavy freezing rain", icon: CloudRain },
  71: { label: "Light snow", icon: CloudSnow },
  73: { label: "Snow", icon: CloudSnow },
  75: { label: "Heavy snow", icon: CloudSnow },
  77: { label: "Snow grains", icon: CloudSnow },
  80: { label: "Light showers", icon: CloudRain },
  81: { label: "Showers", icon: CloudRain },
  82: { label: "Violent showers", icon: CloudRain },
  85: { label: "Snow showers", icon: CloudSnow },
  86: { label: "Heavy snow showers", icon: CloudSnow },
  95: { label: "Thunderstorm", icon: CloudLightning },
  96: { label: "Thunderstorm + hail", icon: CloudHail },
  99: { label: "Thunderstorm + heavy hail", icon: CloudHail },
}

export function weatherInfo(code: number | null | undefined): { label: string; icon: LucideIcon } {
  if (code == null) return { label: "—", icon: CloudSun }
  return CODES[code] ?? { label: "Mixed", icon: CloudSun }
}
