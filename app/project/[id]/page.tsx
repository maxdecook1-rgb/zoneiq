'use client'

import { useEffect, useState } from 'react'
import dynamic from 'next/dynamic'
import { useParams } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { Project, FeasibilityResult as FeasibilityResultType, StructuredAnalysisResult } from '@/lib/types'
import FeasibilityResult from '@/components/FeasibilityResult'
import StructuredResult from '@/components/StructuredResult'

const MapView = dynamic(() => import('@/components/MapView'), { ssr: false })

export default function ProjectPage() {
  const params = useParams()
  const id = params.id as string
  const [project, setProject] = useState<Project | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    async function loadProject() {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) {
        setError('Please sign in to view this project.')
        setLoading(false)
        return
      }

      try {
        const res = await fetch('/api/projects', {
          headers: {
            Authorization: `Bearer ${session.access_token}`,
          },
        })

        if (!res.ok) throw new Error('Failed to load projects')

        const data = await res.json()
        const found = data.projects?.find((p: Project) => p.id === id)

        if (!found) {
          setError('Project not found')
        } else {
          setProject(found)
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load project')
      } finally {
        setLoading(false)
      }
    }

    loadProject()
  }, [id])

  const handleExport = async () => {
    if (!project?.result) return

    try {
      const res = await fetch('/api/export/pdf', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          result: project.result,
          address: project.address,
          project_inputs: project.project_inputs,
        }),
      })

      if (!res.ok) throw new Error('PDF generation failed')

      const blob = await res.blob()
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `ZoneIQ-Report-${project.id}.pdf`
      a.click()
      URL.revokeObjectURL(url)
    } catch {
      alert('Failed to export PDF')
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin h-8 w-8 border-2 border-blue-500 rounded-full border-t-transparent" />
      </div>
    )
  }

  return (
    <div className="min-h-screen">
      <nav className="fixed top-0 w-full bg-white/80 backdrop-blur-md border-b border-gray-200 z-40">
        <div className="max-w-6xl mx-auto px-4 h-14 flex items-center justify-between">
          <a href="/" className="font-bold text-xl text-blue-600 tracking-tight">
            ZoneIQ
          </a>
          <div className="flex items-center gap-3">
            <a href="/dashboard" className="text-sm text-gray-600 hover:text-gray-900 transition-colors">
              Dashboard
            </a>
            <a href="/" className="text-sm text-gray-600 hover:text-gray-900 transition-colors">
              New Check
            </a>
          </div>
        </div>
      </nav>

      <main className="pt-14 max-w-4xl mx-auto px-4 py-8">
        <a
          href="/dashboard"
          className="text-sm text-gray-500 hover:text-gray-700 mb-6 flex items-center gap-1"
        >
          <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
          Back to Dashboard
        </a>

        {error ? (
          <div className="bg-red-50 border border-red-200 rounded-lg px-4 py-3 mt-4">
            <p className="text-sm text-red-800">{error}</p>
          </div>
        ) : project ? (
          <div className="space-y-6">
            {/* Map placeholder — use geocoded coords if available */}
            {project.address && (
              <div className="bg-gray-100 rounded-xl h-48 flex items-center justify-center">
                <MapView lat={34.2} lng={-83.8} zoom={13} className="h-48 w-full rounded-xl overflow-hidden" />
              </div>
            )}

            {/* Project Info */}
            <div className="bg-white border border-gray-200 rounded-xl p-6">
              <h1 className="text-xl font-bold text-gray-900 mb-1">{project.address || 'Unknown Address'}</h1>
              <p className="text-sm text-gray-500 capitalize">
                {project.project_inputs?.type?.replace('_', ' ') || 'Unknown Type'}
                {project.project_inputs?.units ? ` \u2022 ${project.project_inputs.units} units` : ''}
                {project.project_inputs?.stories ? ` \u2022 ${project.project_inputs.stories} stories` : ''}
                {project.project_inputs?.sqft ? ` \u2022 ${project.project_inputs.sqft.toLocaleString()} sq ft` : ''}
              </p>
              <p className="text-xs text-gray-400 mt-2">
                Created {new Date(project.created_at).toLocaleDateString('en-US', {
                  year: 'numeric',
                  month: 'long',
                  day: 'numeric',
                })}
              </p>
            </div>

            {/* Results */}
            {project.result && (
              'verdict' in project.result
                ? <StructuredResult result={project.result as StructuredAnalysisResult} onExport={handleExport} />
                : <FeasibilityResult result={project.result as FeasibilityResultType} onExport={handleExport} />
            )}
          </div>
        ) : null}
      </main>
    </div>
  )
}
