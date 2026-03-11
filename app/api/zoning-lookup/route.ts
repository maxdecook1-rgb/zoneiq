import { NextRequest, NextResponse } from 'next/server'
import { lookupZoningCodes } from '@/lib/claude'

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const address = searchParams.get('address')

    if (!address) {
      return NextResponse.json({ error: 'Address is required' }, { status: 400 })
    }

    const zoningData = await lookupZoningCodes(address)

    return NextResponse.json({
      success: true,
      zoning: zoningData,
    })
  } catch (error) {
    console.error('Zoning lookup error:', error)
    return NextResponse.json({ error: 'Failed to look up zoning codes' }, { status: 500 })
  }
}
