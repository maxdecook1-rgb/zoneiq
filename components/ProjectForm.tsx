'use client'

import { useState } from 'react'
import { ProjectInputs, PROJECT_TYPES } from '@/lib/types'
import DocumentUpload from './DocumentUpload'

interface ProjectFormProps {
  address: string
  onSubmit: (inputs: ProjectInputs) => void
  loading?: boolean
}

export default function ProjectForm({ address, onSubmit, loading }: ProjectFormProps) {
  const [type, setType] = useState<ProjectInputs['type']>('single_family')
  const [units, setUnits] = useState<string>('')
  const [stories, setStories] = useState<string>('')
  const [sqft, setSqft] = useState<string>('')
  const [parking, setParking] = useState<string>('')
  const [showUpload, setShowUpload] = useState(false)

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    onSubmit({
      type,
      units: units ? parseInt(units) : undefined,
      stories: stories ? parseInt(stories) : undefined,
      sqft: sqft ? parseInt(sqft) : undefined,
      parking: parking ? parseInt(parking) : undefined,
    })
  }

  const handleDocumentParsed = (extracted: {
    type?: string | null
    units?: number | null
    stories?: number | null
    sqft?: number | null
    parking?: number | null
  }) => {
    if (extracted.type && PROJECT_TYPES.some((t) => t.value === extracted.type)) {
      setType(extracted.type as ProjectInputs['type'])
    }
    if (extracted.units) setUnits(String(extracted.units))
    if (extracted.stories) setStories(String(extracted.stories))
    if (extracted.sqft) setSqft(String(extracted.sqft))
    if (extracted.parking) setParking(String(extracted.parking))
    setShowUpload(false)
  }

  return (
    <form onSubmit={handleSubmit} className="w-full max-w-2xl mx-auto space-y-6">
      <div className="bg-blue-50 border border-blue-100 rounded-lg px-4 py-3">
        <p className="text-sm text-blue-700 font-medium">Property Address</p>
        <p className="text-blue-900">{address}</p>
      </div>

      {/* Project Type Selector */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">Project Type</label>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
          {PROJECT_TYPES.map((pt) => (
            <button
              key={pt.value}
              type="button"
              onClick={() => setType(pt.value as ProjectInputs['type'])}
              className={`px-4 py-2.5 rounded-lg text-sm font-medium transition-all duration-150
                ${
                  type === pt.value
                    ? 'bg-blue-600 text-white shadow-md'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
            >
              {pt.label}
            </button>
          ))}
        </div>
      </div>

      {/* Number Inputs */}
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label htmlFor="units" className="block text-sm font-medium text-gray-700 mb-1">
            Units
          </label>
          <input
            id="units"
            type="number"
            min="1"
            value={units}
            onChange={(e) => setUnits(e.target.value)}
            placeholder="e.g. 4"
            className="w-full px-3 py-2.5 border border-gray-300 rounded-lg focus:ring-2
                       focus:ring-blue-200 focus:border-blue-500 focus:outline-none text-gray-900"
          />
        </div>
        <div>
          <label htmlFor="stories" className="block text-sm font-medium text-gray-700 mb-1">
            Stories
          </label>
          <input
            id="stories"
            type="number"
            min="1"
            value={stories}
            onChange={(e) => setStories(e.target.value)}
            placeholder="e.g. 2"
            className="w-full px-3 py-2.5 border border-gray-300 rounded-lg focus:ring-2
                       focus:ring-blue-200 focus:border-blue-500 focus:outline-none text-gray-900"
          />
        </div>
        <div>
          <label htmlFor="sqft" className="block text-sm font-medium text-gray-700 mb-1">
            Sq Footage
          </label>
          <input
            id="sqft"
            type="number"
            min="1"
            value={sqft}
            onChange={(e) => setSqft(e.target.value)}
            placeholder="e.g. 5000"
            className="w-full px-3 py-2.5 border border-gray-300 rounded-lg focus:ring-2
                       focus:ring-blue-200 focus:border-blue-500 focus:outline-none text-gray-900"
          />
        </div>
        <div>
          <label htmlFor="parking" className="block text-sm font-medium text-gray-700 mb-1">
            Parking Spaces
          </label>
          <input
            id="parking"
            type="number"
            min="0"
            value={parking}
            onChange={(e) => setParking(e.target.value)}
            placeholder="e.g. 8"
            className="w-full px-3 py-2.5 border border-gray-300 rounded-lg focus:ring-2
                       focus:ring-blue-200 focus:border-blue-500 focus:outline-none text-gray-900"
          />
        </div>
      </div>

      {/* Document Upload */}
      <div>
        {!showUpload ? (
          <button
            type="button"
            onClick={() => setShowUpload(true)}
            className="w-full py-3 border-2 border-dashed border-gray-300 rounded-lg text-gray-500
                       hover:border-blue-400 hover:text-blue-500 transition-colors text-sm"
          >
            Upload existing plans (optional)
          </button>
        ) : (
          <DocumentUpload onParsed={handleDocumentParsed} onCancel={() => setShowUpload(false)} />
        )}
      </div>

      {/* Submit */}
      <button
        type="submit"
        disabled={loading}
        className="w-full py-3.5 bg-blue-600 text-white font-semibold rounded-xl
                   hover:bg-blue-700 transition-colors shadow-md disabled:opacity-50
                   disabled:cursor-not-allowed text-lg"
      >
        {loading ? 'Running Check...' : 'Run Feasibility Check'}
      </button>
    </form>
  )
}
