import * as React from "react"
import { LocateFixed, MapPin } from "lucide-react"
import { toast } from "sonner"

import { api, type GeocodeResult } from "@/lib/api"
import { useFarm } from "@/lib/location"
import { Button } from "@/components/ui/button"
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "@/components/ui/dialog"
import { Skeleton } from "@/components/ui/skeleton"

export function LocationPicker() {
  const { name, lat, lon, setLocation, recents } = useFarm()
  const [open, setOpen] = React.useState(false)
  const [query, setQuery] = React.useState("")
  const [results, setResults] = React.useState<GeocodeResult[]>([])
  const [searching, setSearching] = React.useState(false)

  // debounced place search against the backend geocoder
  React.useEffect(() => {
    if (query.trim().length < 2) {
      setResults([])
      return
    }
    setSearching(true)
    const t = setTimeout(async () => {
      try {
        const res = await api.geocode(query.trim())
        setResults(res.results)
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Search failed")
      } finally {
        setSearching(false)
      }
    }, 300)
    return () => clearTimeout(t)
  }, [query])

  const useMyLocation = () => {
    if (!navigator.geolocation) {
      toast.error("Geolocation is not available in this browser")
      return
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setLocation(pos.coords.latitude, pos.coords.longitude, "My field")
        setOpen(false)
        toast.success("Location set from GPS")
      },
      () => toast.error("Location permission denied")
    )
  }

  return (
    <>
      <Button variant="outline" onClick={() => setOpen(true)} className="max-w-64">
        <MapPin data-icon="inline-start" />
        <span className="truncate">{name}</span>
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="gap-0 p-0" showCloseButton={false}>
          <DialogTitle className="sr-only">Choose farm location</DialogTitle>
          <DialogDescription className="sr-only">
            Search for a place, or use your GPS position.
          </DialogDescription>
          <Command shouldFilter={false}>
            <CommandInput
              placeholder="Search a village, town or district…"
              value={query}
              onValueChange={setQuery}
            />
            <CommandList>
              {searching && (
                <div className="flex flex-col gap-2 p-3">
                  <Skeleton className="h-8 w-full" />
                  <Skeleton className="h-8 w-3/4" />
                </div>
              )}
              {!searching && query.trim().length >= 2 && results.length === 0 && (
                <CommandEmpty>No places found for “{query}”.</CommandEmpty>
              )}
              <CommandGroup heading="Quick action">
                <CommandItem onSelect={useMyLocation}>
                  <LocateFixed />
                  Use my current location
                </CommandItem>
              </CommandGroup>
              {query.trim().length < 2 && recents.length > 0 && (
                <CommandGroup heading="Recent fields">
                  {recents.map((r) => (
                    <CommandItem
                      key={`${r.lat}-${r.lon}`}
                      onSelect={() => {
                        setLocation(r.lat, r.lon, r.name)
                        setOpen(false)
                      }}
                    >
                      <MapPin />
                      <span className="truncate">{r.name}</span>
                    </CommandItem>
                  ))}
                </CommandGroup>
              )}
              {results.length > 0 && (
                <CommandGroup heading="Places">
                  {results.map((r) => {
                    const label = [r.name, r.admin1, r.country].filter(Boolean).join(", ")
                    return (
                      <CommandItem
                        key={`${r.latitude}-${r.longitude}-${r.name}`}
                        onSelect={() => {
                          setLocation(r.latitude, r.longitude, label)
                          setOpen(false)
                          setQuery("")
                        }}
                      >
                        <MapPin />
                        <span className="truncate">{label}</span>
                      </CommandItem>
                    )
                  })}
                </CommandGroup>
              )}
            </CommandList>
          </Command>
          <div className="border-t p-3 text-xs text-muted-foreground">
            Selected: {lat.toFixed(4)}, {lon.toFixed(4)} · You can also click any point on the map.
          </div>
        </DialogContent>
      </Dialog>
    </>
  )
}
