'use client'

import { useEffect, useState } from 'react'

const STEPS = [
  'Locating parcel...',
  'Loading zoning data...',
  'Checking compliance...',
  'Generating report...',
]

export default function LoadingSteps() {
  const [currentStep, setCurrentStep] = useState(0)

  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentStep((prev) => {
        if (prev < STEPS.length - 1) return prev + 1
        return prev
      })
    }, 2000)
    return () => clearInterval(interval)
  }, [])

  return (
    <div className="fixed inset-0 bg-white/95 backdrop-blur-sm z-50 flex items-center justify-center">
      <div className="text-center space-y-8 max-w-sm mx-auto px-4">
        <div className="relative mx-auto w-16 h-16">
          <div className="absolute inset-0 border-4 border-blue-200 rounded-full" />
          <div className="absolute inset-0 border-4 border-blue-600 rounded-full border-t-transparent animate-spin" />
        </div>

        <div className="space-y-3">
          {STEPS.map((step, i) => (
            <div
              key={i}
              className={`flex items-center gap-3 transition-all duration-500 ${
                i <= currentStep ? 'opacity-100' : 'opacity-30'
              }`}
            >
              {i < currentStep ? (
                <svg className="h-5 w-5 text-green-500 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
              ) : i === currentStep ? (
                <div className="h-5 w-5 flex-shrink-0 flex items-center justify-center">
                  <div className="h-2 w-2 bg-blue-600 rounded-full animate-pulse" />
                </div>
              ) : (
                <div className="h-5 w-5 flex-shrink-0" />
              )}
              <span className={`text-sm ${i === currentStep ? 'text-blue-700 font-medium' : 'text-gray-500'}`}>
                {step}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
