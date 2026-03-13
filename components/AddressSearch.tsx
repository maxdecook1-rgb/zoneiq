'use client'

import { useState, useCallback, useRef, useEffect } from 'react'

interface Suggestion {
  id: string
  place_name: string
  center: [number, number]
}

interface AddressSearchProps {
  onAddressSelect: (address: string, lat: number, lng: number) => void
  placeholder?: string
}

export default function AddressSearch({ onAddressSelect, placeholder = 'Enter a property address...' }: AddressSearchProps) {
  const [query, setQuery] = useState('')
  const [suggestions, setSuggestions] = useState<Suggestion[]>([])
  const [loading, setLoading] = useState(false)
  const [showSuggestions, setShowSuggestions] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const debounceRef = useRef<NodeJS.Timeout | null>(null)

  // Clean up timeout on unmount
  useEffect(() => {
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current)
    }
  }, [])

  const searchAddress = useCallback(async (value: string) => {
    if (value.length < 3) {
      setSuggestions([])
      setError(null)
      return
    }

    setLoading(true)
    setError(null)
    try {
      const token = process.env.NEXT_PUBLIC_MAPBOX_TOKEN
      if (!token) {
        setError('Mapbox token not configured')
        setLoading(false)
        return
      }
      const res = await fetch(
        `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(value)}.json?access_token=${token}&country=US&types=address&limit=5`
      )
      if (!res.ok) {
        const errData = await res.json().catch(() => ({}))
        console.error('Mapbox API error:', res.status, errData)
        setError('Address lookup failed')
        setSuggestions([])
        return
      }
      const data = await res.json()
      setSuggestions(data.features || [])
      setShowSuggestions(true)
    } catch (err) {
      console.error('Address search error:', err)
      setError('Could not reach address service')
      setSuggestions([])
    } finally {
      setLoading(false)
    }
  }, [])

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value
    setQuery(value)

    // Cancel previous debounce
    if (debounceRef.current) clearTimeout(debounceRef.current)

    debounceRef.current = setTimeout(() => {
      searchAddress(value)
    }, 300)
  }

  const handleSelect = (suggestion: Suggestion) => {
    setQuery(suggestion.place_name)
    setShowSuggestions(false)
    setSuggestions([])
    setError(null)
    onAddressSelect(suggestion.place_name, suggestion.center[1], suggestion.center[0])
  }

  return (
    <div className="relative w-full max-w-2xl">
      <div className="relative">
        <svg
          className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
          />
        </svg>
        <input
          type="text"
          value={query}
          onChange={handleChange}
          onFocus={() => suggestions.length > 0 && setShowSuggestions(true)}
          onBlur={() => setTimeout(() => setShowSuggestions(false), 200)}
          placeholder={placeholder}
          className="w-full pl-12 pr-4 py-4 text-lg border-2 border-gray-200 rounded-xl
                     focus:border-blue-500 focus:ring-2 focus:ring-blue-200 focus:outline-none
                     shadow-sm transition-all duration-200 bg-white text-gray-900
                     placeholder:text-gray-400"
        />
        {loading && (
          <div className="absolute right-4 top-1/2 -translate-y-1/2">
            <div className="animate-spin h-5 w-5 border-2 border-blue-500 rounded-full border-t-transparent" />
          </div>
        )}
      </div>

      {error && (
        <div className="mt-2 px-4 py-2 bg-red-50 border border-red-200 rounded-lg text-sm text-red-600">
          {error}
        </div>
      )}

      {showSuggestions && suggestions.length > 0 && (
        <ul className="absolute z-50 w-full mt-1 bg-white border border-gray-200 rounded-xl shadow-lg overflow-hidden">
          {suggestions.map((s) => (
            <li key={s.id}>
              <button
                type="button"
                onMouseDown={() => handleSelect(s)}
                className="w-full px-4 py-3 text-left hover:bg-blue-50 transition-colors
                           flex items-center gap-3 text-gray-700"
              >
                <svg className="h-4 w-4 text-gray-400 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
                <span className="text-sm">{s.place_name}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
