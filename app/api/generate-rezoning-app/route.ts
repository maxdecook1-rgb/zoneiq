import { NextRequest, NextResponse } from 'next/server'
import { generateRezoningApplication } from '@/lib/claude'

export const dynamic = 'force-dynamic'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { address, current_zone, requested_zone, project_description, jurisdiction, building_info } = body

    if (!address || !current_zone || !requested_zone) {
      return NextResponse.json({ error: 'Address, current zone, and requested zone are required' }, { status: 400 })
    }

    const application = await generateRezoningApplication(
      address,
      current_zone,
      requested_zone,
      project_description || '',
      jurisdiction || 'Local Planning Department',
      building_info || {}
    )

    return NextResponse.json({
      success: true,
      application,
    })
  } catch (error) {
    console.error('Rezoning application error:', error)
    return NextResponse.json({ error: 'Failed to generate rezoning application' }, { status: 500 })
  }
}
