import Anthropic from '@anthropic-ai/sdk'
import { Verdict, StandardComparison } from './types'

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY!,
})

const MODEL = 'claude-sonnet-4-20250514'

// ─── M1: Generate a plain-language explanation for a zoning verdict ───
export async function generateVerdictExplanation(context: {
  verdict: Verdict
  zone_code: string
  zone_name: string | null
  jurisdiction: string
  project_type: string
  use_status: string
  standards_comparison: StandardComparison[]
  caveats: string[]
}): Promise<string> {
  try {
    const response = await anthropic.messages.create({
      model: MODEL,
      max_tokens: 512,
      system: `You explain zoning verdicts in plain language. The verdict has already been determined by a rules engine — you are only explaining WHY. Write 2-3 sentences. Be direct and factual. Do not say "our analysis" or "our AI" or "we found". Speak as a factual reference: "This property is zoned...", "The proposed use is...", etc.`,
      messages: [
        {
          role: 'user',
          content: `Explain this zoning verdict:

Verdict: ${context.verdict}
Zone: ${context.zone_code} (${context.zone_name || 'Unknown'})
Jurisdiction: ${context.jurisdiction}
Proposed use: ${context.project_type.replace(/_/g, ' ')}
Use status: ${context.use_status}
Standards met: ${context.standards_comparison.every((s) => s.compliant) ? 'Yes, all' : 'No, some failed'}
${context.standards_comparison.filter((s) => !s.compliant).map((s) => `  - ${s.standard}: proposed ${s.proposed}, allowed ${s.allowed}`).join('\n')}
${context.caveats.length > 0 ? `Caveats: ${context.caveats.join('; ')}` : ''}`,
        },
      ],
    })

    const textContent = response.content.find((c) => c.type === 'text')
    if (!textContent || textContent.type !== 'text') {
      throw new Error('No text response from Claude')
    }
    return textContent.text
  } catch {
    // Fallback: generate a simple explanation without AI
    const useLabel = context.project_type.replace(/_/g, ' ')
    if (context.verdict === 'allowed') {
      return `${useLabel} is a permitted use in the ${context.zone_code} zone in ${context.jurisdiction}. All applicable development standards are met.`
    }
    if (context.verdict === 'conditional') {
      return `${useLabel} may require conditional approval in the ${context.zone_code} zone in ${context.jurisdiction}. Some standards may need review or special permitting.`
    }
    if (context.verdict === 'prohibited') {
      return `${useLabel} is not a permitted or conditional use in the ${context.zone_code} zone in ${context.jurisdiction}. A rezoning or variance would be required.`
    }
    return `Insufficient data to determine whether ${useLabel} is permitted in this location. Additional parcel and zoning information is needed.`
  }
}

