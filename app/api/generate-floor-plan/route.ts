import { NextRequest, NextResponse } from 'next/server'
import { generateFloorPlan } from '@/lib/claude'

export const dynamic = 'force-dynamic'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { description, constraints } = body

    if (!description) {
      return NextResponse.json({ error: 'Description is required' }, { status: 400 })
    }

    const floorPlan = await generateFloorPlan(description, constraints || {})

    return NextResponse.json({
      success: true,
      floor_plan: floorPlan,
    })
  } catch (error) {
    console.error('Floor plan generation error:', error)
    return NextResponse.json({ error: 'Failed to generate floor plan' }, { status: 500 })
  }
}
