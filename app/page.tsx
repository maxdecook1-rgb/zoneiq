'use client'

import { useState } from 'react'
import dynamic from 'next/dynamic'
import { useAuth } from '@/lib/auth-context'
import AddressSearch from '@/components/AddressSearch'
import ParcelConfirmation from '@/components/ParcelConfirmation'
import ProjectForm from '@/components/ProjectForm'
import StructuredResult from '@/components/StructuredResult'
import LoadingSteps from '@/components/LoadingSteps'
import { ProjectInputs, StructuredAnalysisResult, ZoningDistrict, Jurisdiction } from '@/lib/types'

const MapView = dynamic(() => import('@/components/MapView'), { ssr: false })

type Step = 'search' | 'confirm_parcel' | 'form' | 'loading' | 'result'

interface ParcelData {
  address: string
  lat: number
  lng: number
  id?: string | null
  jurisdiction_id?: string | null
  zoning_district_id?: string | null
  acreage?: number | null
  apn?: string | null
}

export default function HomePage() {
  const { user, session } = useAuth()
  const [step, setStep] = useState<Step>('search')
  const [address, setAddress] = useState('')
  const [parcelData, setParcelData] = useState<ParcelData | null>(null)
  const [zone, setZone] = useState<ZoningDistrict | null>(null)
  const [jurisdiction, setJurisdiction] = useState<Jurisdiction | null>(null)
  const [result, setResult] = useState<StructuredAnalysisResult | null>(null)
  const [projectInputs, setProjectInputs] = useState<ProjectInputs | null>(null)
  const [warning, setWarning] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [matchQuality, setMatchQuality] = useState<'exact' | 'fuzzy' | 'none'>('none')

  const handleAddressSelect = async (selectedAddress: string, lat: number, lng: number) => {
    setAddress(selectedAddress)
    setError(null)
    setWarning(null)

    try {
      // Fetch parcel data from DB
      const parcelRes = await fetch(`/api/parcel?address=${encodeURIComponent(selectedAddress)}`)

      if (parcelRes.ok) {
        const data = await parcelRes.json()
        setParcelData({
          address: selectedAddress,
          lat: data.parcel?.lat || lat,
          lng: data.parcel?.lng || lng,
          id: data.parcel?.id,
          jurisdiction_id: data.jurisdiction?.id,
          zoning_district_id: data.zone?.id,
          acreage: data.parcel?.acreage || data.parcel?.metadata?.acreage || null,
          apn: data.parcel?.apn || null,
        })
        setZone(data.zone)
        setJurisdiction(data.jurisdiction)
        setMatchQuality(data.match_quality || (data.parcel?.id ? 'exact' : 'none'))
        if (data.warning) setWarning(data.warning)
      } else {
        setParcelData({ address: selectedAddress, lat, lng })
        setMatchQuality('none')
      }

      // Go to parcel confirmation step
      setStep('confirm_parcel')
    } catch {
      setParcelData({ address: selectedAddress, lat, lng })
      setWarning('Could not connect to parcel service. Results will be limited.')
      setMatchQuality('none')
      setStep('confirm_parcel')
    }
  }

  const handleParcelConfirm = () => {
    setStep('form')
  }

  const handleFormSubmit = async (inputs: ProjectInputs) => {
    setProjectInputs(inputs)
    setStep('loading')
    setError(null)

    try {
      // Call the new analysis pipeline
      const res = await fetch('/api/analysis', {
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
        throw new Error(data.error || 'Analysis failed')
      }

      setResult(data.result)
      setStep('result')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong')
      setStep('form')
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
    setMatchQuality('none')
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

        {/* Parcel Confirmation Step */}
        {step === 'confirm_parcel' && parcelData && (
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

            <ParcelConfirmation
              address={parcelData.address}
              lat={parcelData.lat}
              lng={parcelData.lng}
              apn={parcelData.apn || null}
              acreage={parcelData.acreage || null}
              zoneCode={zone?.code || null}
              zoneName={zone?.name || null}
              jurisdictionName={jurisdiction?.name || null}
              matchQuality={matchQuality}
              onConfirm={handleParcelConfirm}
              onSearchAgain={handleReset}
            />
          </div>
        )}

        {/* Form Step */}
        {step === 'form' && (
          <div className="max-w-4xl mx-auto px-4 py-8">
            <button
              onClick={() => setStep('confirm_parcel')}
              className="text-sm text-gray-500 hover:text-gray-700 mb-6 flex items-center gap-1"
            >
              <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
              Back to parcel
            </button>

            {parcelData && (
              <div className="mb-6">
                <MapView lat={parcelData.lat} lng={parcelData.lng} />
              </div>
            )}

            {/* Zoning Info Panel (from DB data) */}
            {zone && (
              <div className="mb-6 bg-white border border-gray-200 rounded-xl p-5 space-y-3">
                <div className="flex items-center justify-between">
                  <h3 className="font-semibold text-gray-900">Zoning Information</h3>
                  <span className={`text-xs px-2 py-1 rounded-full ${
                    matchQuality === 'exact' ? 'bg-green-100 text-green-700' : 'bg-yellow-100 text-yellow-700'
                  }`}>
                    {matchQuality === 'exact' ? 'Database verified' : 'Limited data'}
                  </span>
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 text-sm">
                  <div>
                    <p className="text-gray-500">Zone</p>
                    <p className="font-medium text-gray-900">{zone.code}{zone.name ? ` — ${zone.name}` : ''}</p>
                  </div>
                  {jurisdiction && (
                    <div>
                      <p className="text-gray-500">Jurisdiction</p>
                      <p className="font-medium text-gray-900">{jurisdiction.name}, {jurisdiction.state}</p>
                    </div>
                  )}
                  {zone.development_standards?.max_height_ft && (
                    <div>
                      <p className="text-gray-500">Max Height</p>
                      <p className="font-medium text-gray-900">
                        {zone.development_standards.max_height_ft} ft
                        {zone.development_standards.max_stories ? ` / ${zone.development_standards.max_stories} stories` : ''}
                      </p>
                    </div>
                  )}
                  {zone.development_standards?.setbacks && (
                    <div>
                      <p className="text-gray-500">Setbacks</p>
                      <p className="font-medium text-gray-900">
                        F:{zone.development_standards.setbacks.front_ft}&apos;
                        {' '}S:{zone.development_standards.setbacks.side_ft}&apos;
                        {' '}R:{zone.development_standards.setbacks.rear_ft}&apos;
                      </p>
                    </div>
                  )}
                  {zone.development_standards?.min_lot_sqft && (
                    <div>
                      <p className="text-gray-500">Min Lot Size</p>
                      <p className="font-medium text-gray-900">{zone.development_standards.min_lot_sqft.toLocaleString()} sq ft</p>
                    </div>
                  )}
                  {zone.development_standards?.max_far && (
                    <div>
                      <p className="text-gray-500">Max FAR</p>
                      <p className="font-medium text-gray-900">{zone.development_standards.max_far}</p>
                    </div>
                  )}
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

            <StructuredResult
              result={result}
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