// Enhanced document parsing - accepts ALL file types, classifies building type
export async function parseDocument(base64Content: string, mimeType: string): Promise<{
  type: string | null
  units: number | null
  stories: number | null
  sqft: number | null
  parking: number | null
  address: string | null
  building_footprint_sqft: number | null
  building_width_ft: number | null
  building_depth_ft: number | null
  confidence: number
  description: string
}> {
  const isPdf = mimeType === 'application/pdf'
  const isImage = mimeType.startsWith('image/')

  const systemPrompt = `You are an expert building plan analyzer for a zoning compliance platform. You analyze floor plans, site plans, architectural drawings, and building documents.

Extract the following from the uploaded document:
- project_type: Classify as one of: single_family, duplex, triplex, quadplex, townhome, multifamily, commercial, industrial, mixed_use, adu, other
- units: Number of dwelling/commercial units
- stories: Number of floors/stories
- gross_sqft: Total square footage
- parking_spaces: Number of parking spaces shown
- property_address: If visible on the document
- building_footprint_sqft: Ground floor area in sq ft
- building_width_ft: Building width in feet
- building_depth_ft: Building depth in feet
- confidence: Your confidence level 0.0-1.0
- description: Brief 1-2 sentence description of what you see

Classification guide:
- Single Family: One dwelling unit, detached
- Duplex: Two dwelling units in one structure
- Triplex: Three dwelling units
- Quadplex: Four dwelling units
- Townhome: Attached units with individual entrances
- Multifamily: 5+ units (apartments, condos)
- Commercial: Retail, office, restaurant
- Industrial: Warehouse, manufacturing, distribution
- Mixed-Use: Combination of residential and commercial
- ADU: Accessory dwelling unit / granny flat

Return ONLY valid JSON with these keys. If a field cannot be determined, return null.`

  // Build the content block for the file
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let fileContent: any
  if (isPdf) {
    fileContent = {
      type: 'document',
      source: {
        type: 'base64',
        media_type: 'application/pdf',
        data: base64Content,
      },
    }
  } else if (isImage) {
    // Only these four image types are supported by Claude vision
    let supportedMime = mimeType
    if (!['image/jpeg', 'image/png', 'image/gif', 'image/webp'].includes(mimeType)) {
      // Default to JPEG for unsupported image types (tiff, bmp, etc.)
      supportedMime = 'image/jpeg'
    }
    fileContent = {
      type: 'image',
      source: {
        type: 'base64',
        media_type: supportedMime,
        data: base64Content,
      },
    }
  } else {
    // For non-image/non-pdf files, treat as text document
    const textContent = Buffer.from(base64Content, 'base64').toString('utf-8')
    fileContent = {
      type: 'text',
      text: `Document content:\n${textContent.substring(0, 50000)}`,
    }
  }

  console.log(`[parseDocument] Sending to Claude: type=${fileContent.type}, mime=${fileContent.source?.media_type || 'text'}, base64_length=${base64Content.length}`)

  let response
  try {
    response = await anthropic.messages.create({
      model: MODEL,
      max_tokens: 2048,
      system: systemPrompt,
      messages: [
        {
          role: 'user',
          content: [
            fileContent,
            {
              type: 'text',
              text: 'Analyze this building plan/document. Classify the building type and extract all details. Return only JSON.',
            },
          ],
        },
      ],
    })
  } catch (apiError) {
    const msg = apiError instanceof Error ? apiError.message : String(apiError)
    console.error('[parseDocument] Claude API error:', msg)
    throw new Error(`AI analysis failed: ${msg}`)
  }

  const textResp = response.content.find((c) => c.type === 'text')
  if (!textResp || textResp.type !== 'text') {
    console.error('[parseDocument] No text in Claude response:', JSON.stringify(response.content).substring(0, 500))
    throw new Error('No text response from Claude')
  }

  console.log(`[parseDocument] Claude raw response: ${textResp.text.substring(0, 300)}`)

  try {
    const jsonStr = textResp.text.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim()
    const parsed = JSON.parse(jsonStr)
    return {
      type: parsed.project_type || null,
      units: parsed.units || null,
      stories: parsed.stories || null,
      sqft: parsed.gross_sqft || null,
      parking: parsed.parking_spaces || null,
      address: parsed.property_address || null,
      building_footprint_sqft: parsed.building_footprint_sqft || null,
      building_width_ft: parsed.building_width_ft || null,
      building_depth_ft: parsed.building_depth_ft || null,
      confidence: parsed.confidence || 0.5,
      description: parsed.description || '',
    }
  } catch {
    console.error('[parseDocument] Failed to parse JSON from response:', textResp.text.substring(0, 500))
    throw new Error('Failed to parse AI response')
  }
}

// Generate feasibility summary
export async function generateSummary(feasibilityResult: Record<string, unknown>): Promise<string> {
  const response = await anthropic.messages.create({
    model: MODEL,
    max_tokens: 512,
    system: 'You are a zoning compliance assistant. Given this feasibility result JSON, write a 3-4 sentence plain-language summary for a real estate developer. Be direct. State the verdict first, then the key reason, then the most important next step if action is required. Do not use jargon.',
    messages: [
      {
        role: 'user',
        content: JSON.stringify(feasibilityResult),
      },
    ],
  })

  const textContent = response.content.find((c) => c.type === 'text')
  if (!textContent || textContent.type !== 'text') {
    throw new Error('No text response from Claude')
  }

  return textContent.text
}

