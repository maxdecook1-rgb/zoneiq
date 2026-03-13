'use client'

import { useState } from 'react'
import {
  ApplicationType,
  ApplicationFormData,
  StructuredAnalysisResult,
  ProjectInputs,
  PROJECT_TYPES,
} from '@/lib/types'

interface ApplicationAssistantProps {
  applicationType: ApplicationType
  analysisResult: StructuredAnalysisResult
  projectInputs: ProjectInputs
  recommendedZone?: string
  onBack: () => void
}

const APPLICATION_LABELS: Record<ApplicationType, string> = {
  building_permit: 'Building Permit',
  conditional_use: 'Conditional Use Permit',
  rezoning: 'Rezoning',
}

const APPLICATION_COLORS: Record<ApplicationType, { bg: string; text: string; border: string }> = {
  building_permit: { bg: 'bg-green-50', text: 'text-green-700', border: 'border-green-200' },
  conditional_use: { bg: 'bg-amber-50', text: 'text-amber-700', border: 'border-amber-200' },
  rezoning: { bg: 'bg-blue-50', text: 'text-blue-700', border: 'border-blue-200' },
}

export default function ApplicationAssistant({
  applicationType,
  analysisResult,
  projectInputs,
  recommendedZone,
  onBack,
}: ApplicationAssistantProps) {
  const [phase, setPhase] = useState<'form' | 'generating' | 'review'>('form')
  const [formData, setFormData] = useState<ApplicationFormData>({
    applicant_name: '',
    applicant_email: '',
    applicant_phone: '',
    property_owner_name: '',
    property_owner_is_applicant: true,
    additional_notes: '',
  })
  const [generatedSections, setGeneratedSections] = useState<{ title: string; content: string }[]>([])
  const [checklist, setChecklist] = useState<string[]>([])
  const [checkedItems, setCheckedItems] = useState<Set<number>>(new Set())
  const [error, setError] = useState<string | null>(null)

  const colors = APPLICATION_COLORS[applicationType]
  const typeLabel = PROJECT_TYPES.find((t) => t.value === projectInputs.type)?.label || projectInputs.type

  const handleGenerate = async () => {
    if (!formData.applicant_name || !formData.applicant_email) {
      setError('Please fill in your name and email.')
      return
    }

    setPhase('generating')
    setError(null)

    try {
      const res = await fetch('/api/generate-application', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          application_type: applicationType,
          address: analysisResult.parcel_summary.address,
          zone_code: analysisResult.parcel_summary.zone_code,
          zone_name: analysisResult.parcel_summary.zone_name,
          requested_zone: recommendedZone || undefined,
          jurisdiction: analysisResult.parcel_summary.jurisdiction_name,
          project_type: projectInputs.type,
          project_type_label: typeLabel,
          units: projectInputs.units || null,
          stories: projectInputs.stories || null,
          sqft: projectInputs.sqft || null,
          applicant_info: formData,
        }),
      })

      const data = await res.json()

      if (!res.ok) {
        throw new Error(data.error || 'Failed to generate application')
      }

      setGeneratedSections(data.sections || [])
      setChecklist(data.checklist || [])
      setPhase('review')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong')
      setPhase('form')
    }
  }

  const handleCopyAll = () => {
    const text = generatedSections
      .map((s) => `${s.title}\n${'='.repeat(s.title.length)}\n\n${s.content}`)
      .join('\n\n---\n\n')
    const checklistText = checklist.length > 0
      ? `\n\n---\n\nRequired Documents Checklist\n${'='.repeat(28)}\n\n${checklist.map((item, i) => `${i + 1}. ${item}`).join('\n')}`
      : ''

    navigator.clipboard.writeText(text + checklistText)
  }

  const handlePrint = () => {
    window.print()
  }

  const toggleChecked = (index: number) => {
    setCheckedItems((prev) => {
      const next = new Set(prev)
      if (next.has(index)) {
        next.delete(index)
      } else {
        next.add(index)
      }
      return next
    })
  }

  // ── Form phase ──
  if (phase === 'form') {
    return (
      <div className="space-y-6">
        {/* Header */}
        <div className={`${colors.bg} ${colors.border} border rounded-xl p-5`}>
          <div className="flex items-center gap-3 mb-2">
            <span className={`text-xs px-2.5 py-1 rounded-full font-medium ${colors.bg} ${colors.text} border ${colors.border}`}>
              {APPLICATION_LABELS[applicationType]} Application
            </span>
          </div>
          <h2 className="text-xl font-bold text-gray-900">
            {applicationType === 'rezoning'
              ? `Rezoning Application: ${analysisResult.parcel_summary.zone_code} → ${recommendedZone}`
              : `${APPLICATION_LABELS[applicationType]} Application`}
          </h2>
          <p className="text-sm text-gray-600 mt-1">
            Fill in your details below and we&apos;ll generate a professional application narrative for your project.
          </p>
        </div>

        {/* Project summary (read-only) */}
        <div className="bg-gray-50 border border-gray-200 rounded-xl p-5">
          <h3 className="text-sm font-medium text-gray-500 mb-3">Project Summary</h3>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 text-sm">
            <div>
              <p className="text-gray-500">Address</p>
              <p className="font-medium text-gray-900">{analysisResult.parcel_summary.address}</p>
            </div>
            <div>
              <p className="text-gray-500">Zone</p>
              <p className="font-medium text-gray-900">
                {analysisResult.parcel_summary.zone_code}
                {analysisResult.parcel_summary.zone_name ? ` — ${analysisResult.parcel_summary.zone_name}` : ''}
              </p>
            </div>
            <div>
              <p className="text-gray-500">Jurisdiction</p>
              <p className="font-medium text-gray-900">{analysisResult.parcel_summary.jurisdiction_name}</p>
            </div>
            <div>
              <p className="text-gray-500">Project Type</p>
              <p className="font-medium text-gray-900">{typeLabel}</p>
            </div>
            {projectInputs.units && (
              <div>
                <p className="text-gray-500">Units</p>
                <p className="font-medium text-gray-900">{projectInputs.units}</p>
              </div>
            )}
            {projectInputs.sqft && (
              <div>
                <p className="text-gray-500">Sq Ft</p>
                <p className="font-medium text-gray-900">{projectInputs.sqft.toLocaleString()}</p>
              </div>
            )}
          </div>
        </div>

        {/* Applicant form */}
        <div className="bg-white border border-gray-200 rounded-xl p-5 space-y-4">
          <h3 className="font-semibold text-gray-900">Applicant Information</h3>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm text-gray-600 mb-1">Full Name *</label>
              <input
                type="text"
                value={formData.applicant_name}
                onChange={(e) => setFormData({ ...formData, applicant_name: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm text-gray-900
                           focus:border-blue-500 focus:ring-1 focus:ring-blue-200 focus:outline-none"
                placeholder="John Smith"
              />
            </div>
            <div>
              <label className="block text-sm text-gray-600 mb-1">Email *</label>
              <input
                type="email"
                value={formData.applicant_email}
                onChange={(e) => setFormData({ ...formData, applicant_email: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm text-gray-900
                           focus:border-blue-500 focus:ring-1 focus:ring-blue-200 focus:outline-none"
                placeholder="john@example.com"
              />
            </div>
            <div>
              <label className="block text-sm text-gray-600 mb-1">Phone</label>
              <input
                type="tel"
                value={formData.applicant_phone}
                onChange={(e) => setFormData({ ...formData, applicant_phone: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm text-gray-900
                           focus:border-blue-500 focus:ring-1 focus:ring-blue-200 focus:outline-none"
                placeholder="(555) 123-4567"
              />
            </div>
          </div>

          {/* Property owner */}
          <div className="pt-2">
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={formData.property_owner_is_applicant}
                onChange={(e) =>
                  setFormData({ ...formData, property_owner_is_applicant: e.target.checked })
                }
                className="rounded border-gray-300 text-blue-600 focus:ring-blue-200"
              />
              <span className="text-sm text-gray-700">I am the property owner</span>
            </label>

            {!formData.property_owner_is_applicant && (
              <div className="mt-3">
                <label className="block text-sm text-gray-600 mb-1">Property Owner Name</label>
                <input
                  type="text"
                  value={formData.property_owner_name}
                  onChange={(e) =>
                    setFormData({ ...formData, property_owner_name: e.target.value })
                  }
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm text-gray-900
                             focus:border-blue-500 focus:ring-1 focus:ring-blue-200 focus:outline-none"
                  placeholder="Property owner's name"
                />
              </div>
            )}
          </div>

          {/* Additional notes */}
          <div>
            <label className="block text-sm text-gray-600 mb-1">Additional Notes (optional)</label>
            <textarea
              value={formData.additional_notes}
              onChange={(e) => setFormData({ ...formData, additional_notes: e.target.value })}
              rows={3}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm text-gray-900
                         focus:border-blue-500 focus:ring-1 focus:ring-blue-200 focus:outline-none resize-none"
              placeholder="Any additional context about your project..."
            />
          </div>
        </div>

        {error && (
          <div className="bg-red-50 border border-red-200 rounded-lg px-4 py-3">
            <p className="text-sm text-red-800">{error}</p>
          </div>
        )}

        {/* Submit */}
        <button
          onClick={handleGenerate}
          className="w-full px-6 py-3 bg-blue-600 text-white font-medium rounded-xl
                     hover:bg-blue-700 transition-colors text-center"
        >
          Generate {APPLICATION_LABELS[applicationType]} Application
        </button>
      </div>
    )
  }

  // ── Generating phase ──
  if (phase === 'generating') {
    return (
      <div className="flex flex-col items-center justify-center py-20 space-y-4">
        <div className="w-12 h-12 border-4 border-blue-200 border-t-blue-600 rounded-full animate-spin" />
        <p className="text-gray-600 font-medium">
          Generating your {APPLICATION_LABELS[applicationType].toLowerCase()} application...
        </p>
        <p className="text-sm text-gray-400">This may take 10-20 seconds</p>
      </div>
    )
  }

  // ── Review phase ──
  return (
    <div className="space-y-6 print:space-y-4">
      {/* Header */}
      <div className={`${colors.bg} ${colors.border} border rounded-xl p-5 print:border-black`}>
        <div className="flex items-center justify-between">
          <div>
            <span className={`text-xs px-2.5 py-1 rounded-full font-medium ${colors.text} border ${colors.border}`}>
              {APPLICATION_LABELS[applicationType]} Application
            </span>
            <h2 className="text-xl font-bold text-gray-900 mt-2">
              {analysisResult.parcel_summary.address}
            </h2>
            <p className="text-sm text-gray-600 mt-0.5">
              {analysisResult.parcel_summary.jurisdiction_name} · {typeLabel}
              {applicationType === 'rezoning' && recommendedZone
                ? ` · Rezone to ${recommendedZone}`
                : ` · Zone ${analysisResult.parcel_summary.zone_code}`}
            </p>
          </div>
        </div>
      </div>

      {/* Generated sections */}
      {generatedSections.map((section, i) => (
        <div key={i} className="bg-white border border-gray-200 rounded-xl p-5 print:break-inside-avoid">
          <h3 className="font-semibold text-gray-900 mb-3">{section.title}</h3>
          <div className="text-sm text-gray-700 leading-relaxed whitespace-pre-wrap">
            {section.content}
          </div>
        </div>
      ))}

      {/* Checklist */}
      {checklist.length > 0 && (
        <div className="bg-white border border-gray-200 rounded-xl p-5 print:break-inside-avoid">
          <h3 className="font-semibold text-gray-900 mb-3">Required Documents Checklist</h3>
          <ul className="space-y-2">
            {checklist.map((item, i) => (
              <li key={i} className="flex items-start gap-2">
                <input
                  type="checkbox"
                  checked={checkedItems.has(i)}
                  onChange={() => toggleChecked(i)}
                  className="mt-0.5 rounded border-gray-300 text-blue-600 focus:ring-blue-200 print:hidden"
                />
                <span className={`text-sm ${checkedItems.has(i) ? 'text-gray-400 line-through' : 'text-gray-700'}`}>
                  {item}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Disclaimer */}
      <div className="bg-gray-50 border border-gray-200 rounded-lg px-4 py-3">
        <p className="text-xs text-gray-500">
          This application content was generated as a starting point and should be reviewed
          and customized before submission. Contact your local planning department for specific
          requirements and forms. This does not constitute legal advice.
        </p>
      </div>

      {/* Actions */}
      <div className="flex gap-3 print:hidden">
        <button
          onClick={handleCopyAll}
          className="flex-1 px-4 py-2.5 bg-white border border-gray-300 text-gray-700 font-medium
                     rounded-xl hover:bg-gray-50 transition-colors text-sm text-center"
        >
          Copy All
        </button>
        <button
          onClick={handlePrint}
          className="flex-1 px-4 py-2.5 bg-white border border-gray-300 text-gray-700 font-medium
                     rounded-xl hover:bg-gray-50 transition-colors text-sm text-center"
        >
          Print
        </button>
        <button
          onClick={onBack}
          className="flex-1 px-4 py-2.5 bg-white border border-gray-300 text-gray-700 font-medium
                     rounded-xl hover:bg-gray-50 transition-colors text-sm text-center"
        >
          Back to Results
        </button>
      </div>
    </div>
  )
}
