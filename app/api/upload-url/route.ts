import { NextRequest, NextResponse } from 'next/server'
import { getServiceClient } from '@/lib/supabase'

export const dynamic = 'force-dynamic'

/**
 * Generates a signed upload URL so the client can upload files
 * directly to Supabase Storage, bypassing Vercel's 4.5MB body limit.
 */
export async function POST(request: NextRequest) {
  try {
    const { fileName } = await request.json()

    if (!fileName) {
      return NextResponse.json({ error: 'fileName is required' }, { status: 400 })
    }

    const supabase = getServiceClient()

    // Create a unique path to avoid collisions
    const safeName = fileName.replace(/[^a-zA-Z0-9._-]/g, '_')
    const storagePath = `uploads/${Date.now()}-${safeName}`

    // Create a signed upload URL (valid for 5 minutes)
    const { data, error } = await supabase.storage
      .from('documents')
      .createSignedUploadUrl(storagePath)

    if (error) {
      console.error('Failed to create signed upload URL:', error)

      // If the bucket doesn't exist, try to create it
      if (error.message?.includes('not found') || error.message?.includes('Bucket')) {
        try {
          await supabase.storage.createBucket('documents', {
            public: true,
            fileSizeLimit: 52428800, // 50MB
            allowedMimeTypes: [
              'application/pdf',
              'image/png', 'image/jpeg', 'image/jpg', 'image/gif', 'image/webp',
              'image/tiff', 'image/bmp', 'image/svg+xml',
              'application/dxf', 'application/dwg',
              'image/vnd.dwg', 'image/x-dwg',
              'application/acad', 'application/x-acad',
              'application/octet-stream',
            ],
          })

          // Try again after creating bucket
          const retry = await supabase.storage
            .from('documents')
            .createSignedUploadUrl(storagePath)

          if (retry.error) {
            throw retry.error
          }

          return NextResponse.json({
            signedUrl: retry.data.signedUrl,
            token: retry.data.token,
            storagePath,
          })
        } catch (bucketErr) {
          console.error('Failed to create bucket:', bucketErr)
          return NextResponse.json(
            { error: 'Storage not configured. Please try again or contact support.' },
            { status: 500 }
          )
        }
      }

      return NextResponse.json(
        { error: 'Failed to prepare upload. Please try again.' },
        { status: 500 }
      )
    }

    return NextResponse.json({
      signedUrl: data.signedUrl,
      token: data.token,
      storagePath,
    })
  } catch (error) {
    console.error('Upload URL error:', error)
    return NextResponse.json(
      { error: 'Failed to prepare upload. Please try again.' },
      { status: 500 }
    )
  }
}