// Look up zoning codes for any US address using AI knowledge
export async function lookupZoningCodes(address: string, jurisdiction?: string): Promise<{
  zone_code: string
  zone_name: string
  jurisdiction: string
  state: string
  permitted_uses: string[]
  conditional_uses: string[]
  dev_standards: Record<string, unknown>
  setbacks: { front_ft: number; side_ft: number; rear_ft: number }
  max_height_ft: number
  max_stories: number
  max_lot_coverage_pct: number
  min_lot_size_sqft: number
  parking_requirements: string
  density_limit: string
  notes: string
  source_url: string
  confidence: number
}> {
  const response = await anthropic.messages.create({
    model: MODEL,
    max_tokens: 4096,
    system: `You are a zoning code expert with deep knowledge of US municipal zoning ordinances. Given a property address, provide the most likely zoning classification and all associated development standards.

You must return accurate, real zoning data based on your knowledge of US zoning codes. If you're not sure about the specific parcel's zoning, provide the most common residential or commercial zone for that area.

Return ONLY valid JSON with these fields:
- zone_code: The zoning district code (e.g., "R-1", "C-2", "M-1")
- zone_name: Full name (e.g., "Single-Family Residential")
- jurisdiction: City or county name
- state: State abbreviation
- permitted_uses: Array of permitted use types ["single_family", "duplex", etc.]
- conditional_uses: Array of conditional/special use types
- dev_standards: Object with all known development standards
- setbacks: { front_ft, side_ft, rear_ft }
- max_height_ft: Maximum building height in feet
- max_stories: Maximum number of stories
- max_lot_coverage_pct: Maximum lot coverage percentage
- min_lot_size_sqft: Minimum lot size in square feet
- parking_requirements: Description of parking requirements
- density_limit: Description of density limits (e.g., "4 units per acre")
- notes: Any important notes about this zone
- source_url: URL to the jurisdiction's zoning code if known
- confidence: 0.0-1.0 how confident you are in this data`,
    messages: [
      {
        role: 'user',
        content: `Look up the zoning codes and development standards for this property:\n\nAddress: ${address}${jurisdiction ? `\nJurisdiction: ${jurisdiction}` : ''}\n\nProvide all zoning restrictions including setbacks, height limits, lot coverage, parking requirements, and permitted uses.`,
      },
    ],
  })

  const textContent = response.content.find((c) => c.type === 'text')
  if (!textContent || textContent.type !== 'text') {
    throw new Error('No text response from Claude')
  }

  const jsonStr = textContent.text.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim()
  return JSON.parse(jsonStr)
}

// Generate zoning compatibility analysis
export async function analyzeZoningCompatibility(
  buildingInfo: Record<string, unknown>,
  zoningInfo: Record<string, unknown>,
  address: string
): Promise<{
  compatible: boolean
  issues: string[]
  required_zone: string | null
  required_zone_name: string | null
  steps_to_comply: string[]
  variance_possible: boolean
  variance_requirements: string[]
  rezoning_required: boolean
  rezoning_difficulty: 'easy' | 'moderate' | 'difficult'
  estimated_timeline_days: number
  summary: string
}> {
  const response = await anthropic.messages.create({
    model: MODEL,
    max_tokens: 4096,
    system: `You are a zoning compliance expert. Analyze whether a proposed building is compatible with the current zoning at a given address. If it's not compatible, recommend the correct zoning district and explain exactly what needs to happen.

Return ONLY valid JSON with:
- compatible: boolean - is the building allowed?
- issues: string[] - list of specific compliance issues
- required_zone: string | null - zone code needed if rezoning required
- required_zone_name: string | null - full name of required zone
- steps_to_comply: string[] - ordered list of steps to become compliant
- variance_possible: boolean - could a variance solve this?
- variance_requirements: string[] - what the variance would need
- rezoning_required: boolean
- rezoning_difficulty: "easy" | "moderate" | "difficult"
- estimated_timeline_days: number - estimated total process time
- summary: string - 3-4 sentence plain language summary`,
    messages: [
      {
        role: 'user',
        content: `Analyze zoning compatibility:\n\nAddress: ${address}\n\nProposed Building:\n${JSON.stringify(buildingInfo, null, 2)}\n\nCurrent Zoning:\n${JSON.stringify(zoningInfo, null, 2)}`,
      },
    ],
  })

  const textContent = response.content.find((c) => c.type === 'text')
  if (!textContent || textContent.type !== 'text') {
    throw new Error('No text response from Claude')
  }

  const jsonStr = textContent.text.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim()
  return JSON.parse(jsonStr)
}

// Generate rezoning application content
export async function generateRezoningApplication(
  address: string,
  currentZone: string,
  requestedZone: string,
  projectDescription: string,
  jurisdiction: string,
  buildingInfo: Record<string, unknown>
): Promise<{
  applicant_justification: string
  project_narrative: string
  community_impact: string
  compatibility_statement: string
  comprehensive_plan_consistency: string
  traffic_impact_summary: string
  environmental_considerations: string
  public_benefit_statement: string
}> {
  const response = await anthropic.messages.create({
    model: MODEL,
    max_tokens: 8192,
    system: `You are an expert land use attorney and planning consultant. Generate professional rezoning application content that would be suitable for submission to a municipal planning department.

Write in a professional, persuasive tone that addresses common planning concerns. The content should be thorough but concise.

Return ONLY valid JSON with:
- applicant_justification: 2-3 paragraph justification for the rezoning
- project_narrative: Detailed project description
- community_impact: Analysis of community impact
- compatibility_statement: How the project is compatible with surrounding uses
- comprehensive_plan_consistency: How it aligns with the comprehensive plan
- traffic_impact_summary: Brief traffic impact assessment
- environmental_considerations: Environmental impact notes
- public_benefit_statement: Benefits to the community`,
    messages: [
      {
        role: 'user',
        content: `Generate rezoning application content for:\n\nAddress: ${address}\nJurisdiction: ${jurisdiction}\nCurrent Zoning: ${currentZone}\nRequested Zoning: ${requestedZone}\nProject: ${projectDescription}\n\nBuilding Details:\n${JSON.stringify(buildingInfo, null, 2)}`,
      },
    ],
  })

  const textContent = response.content.find((c) => c.type === 'text')
  if (!textContent || textContent.type !== 'text') {
    throw new Error('No text response from Claude')
  }

  const jsonStr = textContent.text.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim()
  return JSON.parse(jsonStr)
}

