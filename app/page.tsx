'use client'

import { useState } from 'react'
import { useAuth } from '@/lib/auth-context'
import AddressSearch from '@/components/AddressSearch'
import ProjectForm from '@/components/ProjectForm'
import FeasibilityResult from '@/components/FeasibilityResult'
import MapView from '@/components/MapView'
import LoadingSteps from '@/components/LoadingSteps'
import { ProjectInputs, FeasibilityResult as FeasibilityResultType, ZoningDistrict, Jurisdiction } from '@/lib/types'

type Step = 'search' | 'form' | 'loading' | 'result'

interface ParcelData {
  address: string
  lat: number
  lng: number
  id?: string | null
  jurisdiction_id?: string | null
  zone_id?: string | null
  acreage?: number | null
}

interface ZoningLookupData {
  zone_code: string
  zone_name: string
  jurisdiction: string
  state: string
  permitted_uses: string[]
  conditional_uses: string[]
  setbacks: { front_ft: number; side_ft: number; rear_ft: number }
  max_height_ft: number
  max_stories: number
  max_lot_coverage_pct: number
  min_lot_size_sqft: number
  parking_requirements: string
  density_limit: string
  confidence: number
}

interface CompatibilityData {
  compatible: boolean
  issues: string[]
  required_zone: string | null
  required_zone_name: string | null
  steps_to_comply: string[]
  rezoning_required: boolean
  rezoning_difficulty: string
  estimated_timeline_days: number
  summary: string
}

