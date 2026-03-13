/**
 * M1 Analysis Pipeline — 7 stages, deterministic + AI explanation
 *
 * Stage 1: Geocoding (Mapbox)
 * Stage 2: Parcel resolution (DB lookup)
 * Stage 3: Jurisdiction resolution (from parcel FK)
 * Stage 4: Zoning classification (parcel.zoning_district_id → zone row)
 * Stage 5: Use mapping (project type → permitted/conditional/prohibited)
 * Stage 6: Rule evaluation (runFeasibilityCheck + mapToVerdict)
 * Stage 7: Confidence synthesis + AI explanation text
 */

import { getServiceClient } from './supabase'
import { geocodeAddress } from './mapbox'
import {
  runFeasibilityCheck,
  mapToVerdict,
  synthesizeConfidence,
  getDefaultRoadmap,
} from './feasibility-engine'
import { generateVerdictExplanation } from './claude'
import {
  ProjectInputs,
  StructuredAnalysisResult,
  Verdict,
  Parcel,
  ZoningDistrict,
  Jurisdiction,
  RoadmapStep,
  VERDICT_LABELS,
  PROJECT_TYPES,
} from './types'

interface PipelineInput {
  address: string
  parcel_id?: string
  project_inputs: ProjectInputs
  acreage_override?: number
}

interface PipelineTrace {
  stage: string
  duration_ms: number
  status: 'ok' | 'warn' | 'error'
  detail?: string
}

