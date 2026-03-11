import { NextRequest, NextResponse } from 'next/server'
import { lookupZoningCodes, analyzeZoningCompatibility } from '@/lib/claude'

export const dynamic = 'force-dynamic'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { address, building_info, zoning_override } = body

    if (!address) {
      return NextResponse.json({ error: 'Address is required' }, { status: 400 })
    }

    if (!building_info) {
      return NextResponse.json({ error: 'Building info is required' }, { status: 400 })
    }

    // Get zoning data - either from override or AI lookup
    let zoningInfo = zoning_override
    if (!zoningInfo) {
      zoningInfo = await lookupZoningCodes(address)
    }

    // Analyze compatibility
    const compatibility = await analyzeZoningCompatibility(
      building_info,
      zoningInfo,
      address
    )

    return NextResponse.json({
      success: true,
      zoning: zoningInfo,
      compatibility,
    })
  } catch (error) {
    console.error('Compatibility check error:', error)
    return NextResponse.json({ error: 'Failed to check compatibility' }, { status: 500 })
  }
}
