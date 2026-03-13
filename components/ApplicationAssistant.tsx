'use client'

import { useState } from 'react'
import {
  ApplicationType,
  ApplicationFormData,
  StructuredAnalysisResult,
  ProjectInputs,
  PROJECT_TYPES,
} from '@/lib/types'
import DocumentUpload from './DocumentUpload'

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

interface ProjectDetails {
  building_height_ft: string
  building_footprint_sqft: string
  lot_coverage_pct: string
  parking_spaces: string
  building_materials: string
  construction_type: string
  utilities: string
  landscaping_notes: string
  timeline: string
  estimated_cost: string
}

export default function ApplicationAssistant({
  applicationType,
  analysisResult,
  projectInputs,
  recommendedZone,
  onBack,
}: ApplicationAssistantProps) {
  const [phase, setPhase] = useState<'choose' | 'upload' | 'details' | 'form' | 'generating' | 'review'>('choose')
  const [formData, setFormData] = useState<ApplicationFormData>({
    applicant_name: '',
    applicant_email: '',
    applicant_phone: '',
    property_owner_name: '',
    property_owner_is_applicant: true,
    additional_notes: '',
  })
  const [projectDetails, setProjectDetails] = useState<ProjectDetails>({
    building_height_ft: projectInputs.stories ? String(projectInputs.stories * 10) : '',
    building_footprint_sqft: '',
    lot_coverage_pct: '',
    parking_spaces: projectInputs.parking ? String(projectInputs.parking) : '',
    building_materials: '',
    construction_type: '',
    utilities: '',
    landscaping_notes: '',
    timeline: '',
    estimated_cost: '',
  })
  const [uploadedPlanData, setUploadedPlanData] = useState<{
    type?: string | null
    units?: number | null
    stories?: number | null
    sqft?: number | null
    parking?: number | null
    address?: string | null
  } | null>(null)
  const [generatedSections, setGeneratedSections] = useState<{ title: string; content: string }[]>([])
  const [checklist, setChecklist] = useState<string[]>([])
  const [checkedItems, setCheckedItems] = useState<Set<number>>(new Set())
  const [error, setError] = useState<string | null>(null)

  const colors = APPLICATION_COLORS[applicationType]
  const typeLabel = PROJECT_TYPES.find((t) => t.value === projectInputs.type)?.label || projectInputs.type

  // Build extra context string from project details or uploaded plan data
  const buildProjectContext = () => {
    const parts: string[] = []
    if (uploadedPlanData) {
      if (uploadedPlanData.sqft) parts.push(`Building area: ${uploadedPlanData.sqft.toLocaleString()} sq ft`)
      if (uploadedPlanData.stories) parts.push(`Stories: ${uploadedPlanData.stories}`)
      if (uploadedPlanData.units) parts.push(`Units: ${uploadedPlanData.units}`)
      if (uploadedPlanData.parking) parts.push(`Parking spaces: ${uploadedPlanData.parking}`)
      parts.push('(Details extracted from uploaded plans)')
    }
    if (projectDetails.building_height_ft) parts.push(`Building height: ${projectDetails.building_height_ft} ft`)
    if (projectDetails.building_footprint_sqft) parts.push(`Building footprint: ${projectDetails.building_footprint_sqft} sq ft`)
    if (projectDetails.lot_coverage_pct) parts.push(`Lot coverage: ${projectDetails.lot_coverage_pct}%`)
    if (projectDetails.parking_spaces) parts.push(`Parking spaces: ${projectDetails.parking_spaces}`)
    if (projectDetails.building_materials) parts.push(`Building materials: ${projectDetails.building_materials}`)
    if (projectDetails.construction_type) parts.push(`Construction type: ${projectDetails.construction_type}`)
    if (projectDetails.utilities) parts.push(`Utilities: ${projectDetails.utilities}`)
    if (projectDetails.landscaping_notes) parts.push(`Landscaping: ${projectDetails.landscaping_notes}`)
    if (projectDetails.timeline) parts.push(`Construction timeline: ${projectDetails.timeline}`)
    if (projectDetails.estimated_cost) parts.push(`Estimated project cost: ${projectDetails.estimated_cost}`)
    return parts.join('\n')
  }

  const handleDocumentParsed = (extracted: {
    type?: string | null
    units?: number | null
    stories?: number | null
    sqft?: number | null
    parking?: number | null
    address?: string | null
  }) => {
    setUploadedPlanData(extracted)
    // Pre-fill project details from extracted data
    if (extracted.stories) {
      setProjectDetails(prev => ({
        ...prev,
        building_height_ft: prev.building_height_ft || String(extracted.stories! * 10),
      }))
    }
    if (extracted.sqft) {
      setProjectDetails(prev => ({
        ...prev,
        building_footprint_sqft: prev.building_footprint_sqft || String(extracted.sqft),
      }))
    }
    if (extracted.parking) {
      setProjectDetails(prev => ({
        ...prev,
        parking_spaces: prev.parking_spaces || String(extracted.parking),
      }))
    }
    setPhase('form')
  }

  const handleGenerate = async () => {
    if (!formData.applicant_name || !formData.applicant_email) {
      setError('Please fill in your name and email.')
      return
    }

    setPhase('generating')
    setError(null)

    try {
      const projectContext = buildProjectContext()
      const notesWithContext = [
        formData.additional_notes,
        projectContext ? `\n--- Project Details ---\n${projectContext}` : '',
      ].filter(Boolean).join('\n')

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
          units: uploadedPlanData?.units || projectInputs.units || null,
          stories: uploadedPlanData?.stories || projectInputs.stories || null,
          sqft: uploadedPlanData?.sqft || projectInputs.sqft || null,
          applicant_info: {
            ...formData,
            additional_notes: notesWithContext,
          },
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

  // ── Header (reused across phases) ──
  const renderHeader = () => (
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
        {phase === 'choose'
          ? 'Upload your plans to auto-fill details, or enter the information manually.'
          : 'Fill in your details below and we\u0027ll generate a professional application narrative for your project.'}
      </p>
    </div>
  )

  // ── Choose phase (Upload or Manual) ──
  if (phase === 'choose') {
    return (
      <div className="space-y-6">
        {renderHeader()}

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

        {/* Two-path choice */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {/* Upload Plans */}
          <button
            onClick={() => setPhase('upload')}
            className="flex flex-col items-center gap-3 p-6 bg-white border-2 border-gray-200 rounded-xl
                       hover:border-blue-400 hover:bg-blue-50/50 transition-all text-center group"
          >
            <div className="w-14 h-14 rounded-full bg-blue-100 flex items-center justify-center group-hover:bg-blue-200 transition-colors">
              <svg className="h-7 w-7 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
              </svg>
            </div>
            <div>
              <p className="font-semibold text-gray-900">Upload Plans</p>
              <p className="text-sm text-gray-500 mt-1">
                Upload site plans, architectural drawings, or documents and we&apos;ll extract the details automatically
              </p>
            </div>
            <span className="text-xs text-gray-400">PDF, images, DWG, DXF, SVG</span>
          </button>

          {/* Enter Manually */}
          <button
            onClick={() => setPhase('details')}
            className="flex flex-col items-center gap-3 p-6 bg-white border-2 border-gray-200 rounded-xl
                       hover:border-blue-400 hover:bg-blue-50/50 transition-all text-center group"
          >
            <div className="w-14 h-14 rounded-full bg-gray-100 flex items-center justify-center group-hover:bg-blue-100 transition-colors">
              <svg className="h-7 w-7 text-gray-600 group-hover:text-blue-600 transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
              </svg>
            </div>
            <div>
              <p className="font-semibold text-gray-900">Enter Details Manually</p>
              <p className="text-sm text-gray-500 mt-1">
                Don&apos;t have plans yet? Enter your project details like dimensions, materials, and timeline
              </p>
            </div>
            <span className="text-xs text-gray-400">No documents required</span>
          </button>
        </div>

        {/* Skip to applicant info */}
        <button
          onClick={() => setPhase('form')}
          className="w-full text-sm text-gray-500 hover:text-gray-700 transition-colors py-2"
        >
          Skip — I just need the applicant form →
        </button>
      </div>
    )
  }

  // ── Upload phase ──
  if (phase === 'upload') {
    return (
      <div className="space-y-6">
        {renderHeader()}

        <div className="bg-white border border-gray-200 rounded-xl p-5">
          <h3 className="font-semibold text-gray-900 mb-1">Upload Your Plans</h3>
          <p className="text-sm text-gray-500 mb-4">
            Upload site plans, architectural drawings, or floor plans. We&apos;ll extract building details
            like dimensions, units, and square footage to include in your application.
          </p>
          <DocumentUpload
            onParsed={handleDocumentParsed}
            onCancel={() => setPhase('choose')}
          />
        </div>
      </div>
    )
  }

  // ── Manual Details phase ──
  if (phase === 'details') {
    return (
      <div className="space-y-6">
        {renderHeader()}

        {/* Extracted plan data summary */}
        {uploadedPlanData && (
          <div className="bg-green-50 border border-green-200 rounded-xl p-5">
            <div className="flex items-center gap-2 mb-2">
              <svg className="h-5 w-5 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <h3 className="font-semibold text-green-900">Plans Uploaded Successfully</h3>
            </div>
            <p className="text-sm text-green-800">
              Extracted details have been pre-filled below. Review and adjust as needed.
            </p>
          </div>
        )}

        <div className="bg-white border border-gray-200 rounded-xl p-5 space-y-4">
          <h3 className="font-semibold text-gray-900">Project Details</h3>
          <p className="text-sm text-gray-500">
            Provide as much detail as you can — this information will be used to generate a more accurate application narrative.
            All fields are optional.
          </p>

          <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
            <div>
              <label className="block text-sm text-gray-600 mb-1">Building Height (ft)</label>
              <input
                type="number"
                value={projectDetails.building_height_ft}
                onChange={(e) => setProjectDetails({ ...projectDetails, building_height_ft: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm text-gray-900
                           focus:border-blue-500 focus:ring-1 focus:ring-blue-200 focus:outline-none"
                placeholder="e.g. 35"
              />
            </div>
            <div>
              <label className="block text-sm text-gray-600 mb-1">Building Footprint (sq ft)</label>
              <input
                type="number"
                value={projectDetails.building_footprint_sqft}
                onChange={(e) => setProjectDetails({ ...projectDetails, building_footprint_sqft: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm text-gray-900
                           focus:border-blue-500 focus:ring-1 focus:ring-blue-200 focus:outline-none"
                placeholder="e.g. 2500"
              />
            </div>
            <div>
              <label className="block text-sm text-gray-600 mb-1">Lot Coverage (%)</label>
              <input
                type="number"
                value={projectDetails.lot_coverage_pct}
                onChange={(e) => setProjectDetails({ ...projectDetails, lot_coverage_pct: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm text-gray-900
                           focus:border-blue-500 focus:ring-1 focus:ring-blue-200 focus:outline-none"
                placeholder="e.g. 40"
              />
            </div>
            <div>
              <label className="block text-sm text-gray-600 mb-1">Parking Spaces</label>
              <input
                type="number"
                value={projectDetails.parking_spaces}
                onChange={(e) => setProjectDetails({ ...projectDetails, parking_spaces: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm text-gray-900
                           focus:border-blue-500 focus:ring-1 focus:ring-blue-200 focus:outline-none"
                placeholder="e.g. 4"
              />
            </div>
            <div>
              <label className="block text-sm text-gray-600 mb-1">Estimated Cost</label>
              <input
                type="text"
                value={projectDetails.estimated_cost}
                onChange={(e) => setProjectDetails({ ...projectDetails, estimated_cost: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm text-gray-900
                           focus:border-blue-500 focus:ring-1 focus:ring-blue-200 focus:outline-none"
                placeholder="e.g. $500,000"
              />
            </div>
            <div>
              <label className="block text-sm text-gray-600 mb-1">Construction Timeline</label>
              <input
                type="text"
                value={projectDetails.timeline}
                onChange={(e) => setProjectDetails({ ...projectDetails, timeline: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm text-gray-900
                           focus:border-blue-500 focus:ring-1 focus:ring-blue-200 focus:outline-none"
                placeholder="e.g. 12 months"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm text-gray-600 mb-1">Building Materials</label>
              <input
                type="text"
                value={projectDetails.building_materials}
                onChange={(e) => setProjectDetails({ ...projectDetails, building_materials: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm text-gray-900
                           focus:border-blue-500 focus:ring-1 focus:ring-blue-200 focus:outline-none"
                placeholder="e.g. Wood frame, brick exterior, asphalt shingles"
              />
            </div>
            <div>
              <label className="block text-sm text-gray-600 mb-1">Construction Type</label>
              <select
                value={projectDetails.construction_type}
                onChange={(e) => setProjectDetails({ ...projectDetails, construction_type: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm text-gray-900
                           focus:border-blue-500 focus:ring-1 focus:ring-blue-200 focus:outline-none"
              >
                <option value="">Select...</option>
                <option value="new_construction">New Construction</option>
                <option value="addition">Addition / Expansion</option>
                <option value="renovation">Renovation / Remodel</option>
                <option value="change_of_use">Change of Use</option>
                <option value="demolition_rebuild">Demolition & Rebuild</option>
              </select>
            </div>
          </div>

          <div>
            <label className="block text-sm text-gray-600 mb-1">Utilities & Infrastructure</label>
            <input
              type="text"
              value={projectDetails.utilities}
              onChange={(e) => setProjectDetails({ ...projectDetails, utilities: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm text-gray-900
                         focus:border-blue-500 focus:ring-1 focus:ring-blue-200 focus:outline-none"
              placeholder="e.g. City water, septic system, natural gas, underground electric"
            />
          </div>

          <div>
            <label className="block text-sm text-gray-600 mb-1">Landscaping & Site Notes</label>
            <textarea
              value={projectDetails.landscaping_notes}
              onChange={(e) => setProjectDetails({ ...projectDetails, landscaping_notes: e.target.value })}
              rows={2}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm text-gray-900
                         focus:border-blue-500 focus:ring-1 focus:ring-blue-200 focus:outline-none resize-none"
              placeholder="e.g. Gravel driveway, native plantings, retaining wall on south side"
            />
          </div>
        </div>

        {error && (
          <div className="bg-red-50 border border-red-200 rounded-lg px-4 py-3">
            <p className="text-sm text-red-800">{error}</p>
          </div>
        )}

        <div className="flex gap-3">
          <button
            onClick={() => setPhase('choose')}
            className="px-4 py-2.5 bg-white border border-gray-300 text-gray-700 font-medium
                       rounded-xl hover:bg-gray-50 transition-colors text-sm"
          >
            Back
          </button>
          <button
            onClick={() => setPhase('form')}
            className="flex-1 px-6 py-2.5 bg-blue-600 text-white font-medium rounded-xl
                       hover:bg-blue-700 transition-colors text-center"
          >
            Continue to Applicant Info →
          </button>
        </div>
      </div>
    )
  }

  // ── Form phase (applicant info) ──
  if (phase === 'form') {
    return (
      <div className="space-y-6">
        {renderHeader()}

        {/* Uploaded plan data indicator */}
        {uploadedPlanData && (
          <div className="bg-green-50 border border-green-200 rounded-lg px-4 py-3 flex items-center gap-2">
            <svg className="h-4 w-4 text-green-600 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <p className="text-sm text-green-800">
              Plan details extracted and will be included in your application
              {uploadedPlanData.sqft ? ` · ${uploadedPlanData.sqft.toLocaleString()} sq ft` : ''}
              {uploadedPlanData.stories ? ` · ${uploadedPlanData.stories} stories` : ''}
              {uploadedPlanData.parking ? ` · ${uploadedPlanData.parking} parking spaces` : ''}
            </p>
          </div>
        )}

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
            {(uploadedPlanData?.units || projectInputs.units) && (
              <div>
                <p className="text-gray-500">Units</p>
                <p className="font-medium text-gray-900">{uploadedPlanData?.units || projectInputs.units}</p>
              </div>
            )}
            {(uploadedPlanData?.sqft || projectInputs.sqft) && (
              <div>
                <p className="text-gray-500">Sq Ft</p>
                <p className="font-medium text-gray-900">{(uploadedPlanData?.sqft || projectInputs.sqft)?.toLocaleString()}</p>
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
        <div className="flex gap-3">
          <button
            onClick={() => setPhase(uploadedPlanData ? 'details' : 'choose')}
            className="px-4 py-2.5 bg-white border border-gray-300 text-gray-700 font-medium
                       rounded-xl hover:bg-gray-50 transition-colors text-sm"
          >
            Back
          </button>
          <button
            onClick={handleGenerate}
            className="flex-1 px-6 py-3 bg-blue-600 text-white font-medium rounded-xl
                       hover:bg-blue-700 transition-colors text-center"
          >
            Generate {APPLICATION_LABELS[applicationType]} Application
          </button>
        </div>
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