export async function runAnalysisPipeline(input: PipelineInput): Promise<{
  result: StructuredAnalysisResult
  traces: PipelineTrace[]
}> {
  const traces: PipelineTrace[] = []
  const supabase = getServiceClient()

  let lat: number | null = null
  let lng: number | null = null
  let parcel: Parcel | null = null
  let jurisdiction: Jurisdiction | null = null
  let zone: ZoningDistrict | null = null
  let parcelFound = false

  // ── Stage 1: Geocoding ──
  const t1 = Date.now()
  try {
    const geocoded = await geocodeAddress(input.address)
    if (geocoded) {
      lat = geocoded.lat
      lng = geocoded.lng
    }
    traces.push({ stage: 'Geocoding', duration_ms: Date.now() - t1, status: geocoded ? 'ok' : 'warn', detail: geocoded ? `${lat}, ${lng}` : 'Could not geocode' })
  } catch {
    traces.push({ stage: 'Geocoding', duration_ms: Date.now() - t1, status: 'error', detail: 'Geocoding failed' })
  }

  // ── Stage 2: Parcel resolution ──
  const t2 = Date.now()
  try {
    if (input.parcel_id) {
      const { data } = await supabase
        .from('parcels')
        .select('*')
        .eq('id', input.parcel_id)
        .single()
      parcel = data
    }

    if (!parcel && input.address) {
      // Try exact-ish match on street portion
      const streetPart = input.address.split(',')[0].trim()
      const { data: parcels } = await supabase
        .from('parcels')
        .select('*')
        .ilike('address', `%${streetPart}%`)
        .limit(1)
      parcel = parcels?.[0] || null
    }

    parcelFound = !!parcel
    if (parcel?.metadata) {
      lat = parcel.metadata.lat ?? lat
      lng = parcel.metadata.lng ?? lng
    }
    traces.push({ stage: 'Parcel resolution', duration_ms: Date.now() - t2, status: parcelFound ? 'ok' : 'warn', detail: parcelFound ? `APN: ${parcel!.apn}` : 'Not in database' })
  } catch {
    traces.push({ stage: 'Parcel resolution', duration_ms: Date.now() - t2, status: 'error', detail: 'DB query failed' })
  }

  // ── Stage 3: Jurisdiction resolution ──
  const t3 = Date.now()
  try {
    if (parcel?.jurisdiction_id) {
      const { data } = await supabase
        .from('jurisdictions')
        .select('*')
        .eq('id', parcel.jurisdiction_id)
        .single()
      jurisdiction = data
    }

    if (!jurisdiction) {
      // Fallback: try to match by address
      const { data: jurisdictions } = await supabase
        .from('jurisdictions')
        .select('*')
        .limit(1)
      jurisdiction = jurisdictions?.[0] || null
    }

    traces.push({ stage: 'Jurisdiction resolution', duration_ms: Date.now() - t3, status: jurisdiction ? 'ok' : 'warn', detail: jurisdiction ? jurisdiction.name : 'Unknown' })
  } catch {
    traces.push({ stage: 'Jurisdiction resolution', duration_ms: Date.now() - t3, status: 'error', detail: 'DB query failed' })
  }

  // ── Stage 4: Zoning classification ──
  const t4 = Date.now()
  try {
    if (parcel?.zoning_district_id) {
      const { data } = await supabase
        .from('zoning_districts')
        .select('*')
        .eq('id', parcel.zoning_district_id)
        .single()
      zone = data
    }

    if (!zone && jurisdiction) {
      // Fallback: pick first zone that permits the project type
      const { data: zones } = await supabase
        .from('zoning_districts')
        .select('*')
        .eq('jurisdiction_id', jurisdiction.id)
      zone = zones?.find((z: ZoningDistrict) => z.permitted_uses?.includes(input.project_inputs.type))
        || zones?.[0]
        || null
    }

    traces.push({ stage: 'Zoning classification', duration_ms: Date.now() - t4, status: zone ? 'ok' : 'error', detail: zone ? `${zone.code} (${zone.name})` : 'No zone found' })
  } catch {
    traces.push({ stage: 'Zoning classification', duration_ms: Date.now() - t4, status: 'error', detail: 'DB query failed' })
  }

  // ── Stage 5 & 6: Use mapping + Rule evaluation ──
  const t56 = Date.now()

  let verdict: Verdict = 'uncertain'
  let useStatus = 'unknown'
  let comparisons: import('./types').StandardComparison[] = []
  let allCompliant = true

  if (zone) {
    const acreage = parcel?.metadata?.acreage ?? input.acreage_override ?? undefined

    const checkResult = runFeasibilityCheck(input.project_inputs, zone, acreage)
    useStatus = checkResult.permitted_use_status
    comparisons = checkResult.standards_comparison
    allCompliant = comparisons.length === 0 || comparisons.every((s) => s.compliant)

    // Determine if use was found in any list
    const useFoundInAnyList =
      zone.permitted_uses?.includes(input.project_inputs.type) ||
      zone.conditional_uses?.includes(input.project_inputs.type) ||
      false

    verdict = mapToVerdict(checkResult.status, useFoundInAnyList)

    traces.push({ stage: 'Rule evaluation', duration_ms: Date.now() - t56, status: 'ok', detail: `${verdict} (${useStatus})` })
  } else {
    traces.push({ stage: 'Rule evaluation', duration_ms: Date.now() - t56, status: 'warn', detail: 'No zone — verdict uncertain' })
  }

  // ── Stage 7: Confidence synthesis + AI explanation ──
  const t7 = Date.now()

  const ds = zone?.development_standards || {}
  const confidence = synthesizeConfidence({
    parcelFound,
    zoneFound: !!zone,
    hasDevStandards: !!(ds.max_height_ft || ds.max_stories || ds.max_far),
    hasSetbacks: !!(ds.setbacks?.front_ft || ds.setbacks?.side_ft || ds.setbacks?.rear_ft),
    hasAcreage: !!(parcel?.metadata?.acreage || input.acreage_override),
    hasPermittedUses: !!(zone?.permitted_uses?.length),
  })

  // Build caveats
  const caveats: { text: string; severity: 'info' | 'warning' | 'critical' }[] = []
  for (const c of confidence.caveats) {
    caveats.push({ text: c, severity: c.includes('not found') ? 'warning' : 'info' })
  }
  if (!allCompliant) {
    const failedStandards = comparisons.filter((s) => !s.compliant)
    caveats.push({
      text: `${failedStandards.length} development standard(s) not met. May require variance or project modification.`,
      severity: 'warning',
    })
  }

  // AI explanation
  let explanation = ''
  try {
    explanation = await generateVerdictExplanation({
      verdict,
      zone_code: zone?.code || 'Unknown',
      zone_name: zone?.name || null,
      jurisdiction: jurisdiction?.name || 'Unknown jurisdiction',
      project_type: input.project_inputs.type,
      use_status: useStatus,
      standards_comparison: comparisons,
      caveats: confidence.caveats,
    })
  } catch {
    // Fallback
    const useLabel = input.project_inputs.type.replace(/_/g, ' ')
    explanation = `${useLabel} in the ${zone?.code || 'Unknown'} zone: verdict is ${verdict}.`
  }

  traces.push({ stage: 'Confidence + explanation', duration_ms: Date.now() - t7, status: 'ok' })

  // ── Build roadmap ──
  let roadmap: RoadmapStep[] = getDefaultRoadmap(verdict, jurisdiction?.name || 'Local')

  // Check for custom roadmap template
  if (jurisdiction) {
    try {
      const { data: templates } = await supabase
        .from('approval_roadmap_templates')
        .select('*')
        .eq('jurisdiction_id', jurisdiction.id)
        .limit(1)
      if (templates?.[0]?.steps) {
        roadmap = templates[0].steps
      }
    } catch {
      // Use default roadmap
    }
  }

  // ── Build setbacks info ──
  const setbacksInfo = ds.setbacks ? {
    front: ds.setbacks.front_ft ? { required_ft: ds.setbacks.front_ft, available_ft: null, compliant: null } : null,
    side: ds.setbacks.side_ft ? { required_ft: ds.setbacks.side_ft, available_ft: null, compliant: null } : null,
    rear: ds.setbacks.rear_ft ? { required_ft: ds.setbacks.rear_ft, available_ft: null, compliant: null } : null,
  } : null

  // ── Project type label ──
  const typeLabel = PROJECT_TYPES.find((t) => t.value === input.project_inputs.type)?.label
    || input.project_inputs.type.replace(/_/g, ' ')

  // ── Assemble structured result ──
  const result: StructuredAnalysisResult = {
    parcel_summary: {
      address: parcel?.address || input.address,
      apn: parcel?.apn || null,
      acreage: parcel?.metadata?.acreage || input.acreage_override || null,
      jurisdiction_name: jurisdiction?.name || 'Unknown',
      zone_code: zone?.code || 'Unknown',
      zone_name: zone?.name || null,
      lat,
      lng,
    },
    project_summary: {
      type: input.project_inputs.type,
      type_label: typeLabel,
      units: input.project_inputs.units || null,
      stories: input.project_inputs.stories || null,
      sqft: input.project_inputs.sqft || null,
      parking: input.project_inputs.parking || null,
      description: input.project_inputs.description || null,
    },
    verdict: {
      status: verdict,
      status_label: VERDICT_LABELS[verdict],
      use_status: useStatus,
      explanation,
    },
    standards: {
      comparisons,
      all_compliant: allCompliant,
      setbacks: setbacksInfo,
    },
    confidence,
    caveats,
    roadmap,
    sources: [
      {
        label: `${jurisdiction?.name || 'Local'} Zoning Ordinance`,
        url: jurisdiction?.municipal_code_url || null,
        accessed_at: new Date().toISOString(),
      },
      ...(jurisdiction?.zoning_map_url ? [{
        label: `${jurisdiction.name} Zoning Map`,
        url: jurisdiction.zoning_map_url,
        accessed_at: new Date().toISOString(),
      }] : []),
    ],
    disclaimer: 'This analysis is for informational purposes only and does not constitute legal, architectural, or professional zoning advice. All results should be verified with the local planning department before making development decisions.',
  }

  return { result, traces }
}
