/** Shared crop & growth-stage vocabularies (kept in sync with backend rules.py). */

export const CROPS = [
  { id: "wheat", name: "Wheat" },
  { id: "rice", name: "Rice (paddy)" },
  { id: "maize", name: "Maize" },
  { id: "cotton", name: "Cotton" },
  { id: "sugarcane", name: "Sugarcane" },
  { id: "soybean", name: "Soybean" },
  { id: "mustard", name: "Mustard" },
  { id: "groundnut", name: "Groundnut" },
  { id: "pulses", name: "Pulses" },
  { id: "vegetables", name: "Vegetables" },
  { id: "other", name: "Other / general" },
]

export const STAGES = [
  { id: "planning", name: "Planning / sowing" },
  { id: "vegetative", name: "Vegetative growth" },
  { id: "flowering", name: "Flowering" },
  { id: "grain_filling", name: "Grain filling" },
  { id: "harvest", name: "Harvest / drying" },
]

export const labelFor = (list: { id: string; name: string }[], id: string) =>
  list.find((x) => x.id === id)?.name ?? id
