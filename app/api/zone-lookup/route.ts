import { NextRequest, NextResponse } from 'next/server'
import { getServiceClient } from '@/lib/supabase'
import Anthropic from '@anthropic-ai/sdk'

export const dynamic = 'force-dynamic'
export const maxDuration = 30

/**
 * POST /api/zone-lookup
 *
 * Given a zone code (e.g. "R-3", "PRD", "C-2") and optionally a jurisdiction,
 * returns zone details. First checks the DB, then uses AI to identify the zone
 * if it's not in our database, and creates a new record for future lookups.
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { zone_code, jurisdiction_id, jurisdiction_name, state } = body as {
      zone_code: string
      jurisdiction_id?: string
      jurisdiction_name?: string
      state?: string
    }

    if (!zone_code) {
      return NextResponse.json({ error: 'zone_code is required' }, { status: 400 })
    }

    const normalizedCode = zone_code.trim().toUpperCase()
    const supabase = getServiceClient()

    // 1. Check if zone already exists in our DB for this jurisdiction
    if (jurisdiction_id) {
      const { data: existing } = await supabase
        .from('zoning_districts')
        .select('*')
        .eq('jurisdiction_id', jurisdiction_id)
        .ilike('code', normalizedCode)
        .limit(1)

      if (existing?.length) {
        return NextResponse.json({ zone: existing[0], source: 'database' })
      }
    }

    // 2. Not in DB — use AI to identify what this zone code means
    const anthropic = new Anthropic()
    const jurisdictionContext = jurisdiction_name
      ? `${jurisdiction_name}, ${state || 'GA'}`
      : state || 'Georgia'

    const aiResponse = await anthropic.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 1024,
      system: `You are a zoning expert. When given a zoning district code and jurisdiction, identify what it means and provide details. Respond ONLY with valid JSON matching this exact schema:
{
  "code": "the zone code",
  "name": "full name of the zoning district",
  "category": "residential" | "commercial" | "industrial" | "agricultural" | "mixed_use" | "special",
  "permitted_uses": ["array", "of", "use_types"],
  "conditional_uses": ["array", "of", "use_types"],
  "development_standards": {
    "min_lot_sqft": number_or_null,
    "max_height_ft": number_or_null,
    "max_stories": number_or_null,
    "max_far": number_or_null,
    "min_parking_spaces": number_or_null,
    "setbacks": {
      "front_ft": number_or_null,
      "side_ft": number_or_null,
      "rear_ft": number_or_null
    }
  }
}

For use types, use these exact values: single_family, duplex, townhome, multifamily, apartment, adu, commercial, retail, office, industrial, mixed_use, home_occupation, institutional, recreational

For development standards, use typical values for this zone type in this jurisdiction or similar jurisdictions in the area. If you're unsure about exact numbers, use reasonable typical values for the zone type.`,
      messages: [
        {
          role: 'user',
          content: `What is zoning district "${normalizedCode}" in ${jurisdictionContext}? Provide the full details as JSON.`,
        },
      ],
    })

    // Parse AI response
    const responseText = aiResponse.content
      .filter((b) => b.type === 'text')
      .map((b) => {
        if (b.type === 'text') return b.text
        return ''
      })
      .join('')

    // Extract JSON from response (handle markdown code blocks)
    const jsonMatch = responseText.match(/\{[\s\S]*\}/)
    if (!jsonMatch) {
      return NextResponse.json(
        { error: 'Could not identify zone code. Please check the code and try again.' },
        { status: 404 }
      )
    }

    const zoneData = JSON.parse(jsonMatch[0])

    // 3. Save to DB for future lookups (if we have a jurisdiction)
    if (jurisdiction_id) {
      const { data: saved, error: saveError } = await supabase
        .from('zoning_districts')
        .insert({
          jurisdiction_id,
          code: normalizedCode,
          name: zoneData.name || null,
          category: zoneData.category || 'residential',
          permitted_uses: zoneData.permitted_uses || [],
          conditional_uses: zoneData.conditional_uses || [],
          development_standards: zoneData.development_standards || {},
        })
        .select()
        .single()

      if (saveError) {
        console.error('Failed to save zone:', saveError.message)
        // Return the AI data even if save fails
        return NextResponse.json({
          zone: {
            id: null,
            jurisdiction_id,
            code: normalizedCode,
            name: zoneData.name,
            category: zoneData.category,
            permitted_uses: zoneData.permitted_uses,
            conditional_uses: zoneData.conditional_uses,
            development_standards: zoneData.development_standards,
          },
          source: 'ai',
        })
      }

      return NextResponse.json({ zone: saved, source: 'ai_saved' })
    }

    // No jurisdiction — just return the AI data
    return NextResponse.json({
      zone: {
        id: null,
        code: normalizedCode,
        name: zoneData.name,
        category: zoneData.category,
        permitted_uses: zoneData.permitted_uses,
        conditional_uses: zoneData.conditional_uses,
        development_standards: zoneData.development_standards,
      },
      source: 'ai',
    })
  } catch (error) {
    console.error('Zone lookup error:', error)
    const message = error instanceof Error ? error.message : 'Unknown error'

    if (message.includes('credit balance') || message.includes('billing')) {
      return NextResponse.json(
        { error: 'AI zone lookup is temporarily unavailable. Please try again later.' },
        { status: 402 }
      )
    }

    return NextResponse.json(
      { error: `Zone lookup failed: ${message.substring(0, 200)}` },
      { status: 500 }
    )
  }
}
