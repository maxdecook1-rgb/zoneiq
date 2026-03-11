import { NextRequest, NextResponse } from 'next/server'
import { getServiceClient } from '@/lib/supabase'
import { parseDocument } from '@/lib/claude'

export const dynamic = 'force-dynamic'
// Give Claude more time to analyze complex plans
export const maxDuration = 60

export async function POST(request: NextRequest) {
  try {
    const contentType = request.headers.get('content-type') || ''

    let base64: string
    let mimeType: string
    let originalFileName: string
    let fileSize: number
    let fileUrl = ''

    // Check if this is a JSON request (file already in Supabase Storage)
    if (contentType.includes('application/json')) {
      const body = await request.json()
      const { storagePath, fileName } = body

      if (!storagePath) {
        return NextResponse.json({ error: 'storagePath is required' }, { status: 400 })
      }

      originalFileName = fileName || storagePath.split('/').pop() || 'unknown'
      console.log(`[parse-document] Processing file from storage: ${storagePath}`)

      // Download file from Supabase Storage
      let supabase
      try {
        supabase = getServiceClient()
      } catch (err) {
        console.error('[parse-document] Failed to create Supabase client:', err)
        return NextResponse.json(
          { error: 'Server configuration error. Please contact support.' },
          { status: 500 }
        )
      }

      const { data: downloadData, error: downloadError } = await supabase.storage
        .from('documents')
        .download(storagePath)

      if (downloadError || !downloadData) {
        console.error('[parse-document] Storage download failed:', downloadError)
        return NextResponse.json(
          { error: `Could not retrieve file from storage: ${downloadError?.message || 'File not found'}` },
          { status: 400 }
        )
      }

      console.log(`[parse-document] Downloaded ${downloadData.size} bytes from storage`)

      // Get public URL for reference
      const { data: urlData } = supabase.storage
        .from('documents')
        .getPublicUrl(storagePath)
      fileUrl = urlData.publicUrl

      // Convert to base64
      const buffer = Buffer.from(await downloadData.arrayBuffer())
      base64 = buffer.toString('base64')
      fileSize = buffer.length

      // Check base64 size (Claude has ~20MB limit for content)
      const base64SizeMB = (base64.length / (1024 * 1024)).toFixed(1)
      console.log(`[parse-document] Base64 size: ${base64SizeMB}MB`)

      if (base64.length > 20 * 1024 * 1024) {
        return NextResponse.json(
          { error: `File is too large for AI analysis (${base64SizeMB}MB encoded). Try a file under 15MB.` },
          { status: 400 }
        )
      }

      // Determine mime type from extension
      const ext = originalFileName.split('.').pop()?.toLowerCase()
      const mimeMap: Record<string, string> = {
        pdf: 'application/pdf',
        png: 'image/png',
        jpg: 'image/jpeg',
        jpeg: 'image/jpeg',
        gif: 'image/gif',
        webp: 'image/webp',
        tiff: 'image/tiff',
        tif: 'image/tiff',
        bmp: 'image/bmp',
        svg: 'image/svg+xml',
        dwg: 'application/octet-stream',
        dxf: 'text/plain',
      }
      mimeType = (ext && mimeMap[ext]) || 'application/octet-stream'
      console.log(`[parse-document] Detected mime type: ${mimeType} (ext: ${ext})`)

    } else {
      // Legacy: FormData upload (for small files that come directly)
      let formData: FormData
      try {
        formData = await request.formData()
      } catch {
        return NextResponse.json(
          { error: 'Failed to read uploaded file. The file may be too large — try the upload method.' },
          { status: 400 }
        )
      }

      const file = formData.get('file') as File | null
      if (!file) {
        return NextResponse.json({ error: 'No file provided' }, { status: 400 })
      }

      // Validate file type
      const validTypes = [
        'application/pdf',
        'image/png', 'image/jpeg', 'image/jpg', 'image/gif', 'image/webp',
        'image/tiff', 'image/bmp',
        'application/dxf', 'application/dwg',
        'image/vnd.dwg', 'image/x-dwg',
        'application/acad', 'application/x-acad',
        'application/octet-stream',
      ]
      const ext = file.name.split('.').pop()?.toLowerCase()
      const validExtensions = ['pdf', 'png', 'jpg', 'jpeg', 'gif', 'webp', 'tiff', 'tif', 'bmp', 'dwg', 'dxf', 'svg']

      if (!validTypes.includes(file.type) && (!ext || !validExtensions.includes(ext))) {
        return NextResponse.json({ error: 'Unsupported file type.' }, { status: 400 })
      }

      if (file.size > 4.5 * 1024 * 1024) {
        return NextResponse.json({ error: 'File too large for direct upload. Max 4MB.' }, { status: 400 })
      }

      const bytes = await file.arrayBuffer()
      const buffer = Buffer.from(bytes)
      base64 = buffer.toString('base64')
      fileSize = file.size
      originalFileName = file.name

      // Upload to Supabase Storage
      try {
        const supabase = getServiceClient()
        const storageName = `${Date.now()}-${file.name}`
        const { data, error } = await supabase.storage
          .from('documents')
          .upload(storageName, buffer, { contentType: file.type })

        if (!error && data) {
          const { data: urlData } = supabase.storage
            .from('documents')
            .getPublicUrl(data.path)
          fileUrl = urlData.publicUrl
        }
      } catch {
        console.warn('Supabase storage upload failed, continuing with parse')
      }

      // Determine mime type
      mimeType = file.type
      if (!mimeType || mimeType === 'application/octet-stream') {
        const mimeMap: Record<string, string> = {
          pdf: 'application/pdf', png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg',
          gif: 'image/gif', webp: 'image/webp', tiff: 'image/tiff', tif: 'image/tiff',
          bmp: 'image/bmp', svg: 'image/svg+xml', dwg: 'application/octet-stream', dxf: 'text/plain',
        }
        mimeType = (ext && mimeMap[ext]) || 'application/octet-stream'
      }
    }

    // Parse with Claude AI
    console.log(`[parse-document] Sending to Claude AI (mime: ${mimeType}, size: ${fileSize} bytes)`)
    const extracted = await parseDocument(base64, mimeType)
    console.log(`[parse-document] Claude response received, type: ${extracted.type}, confidence: ${extracted.confidence}`)

    return NextResponse.json({
      extracted,
      file_url: fileUrl,
      file_name: originalFileName,
      file_size: fileSize,
      confidence: extracted.confidence || (extracted.type ? 0.7 : 0.3),
    })
  } catch (error) {
    console.error('[parse-document] Error:', error)
    const message = error instanceof Error ? error.message : 'Unknown error'

    if (message.includes('rate_limit') || message.includes('429') || message.includes('overloaded')) {
      return NextResponse.json(
        { error: 'AI service is busy. Please wait a moment and try again.' },
        { status: 429 }
      )
    }
    if (message.includes('timeout') || message.includes('ETIMEDOUT') || message.includes('ECONNRESET')) {
      return NextResponse.json(
        { error: 'Analysis timed out. Try a smaller or simpler file.' },
        { status: 504 }
      )
    }
    if (message.includes('invalid_api_key') || message.includes('authentication')) {
      return NextResponse.json(
        { error: 'AI service authentication failed. Please check API key configuration.' },
        { status: 500 }
      )
    }
    if (message.includes('too large') || message.includes('max_tokens') || message.includes('content_too_large')) {
      return NextResponse.json(
        { error: 'File is too large or complex for AI analysis. Try a smaller file or fewer pages.' },
        { status: 400 }
      )
    }

    // Return the actual error message so we can debug
    return NextResponse.json(
      { error: `Analysis failed: ${message.substring(0, 200)}` },
      { status: 500 }
    )
  }
}
