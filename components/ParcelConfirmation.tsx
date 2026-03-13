'use client'

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
  matchQuality: 'exact' | 'fuzzy' | 'none'
  onConfirm: () => void
  onSearchAgain: () => void
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
  matchQuality,
  onConfirm,
  onSearchAgain,
}: ParcelConfirmationProps) {
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
              Results will be based on limited data. For best accuracy, use an address within our covered jurisdictions.
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
          {zoneCode && (
            <div>
              <p className="text-gray-500">Zoning District</p>
              <p className="font-medium text-gray-900">
                {zoneCode}{zoneName ? ` — ${zoneName}` : ''}
              </p>
            </div>
          )}
          {apn && (
            <div>
              <p className="text-gray-500">APN</p>
              <p className="font-medium text-gray-900">{apn}</p>
            </div>
          )}
          {acreage && (
            <div>
              <p className="text-gray-500">Lot Size</p>
              <p className="font-medium text-gray-900">{acreage} acres ({Math.round(acreage * 43560).toLocaleString()} sq ft)</p>
            </div>
          )}
        </div>
      </div>

      {/* Actions */}
      <div className="flex gap-3">
        <button
          onClick={onConfirm}
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
