import { NextRequest, NextResponse } from 'next/server'
import { findCompatibleZones } from '@/lib/feasibility-engine'

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const jurisdictionId = searchParams.get('jurisdiction_id')
    const projectType = searchParams.get('project_type')
    const currentZoneId = searchParams.get('current_zone_id') || undefined

    if (!jurisdictionId) {
      return NextResponse.json({ error: 'jurisdiction_id is required' }, { status: 400 })
    }
    if (!projectType) {
      return NextResponse.json({ error: 'project_type is required' }, { status: 400 })
    }

    const recommendations = await findCompatibleZones(jurisdictionId, projectType, currentZoneId)

    return NextResponse.json({ recommendations })
  } catch (error) {
    console.error('Zone recommendations error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to find compatible zones' },
      { status: 500 }
    )
  }
}
