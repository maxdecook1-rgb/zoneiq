'use client'

import { useState } from 'react'
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

export default function HomePage() {
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

  const handleAddressSelect = async (selectedAddress: string, lat: number, lng: number) => {
    setAddress(selectedAddress)
    setError(null)
    setWarning(null)

    try {
      const res = await fetch(`/api/parcel?address=${encodeURIComponent(selectedAddress)}`)
      const data = await res.json()

      if (!res.ok) {
        setParcelData({ address: selectedAddress, lat, lng })
        setWarning('Could not find parcel data. Results will be limited.')
        setStep('form')
        return
      }

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

      if (data.warning) {
        setWarning(data.warning)
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

      setResult({
        status: data.status,
        confidence: data.confidence,
        permitted_use_status: data.permitted_use_status,
        standards_comparison: data.standards_comparison,
        roadmap_steps: data.roadmap_steps,
        summary: data.summary,
      })

      if (data.zone) setZone(data.zone)
      if (data.jurisdiction) setJurisdiction(data.jurisdiction)

      setStep('result')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong')
      setStep('form')
    }
  }

  const handleSave = async () => {
    setSaving(true)
    try {
      const token = (await import('@/lib/supabase')).supabase
      const { data: { session } } = await token.auth.getSession()

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
  }

  return (
    <div className="min-h-screen">
      {/* Nav */}
      <nav className="fixed top-0 w-full bg-white/80 backdrop-blur-md border-b border-gray-200 z-40">
        <div className="max-w-6xl mx-auto px-4 h-14 flex items-center justify-between">
          <button onClick={handleReset} className="font-bold text-xl text-blue-600 tracking-tight">
            ZoneIQ
          </button>
          <div className="flex items-center gap-3">
            <a href="/dashboard" className="text-sm text-gray-600 hover:text-gray-900 transition-colors">
              Dashboard
            </a>
          </div>
        </div>
      </nav>

      {/* Loading Overlay */}
      {step === 'loading' && <LoadingSteps />}

      {/* Main Content */}
      <main className="pt-14">
        {/* Search Step — Hero */}
        {step === 'search' && (
          <div className="min-h-[calc(100vh-56px)] flex flex-col items-center justify-center px-4">
            <div className="text-center mb-8">
              <h1 className="text-4xl sm:text-5xl font-bold text-gray-900 mb-3 tracking-tight">
                What can you build?
              </h1>
              <p className="text-gray-500 text-lg">Find out in under 10 seconds</p>
            </div>
            <AddressSearch onAddressSelect={handleAddressSelect} />
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

            {zone && (
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

            <FeasibilityResult
              result={result}
              zone={zone}
              jurisdiction={jurisdiction}
              onSave={handleSave}
              onExport={handleExport}
              saving={saving}
            />
          </div>
        )}
      </main>
    </div>
  )
}
