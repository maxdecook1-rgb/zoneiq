'use client'

import { FeasibilityResult as FeasibilityResultType, ZoningDistrict, Jurisdiction } from '@/lib/types'
import ConfidenceBadge from './ConfidenceBadge'
import RoadmapSteps from './RoadmapSteps'

interface FeasibilityResultProps {
  result: FeasibilityResultType
  zone?: ZoningDistrict | null
  jurisdiction?: Jurisdiction | null
  onSave?: () => void
  onExport?: () => void
  saving?: boolean
}

const statusConfig = {
  permitted: {
    icon: (
      <svg className="h-16 w-16 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
    ),
    label: 'Permitted As-of-Right',
    bg: 'bg-green-50',
    border: 'border-green-200',
    textColor: 'text-green-800',
  },
  conditional: {
    icon: (
      <svg className="h-16 w-16 text-yellow-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z" />
      </svg>
    ),
    label: 'Conditional Approval Required',
    bg: 'bg-yellow-50',
    border: 'border-yellow-200',
    textColor: 'text-yellow-800',
  },
  not_permitted: {
    icon: (
      <svg className="h-16 w-16 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
    ),
    label: 'Not Permitted',
    bg: 'bg-red-50',
    border: 'border-red-200',
    textColor: 'text-red-800',
  },
}

export default function FeasibilityResult({ result, zone, jurisdiction, onSave, onExport, saving }: FeasibilityResultProps) {
  const config = statusConfig[result.status]

  return (
    <div className="w-full max-w-3xl mx-auto space-y-6">
      {/* Status Header */}
      <div className={`${config.bg} ${config.border} border-2 rounded-2xl p-8 text-center`}>
        <div className="flex justify-center mb-4">{config.icon}</div>
        <h2 className={`text-2xl font-bold ${config.textColor} mb-2`}>{config.label}</h2>
        <ConfidenceBadge confidence={result.confidence} />
        {zone && jurisdiction && (
          <p className="text-sm text-gray-600 mt-3">
            Zone: <strong>{zone.code}</strong> ({zone.name}) &mdash; {jurisdiction.name}, {jurisdiction.state}
          </p>
        )}
      </div>

      {/* Summary */}
      {result.summary && (
        <div className="bg-white border border-gray-200 rounded-xl p-6">
          <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-2">Summary</h3>
          <p className="text-gray-800 leading-relaxed">{result.summary}</p>
        </div>
      )}

      {/* Standards Comparison Table */}
      {result.standards_comparison.length > 0 && (
        <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-200">
            <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wide">Development Standards</h3>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="bg-gray-50">
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Standard</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Proposed</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Allowed</th>
                  <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {result.standards_comparison.map((s, i) => (
                  <tr key={i}>
                    <td className="px-6 py-4 text-sm text-gray-900">{s.standard}</td>
                    <td className="px-6 py-4 text-sm text-gray-700">{String(s.proposed)}</td>
                    <td className="px-6 py-4 text-sm text-gray-700">{String(s.allowed)}</td>
                    <td className="px-6 py-4 text-center">
                      {s.compliant ? (
                        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                          Compliant
                        </span>
                      ) : (
                        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-800">
                          Non-Compliant
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Roadmap */}
      {result.roadmap_steps.length > 0 && (
        <RoadmapSteps steps={result.roadmap_steps} />
      )}

      {/* Disclaimer */}
      <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
        <p className="text-xs text-gray-500 text-center">
          This result is informational only and does not constitute legal or professional zoning advice.
        </p>
      </div>

      {/* Actions */}
      <div className="flex gap-3 justify-center">
        {onSave && (
          <button
            onClick={onSave}
            disabled={saving}
            className="px-6 py-2.5 bg-blue-600 text-white font-medium rounded-lg
                       hover:bg-blue-700 transition-colors disabled:opacity-50"
          >
            {saving ? 'Saving...' : 'Save Project'}
          </button>
        )}
        {onExport && (
          <button
            onClick={onExport}
            className="px-6 py-2.5 bg-white border border-gray-300 text-gray-700 font-medium
                       rounded-lg hover:bg-gray-50 transition-colors"
          >
            Export PDF
          </button>
        )}
      </div>
    </div>
  )
}
