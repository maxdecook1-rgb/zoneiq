'use client'

import { StructuredAnalysisResult, Verdict } from '@/lib/types'
import RoadmapSteps from './RoadmapSteps'

interface StructuredResultProps {
  result: StructuredAnalysisResult
  onSave?: () => void
  onExport?: () => void
  saving?: boolean
}

const verdictConfig: Record<Verdict, {
  bg: string
  border: string
  text: string
  icon: JSX.Element
}> = {
  allowed: {
    bg: 'bg-green-50',
    border: 'border-green-200',
    text: 'text-green-800',
    icon: (
      <svg className="h-14 w-14 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
    ),
  },
  conditional: {
    bg: 'bg-amber-50',
    border: 'border-amber-200',
    text: 'text-amber-800',
    icon: (
      <svg className="h-14 w-14 text-amber-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z" />
      </svg>
    ),
  },
  prohibited: {
    bg: 'bg-red-50',
    border: 'border-red-200',
    text: 'text-red-800',
    icon: (
      <svg className="h-14 w-14 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
    ),
  },
  uncertain: {
    bg: 'bg-gray-50',
    border: 'border-gray-300',
    text: 'text-gray-700',
    icon: (
      <svg className="h-14 w-14 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
    ),
  },
}

const confidenceLevelConfig = {
  high: { bg: 'bg-green-100', text: 'text-green-800', dot: 'bg-green-500' },
  medium: { bg: 'bg-yellow-100', text: 'text-yellow-800', dot: 'bg-yellow-500' },
  low: { bg: 'bg-red-100', text: 'text-red-800', dot: 'bg-red-500' },
}

