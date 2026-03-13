import {
  ProjectInputs,
  ZoningDistrict,
  StandardComparison,
  RoadmapStep,
  Verdict,
  ConfidenceMetadata,
} from './types'

// ─── Core feasibility check (deterministic rule evaluation) ───

export function runFeasibilityCheck(
  projectInputs: ProjectInputs,
  zoningDistrict: ZoningDistrict,
  parcelAcreage?: number
): {
  status: 'permitted' | 'conditional' | 'not_permitted'
  permitted_use_status: string
  standards_comparison: StandardComparison[]
} {
  const { type, units, stories, sqft, parking } = projectInputs
  const { permitted_uses, conditional_uses, development_standards } = zoningDistrict
  const ds = development_standards || {}

  // 1. Determine use status
  let permitted_use_status = 'not_permitted'
  if (permitted_uses?.includes(type)) {
    permitted_use_status = 'permitted'
  } else if (conditional_uses?.includes(type)) {
    permitted_use_status = 'conditional'
  }

  // 2. Compare development standards
  const standards_comparison: StandardComparison[] = []

  if (stories && ds.max_stories) {
    standards_comparison.push({
      standard: 'Building Height (Stories)',
      proposed: stories,
      allowed: ds.max_stories,
      compliant: stories <= ds.max_stories,
    })
  }

  if (ds.max_height_ft) {
    const estimatedHeight = (stories || 1) * 11
    standards_comparison.push({
      standard: 'Building Height (Feet)',
      proposed: `~${estimatedHeight} ft (estimated)`,
      allowed: `${ds.max_height_ft} ft`,
      compliant: estimatedHeight <= ds.max_height_ft,
    })
  }

  if (sqft && ds.max_far && parcelAcreage) {
    const lotSqft = parcelAcreage * 43560
    const proposedFar = sqft / lotSqft
    standards_comparison.push({
      standard: 'Floor Area Ratio (FAR)',
      proposed: Number(proposedFar.toFixed(2)),
      allowed: ds.max_far,
      compliant: proposedFar <= ds.max_far,
    })
  } else if (sqft && ds.max_far) {
    standards_comparison.push({
      standard: 'Floor Area Ratio (FAR)',
      proposed: 'Lot size needed',
      allowed: ds.max_far,
      compliant: true,
    })
  }

  if (parking !== undefined && ds.min_parking_spaces && units) {
    const requiredParking = Math.ceil(units * ds.min_parking_spaces)
    standards_comparison.push({
      standard: 'Parking Spaces',
      proposed: parking,
      allowed: `${requiredParking} minimum`,
      compliant: parking >= requiredParking,
    })
  }

  if (ds.min_lot_sqft && parcelAcreage) {
    const lotSqft = parcelAcreage * 43560
    standards_comparison.push({
      standard: 'Minimum Lot Size',
      proposed: `${Math.round(lotSqft).toLocaleString()} sq ft`,
      allowed: `${ds.min_lot_sqft.toLocaleString()} sq ft`,
      compliant: lotSqft >= ds.min_lot_sqft,
    })
  }

  // Lot coverage check
  if (ds.max_lot_coverage_pct && sqft && parcelAcreage && stories) {
    const footprintSqft = sqft / (stories || 1)
    const lotSqft = parcelAcreage * 43560
    const coveragePct = (footprintSqft / lotSqft) * 100
    standards_comparison.push({
      standard: 'Lot Coverage',
      proposed: `${coveragePct.toFixed(1)}%`,
      allowed: `${ds.max_lot_coverage_pct}% max`,
      compliant: coveragePct <= ds.max_lot_coverage_pct,
    })
  }

  // 3. Setback comparisons (from nested setbacks object)
  if (ds.setbacks) {
    const setbacks = ds.setbacks
    if (setbacks.front_ft) {
      standards_comparison.push({
        standard: 'Front Setback',
        proposed: 'Per site plan',
        allowed: `${setbacks.front_ft} ft`,
        compliant: true, // Cannot verify without building placement data
        notes: 'Verify building placement meets setback requirement',
      })
    }
    if (setbacks.side_ft) {
      standards_comparison.push({
        standard: 'Side Setback',
        proposed: 'Per site plan',
        allowed: `${setbacks.side_ft} ft`,
        compliant: true,
        notes: 'Verify building placement meets setback requirement',
      })
    }
    if (setbacks.rear_ft) {
      standards_comparison.push({
        standard: 'Rear Setback',
        proposed: 'Per site plan',
        allowed: `${setbacks.rear_ft} ft`,
        compliant: true,
        notes: 'Verify building placement meets setback requirement',
      })
    }
  }

  // 4. Determine overall status
  const allStandardsMet = standards_comparison.length === 0 || standards_comparison.every((s) => s.compliant)
  let status: 'permitted' | 'conditional' | 'not_permitted' = 'not_permitted'

  if (permitted_use_status === 'permitted' && allStandardsMet) {
    status = 'permitted'
  } else if (permitted_use_status === 'conditional') {
    status = 'conditional'
  } else if (permitted_use_status === 'permitted' && !allStandardsMet) {
    status = 'conditional'
  }

  return { status, permitted_use_status, standards_comparison }
}

// ─── M1: Map 3-state + use status to 4-state Verdict ───

