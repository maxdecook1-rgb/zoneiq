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
  min_parking_per_1000sqft?: number
  max_density_units_per_acre?: number
  max_impervious_surface_pct?: number
  buffer_ft?: number
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
  lot_width_ft?: number | null
  lot_depth_ft?: number | null
  lot_shape?: string | null  // from GIS
}

export interface ProjectInputs {
  type: ProjectType
  units?: number
  stories?: number
  sqft?: number
  parking?: number
  description?: string  // user free-text description
}

export type ProjectType =
  | 'single_family'
  | 'duplex'
  | 'triplex'
  | 'quadplex'
  | 'townhome'
  | 'multifamily'
  | 'commercial'
  | 'industrial'
  | 'mixed_use'
  | 'adu'
  | 'other'

export interface BuildingClassification {
  type: ProjectType
  confidence: number  // 0-1
  units: number | null
  stories: number | null
  sqft: number | null
  parking: number | null
  building_footprint_sqft: number | null
  building_width_ft: number | null
  building_depth_ft: number | null
  description: string
}

export interface StandardComparison {
  standard: string
  proposed: number | string
  allowed: number | string
  compliant: boolean
  notes?: string
}

export interface RoadmapStep {
  order: number
  action: string
  agency: string
  estimated_days: number
  required_documents: string[]
  notes: string
}

export interface ZoningRecommendation {
  current_zone: string
  recommended_zone: string
  reason: string
  compliance_issues: string[]
  steps_to_comply: string[]
}

export interface FeasibilityResult {
  status: 'permitted' | 'conditional' | 'not_permitted'
  confidence: 'high' | 'medium' | 'low'
  permitted_use_status: string
  standards_comparison: StandardComparison[]
  roadmap_steps: RoadmapStep[]
  summary: string
  zoning_recommendation?: ZoningRecommendation
  required_zone_code?: string
}

export interface Project {
  id: string
  user_id: string
  name: string
  address: string | null
  parcel_id: string | null
  jurisdiction_id: string | null
  project_inputs: ProjectInputs
  result: FeasibilityResult | null
  uploaded_files: UploadedFile[]
  building_classification: BuildingClassification | null
  site_plan_url: string | null
  floor_plan_url: string | null
  rezoning_app_url: string | null
  tier: 'basic' | 'medium' | 'detailed'
  created_at: string
  updated_at: string
}

export interface UploadedFile {
  id: string
  name: string
  url: string
  type: string
  size: number
  uploaded_at: string
}

export interface SitePlanData {
  lot_width_ft: number
  lot_depth_ft: number
  lot_shape: 'rectangular' | 'irregular'
  lot_vertices?: { x: number; y: number }[]
  building_footprint: {
    width_ft: number
    depth_ft: number
    x_offset_ft: number
    y_offset_ft: number
  }
  setbacks: {
    front_ft: number
    rear_ft: number
    left_ft: number
    right_ft: number
  }
  driveway?: {
    width_ft: number
    position: 'left' | 'center' | 'right'
  }
  parking_spaces?: number
  parking_layout?: 'surface' | 'garage' | 'both'
  show_neighbors?: boolean
  tier: 'basic' | 'medium' | 'detailed'
}

export interface FloorPlanRoom {
  name: string
  width_ft: number
  height_ft: number
  x: number
  y: number
}

export interface FloorPlanData {
  width_ft: number
  depth_ft: number
  stories: number
  rooms: FloorPlanRoom[][]  // array per floor
  total_sqft: number
  description: string
}

export interface UserProfile {
  id: string
  email: string
  full_name: string | null
  company: string | null
  plan: 'free' | 'basic' | 'pro' | 'enterprise'
  credits: number
  created_at: string
}

export const PROJECT_TYPES = [
  { value: 'single_family', label: 'Single Family' },
  { value: 'duplex', label: 'Duplex' },
  { value: 'triplex', label: 'Triplex' },
  { value: 'quadplex', label: 'Quadplex' },
  { value: 'townhome', label: 'Townhome' },
  { value: 'multifamily', label: 'Multifamily' },
  { value: 'adu', label: 'ADU' },
  { value: 'commercial', label: 'Commercial' },
  { value: 'mixed_use', label: 'Mixed-Use' },
  { value: 'industrial', label: 'Industrial' },
] as const

export const TIER_PRICING = {
  basic: { name: 'Basic', price: 29, description: 'Zoning check + basic site plan' },
  medium: { name: 'Standard', price: 79, description: 'Full compliance report + detailed site plan' },
  detailed: { name: 'Professional', price: 199, description: 'Full plans + rezoning application' },
} as const
