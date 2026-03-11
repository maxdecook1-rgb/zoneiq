import { NextRequest, NextResponse } from 'next/server'
import { getServiceClient } from '@/lib/supabase'
import { parseDocument } from '@/lib/claude'

export const dynamic = 'force-dynamic'

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData()
    const file = formData.get('file') as File | null

    if (!file) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 })
    }

    // Accept all common file types
    const validTypes = [
      'application/pdf',
      'image/png', 'image/jpeg', 'image/jpg', 'image/gif', 'image/webp',
      'image/tiff', 'image/bmp',
      'application/dxf', 'application/dwg',
      'image/vnd.dwg', 'image/x-dwg',
      'application/acad', 'application/x-acad',
      'application/octet-stream', // catch-all for AutoCAD files
    ]

    // Also accept by extension
    const ext = file.name.split('.').pop()?.toLowerCase()
    const validExtensions = ['pdf', 'png', 'jpg', 'jpeg', 'gif', 'webp', 'tiff', 'tif', 'bmp', 'dwg', 'dxf', 'svg']

    if (!validTypes.includes(file.type) && (!ext || !validExtensions.includes(ext))) {
      return NextResponse.json({ error: 'Unsupported file type. Accepts PDF, images, DWG, DXF, SVG.' }, { status: 400 })
    }

    // Validate file size (100MB for CAD files)
    if (file.size > 100 * 1024 * 1024) {
      return NextResponse.json({ error: 'File too large. Max 100MB.' }, { status: 400 })
    }

    // Convert to base64
    const bytes = await file.arrayBuffer()
    const buffer = Buffer.from(bytes)
    const base64 = buffer.toString('base64')

    // Upload to Supabase Storage
    let fileUrl = ''
    try {
      const supabase = getServiceClient()
      const fileName = `${Date.now()}-${file.name}`
      const { data, error } = await supabase.storage
        .from('documents')
        .upload(fileName, buffer, {
          contentType: file.type,
        })

      if (!error && data) {
        const { data: urlData } = supabase.storage
          .from('documents')
          .getPublicUrl(data.path)
        fileUrl = urlData.publicUrl
      }
    } catch {
      console.warn('Supabase storage upload failed, continuing with parse')
    }

    // Determine mime type for Claude
    let mimeType = file.type
    if (!mimeType || mimeType === 'application/octet-stream') {
      // Infer from extension
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
    }

    // Parse with Claude
    const extracted = await parseDocument(base64, mimeType)

    return NextResponse.json({
      extracted,
      file_url: fileUrl,
      file_name: file.name,
      file_size: file.size,
      confidence: extracted.confidence || (extracted.type ? 0.7 : 0.3),
    })
  } catch (error) {
    console.error('Document parse error:', error)
    return NextResponse.json({ error: 'Failed to parse document' }, { status: 500 })
  }
}
