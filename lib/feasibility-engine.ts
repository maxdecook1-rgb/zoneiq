export interface ProjectInputs {
  type: 'single_family' | 'multifamily' | 'commercial' | 'mixed_use' | 'adu' | 'industrial' | 'other'
  units?: number
  stories?: number
  sqft?: number
  parking?: number
}

export interface DevStandards {
  min_lot_size_sqft?: number
  max_height_ft?: number
  max_stories?: number
  front_setback_ft?: number
  side_setback_ft?: number
  rear_setback_ft?: number
  max_lot_coverage_pct?: number
  max_far?: number
  min_parking_per_unit?: number
}

export interface ZoningDistrict {
  id: string
  code: string
  name: string | null
  description: string | null
  permitted_uses: string[]
  conditional_uses: string[]
  prohibited_uses: string[]
  dev_standards: DevStandards
}

export interface StandardComparison {
  standard: string
  proposed: number | string
  allowed: number | string
  compliant: boolean
}

export interface FeasibilityResult {
  status: 'permitted' | 'conditional' | 'not_permitted'
  confidence: 'high' | 'medium' | 'low'
  permitted_use_status: string
  standards_comparison: StandardComparison[]
  roadmap_steps: RoadmapStep[]
  summary: string
}

export interface RoadmapStep {
  order: number
  action: string
  agency: string
  estimated_days: number
  required_documents: string[]
  notes: string
}

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
  const { permitted_uses, conditional_uses, dev_standards } = zoningDistrict

  // 1. Determine use status
  let permitted_use_status = 'not_permitted'
  if (permitted_uses?.includes(type)) {
    permitted_use_status = 'permitted'
  } else if (conditional_uses?.includes(type)) {
    permitted_use_status = 'conditional'
  }

  // 2. Compare development standards
  const standards_comparison: StandardComparison[] = []

  if (stories && dev_standards?.max_stories) {
    standards_comparison.push({
      standard: 'Building Height (Stories)',
      proposed: stories,
      allowed: dev_standards.max_stories,
      compliant: stories <= dev_standards.max_stories,
    })
  }

  if (dev_standards?.max_height_ft) {
    // Rough estimate: ~10-12 ft per story
    const estimatedHeight = (stories || 1) * 11
    standards_comparison.push({
      standard: 'Building Height (Feet)',
      proposed: `~${estimatedHeight} ft (estimated)`,
      allowed: `${dev_standards.max_height_ft} ft`,
      compliant: estimatedHeight <= dev_standards.max_height_ft,
    })
  }

  if (sqft && dev_standards?.max_far && parcelAcreage) {
    const lotSqft = parcelAcreage * 43560
    const proposedFar = sqft / lotSqft
    standards_comparison.push({
      standard: 'Floor Area Ratio (FAR)',
      proposed: Number(proposedFar.toFixed(2)),
      allowed: dev_standards.max_far,
      compliant: proposedFar <= dev_standards.max_far,
    })
  } else if (sqft && dev_standards?.max_far) {
    standards_comparison.push({
      standard: 'Floor Area Ratio (FAR)',
      proposed: 'Lot size needed',
      allowed: dev_standards.max_far,
      compliant: true, // Cannot determine without lot size
    })
  }

  if (parking !== undefined && dev_standards?.min_parking_per_unit && units) {
    const required_parking = Math.ceil(units * dev_standards.min_parking_per_unit)
    standards_comparison.push({
      standard: 'Parking Spaces',
      proposed: parking,
      allowed: `${required_parking} minimum`,
      compliant: parking >= required_parking,
    })
  }

  if (dev_standards?.min_lot_size_sqft && parcelAcreage) {
    const lotSqft = parcelAcreage * 43560
    standards_comparison.push({
      standard: 'Minimum Lot Size',
      proposed: `${Math.round(lotSqft).toLocaleString()} sq ft`,
      allowed: `${dev_standards.min_lot_size_sqft.toLocaleString()} sq ft`,
      compliant: lotSqft >= dev_standards.min_lot_size_sqft,
    })
  }

  // 3. Determine overall status
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

export function determineConfidence(
  parcelFound: boolean,
  hasFullDevStandards: boolean
): 'high' | 'medium' | 'low' {
  if (parcelFound && hasFullDevStandards) return 'high'
  if (parcelFound) return 'medium'
  return 'low'
}

export function getDefaultRoadmap(
  status: string,
  jurisdictionName: string
): RoadmapStep[] {
  if (status === 'permitted') {
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

  // not_permitted
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
