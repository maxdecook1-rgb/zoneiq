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

    // Validate file type
    const validTypes = ['application/pdf', 'image/png', 'image/jpeg']
    if (!validTypes.includes(file.type)) {
      return NextResponse.json({ error: 'Invalid file type. Accepts PDF, PNG, JPG.' }, { status: 400 })
    }

    // Validate file size (50MB)
    if (file.size > 50 * 1024 * 1024) {
      return NextResponse.json({ error: 'File too large. Max 50MB.' }, { status: 400 })
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
      // Storage upload is optional — continue with parsing
      console.warn('Supabase storage upload failed, continuing with parse')
    }

    // Parse with Claude
    const extracted = await parseDocument(base64, file.type)

    return NextResponse.json({
      extracted,
      file_url: fileUrl,
      confidence: extracted.type ? 'medium' : 'low',
    })
  } catch (error) {
    console.error('Document parse error:', error)
    return NextResponse.json({ error: 'Failed to parse document' }, { status: 500 })
  }
}