// Generate site plan layout
export async function generateSitePlanLayout(
  lotInfo: Record<string, unknown>,
  buildingInfo: Record<string, unknown>,
  zoningInfo: Record<string, unknown>,
  tier: 'basic' | 'medium' | 'detailed'
): Promise<{
  building_placement: { x_ft: number; y_ft: number; width_ft: number; depth_ft: number; rotation_deg: number }
  driveway: { start_x: number; start_y: number; end_x: number; end_y: number; width_ft: number } | null
  parking_areas: { x_ft: number; y_ft: number; width_ft: number; depth_ft: number; spaces: number }[]
  setback_lines: { front_ft: number; rear_ft: number; left_ft: number; right_ft: number }
  landscaping_areas: { x_ft: number; y_ft: number; width_ft: number; depth_ft: number; type: string }[]
  utility_connections: { type: string; from_x: number; from_y: number; to_x: number; to_y: number }[]
  notes: string[]
  total_lot_coverage_pct: number
  total_impervious_pct: number
}> {
  const response = await anthropic.messages.create({
    model: MODEL,
    max_tokens: 4096,
    system: `You are a site planning expert. Given lot dimensions, building specifications, and zoning requirements, generate an optimal site plan layout.

Place the building to comply with all setbacks. Add driveway access, parking, and landscaping as appropriate. All coordinates are in feet from the lot's bottom-left corner (0,0). The lot extends right (x) and up (y).

Tier levels:
- basic: Building footprint, setback lines, driveway, parking count
- medium: Add landscaping buffers, utility connection points, stormwater area
- detailed: Add grading notes, detailed utility routing, retention areas, sidewalks

Return ONLY valid JSON.`,
    messages: [
      {
        role: 'user',
        content: `Generate a ${tier} site plan layout:\n\nLot: ${JSON.stringify(lotInfo)}\nBuilding: ${JSON.stringify(buildingInfo)}\nZoning: ${JSON.stringify(zoningInfo)}`,
      },
    ],
  })

  const textContent = response.content.find((c) => c.type === 'text')
  if (!textContent || textContent.type !== 'text') {
    throw new Error('No text response from Claude')
  }

  const jsonStr = textContent.text.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim()
  return JSON.parse(jsonStr)
}

// Generate floor plan from description
export async function generateFloorPlan(
  description: string,
  constraints: {
    max_sqft?: number
    max_width_ft?: number
    max_depth_ft?: number
    stories?: number
    type?: string
  }
): Promise<{
  stories: number
  total_sqft: number
  width_ft: number
  depth_ft: number
  floors: {
    floor: number
    rooms: {
      name: string
      width_ft: number
      height_ft: number
      x_ft: number
      y_ft: number
      type: string
    }[]
    walls: { x1: number; y1: number; x2: number; y2: number }[]
    doors: { x: number; y: number; width_ft: number; rotation: number }[]
  }[]
  description: string
}> {
  const response = await anthropic.messages.create({
    model: MODEL,
    max_tokens: 8192,
    system: `You are an expert residential and commercial architect. Generate a floor plan layout from a description.

Rules:
- All rooms must be rectangular and non-overlapping
- Coordinates are in feet from bottom-left corner (0,0)
- Include standard rooms: bedrooms, bathrooms, kitchen, living room, etc.
- Hallways should be 3-4 ft wide
- Doors are 3 ft wide (standard) or 6 ft (double)
- Rooms should have realistic proportions
- Total area should approximately match the described square footage
- Include walls as line segments

Return ONLY valid JSON with the structure described.`,
    messages: [
      {
        role: 'user',
        content: `Generate a floor plan:\n\nDescription: ${description}\n\nConstraints: ${JSON.stringify(constraints)}`,
      },
    ],
  })

  const textContent = response.content.find((c) => c.type === 'text')
  if (!textContent || textContent.type !== 'text') {
    throw new Error('No text response from Claude')
  }

  const jsonStr = textContent.text.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim()
  return JSON.parse(jsonStr)
}