export function mapToVerdict(
  status: 'permitted' | 'conditional' | 'not_permitted',
  useFoundInAnyList: boolean
): Verdict {
  if (!useFoundInAnyList) return 'uncertain'
  if (status === 'permitted') return 'allowed'
  if (status === 'conditional') return 'conditional'
  return 'prohibited'
}

// ─── M1: Synthesize confidence score from factors ───

export function synthesizeConfidence(factors: {
  parcelFound: boolean
  zoneFound: boolean
  hasDevStandards: boolean
  hasSetbacks: boolean
  hasAcreage: boolean
  hasPermittedUses: boolean
}): ConfidenceMetadata {
  const weightedFactors = [
    { name: 'Parcel found in database', present: factors.parcelFound, weight: 0.3 },
    { name: 'Zoning district identified', present: factors.zoneFound, weight: 0.25 },
    { name: 'Development standards available', present: factors.hasDevStandards, weight: 0.2 },
    { name: 'Setback requirements available', present: factors.hasSetbacks, weight: 0.1 },
    { name: 'Lot size / acreage known', present: factors.hasAcreage, weight: 0.05 },
    { name: 'Permitted uses defined', present: factors.hasPermittedUses, weight: 0.1 },
  ]

  const score = weightedFactors.reduce((sum, f) => sum + (f.present ? f.weight : 0), 0)
  const level = score >= 0.75 ? 'high' : score >= 0.45 ? 'medium' : 'low'

  const caveats: string[] = []
  if (!factors.parcelFound) caveats.push('Parcel not found in database — results based on limited data.')
  if (!factors.zoneFound) caveats.push('Zoning district could not be determined.')
  if (!factors.hasDevStandards) caveats.push('Development standards not available for this zone.')
  if (!factors.hasAcreage) caveats.push('Lot size unknown — FAR and lot coverage checks skipped.')

  return {
    score: Math.round(score * 100) / 100,
    level,
    factors: weightedFactors,
    caveats,
  }
}

// ─── Confidence (legacy helper) ───

export function determineConfidence(
  parcelFound: boolean,
  hasFullDevStandards: boolean
): 'high' | 'medium' | 'low' {
  if (parcelFound && hasFullDevStandards) return 'high'
  if (parcelFound) return 'medium'
  return 'low'
}

// ─── Default roadmap ───

export function getDefaultRoadmap(
  status: string,
  jurisdictionName: string
): RoadmapStep[] {
  if (status === 'permitted' || status === 'allowed') {
    return [
      {
        order: 1,
        action: 'Submit building permit application',
        agency: `${jurisdictionName} Building Department`,
        estimated_days: 1,
        required_documents: ['Site plan', 'Building plans', 'Permit application form'],
        notes: 'As-of-right project — no zoning approval needed.',
      },
      {
        order: 2,
        action: 'Building permit review',
        agency: `${jurisdictionName} Building Department`,
        estimated_days: 30,
        required_documents: [],
        notes: 'Review period varies; expedited review may be available.',
      },
      {
        order: 3,
        action: 'Obtain building permit and begin construction',
        agency: `${jurisdictionName} Building Department`,
        estimated_days: 7,
        required_documents: ['Insurance certificates', 'Contractor licenses'],
        notes: '',
      },
    ]
  }

  if (status === 'conditional') {
    return [
      {
        order: 1,
        action: 'Pre-application meeting with planning staff',
        agency: `${jurisdictionName} Planning Department`,
        estimated_days: 14,
        required_documents: ['Preliminary site plan', 'Project description'],
        notes: 'Recommended before formal application.',
      },
      {
        order: 2,
        action: 'Submit conditional use permit application',
        agency: `${jurisdictionName} Planning Department`,
        estimated_days: 1,
        required_documents: [
          'Conditional use permit application',
          'Site plan',
          'Traffic study (if required)',
          'Environmental review',
        ],
        notes: 'Application fees vary by jurisdiction.',
      },
      {
        order: 3,
        action: 'Planning commission review and public hearing',
        agency: `${jurisdictionName} Planning Commission`,
        estimated_days: 60,
        required_documents: [],
        notes: 'Public notice required. Neighbors may comment.',
      },
      {
        order: 4,
        action: 'Obtain conditional use approval and submit building permit',
        agency: `${jurisdictionName} Building Department`,
        estimated_days: 30,
        required_documents: ['Approved conditional use permit', 'Building plans', 'Permit application'],
        notes: 'Conditions of approval must be incorporated into building plans.',
      },
    ]
  }

  // not_permitted / prohibited
  return [
    {
      order: 1,
      action: 'Consult with a zoning attorney or land use consultant',
      agency: 'Private Professional',
      estimated_days: 7,
      required_documents: [],
      notes: 'Discuss options: rezoning, variance, or alternative project design.',
    },
    {
      order: 2,
      action: 'Submit rezoning or variance application (if pursued)',
      agency: `${jurisdictionName} Planning Department`,
      estimated_days: 1,
      required_documents: [
        'Rezoning/variance application',
        'Justification letter',
        'Site plan',
        'Community impact statement',
      ],
      notes: 'Rezoning typically requires a more extensive review process.',
    },
    {
      order: 3,
      action: 'Public hearings (planning commission + city/county council)',
      agency: `${jurisdictionName} Planning Commission / Board of Commissioners`,
      estimated_days: 120,
      required_documents: [],
      notes: 'Multiple public hearings required. Process can take 4-6 months.',
    },
  ]
}
