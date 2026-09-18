import * as React from "react"
import { CircleMarker, MapContainer, TileLayer, useMap, useMapEvents } from "react-leaflet"
import "leaflet/dist/leaflet.css"

import { useFarm } from "@/lib/location"

function Recenter({ lat, lon }: { lat: number; lon: number }) {
  const map = useMap()
  React.useEffect(() => {
    map.setView([lat, lon], map.getZoom())
  }, [lat, lon, map])
  return null
}

function ClickToPick() {
  const { setLocation } = useFarm()
  useMapEvents({
    click(e) {
      setLocation(e.latlng.lat, e.latlng.lng)
    },
  })
  return null
}

export function FarmMap() {
  const { lat, lon } = useFarm()
  return (
    <MapContainer
      center={[lat, lon]}
      zoom={9}
      scrollWheelZoom
      className="z-0 h-72 w-full rounded-lg border md:h-96"
    >
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      />
      <Recenter lat={lat} lon={lon} />
      <ClickToPick />
      <CircleMarker
        center={[lat, lon]}
        radius={9}
        pathOptions={{ color: "#34d399", fillColor: "#34d399", fillOpacity: 0.75, weight: 2 }}
      />
    </MapContainer>
  )
}
