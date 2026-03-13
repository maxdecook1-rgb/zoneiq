'use client'

import { useState } from 'react'
import dynamic from 'next/dynamic'

const MapView = dynamic(() => import('./MapView'), { ssr: false })

interface ParcelConfirmationProps {
  address: string
  lat: number
  lng: number
  apn: string | null
  acreage: number | null
  zoneCode: string | null
  zoneName: string | null
  jurisdictionName: string | null
  jurisdictionId: string | null
  matchQuality: 'exact' | 'fuzzy' | 'none'
  onConfirm: (overrides?: { acreage?: number; zoneOverride?: ZoneOverride }) => void
  onSearchAgain: () => void
}

export interface ZoneOverride {
  id: string | null
  code: string
  name: string | null
  category: string
  permitted_uses: string[]
  conditional_uses: string[]
  development_standards: Record<string, unknown>
}

export default function ParcelConfirmation({
  address,
  lat,
  lng,
  apn,
  acreage,
  zoneCode,
  zoneName,
  jurisdictionName,
  jurisdictionId,
  matchQuality,
  onConfirm,
  onSearchAgain,
}: ParcelConfirmationProps) {
  const [manualAcreage, setManualAcreage] = useState('')
  const [showZoneOverride, setShowZoneOverride] = useState(false)
  const [manualZoneCode, setManualZoneCode] = useState('')
  const [zoneLookupLoading, setZoneLookupLoading] = useState(false)
  const [zoneLookupResult, setZoneLookupResult] = useState<ZoneOverride | null>(null)
  const [zoneLookupError, setZoneLookupError] = useState<string | null>(null)
  const showLotInput = !acreage

  const handleZoneLookup = async () => {
    if (!manualZoneCode.trim()) return

    setZoneLookupLoading(true)
    setZoneLookupError(null)
    setZoneLookupResult(null)

    try {
      const res = await fetch('/api/zone-lookup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          zone_code: manualZoneCode.trim(),
          jurisdiction_id: jurisdictionId || undefined,
          jurisdiction_name: jurisdictionName || undefined,
          state: 'GA',
        }),
      })

      const data = await res.json()

      if (!res.ok) {
        throw new Error(data.error || 'Zone lookup failed')
      }

      setZoneLookupResult({
        id: data.zone.id || null,
        code: data.zone.code,
        name: data.zone.name,
        category: data.zone.category,
        permitted_uses: data.zone.permitted_uses || [],
        conditional_uses: data.zone.conditional_uses || [],
        development_standards: data.zone.development_standards || {},
      })
    } catch (err) {
      setZoneLookupError(err instanceof Error ? err.message : 'Lookup failed')
    } finally {
      setZoneLookupLoading(false)
    }
  }

  const handleConfirm = () => {
    const overrides: { acreage?: number; zoneOverride?: ZoneOverride } = {}
    if (showLotInput && manualAcreage) {
      overrides.acreage = parseFloat(manualAcreage)
    }
    if (zoneLookupResult) {
      overrides.zoneOverride = zoneLookupResult
    }
    onConfirm(Object.keys(overrides).length > 0 ? overrides : undefined)
  }

  // Determine the displayed zone (override or original)
  const displayZoneCode = zoneLookupResult?.code || zoneCode
  const displayZoneName = zoneLookupResult?.name || zoneName

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      {/* Map */}
      <MapView lat={lat} lng={lng} />

      {/* Match quality banner */}
      {matchQuality === 'none' && (
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg px-4 py-3 flex items-start gap-3">
          <svg className="h-5 w-5 text-yellow-500 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z" />
          </svg>
          <div>
            <p className="text-sm font-medium text-yellow-800">Parcel not found in database</p>
            <p className="text-xs text-yellow-700 mt-0.5">
              You can enter your zoning district below for accurate results.
            </p>
          </div>
        </div>
      )}

      {/* Parcel details card */}
      <div className="bg-white border border-gray-200 rounded-xl p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-semibold text-gray-900">Parcel Details</h3>
          {matchQuality === 'exact' && (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
              <span className="w-1.5 h-1.5 rounded-full bg-green-500" />
              Found in database
            </span>
          )}
        </div>

        <div className="grid grid-cols-2 gap-4 text-sm">
          <div className="col-span-2">
            <p className="text-gray-500">Address</p>
            <p className="font-medium text-gray-900">{address}</p>
          </div>
          {jurisdictionName && (
            <div>
              <p className="text-gray-500">Jurisdiction</p>
              <p className="font-medium text-gray-900">{jurisdictionName}</p>
            </div>
          )}
          {displayZoneCode && (
            <div>
              <p className="text-gray-500">Zoning District</p>
              <div className="flex items-center gap-2">
                <p className="font-medium text-gray-900">
                  {displayZoneCode}{displayZoneName ? ` — ${displayZoneName}` : ''}
                </p>
                {zoneLookupResult && (
                  <span className="text-xs px-1.5 py-0.5 bg-blue-100 text-blue-700 rounded">
                    Updated
                  </span>
                )}
              </div>
            </div>
          )}
          {apn && (
            <div>
              <p className="text-gray-500">APN</p>
              <p className="font-medium text-gray-900">{apn}</p>
            </div>
          )}
          {acreage ? (
            <div>
              <p className="text-gray-500">Lot Size</p>
              <p className="font-medium text-gray-900">{acreage} acres ({Math.round(acreage * 43560).toLocaleString()} sq ft)</p>
            </div>
          ) : (
            <div className="col-span-2">
              <label className="block text-gray-500 mb-1">Lot Size (acres)</label>
              <div className="flex items-center gap-3">
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  placeholder="e.g. 0.5"
                  value={manualAcreage}
                  onChange={(e) => setManualAcreage(e.target.value)}
                  className="w-40 px-3 py-2 border border-gray-300 rounded-lg text-sm text-gray-900
                             focus:border-blue-500 focus:ring-1 focus:ring-blue-200 focus:outline-none"
                />
                {manualAcreage && !isNaN(parseFloat(manualAcreage)) && (
                  <span className="text-xs text-gray-500">
                    = {Math.round(parseFloat(manualAcreage) * 43560).toLocaleString()} sq ft
                  </span>
                )}
              </div>
              <p className="text-xs text-gray-400 mt-1">
                Optional — enables FAR and lot coverage checks.
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Zoning Override Section */}
      {!showZoneOverride ? (
        <button
          onClick={() => setShowZoneOverride(true)}
          className="w-full py-3 border-2 border-dashed border-gray-300 rounded-lg text-gray-500
                     hover:border-blue-400 hover:text-blue-600 transition-colors text-sm flex items-center justify-center gap-2"
        >
          <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
          </svg>
          {zoneCode ? 'Wrong zoning? Enter the correct zone code' : 'Know your zoning? Enter it here'}
        </button>
      ) : (
        <div className="bg-white border border-gray-200 rounded-xl p-5 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="font-semibold text-gray-900">
              {zoneCode ? 'Correct Zoning District' : 'Enter Zoning District'}
            </h3>
            <button
              onClick={() => {
                setShowZoneOverride(false)
                setManualZoneCode('')
                setZoneLookupResult(null)
                setZoneLookupError(null)
              }}
              className="text-xs text-gray-400 hover:text-gray-600"
            >
              Cancel
            </button>
          </div>

          <p className="text-sm text-gray-500">
            Enter your zone code (e.g. R-3, PRD, C-2, M-1) and we&apos;ll look up the permitted uses and development standards automatically.
          </p>

          <div className="flex gap-2">
            <input
              type="text"
              value={manualZoneCode}
              onChange={(e) => setManualZoneCode(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleZoneLookup()}
              className="flex-1 px-3 py-2 border border-gray-300 rounded-lg text-sm text-gray-900
                         focus:border-blue-500 focus:ring-1 focus:ring-blue-200 focus:outline-none
                         uppercase placeholder:normal-case"
              placeholder="e.g. R-3, PRD, C-2, I-1"
              disabled={zoneLookupLoading}
            />
            <button
              onClick={handleZoneLookup}
              disabled={!manualZoneCode.trim() || zoneLookupLoading}
              className="px-4 py-2 bg-blue-600 text-white font-medium rounded-lg text-sm
                         hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed
                         flex items-center gap-2"
            >
              {zoneLookupLoading ? (
                <>
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  Looking up...
                </>
              ) : (
                'Look up'
              )}
            </button>
          </div>

          {zoneLookupError && (
            <div className="bg-red-50 border border-red-200 rounded-lg px-3 py-2">
              <p className="text-sm text-red-700">{zoneLookupError}</p>
            </div>
          )}

          {zoneLookupResult && (
            <div className="bg-green-50 border border-green-200 rounded-lg p-4 space-y-3">
              <div className="flex items-center gap-2">
                <svg className="h-5 w-5 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <p className="font-semibold text-green-900">
                  {zoneLookupResult.code} — {zoneLookupResult.name}
                </p>
              </div>

              <div className="grid grid-cols-2 gap-2 text-xs">
                <div>
                  <p className="text-green-700 font-medium">Category</p>
                  <p className="text-green-800 capitalize">{zoneLookupResult.category?.replace(/_/g, ' ')}</p>
                </div>
                {zoneLookupResult.permitted_uses?.length > 0 && (
                  <div>
                    <p className="text-green-700 font-medium">Permitted Uses</p>
                    <p className="text-green-800">{zoneLookupResult.permitted_uses.map(u => u.replace(/_/g, ' ')).join(', ')}</p>
                  </div>
                )}
                {(() => {
                  const ds = zoneLookupResult.development_standards as Record<string, unknown>
                  const maxHeight = ds?.max_height_ft
                  return maxHeight ? (
                    <div>
                      <p className="text-green-700 font-medium">Max Height</p>
                      <p className="text-green-800">{String(maxHeight)} ft</p>
                    </div>
                  ) : null
                })()}
                {(() => {
                  const ds = zoneLookupResult.development_standards as Record<string, unknown>
                  const minLot = ds?.min_lot_sqft
                  return minLot ? (
                    <div>
                      <p className="text-green-700 font-medium">Min Lot Size</p>
                      <p className="text-green-800">{Number(minLot).toLocaleString()} sq ft</p>
                    </div>
                  ) : null
                })()}
              </div>

              <p className="text-xs text-green-600 italic">
                This zone will be used for your feasibility analysis.
              </p>
            </div>
          )}
        </div>
      )}

      {/* Actions */}
      <div className="flex gap-3">
        <button
          onClick={handleConfirm}
          className="flex-1 px-6 py-3 bg-blue-600 text-white font-medium rounded-xl
                     hover:bg-blue-700 transition-colors text-center"
        >
          Confirm this parcel
        </button>
        <button
          onClick={onSearchAgain}
          className="px-6 py-3 bg-white border border-gray-300 text-gray-700 font-medium
                     rounded-xl hover:bg-gray-50 transition-colors"
        >
          Search again
        </button>
      </div>
    </div>
  )
}
