import { NextRequest, NextResponse } from 'next/server'
import { getServiceClient } from '@/lib/supabase'
import { geocodeAddress } from '@/lib/mapbox'
import {
  runFeasibilityCheck,
  determineConfidence,
  getDefaultRoadmap,
} from '@/lib/feasibility-engine'

export const dynamic = 'force-dynamic'
import { generateSummary } from '@/lib/claude'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { address, parcel_id, project_inputs } = body

    if (!address && !parcel_id) {
      return NextResponse.json({ error: 'Address or parcel_id is required' }, { status: 400 })
    }

    if (!project_inputs?.type) {
      return NextResponse.json({ error: 'Project type is required' }, { status: 400 })
    }

    const supabase = getServiceClient()
    let parcel = null
    let zone = null
    let jurisdiction = null
    let parcelFound = false

    // 1. Resolve parcel
    if (parcel_id) {
      const { data } = await supabase
        .from('parcels')
        .select('*')
        .eq('id', parcel_id)
        .single()
      parcel = data
    }

    if (!parcel && address) {
      // Search by address
      const { data: parcels } = await supabase
        .from('parcels')
        .select('*')
        .ilike('address', `%${address.split(',')[0]}%`)
        .limit(1)

      parcel = parcels?.[0] || null
    }

    if (parcel) {
      parcelFound = true
      // 2. Get zoning district
      if (parcel.current_zone_id) {
        const { data } = await supabase
          .from('zoning_districts')
          .select('*')
          .eq('id', parcel.current_zone_id)
          .single()
        zone = data
      }

      if (parcel.jurisdiction_id) {
        const { data } = await supabase
          .from('jurisdictions')
          .select('*')
          .eq('id', parcel.jurisdiction_id)
          .single()
        jurisdiction = data
      }
    } else {
      // Parcel not in DB — geocode and try to find jurisdiction
      const geocoded = address ? await geocodeAddress(address) : null

      // Fallback: use first available jurisdiction and zone
      const { data: jurisdictions } = await supabase
        .from('jurisdictions')
        .select('*')
        .limit(1)

      jurisdiction = jurisdictions?.[0] || null

      if (jurisdiction) {
        const { data: zones } = await supabase
          .from('zoning_districts')
          .select('*')
          .eq('jurisdiction_id', jurisdiction.id)

        // Try to pick a relevant zone based on project type
        zone = zones?.find((z) => z.permitted_uses?.includes(project_inputs.type))
          || zones?.[0]
          || null
      }

      parcel = {
        id: null,
        address: geocoded?.address || address,
        lat: geocoded?.lat || null,
        lng: geocoded?.lng || null,
        acreage: null,
      }
    }

    if (!zone) {
      return NextResponse.json({
        error: 'No zoning data available for this location',
        parcel,
        jurisdiction,
      }, { status: 404 })
    }

    // 3-5. Run feasibility check
    const checkResult = runFeasibilityCheck(
      project_inputs,
      zone,
      parcel?.acreage ? Number(parcel.acreage) : undefined
    )

    // 6. Determine confidence
    const hasFullDevStandards = zone.dev_standards &&
      zone.dev_standards.max_stories !== undefined &&
      zone.dev_standards.max_height_ft !== undefined

    const confidence = determineConfidence(parcelFound, !!hasFullDevStandards)

    // 7. Get roadmap
    let roadmapSteps = getDefaultRoadmap(
      checkResult.status,
      jurisdiction?.name || 'Local'
    )

    // Check for custom roadmap template
    if (jurisdiction) {
      const { data: templates } = await supabase
        .from('approval_roadmap_templates')
        .select('*')
        .eq('jurisdiction_id', jurisdiction.id)
        .limit(1)

      if (templates?.[0]?.steps) {
        roadmapSteps = templates[0].steps
      }
    }

    // 8. Generate summary via Claude
    let summary = ''
    try {
      summary = await generateSummary({
        status: checkResult.status,
        permitted_use_status: checkResult.permitted_use_status,
        standards_comparison: checkResult.standards_comparison,
        project_type: project_inputs.type,
        zone_code: zone.code,
        zone_name: zone.name,
        jurisdiction_name: jurisdiction?.name,
      })
    } catch (err) {
      console.error('Claude summary generation failed:', err)
      // Fallback summary
      const statusText = checkResult.status === 'permitted'
        ? 'permitted as-of-right'
        : checkResult.status === 'conditional'
          ? 'may be allowed with conditional approval'
          : 'not permitted under current zoning'

      summary = `Your proposed ${project_inputs.type.replace('_', ' ')} project is ${statusText} in the ${zone.code} (${zone.name}) zone. ${
        checkResult.standards_comparison.some((s) => !s.compliant)
          ? 'Some development standards are not met.'
          : 'All applicable development standards are met.'
      }`
    }

    const result = {
      status: checkResult.status,
      confidence,
      permitted_use_status: checkResult.permitted_use_status,
      standards_comparison: checkResult.standards_comparison,
      roadmap_steps: roadmapSteps,
      summary,
    }

    return NextResponse.json({
      ...result,
      parcel,
      zone,
      jurisdiction,
    })
  } catch (error) {
    console.error('Feasibility check error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
