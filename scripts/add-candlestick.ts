/**
 * Add 4555 Candlestick Lane parcel + PRD zone to Hall County
 * Run: npx tsx scripts/add-candlestick.ts
 */

import { createClient } from '@supabase/supabase-js'
import * as fs from 'fs'
import * as path from 'path'

const envPath = path.join(process.cwd(), '.env.local')
if (fs.existsSync(envPath)) {
  const envContent = fs.readFileSync(envPath, 'utf-8')
  for (const line of envContent.split('\n')) {
    const [key, ...valueParts] = line.split('=')
    if (key && valueParts.length) process.env[key.trim()] = valueParts.join('=').trim()
  }
}

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || '',
  process.env.SUPABASE_SERVICE_ROLE_KEY || ''
)

const HALL_COUNTY_ID = 'a1b2c3d4-0000-0000-0000-000000000001'

async function run() {
  console.log('Adding PRD zone + Candlestick Lane parcel...\n')

  // 1. Check if PRD zone exists
  const { data: existingPRD } = await supabase
    .from('zoning_districts')
    .select('id, code')
    .eq('jurisdiction_id', HALL_COUNTY_ID)
    .eq('code', 'PRD')
    .limit(1)

  let prdId: string

  if (existingPRD && existingPRD.length > 0) {
    prdId = existingPRD[0].id
    console.log('✅ PRD zone already exists:', prdId)
  } else {
    // Hall County PRD — Planned Residential Development
    // Allows a mix of housing types at higher density with flexible lot standards
    const { data: prd, error } = await supabase
      .from('zoning_districts')
      .insert({
        jurisdiction_id: HALL_COUNTY_ID,
        code: 'PRD',
        name: 'Planned Residential Development',
        category: 'residential',
        permitted_uses: ['single_family', 'duplex', 'townhome', 'multifamily'],
        conditional_uses: ['adu', 'mixed_use', 'commercial'],
        development_standards: {
          min_lot_sqft: 6000,
          max_height_ft: 40,
          max_stories: 3,
          max_far: 0.6,
          min_parking_spaces: 2,
          setbacks: { front_ft: 20, side_ft: 7.5, rear_ft: 20 },
        },
      })
      .select()
      .single()

    if (error) {
      console.error('❌ Failed to create PRD zone:', error.message)
      process.exit(1)
    }
    prdId = prd.id
    console.log('✅ PRD zone created:', prdId)
  }

  // 2. Also ensure R-3 zone has the right data (it should already exist)
  const { data: r3 } = await supabase
    .from('zoning_districts')
    .select('id')
    .eq('jurisdiction_id', HALL_COUNTY_ID)
    .eq('code', 'R-3')
    .single()

  if (r3) {
    console.log('✅ R-3 zone exists:', r3.id)
  } else {
    console.log('⚠️  R-3 zone not found — this is unexpected')
  }

  // 3. Check if Candlestick Lane parcel already exists
  const { data: existingParcel } = await supabase
    .from('parcels')
    .select('id')
    .ilike('address', '%candlestick%')
    .limit(1)

  if (existingParcel && existingParcel.length > 0) {
    // Update the zoning to PRD
    const { error: updateErr } = await supabase
      .from('parcels')
      .update({ zoning_district_id: prdId })
      .eq('id', existingParcel[0].id)

    if (updateErr) {
      console.error('❌ Failed to update parcel:', updateErr.message)
    } else {
      console.log('✅ Updated existing Candlestick parcel to PRD zone')
    }
  } else {
    // Insert the parcel — 4555 Candlestick Ln is in the Clarks Bridge area
    // of Hall County near Lake Lanier
    const { data: parcel, error } = await supabase
      .from('parcels')
      .insert({
        jurisdiction_id: HALL_COUNTY_ID,
        zoning_district_id: prdId,
        apn: '15-0042-0018',
        address: '4555 Candlestick Ln, Gainesville, GA 30506',
        metadata: {
          lat: 34.3345,
          lng: -83.8912,
          acreage: 0.45,
          lot_width_ft: 90,
          lot_depth_ft: 218,
        },
      })
      .select()
      .single()

    if (error) {
      console.error('❌ Failed to insert parcel:', error.message)
      process.exit(1)
    }
    console.log('✅ Candlestick Lane parcel created:', parcel.id)
  }

  console.log('\n✅ Done!')
}

run().catch((err) => {
  console.error('Failed:', err)
  process.exit(1)
})
