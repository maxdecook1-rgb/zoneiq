'use client'

import { useState, useEffect } from 'react'
import { CompatibleZone } from '@/lib/types'

interface ZoneRecommendationProps {
  jurisdictionId: string
  projectType: string
  projectTypeLabel: string
  currentZoneCode: string
  currentZoneId?: string
  onStartRezoning: (recommendedZoneCode: string) => void
}

export default function ZoneRecommendation({
  jurisdictionId,
  projectType,
  projectTypeLabel,
  currentZoneCode,
  currentZoneId,
  onStartRezoning,
}: ZoneRecommendationProps) {
  const [recommendations, setRecommendations] = useState<CompatibleZone[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    async function fetchRecommendations() {
      try {
        const params = new URLSearchParams({
          jurisdiction_id: jurisdictionId,
          project_type: projectType,
        })
        if (currentZoneId) {
          params.set('current_zone_id', currentZoneId)
        }

        const res = await fetch(`/api/zone-recommendations?${params}`)
        if (!res.ok) {
          throw new Error('Failed to fetch zone recommendations')
        }
        const data = await res.json()
        setRecommendations(data.recommendations || [])
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load recommendations')
      } finally {
        setLoading(false)
      }
    }

    fetchRecommendations()
  }, [jurisdictionId, projectType, currentZoneId])

  if (loading) {
    return (
      <div className="bg-white border border-gray-200 rounded-xl p-6 animate-pulse">
        <div className="h-5 w-64 bg-gray-200 rounded mb-3" />
        <div className="h-4 w-96 bg-gray-100 rounded mb-4" />
        <div className="h-24 bg-gray-50 rounded" />
      </div>
    )
  }

  if (error) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-xl p-5">
        <p className="text-sm text-red-800">{error}</p>
      </div>
    )
  }

  if (recommendations.length === 0) {
    return (
      <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-5">
        <h3 className="font-semibold text-yellow-900 mb-1">No Compatible Zones Found</h3>
        <p className="text-sm text-yellow-800">
          No zoning districts in this jurisdiction currently permit {projectTypeLabel.toLowerCase()} development.
          Consider consulting with a zoning attorney about variance or special exception options.
        </p>
      </div>
    )
  }

  return (
    <div className="bg-white border border-gray-200 rounded-xl p-6 space-y-4">
      <div>
        <h3 className="font-semibold text-gray-900 text-lg">
          This project requires a different zoning district
        </h3>
        <p className="text-sm text-gray-600 mt-1">
          A <span className="font-medium">{projectTypeLabel}</span> is not permitted in the{' '}
          <span className="font-medium">{currentZoneCode}</span> zone. These zones would allow it:
        </p>
      </div>

      <div className="space-y-3">
        {recommendations.map((rec, i) => (
          <div
            key={rec.zone_code}
            className={`border rounded-lg p-4 ${
              i === 0 ? 'border-blue-200 bg-blue-50/50' : 'border-gray-200'
            }`}
          >
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <span className="font-semibold text-gray-900">
                  {rec.zone_code}
                </span>
                {rec.zone_name && (
                  <span className="text-sm text-gray-600">— {rec.zone_name}</span>
                )}
                {i === 0 && (
                  <span className="text-xs px-2 py-0.5 bg-blue-100 text-blue-700 rounded-full font-medium">
                    Best match
                  </span>
                )}
              </div>
              <span
                className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                  rec.use_status === 'permitted'
                    ? 'bg-green-100 text-green-700'
                    : 'bg-amber-100 text-amber-700'
                }`}
              >
                {rec.use_status === 'permitted' ? 'Permitted Use' : 'Conditional Use'}
              </span>
            </div>

            {/* Key dev standards */}
            <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-gray-500">
              {rec.development_standards?.max_height_ft && (
                <span>Max height: {rec.development_standards.max_height_ft} ft</span>
              )}
              {rec.development_standards?.max_stories && (
                <span>Max stories: {rec.development_standards.max_stories}</span>
              )}
              {rec.development_standards?.min_lot_sqft && (
                <span>
                  Min lot: {rec.development_standards.min_lot_sqft.toLocaleString()} sq ft
                </span>
              )}
              {rec.development_standards?.max_far && (
                <span>Max FAR: {rec.development_standards.max_far}</span>
              )}
              {rec.development_standards?.setbacks && (
                <span>
                  Setbacks: F:{rec.development_standards.setbacks.front_ft}&apos;
                  {' '}S:{rec.development_standards.setbacks.side_ft}&apos;
                  {' '}R:{rec.development_standards.setbacks.rear_ft}&apos;
                </span>
              )}
            </div>
          </div>
        ))}
      </div>

      <button
        onClick={() => onStartRezoning(recommendations[0].zone_code)}
        className="w-full px-6 py-3 bg-blue-600 text-white font-medium rounded-xl
                   hover:bg-blue-700 transition-colors text-center"
      >
        Start Rezoning Application to {recommendations[0].zone_code}
        {recommendations[0].zone_name ? ` (${recommendations[0].zone_name})` : ''} →
      </button>
    </div>
  )
}
