'use client'

import { useEffect, useRef } from 'react'
import mapboxgl from 'mapbox-gl'
import 'mapbox-gl/dist/mapbox-gl.css'

interface MapViewProps {
  lat: number
  lng: number
  zoom?: number
  className?: string
}

export default function MapView({ lat, lng, zoom = 16, className = 'h-64 w-full rounded-xl overflow-hidden' }: MapViewProps) {
  const mapContainer = useRef<HTMLDivElement>(null)
  const map = useRef<mapboxgl.Map | null>(null)

  useEffect(() => {
    if (!mapContainer.current) return

    mapboxgl.accessToken = process.env.NEXT_PUBLIC_MAPBOX_TOKEN!

    map.current = new mapboxgl.Map({
      container: mapContainer.current,
      style: 'mapbox://styles/mapbox/light-v11',
      center: [lng, lat],
      zoom,
    })

    new mapboxgl.Marker({ color: '#2563eb' })
      .setLngLat([lng, lat])
      .addTo(map.current)

    map.current.addControl(new mapboxgl.NavigationControl(), 'top-right')

    return () => {
      map.current?.remove()
    }
  }, [lat, lng, zoom])

  return <div ref={mapContainer} className={className} />
}
