// ─── DB-aligned types (match actual Supabase schema) ───

export interface Jurisdiction {
  id: string
  name: string
  state: string
  county?: string | null
  municipal_code_url?: string | null
  zoning_map_url?: string | null
  created_at?: string
}

export interface DevStandards {
  min_lot_sqft?: number
  max_height_ft?: number
  max_stories?: number
  max_far?: number
  max_lot_coverage_pct?: number
  min_parking_spaces?: number
  max_density_units_per_acre?: number
  max_impervious_surface_pct?: number
  buffer_ft?: number
  setbacks?: {
    front_ft?: number
    side_ft?: number
    rear_ft?: number
  }
}

export interface ZoningDistrict {
  id: string
  jurisdiction_id: string
  code: string
  name: string | null
  category: string | null
  permitted_uses: string[]
  conditional_uses: string[]
  development_standards: DevStandards
  created_at?: string
}

export interface ParcelMetadata {
  lat?: number
  lng?: number
  acreage?: number
  lot_width_ft?: number
  lot_depth_ft?: number
  lot_shape?: string
}

export interface Parcel {
  id: string
  jurisdiction_id: string
  zoning_district_id: string | null
  apn: string | null
  address: string
  metadata: ParcelMetadata | null
  created_at?: string
}

// ─── Project types ───

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

export interface ProjectInputs {
  type: ProjectType
  units?: number
  stories?: number
  sqft?: number
  parking?: number
  description?: string
}

export interface BuildingClassification {
  type: ProjectType
  confidence: number
  units: number | null
  stories: number | null
  sqft: number | null
  parking: number | null
  building_footprint_sqft: number | null
  building_width_ft: number | null
  building_depth_ft: number | null
  description: string
}

// ─── Feasibility result types ───

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

// ─── M1: Structured Analysis types ───

export type Verdict = 'allowed' | 'conditional' | 'prohibited' | 'uncertain'

export interface ConfidenceMetadata {
  score: number            // 0.0–1.0
  level: 'high' | 'medium' | 'low'
  factors: { name: string; present: boolean; weight: number }[]
  caveats: string[]
}

export interface StructuredAnalysisResult {
  parcel_summary: {
    address: string
    apn: string | null
    acreage: number | null
    jurisdiction_name: string
    zone_code: string
    zone_name: string | null
    lat: number | null
    lng: number | null
  }
  project_summary: {
    type: ProjectType
    type_label: string
    units: number | null
    stories: number | null
    sqft: number | null
    parking: number | null
    description: string | null
  }
  verdict: {
    status: Verdict
    status_label: string
    use_status: string
    explanation: string
  }
  standards: {
    comparisons: StandardComparison[]
    all_compliant: boolean
    setbacks: {
      front: { required_ft: number | null; available_ft: number | null; compliant: boolean | null } | null
      side: { required_ft: number | null; available_ft: number | null; compliant: boolean | null } | null
      rear: { required_ft: number | null; available_ft: number | null; compliant: boolean | null } | null
    } | null
  }
  confidence: ConfidenceMetadata
  caveats: { text: string; severity: 'info' | 'warning' | 'critical' }[]
  roadmap: RoadmapStep[]
  sources: { label: string; url: string | null; accessed_at: string }[]
  disclaimer: string
}

// ─── Project (DB-aligned) ───

export interface Project {
  id: string
  user_id: string
  address: string | null
  parcel_id: string | null
  jurisdiction_id: string | null
  project_inputs: ProjectInputs
  result: FeasibilityResult | StructuredAnalysisResult | null
  created_at: string
}

export interface UploadedFile {
  id: string
  name: string
  url: string
  type: string
  size: number
  uploaded_at: string
}

// ─── Site/Floor plan types ───

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
  rooms: FloorPlanRoom[][]
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

// ─── Application Assistant types ───

export type ApplicationType = 'building_permit' | 'conditional_use' | 'rezoning'

export interface ApplicationFormData {
  applicant_name: string
  applicant_email: string
  applicant_phone: string
  property_owner_name: string
  property_owner_is_applicant: boolean
  additional_notes: string
}

export interface GeneratedApplication {
  type: ApplicationType
  sections: { title: string; content: string }[]
  checklist: string[]
  generated_at: string
}

export interface CompatibleZone {
  zone_code: string
  zone_name: string | null
  use_status: 'permitted' | 'conditional'
  development_standards: DevStandards
}

// ─── Constants ───

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

export const VERDICT_LABELS: Record<Verdict, string> = {
  allowed: 'Allowed As-of-Right',
  conditional: 'Conditional Approval Required',
  prohibited: 'Not Permitted',
  uncertain: 'Insufficient Data',
}

export const TIER_PRICING = {
  basic: { name: 'Basic', price: 29, description: 'Zoning check + basic site plan' },
  medium: { name: 'Standard', price: 79, description: 'Full compliance report + detailed site plan' },
  detailed: { name: 'Professional', price: 199, description: 'Full plans + rezoning application' },
} as const
