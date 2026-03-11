import { NextRequest, NextResponse } from 'next/server'
import { generateSitePlanLayout, lookupZoningCodes } from '@/lib/claude'

export const dynamic = 'force-dynamic'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { address, lot_info, building_info, tier = 'basic' } = body

    if (!building_info) {
      return NextResponse.json({ error: 'Building info is required' }, { status: 400 })
    }

    // Get zoning if not provided
    let zoningInfo = body.zoning_info
    if (!zoningInfo && address) {
      zoningInfo = await lookupZoningCodes(address)
    }

    // Default lot info if not provided
    const lot = lot_info || {
      width_ft: 100,
      depth_ft: 150,
      acreage: 0.34,
    }

    const sitePlan = await generateSitePlanLayout(
      lot,
      building_info,
      zoningInfo || {},
      tier
    )

    return NextResponse.json({
      success: true,
      site_plan: sitePlan,
      lot: lot,
      tier,
    })
  } catch (error) {
    console.error('Site plan generation error:', error)
    return NextResponse.json({ error: 'Failed to generate site plan' }, { status: 500 })
  }
}
