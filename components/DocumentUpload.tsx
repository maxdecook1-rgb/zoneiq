'use client'

import { useState, useRef } from 'react'
import { compressImage, formatFileSize } from '@/lib/compress-image'

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

const MAX_UPLOAD_MB = 4 // Vercel serverless function body limit is 4.5MB

export default function DocumentUpload({ onParsed, onCancel }: DocumentUploadProps) {
  const [uploading, setUploading] = useState(false)
  const [compressing, setCompressing] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [fileName, setFileName] = useState<string | null>(null)
  const [statusText, setStatusText] = useState<string | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)

  const handleFile = async (file: File) => {
    // Validate extension
    const validExtensions = ['pdf', 'png', 'jpg', 'jpeg', 'gif', 'webp', 'tiff', 'tif', 'bmp', 'dwg', 'dxf', 'svg']
    const ext = file.name.split('.').pop()?.toLowerCase()
    if (!ext || !validExtensions.includes(ext)) {
      setError('Please upload a PDF, image, DWG, DXF, or SVG file.')
      return
    }

    setFileName(file.name)
    setError(null)
    setStatusText(null)

    let fileToUpload = file

    // For images, compress if needed
    if (file.type.startsWith('image/') && file.type !== 'image/svg+xml') {
      if (file.size > MAX_UPLOAD_MB * 1024 * 1024) {
        setCompressing(true)
        setStatusText(`Compressing ${formatFileSize(file.size)} image...`)
        try {
          fileToUpload = await compressImage(file, MAX_UPLOAD_MB)
          setStatusText(`Compressed to ${formatFileSize(fileToUpload.size)}`)
        } catch {
          setError('Failed to compress image. Try a smaller file.')
          setCompressing(false)
          return
        }
        setCompressing(false)
      }
    }

    // For non-image files (PDFs, CAD), check size directly
    if (!file.type.startsWith('image/') || file.type === 'image/svg+xml') {
      if (file.size > MAX_UPLOAD_MB * 1024 * 1024) {
        setError(
          `File is ${formatFileSize(file.size)} — max upload size is ${MAX_UPLOAD_MB}MB. ` +
          'Try a smaller PDF or convert to JPG/PNG first.'
        )
        return
      }
    }

    // Final size check after compression
    if (fileToUpload.size > MAX_UPLOAD_MB * 1024 * 1024) {
      setError(
        `File is still ${formatFileSize(fileToUpload.size)} after compression. ` +
        'Please use a lower resolution image or smaller file.'
      )
      return
    }

    setUploading(true)
    setStatusText('Analyzing your plans with AI...')

    try {
      const formData = new FormData()
      formData.append('file', fileToUpload)

      const res = await fetch('/api/parse-document', {
        method: 'POST',
        body: formData,
      })

      // Handle non-JSON responses (e.g., Vercel's "Request Entity Too Large")
      const contentType = res.headers.get('content-type') || ''
      if (!contentType.includes('application/json')) {
        const text = await res.text()
        console.error('Non-JSON response from parse-document:', res.status, text)

        if (res.status === 413 || text.includes('Request Entity Too Large') || text.includes('FUNCTION_PAYLOAD_TOO_LARGE')) {
          throw new Error('File is too large for the server. Try a smaller file or lower resolution image.')
        }
        if (res.status === 504 || text.includes('FUNCTION_INVOCATION_TIMEOUT')) {
          throw new Error('Analysis timed out — the file may be too complex. Try a simpler or smaller file.')
        }
        throw new Error(`Server error (${res.status}). Please try again.`)
      }

      const data = await res.json()

      if (!res.ok) {
        throw new Error(data.error || 'Failed to parse document')
      }

      onParsed(data.extracted)
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Upload failed'
      // Clean up common JSON parse errors for user-friendly display
      if (message.includes('Unexpected token') || message.includes('not valid JSON')) {
        setError('Server returned an unexpected response. The file may be too large — try a smaller file.')
      } else {
        setError(message)
      }
    } finally {
      setUploading(false)
      setStatusText(null)
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

  const isProcessing = uploading || compressing

  return (
    <div className="space-y-2">
      <div
        onDrop={handleDrop}
        onDragOver={(e) => e.preventDefault()}
        className={`border-2 border-dashed rounded-lg p-6 text-center transition-colors
                   ${isProcessing ? 'border-blue-400 bg-blue-50' : 'border-gray-300 hover:border-blue-400 cursor-pointer'}`}
        onClick={() => !isProcessing && fileRef.current?.click()}
      >
        <input
          ref={fileRef}
          type="file"
          accept=".pdf,.png,.jpg,.jpeg,.gif,.webp,.tiff,.tif,.bmp,.dwg,.dxf,.svg"
          onChange={handleChange}
          className="hidden"
          disabled={isProcessing}
        />
        {isProcessing ? (
          <div className="flex flex-col items-center gap-2">
            <div className="animate-spin h-8 w-8 border-2 border-blue-500 rounded-full border-t-transparent" />
            <p className="text-sm text-blue-700 font-medium">
              {statusText || `Processing ${fileName}...`}
            </p>
            {uploading && (
              <p className="text-xs text-gray-500">This may take 10-30 seconds for complex plans</p>
            )}
          </div>
        ) : (
          <div className="flex flex-col items-center gap-2">
            <svg className="h-8 w-8 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
            </svg>
            <p className="text-sm text-gray-600">
              Drop your plans here or <span className="text-blue-600 font-medium">browse</span>
            </p>
            <p className="text-xs text-gray-400">PDF, images, DWG, DXF, SVG — max {MAX_UPLOAD_MB}MB (images auto-compressed)</p>
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
        disabled={isProcessing}
        className="text-sm text-gray-500 hover:text-gray-700 disabled:opacity-50"
      >
        Cancel
      </button>
    </div>
  )
}
