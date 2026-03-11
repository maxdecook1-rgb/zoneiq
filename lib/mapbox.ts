const MAPBOX_TOKEN = process.env.NEXT_PUBLIC_MAPBOX_TOKEN!

export interface GeocodingResult {
  lat: number
  lng: number
  place_name: string
  address: string
}

export async function geocodeAddress(address: string): Promise<GeocodingResult | null> {
  const encoded = encodeURIComponent(address)
  const url = `https://api.mapbox.com/geocoding/v5/mapbox.places/${encoded}.json?access_token=${MAPBOX_TOKEN}&country=US&types=address&limit=1`

  const res = await fetch(url)
  if (!res.ok) return null

  const data = await res.json()
  if (!data.features || data.features.length === 0) return null

  const feature = data.features[0]
  return {
    lat: feature.center[1],
    lng: feature.center[0],
    place_name: feature.place_name,
    address: feature.place_name,
  }
}

export function getMapboxToken(): string {
  return MAPBOX_TOKEN
}
