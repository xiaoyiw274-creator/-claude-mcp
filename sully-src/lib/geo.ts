export interface GeoSnap {
  ts: number
  lat: number
  lon: number
  accuracy_m: number
  age_s: number
  device: string
  battery: number
  dist_home_m: number
  is_home: boolean
  address_full: string
  address_short: string
  weather: {
    temp: number
    feels: number
    humidity: number
    wind_kmh: number
    desc: string
    is_day: boolean
  }
  recent_events?: {ts:number; kind:string; summary:string}[]
}

export async function fetchGeo(): Promise<GeoSnap | null> {
  try {
    const r = await fetch('/api/geo')
    if (!r.ok) return null
    return await r.json()
  } catch { return null }
}
