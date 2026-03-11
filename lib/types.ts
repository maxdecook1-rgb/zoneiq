export interface Jurisdiction {
  id: string
  name: string
  state: string
  coverage_status: 'full' | 'partial' | 'none'
  gis_source_url: string | null
  code_source_url: string | null
  last_updated: string | null
}

export interface ZoningDistrict {
  id: string
  jurisdiction_id: string
  code: string
  name: string | null
  description: string | null
  permitted_uses: string[]
  conditional_uses: string[]
  prohibited_uses: string[]
  dev_standards: DevStandards
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

export interface Parcel {
  id: string
  jurisdiction_id: string
  apn: string | null
  address: string
  lat: number | null
  lng: number | null
  acreage: number | null
  current_zone_id: string | null
  raw_data: Record<string, unknown> | null
}

export interface ProjectInputs {
  type: 'single_family' | 'multifamily' | 'commercial' | 'mixed_use' | 'adu' | 'industrial' | 'other'
  units?: number
  stories?: number
  sqft?: number
  parking?: number
}

export interface StandardComparison {
  standard: string
  proposed: number | string
  allowed: number | string
  compliant: boolean
}

export interface RoadmapStep {
  order: number
  action: string
  agency: string
  estimated_days: number
  required_documents: string[]
  notes: string
}

export interface FeasibilityResult {
  status: 'permitted' | 'conditional' | 'not_permitted'
  confidence: 'high' | 'medium' | 'low'
  permitted_use_status: string
  standards_comparison: StandardComparison[]
  roadmap_steps: RoadmapStep[]
  summary: string
}

export interface Project {
  id: string
  user_id: string
  address: string | null
  parcel_id: string | null
  jurisdiction_id: string | null
  project_inputs: ProjectInputs
  result: FeasibilityResult | null
  created_at: string
  updated_at: string
}

export const PROJECT_TYPES = [
  { value: 'single_family', label: 'Single Family' },
  { value: 'multifamily', label: 'Multifamily' },
  { value: 'adu', label: 'ADU' },
  { value: 'commercial', label: 'Commercial' },
  { value: 'mixed_use', label: 'Mixed-Use' },
  { value: 'industrial', label: 'Industrial' },
] as const