export default function StructuredResult({ result, onSave, onExport, saving }: StructuredResultProps) {
  const vc = verdictConfig[result.verdict.status]
  const cc = confidenceLevelConfig[result.confidence.level]

  return (
    <div className="w-full max-w-3xl mx-auto space-y-6">
      {/* Section 1: Verdict Hero */}
      <div className={`${vc.bg} ${vc.border} border-2 rounded-2xl p-8 text-center`}>
        <div className="flex justify-center mb-4">{vc.icon}</div>
        <h2 className={`text-2xl font-bold ${vc.text} mb-2`}>{result.verdict.status_label}</h2>
        <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium ${cc.bg} ${cc.text}`}>
          <span className={`w-1.5 h-1.5 rounded-full ${cc.dot}`} />
          {Math.round(result.confidence.score * 100)}% confidence
        </span>
        <p className="text-sm text-gray-600 mt-3">
          Zone: <strong>{result.parcel_summary.zone_code}</strong>
          {result.parcel_summary.zone_name && ` (${result.parcel_summary.zone_name})`}
          {' '}&mdash; {result.parcel_summary.jurisdiction_name}
        </p>
      </div>

      {/* Section 2: AI Explanation */}
      {result.verdict.explanation && (
        <div className="bg-white border border-gray-200 rounded-xl p-6">
          <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-2">Analysis</h3>
          <p className="text-gray-800 leading-relaxed">{result.verdict.explanation}</p>
        </div>
      )}

      {/* Section 3: Parcel & Project Summary */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="bg-white border border-gray-200 rounded-xl p-5">
          <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-3">Parcel</h3>
          <div className="space-y-2 text-sm">
            <div>
              <p className="text-gray-500">Address</p>
              <p className="font-medium text-gray-900">{result.parcel_summary.address}</p>
            </div>
            {result.parcel_summary.apn && (
              <div>
                <p className="text-gray-500">APN</p>
                <p className="font-medium text-gray-900">{result.parcel_summary.apn}</p>
              </div>
            )}
            {result.parcel_summary.acreage && (
              <div>
                <p className="text-gray-500">Lot Size</p>
                <p className="font-medium text-gray-900">
                  {result.parcel_summary.acreage} acres ({Math.round(result.parcel_summary.acreage * 43560).toLocaleString()} sq ft)
                </p>
              </div>
            )}
          </div>
        </div>

        <div className="bg-white border border-gray-200 rounded-xl p-5">
          <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-3">Proposed Project</h3>
          <div className="space-y-2 text-sm">
            <div>
              <p className="text-gray-500">Type</p>
              <p className="font-medium text-gray-900">{result.project_summary.type_label}</p>
            </div>
            <div className="grid grid-cols-2 gap-2">
              {result.project_summary.units && (
                <div>
                  <p className="text-gray-500">Units</p>
                  <p className="font-medium text-gray-900">{result.project_summary.units}</p>
                </div>
              )}
              {result.project_summary.stories && (
                <div>
                  <p className="text-gray-500">Stories</p>
                  <p className="font-medium text-gray-900">{result.project_summary.stories}</p>
                </div>
              )}
              {result.project_summary.sqft && (
                <div>
                  <p className="text-gray-500">Sq Ft</p>
                  <p className="font-medium text-gray-900">{result.project_summary.sqft.toLocaleString()}</p>
                </div>
              )}
              {result.project_summary.parking && (
                <div>
                  <p className="text-gray-500">Parking</p>
                  <p className="font-medium text-gray-900">{result.project_summary.parking}</p>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Section 4: Standards Comparison Table */}
      {result.standards.comparisons.length > 0 && (
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
                {result.standards.comparisons.map((s, i) => (
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

      {/* Section 5: Caveats & Confidence */}
      {(result.caveats.length > 0 || result.confidence.factors.length > 0) && (
        <div className="bg-white border border-gray-200 rounded-xl p-6">
          <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-3">Confidence & Caveats</h3>

          {/* Confidence factors */}
          <div className="mb-4">
            <div className="flex items-center gap-2 mb-2">
              <div className="flex-1 bg-gray-200 rounded-full h-2">
                <div
                  className={`h-2 rounded-full ${
                    result.confidence.level === 'high' ? 'bg-green-500' :
                    result.confidence.level === 'medium' ? 'bg-yellow-500' : 'bg-red-500'
                  }`}
                  style={{ width: `${Math.round(result.confidence.score * 100)}%` }}
                />
              </div>
              <span className="text-sm font-medium text-gray-700">
                {Math.round(result.confidence.score * 100)}%
              </span>
            </div>
            <div className="flex flex-wrap gap-2">
              {result.confidence.factors.map((f, i) => (
                <span
                  key={i}
                  className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs ${
                    f.present ? 'bg-green-50 text-green-700' : 'bg-gray-100 text-gray-500'
                  }`}
                >
                  {f.present ? (
                    <svg className="h-3 w-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                  ) : (
                    <svg className="h-3 w-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  )}
                  {f.name}
                </span>
              ))}
            </div>
          </div>

          {/* Caveats */}
          {result.caveats.length > 0 && (
            <div className="space-y-2 mt-4">
              {result.caveats.map((caveat, i) => (
                <div
                  key={i}
                  className={`flex items-start gap-2 text-sm rounded-lg px-3 py-2 ${
                    caveat.severity === 'critical' ? 'bg-red-50 text-red-800' :
                    caveat.severity === 'warning' ? 'bg-yellow-50 text-yellow-800' :
                    'bg-blue-50 text-blue-800'
                  }`}
                >
                  {caveat.severity === 'critical' ? (
                    <svg className="h-4 w-4 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z" />
                    </svg>
                  ) : (
                    <svg className="h-4 w-4 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                  )}
                  {caveat.text}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Section 6: Approval Roadmap */}
      {result.roadmap.length > 0 && (
        <RoadmapSteps steps={result.roadmap} />
      )}

      {/* Section 7: Sources */}
      {result.sources.length > 0 && (
        <div className="bg-white border border-gray-200 rounded-xl p-6">
          <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-3">Sources & Basis</h3>
          <ul className="space-y-2">
            {result.sources.map((source, i) => (
              <li key={i} className="flex items-center gap-2 text-sm">
                <svg className="h-4 w-4 text-gray-400 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
                </svg>
                {source.url ? (
                  <a href={source.url} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline">
                    {source.label}
                  </a>
                ) : (
                  <span className="text-gray-700">{source.label}</span>
                )}
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Section 8: Disclaimer */}
      <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
        <p className="text-xs text-gray-500 text-center">
          {result.disclaimer}
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
