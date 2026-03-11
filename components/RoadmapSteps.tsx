'use client'

import { useState } from 'react'
import { RoadmapStep } from '@/lib/types'

interface RoadmapStepsProps {
  steps: RoadmapStep[]
}

export default function RoadmapSteps({ steps }: RoadmapStepsProps) {
  const [expandedStep, setExpandedStep] = useState<number | null>(0)

  return (
    <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
      <div className="px-6 py-4 border-b border-gray-200">
        <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wide">Approval Roadmap</h3>
      </div>
      <div className="divide-y divide-gray-100">
        {steps.map((step) => (
          <div key={step.order}>
            <button
              onClick={() => setExpandedStep(expandedStep === step.order ? null : step.order)}
              className="w-full px-6 py-4 flex items-start gap-4 text-left hover:bg-gray-50 transition-colors"
            >
              <span className="flex-shrink-0 w-8 h-8 rounded-full bg-blue-100 text-blue-700 flex items-center justify-center text-sm font-bold">
                {step.order}
              </span>
              <div className="flex-1 min-w-0">
                <p className="font-medium text-gray-900">{step.action}</p>
                <p className="text-sm text-gray-500">{step.agency}</p>
              </div>
              <div className="flex items-center gap-2 flex-shrink-0">
                <span className="text-xs text-gray-400">{step.estimated_days} days</span>
                <svg
                  className={`h-5 w-5 text-gray-400 transition-transform ${expandedStep === step.order ? 'rotate-180' : ''}`}
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
              </div>
            </button>

            {expandedStep === step.order && (
              <div className="px-6 pb-4 pl-18 ml-12 space-y-3">
                {step.required_documents.length > 0 && (
                  <div>
                    <p className="text-xs font-semibold text-gray-500 uppercase mb-1">Required Documents</p>
                    <ul className="space-y-1">
                      {step.required_documents.map((doc, i) => (
                        <li key={i} className="text-sm text-gray-700 flex items-center gap-2">
                          <svg className="h-3.5 w-3.5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                          </svg>
                          {doc}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
                {step.notes && (
                  <p className="text-sm text-gray-600 italic">{step.notes}</p>
                )}
                <div className="flex items-center gap-2 text-xs text-gray-400">
                  <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  Estimated timeline: {step.estimated_days} days
                </div>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}