export default function HomePage() {
  const { user, session } = useAuth()
  const [step, setStep] = useState<Step>('search')
  const [address, setAddress] = useState('')
  const [parcelData, setParcelData] = useState<ParcelData | null>(null)
  const [zone, setZone] = useState<ZoningDistrict | null>(null)
  const [jurisdiction, setJurisdiction] = useState<Jurisdiction | null>(null)
  const [result, setResult] = useState<FeasibilityResultType | null>(null)
  const [projectInputs, setProjectInputs] = useState<ProjectInputs | null>(null)
  const [warning, setWarning] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [zoningLookup, setZoningLookup] = useState<ZoningLookupData | null>(null)
  const [compatibility, setCompatibility] = useState<CompatibilityData | null>(null)
  const [uploadedClassification, setUploadedClassification] = useState<Record<string, unknown> | null>(null)
  const [generatingSitePlan, setGeneratingSitePlan] = useState(false)
  const [generatingFloorPlan, setGeneratingFloorPlan] = useState(false)
  const [generatingRezoning, setGeneratingRezoning] = useState(false)
  const [sitePlanData, setSitePlanData] = useState<Record<string, unknown> | null>(null)
  const [floorPlanData, setFloorPlanData] = useState<Record<string, unknown> | null>(null)
  const [rezoningData, setRezoningData] = useState<Record<string, unknown> | null>(null)

  const handleAddressSelect = async (selectedAddress: string, lat: number, lng: number) => {
    setAddress(selectedAddress)
    setError(null)
    setWarning(null)
    setZoningLookup(null)

    try {
      // Fetch parcel data
      const parcelRes = await fetch(`/api/parcel?address=${encodeURIComponent(selectedAddress)}`)

      if (parcelRes.ok) {
        const data = await parcelRes.json()
        setParcelData({
          address: selectedAddress,
          lat: data.parcel?.lat || lat,
          lng: data.parcel?.lng || lng,
          id: data.parcel?.id,
          jurisdiction_id: data.jurisdiction?.id,
          zone_id: data.zone?.id,
          acreage: data.parcel?.acreage,
        })
        setZone(data.zone)
        setJurisdiction(data.jurisdiction)
        if (data.warning) setWarning(data.warning)
      } else {
        setParcelData({ address: selectedAddress, lat, lng })
      }

      // Also do AI zoning lookup
      try {
        const zoningRes = await fetch(`/api/zoning-lookup?address=${encodeURIComponent(selectedAddress)}`)
        if (zoningRes.ok) {
          const zData = await zoningRes.json()
          setZoningLookup(zData.zoning)
        }
      } catch {
        // Non-critical - continue without AI lookup
      }

      setStep('form')
    } catch {
      setParcelData({ address: selectedAddress, lat, lng })
      setWarning('Could not connect to parcel service. Results will be limited.')
      setStep('form')
    }
  }

  const handleFormSubmit = async (inputs: ProjectInputs) => {
    setProjectInputs(inputs)
    setStep('loading')
    setError(null)

    try {
      // Run compatibility check with enhanced AI
      const compatRes = await fetch('/api/compatibility-check', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          address,
          building_info: {
            ...inputs,
            ...(uploadedClassification || {}),
          },
          zoning_override: zoningLookup || undefined,
        }),
      })

      let compatData = null
      if (compatRes.ok) {
        compatData = await compatRes.json()
        setCompatibility(compatData.compatibility)
      }

      // Also run the standard feasibility check
      const res = await fetch('/api/feasibility', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          address,
          parcel_id: parcelData?.id || undefined,
          project_inputs: inputs,
        }),
      })

      const data = await res.json()

      if (!res.ok) {
        throw new Error(data.error || 'Feasibility check failed')
      }

      // Merge compatibility data into result
      const enhancedResult: FeasibilityResultType = {
        status: data.status,
        confidence: data.confidence,
        permitted_use_status: data.permitted_use_status,
        standards_comparison: data.standards_comparison,
        roadmap_steps: data.roadmap_steps,
        summary: data.summary,
      }

      if (compatData?.compatibility) {
        enhancedResult.zoning_recommendation = {
          current_zone: zoningLookup?.zone_code || zone?.code || 'Unknown',
          recommended_zone: compatData.compatibility.required_zone || zoningLookup?.zone_code || '',
          reason: compatData.compatibility.summary || '',
          compliance_issues: compatData.compatibility.issues || [],
          steps_to_comply: compatData.compatibility.steps_to_comply || [],
        }
      }

      setResult(enhancedResult)
      if (data.zone) setZone(data.zone)
      if (data.jurisdiction) setJurisdiction(data.jurisdiction)
      setStep('result')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong')
      setStep('form')
    }
  }

  const handleGenerateSitePlan = async () => {
    setGeneratingSitePlan(true)
    try {
      const res = await fetch('/api/generate-site-plan', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          address,
          lot_info: {
            width_ft: 100,
            depth_ft: 150,
            acreage: parcelData?.acreage || 0.34,
          },
          building_info: {
            type: projectInputs?.type,
            sqft: projectInputs?.sqft || 2000,
            stories: projectInputs?.stories || 1,
            units: projectInputs?.units || 1,
          },
          zoning_info: zoningLookup,
          tier: 'basic',
        }),
      })
      if (res.ok) {
        const data = await res.json()
        setSitePlanData(data.site_plan)
      }
    } catch (err) {
      console.error('Site plan error:', err)
    } finally {
      setGeneratingSitePlan(false)
    }
  }

  const handleGenerateFloorPlan = async () => {
    setGeneratingFloorPlan(true)
    try {
      const desc = projectInputs?.description ||
        `${projectInputs?.type?.replace('_', ' ')} with ${projectInputs?.units || 1} unit(s), ${projectInputs?.stories || 1} stories, approximately ${projectInputs?.sqft || 1500} square feet`

      const res = await fetch('/api/generate-floor-plan', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          description: desc,
          constraints: {
            max_sqft: projectInputs?.sqft,
            stories: projectInputs?.stories,
            type: projectInputs?.type,
          },
        }),
      })
      if (res.ok) {
        const data = await res.json()
        setFloorPlanData(data.floor_plan)
      }
    } catch (err) {
      console.error('Floor plan error:', err)
    } finally {
      setGeneratingFloorPlan(false)
    }
  }

  const handleGenerateRezoning = async () => {
    setGeneratingRezoning(true)
    try {
      const res = await fetch('/api/generate-rezoning-app', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          address,
          current_zone: zoningLookup?.zone_code || zone?.code || 'Unknown',
          requested_zone: compatibility?.required_zone || result?.required_zone_code || '',
          project_description: projectInputs?.description || `${projectInputs?.type} development`,
          jurisdiction: zoningLookup?.jurisdiction || jurisdiction?.name || '',
          building_info: projectInputs,
        }),
      })
      if (res.ok) {
        const data = await res.json()
        setRezoningData(data.application)
      }
    } catch (err) {
      console.error('Rezoning app error:', err)
    } finally {
      setGeneratingRezoning(false)
    }
  }

  const handleSave = async () => {
    setSaving(true)
    try {
      if (!session) {
        setError('Please sign in to save projects.')
        setSaving(false)
        return
      }

      const res = await fetch('/api/projects', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          address,
          parcel_id: parcelData?.id || null,
          jurisdiction_id: jurisdiction?.id || null,
          project_inputs: projectInputs,
          result,
        }),
      })

      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error || 'Failed to save')
      }

      alert('Project saved successfully!')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save')
    } finally {
      setSaving(false)
    }
  }

  const handleExport = async () => {
    try {
      const res = await fetch('/api/export/pdf', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          result,
          address,
          zone,
          jurisdiction,
          project_inputs: projectInputs,
        }),
      })

      if (!res.ok) throw new Error('PDF generation failed')

      const blob = await res.blob()
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `ZoneIQ-Report-${Date.now()}.pdf`
      a.click()
      URL.revokeObjectURL(url)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Export failed')
    }
  }

  const handleReset = () => {
    setStep('search')
    setAddress('')
    setParcelData(null)
    setZone(null)
    setJurisdiction(null)
    setResult(null)
    setProjectInputs(null)
    setWarning(null)
    setError(null)
    setZoningLookup(null)
    setCompatibility(null)
    setUploadedClassification(null)
    setSitePlanData(null)
    setFloorPlanData(null)
    setRezoningData(null)
  }

  return (
    <div className="min-h-screen">
      {/* Nav */}
      <nav className="fixed top-0 w-full bg-white/80 backdrop-blur-md border-b border-gray-200 z-40">
        <div className="max-w-6xl mx-auto px-4 h-14 flex items-center justify-between">
          <button onClick={handleReset} className="font-bold text-xl text-blue-600 tracking-tight">
            ZoneIQ
          </button>
          <div className="flex items-center gap-4">
            <a href="/dashboard" className="text-sm text-gray-600 hover:text-gray-900 transition-colors">
              Dashboard
            </a>
            {user ? (
              <span className="text-xs text-gray-400">{user.email}</span>
            ) : (
              <a href="/dashboard" className="text-sm text-blue-600 hover:text-blue-700 font-medium">
                Sign In
              </a>
            )}
          </div>
        </div>
      </nav>

      {/* Loading Overlay */}
      {step === 'loading' && <LoadingSteps />}

      {/* Main Content */}
      <main className="pt-14">
        {/* Search Step */}
        {step === 'search' && (
          <div className="min-h-[calc(100vh-56px)] flex flex-col items-center justify-center px-4">
            <div className="text-center mb-8">
              <h1 className="text-4xl sm:text-5xl font-bold text-gray-900 mb-3 tracking-tight">
                What can you build?
              </h1>
              <p className="text-gray-500 text-lg">Find out in under 10 seconds</p>
            </div>
            <AddressSearch onAddressSelect={handleAddressSelect} />
            <p className="mt-4 text-xs text-gray-400">Enter any US property address to check zoning</p>
          </div>
        )}

        {/* Form Step */}
        {step === 'form' && (
          <div className="max-w-4xl mx-auto px-4 py-8">
            <button
              onClick={handleReset}
              className="text-sm text-gray-500 hover:text-gray-700 mb-6 flex items-center gap-1"
            >
              <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
              New search
            </button>

            {parcelData && (
              <div className="mb-6">
                <MapView lat={parcelData.lat} lng={parcelData.lng} />
              </div>
            )}

            {/* Zoning Info Panel */}
            {zoningLookup && (
              <div className="mb-6 bg-white border border-gray-200 rounded-xl p-5 space-y-3">
                <div className="flex items-center justify-between">
                  <h3 className="font-semibold text-gray-900">Zoning Information</h3>
                  <span className="text-xs px-2 py-1 bg-blue-100 text-blue-700 rounded-full">
                    {Math.round(zoningLookup.confidence * 100)}% confidence
                  </span>
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 text-sm">
                  <div>
                    <p className="text-gray-500">Zone</p>
                    <p className="font-medium text-gray-900">{zoningLookup.zone_code} — {zoningLookup.zone_name}</p>
                  </div>
                  <div>
                    <p className="text-gray-500">Jurisdiction</p>
                    <p className="font-medium text-gray-900">{zoningLookup.jurisdiction}, {zoningLookup.state}</p>
                  </div>
                  <div>
                    <p className="text-gray-500">Max Height</p>
                    <p className="font-medium text-gray-900">{zoningLookup.max_height_ft} ft / {zoningLookup.max_stories} stories</p>
                  </div>
                  <div>
                    <p className="text-gray-500">Setbacks</p>
                    <p className="font-medium text-gray-900">
                      F:{zoningLookup.setbacks.front_ft}&apos; S:{zoningLookup.setbacks.side_ft}&apos; R:{zoningLookup.setbacks.rear_ft}&apos;
                    </p>
                  </div>
                  <div>
                    <p className="text-gray-500">Lot Coverage</p>
                    <p className="font-medium text-gray-900">{zoningLookup.max_lot_coverage_pct}% max</p>
                  </div>
                  <div>
                    <p className="text-gray-500">Min Lot Size</p>
                    <p className="font-medium text-gray-900">{zoningLookup.min_lot_size_sqft?.toLocaleString()} sq ft</p>
                  </div>
                </div>
                <div className="text-xs text-gray-400 flex items-center gap-1">
                  <svg className="h-3 w-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  AI-generated data — verify with local planning department
                </div>
              </div>
            )}

            {warning && (
              <div className="mb-6 bg-yellow-50 border border-yellow-200 rounded-lg px-4 py-3">
                <p className="text-sm text-yellow-800">{warning}</p>
              </div>
            )}

            {error && (
              <div className="mb-6 bg-red-50 border border-red-200 rounded-lg px-4 py-3">
                <p className="text-sm text-red-800">{error}</p>
              </div>
            )}

            {zone && !zoningLookup && (
              <div className="mb-6 bg-gray-50 border border-gray-200 rounded-lg px-4 py-3">
                <p className="text-sm text-gray-600">
                  Zone: <strong className="text-gray-900">{zone.code}</strong> ({zone.name})
                  {jurisdiction && <> &mdash; {jurisdiction.name}, {jurisdiction.state}</>}
                </p>
              </div>
            )}

            <ProjectForm address={address} onSubmit={handleFormSubmit} />
          </div>
        )}

        {/* Result Step */}
        {step === 'result' && result && (
          <div className="max-w-4xl mx-auto px-4 py-8">
            <button
              onClick={handleReset}
              className="text-sm text-gray-500 hover:text-gray-700 mb-6 flex items-center gap-1"
            >
              <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
              New search
            </button>

            {parcelData && (
              <div className="mb-6">
                <MapView lat={parcelData.lat} lng={parcelData.lng} />
              </div>
            )}

            {error && (
              <div className="mb-6 bg-red-50 border border-red-200 rounded-lg px-4 py-3">
                <p className="text-sm text-red-800">{error}</p>
              </div>
            )}

            {/* Compatibility Alert */}
            {compatibility && !compatibility.compatible && (
              <div className="mb-6 bg-orange-50 border border-orange-200 rounded-xl p-5">
                <h3 className="font-semibold text-orange-800 mb-2">Zoning Compatibility Issues</h3>
                <p className="text-sm text-orange-700 mb-3">{compatibility.summary}</p>
                {compatibility.issues.length > 0 && (
                  <ul className="text-sm text-orange-700 space-y-1 mb-3">
                    {compatibility.issues.map((issue, i) => (
                      <li key={i} className="flex items-start gap-2">
                        <span className="text-orange-400 mt-0.5">•</span>
                        {issue}
                      </li>
                    ))}
                  </ul>
                )}
                {compatibility.required_zone && (
                  <p className="text-sm font-medium text-orange-800">
                    Recommended Zone: {compatibility.required_zone} ({compatibility.required_zone_name})
                  </p>
                )}
                {compatibility.rezoning_required && (
                  <p className="text-xs text-orange-600 mt-1">
                    Estimated timeline: ~{compatibility.estimated_timeline_days} days • Difficulty: {compatibility.rezoning_difficulty}
                  </p>
                )}
              </div>
            )}

            <FeasibilityResult
              result={result}
              zone={zone}
              jurisdiction={jurisdiction}
              onSave={handleSave}
              onExport={handleExport}
              saving={saving}
            />

            {/* Phase 2 Action Buttons */}
            <div className="mt-8 space-y-4">
              <h3 className="text-lg font-semibold text-gray-900">Generate Documents</h3>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                {/* Site Plan */}
                <button
                  onClick={handleGenerateSitePlan}
                  disabled={generatingSitePlan}
                  className="p-4 bg-white border-2 border-gray-200 rounded-xl hover:border-blue-400 transition-all text-left disabled:opacity-50"
                >
                  <div className="flex items-center gap-3 mb-2">
                    <svg className="h-6 w-6 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7" />
                    </svg>
                    <span className="font-medium text-gray-900">
                      {generatingSitePlan ? 'Generating...' : 'Site Plan'}
                    </span>
                  </div>
                  <p className="text-xs text-gray-500">Building placement, setbacks, parking layout</p>
                </button>

                {/* Floor Plan */}
                <button
                  onClick={handleGenerateFloorPlan}
                  disabled={generatingFloorPlan}
                  className="p-4 bg-white border-2 border-gray-200 rounded-xl hover:border-blue-400 transition-all text-left disabled:opacity-50"
                >
                  <div className="flex items-center gap-3 mb-2">
                    <svg className="h-6 w-6 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 5a1 1 0 011-1h14a1 1 0 011 1v2a1 1 0 01-1 1H5a1 1 0 01-1-1V5zM4 13a1 1 0 011-1h6a1 1 0 011 1v6a1 1 0 01-1 1H5a1 1 0 01-1-1v-6zM16 13a1 1 0 011-1h2a1 1 0 011 1v6a1 1 0 01-1 1h-2a1 1 0 01-1-1v-6z" />
                    </svg>
                    <span className="font-medium text-gray-900">
                      {generatingFloorPlan ? 'Generating...' : 'Floor Plan'}
                    </span>
                  </div>
                  <p className="text-xs text-gray-500">Room layout with dimensions and labels</p>
                </button>

                {/* Rezoning App */}
                {(result.status === 'not_permitted' || result.status === 'conditional') && (
                  <button
                    onClick={handleGenerateRezoning}
                    disabled={generatingRezoning}
                    className="p-4 bg-white border-2 border-gray-200 rounded-xl hover:border-blue-400 transition-all text-left disabled:opacity-50"
                  >
                    <div className="flex items-center gap-3 mb-2">
                      <svg className="h-6 w-6 text-orange-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                      </svg>
                      <span className="font-medium text-gray-900">
                        {generatingRezoning ? 'Generating...' : 'Rezoning Application'}
                      </span>
                    </div>
                    <p className="text-xs text-gray-500">Auto-filled application with justification</p>
                  </button>
                )}
              </div>
            </div>

            {/* Site Plan Results */}
            {sitePlanData && (
              <div className="mt-6 bg-white border border-gray-200 rounded-xl p-6">
                <h3 className="font-semibold text-gray-900 mb-4">Generated Site Plan</h3>
                <div className="text-sm text-gray-600">
                  <p className="mb-2">Site plan generated successfully. Building placement optimized for setback compliance.</p>
                  {Array.isArray((sitePlanData as Record<string, unknown>).notes) && (
                    <ul className="space-y-1">
                      {((sitePlanData as Record<string, unknown>).notes as string[]).map((note: string, i: number) => (
                        <li key={i}>• {note}</li>
                      ))}
                    </ul>
                  )}
                </div>
              </div>
            )}

            {/* Floor Plan Results */}
            {floorPlanData && (
              <div className="mt-6 bg-white border border-gray-200 rounded-xl p-6">
                <h3 className="font-semibold text-gray-900 mb-4">Generated Floor Plan</h3>
                <p className="text-sm text-gray-600">
                  {(floorPlanData as Record<string, unknown>).description as string || 'Floor plan generated successfully.'}
                </p>
                <p className="text-sm text-gray-500 mt-1">
                  {(floorPlanData as Record<string, unknown>).total_sqft as number || 0} sq ft • {(floorPlanData as Record<string, unknown>).stories as number || 1} story
                </p>
              </div>
            )}

            {/* Rezoning Application Results */}
            {rezoningData && (
              <div className="mt-6 bg-white border border-gray-200 rounded-xl p-6 space-y-4">
                <h3 className="font-semibold text-gray-900">Rezoning Application Draft</h3>
                <p className="text-xs text-gray-400">Review and edit before submitting to your local planning department</p>

                {Object.entries(rezoningData).map(([key, value]) => (
                  <div key={key} className="border-t border-gray-100 pt-3">
                    <h4 className="text-sm font-medium text-gray-700 mb-1 capitalize">
                      {key.replace(/_/g, ' ')}
                    </h4>
                    <textarea
                      defaultValue={String(value)}
                      className="w-full text-sm text-gray-600 border border-gray-200 rounded-lg p-3 min-h-[100px] focus:ring-2 focus:ring-blue-200 focus:border-blue-500 focus:outline-none"
                    />
                  </div>
                ))}

                <div className="flex gap-3">
                  <button
                    onClick={handleExport}
                    className="px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 transition-colors"
                  >
                    Export as PDF
                  </button>
                  <button
                    onClick={() => window.print()}
                    className="px-4 py-2 bg-white border border-gray-300 text-gray-700 text-sm font-medium rounded-lg hover:bg-gray-50 transition-colors"
                  >
                    Print
                  </button>
                </div>
              </div>
            )}

            {/* Disclaimer */}
            <div className="mt-6 bg-gray-50 border border-gray-200 rounded-lg p-4">
              <p className="text-xs text-gray-500 text-center">
                AI-generated results are informational only. All zoning data, site plans, floor plans, and applications
                should be verified by a licensed professional before submission. ZoneIQ does not replace professional
                architectural, engineering, or legal advice.
              </p>
            </div>
          </div>
        )}
      </main>
    </div>
  )
}
