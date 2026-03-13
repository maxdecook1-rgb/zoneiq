import { NextRequest, NextResponse } from 'next/server'
import { runAnalysisPipeline } from '@/lib/pipeline'

export const dynamic = 'force-dynamic'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { address, parcel_id, project_inputs, acreage_override } = body

    if (!address) {
      return NextResponse.json({ error: 'Address is required' }, { status: 400 })
    }

    if (!project_inputs?.type) {
      return NextResponse.json({ error: 'Project type is required' }, { status: 400 })
    }

    const { result, traces } = await runAnalysisPipeline({
      address,
      parcel_id: parcel_id || undefined,
      project_inputs,
      acreage_override: acreage_override || undefined,
    })

    return NextResponse.json({
      result,
      traces,
    })
  } catch (error) {
    console.error('Analysis pipeline error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Analysis failed' },
      { status: 500 }
    )
  }
}
