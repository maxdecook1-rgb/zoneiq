'use client'

import { useState, useRef } from 'react'
import { formatFileSize } from '@/lib/compress-image'

interface DocumentUploadProps {
  onParsed: (extracted: {
    type?: string | null
    units?: number | null
    stories?: number | null
    sqft?: number | null
    parking?: number | null
    address?: string | null
  }) => void
  onCancel: () => void
}

const MAX_FILE_SIZE_MB = 50

export default function DocumentUpload({ onParsed, onCancel }: DocumentUploadProps) {
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [fileName, setFileName] = useState<string | null>(null)
  const [statusText, setStatusText] = useState<string | null>(null)
  const [progress, setProgress] = useState<number>(0)
  const fileRef = useRef<HTMLInputElement>(null)

  const handleFile = async (file: File) => {
    // Validate extension
    const validExtensions = ['pdf', 'png', 'jpg', 'jpeg', 'gif', 'webp', 'tiff', 'tif', 'bmp', 'dwg', 'dxf', 'svg']
    const ext = file.name.split('.').pop()?.toLowerCase()
    if (!ext || !validExtensions.includes(ext)) {
      setError('Please upload a PDF, image, DWG, DXF, or SVG file.')
      return
    }

    if (file.size > MAX_FILE_SIZE_MB * 1024 * 1024) {
      setError(`File is ${formatFileSize(file.size)} — max is ${MAX_FILE_SIZE_MB}MB.`)
      return
    }

    setFileName(file.name)
    setError(null)
    setUploading(true)
    setProgress(10)

    try {
      // Step 1: Get a signed upload URL from our server (tiny request)
      setStatusText('Preparing upload...')
      const urlRes = await fetch('/api/upload-url', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fileName: file.name,
          contentType: file.type,
        }),
      })

      if (!urlRes.ok) {
        const urlData = await urlRes.json().catch(() => ({ error: 'Failed to prepare upload' }))
        throw new Error(urlData.error || 'Failed to prepare upload')
      }

      const { signedUrl, storagePath } = await urlRes.json()
      setProgress(20)

      // Step 2: Upload file directly to Supabase Storage (bypasses Vercel entirely)
      setStatusText(`Uploading ${formatFileSize(file.size)}...`)

      const uploadRes = await fetch(signedUrl, {
        method: 'PUT',
        headers: {
          'Content-Type': file.type || 'application/octet-stream',
        },
        body: file,
      })

      if (!uploadRes.ok) {
        const uploadText = await uploadRes.text().catch(() => '')
        console.error('Direct upload failed:', uploadRes.status, uploadText)
        throw new Error('Upload failed. Please try again.')
      }

      setProgress(60)

      // Step 3: Tell our API to analyze the uploaded file (tiny JSON request)
      setStatusText('Analyzing plans with AI...')

      const parseRes = await fetch('/api/parse-document', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          storagePath,
          fileName: file.name,
        }),
      })

      setProgress(90)

      // Handle non-JSON responses
      const parseContentType = parseRes.headers.get('content-type') || ''
      if (!parseContentType.includes('application/json')) {
        const text = await parseRes.text()
        console.error('Non-JSON response:', parseRes.status, text)
        if (parseRes.status === 504) {
          throw new Error('Analysis timed out — the file may be too complex. Try a smaller file.')
        }
        throw new Error(`Server error (${parseRes.status}). Please try again.`)
      }

      const data = await parseRes.json()

      if (!parseRes.ok) {
        throw new Error(data.error || 'Failed to analyze document')
      }

      setProgress(100)
      onParsed(data.extracted)

    } catch (err) {
      const message = err instanceof Error ? err.message : 'Upload failed'
      if (message.includes('Unexpected token') || message.includes('not valid JSON')) {
        setError('Server returned an unexpected response. Please try again.')
      } else {
        setError(message)
      }
    } finally {
      setUploading(false)
      setStatusText(null)
      setProgress(0)
    }
  }

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    const file = e.dataTransfer.files[0]
    if (file) handleFile(file)
  }

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) handleFile(file)
  }

  return (
    <div className="space-y-2">
      <div
        onDrop={handleDrop}
        onDragOver={(e) => e.preventDefault()}
        className={`border-2 border-dashed rounded-lg p-6 text-center transition-colors
                   ${uploading ? 'border-blue-400 bg-blue-50' : 'border-gray-300 hover:border-blue-400 cursor-pointer'}`}
        onClick={() => !uploading && fileRef.current?.click()}
      >
        <input
          ref={fileRef}
          type="file"
          accept=".pdf,.png,.jpg,.jpeg,.gif,.webp,.tiff,.tif,.bmp,.dwg,.dxf,.svg"
          onChange={handleChange}
          className="hidden"
          disabled={uploading}
        />
        {uploading ? (
          <div className="flex flex-col items-center gap-3">
            <div className="animate-spin h-8 w-8 border-2 border-blue-500 rounded-full border-t-transparent" />
            <p className="text-sm text-blue-700 font-medium">
              {statusText || `Processing ${fileName}...`}
            </p>
            {/* Progress bar */}
            <div className="w-full max-w-xs bg-gray-200 rounded-full h-2">
              <div
                className="bg-blue-500 h-2 rounded-full transition-all duration-500"
                style={{ width: `${progress}%` }}
              />
            </div>
            <p className="text-xs text-gray-500">This may take 15-60 seconds for complex plans</p>
          </div>
        ) : (
          <div className="flex flex-col items-center gap-2">
            <svg className="h-8 w-8 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
            </svg>
            <p className="text-sm text-gray-600">
              Drop your plans here or <span className="text-blue-600 font-medium">browse</span>
            </p>
            <p className="text-xs text-gray-400">PDF, images, DWG, DXF, SVG up to {MAX_FILE_SIZE_MB}MB</p>
          </div>
        )}
      </div>
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg px-3 py-2">
          <p className="text-sm text-red-700">{error}</p>
        </div>
      )}
      <button
        type="button"
        onClick={onCancel}
        disabled={uploading}
        className="text-sm text-gray-500 hover:text-gray-700 disabled:opacity-50"
      >
        Cancel
      </button>
    </div>
  )
}
