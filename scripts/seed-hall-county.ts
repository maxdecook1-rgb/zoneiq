/**
 * Seed script for Hall County, GA zoning data
 * Run: npx tsx scripts/seed-hall-county.ts
 *
 * Adds parcels to the existing Hall County jurisdiction and zones.
 * Also adds AR and I-1 zones if missing.
 * Idempotent: checks before inserting.
 */

import { createClient } from '@supabase/supabase-js'
import * as fs from 'fs'
import * as path from 'path'

// Load .env.local
const envPath = path.join(process.cwd(), '.env.local')
if (fs.existsSync(envPath)) {
  const envContent = fs.readFileSync(envPath, 'utf-8')
  for (const line of envContent.split('\n')) {
    const [key, ...valueParts] = line.split('=')
    if (key && valueParts.length) process.env[key.trim()] = valueParts.join('=').trim()
  }
}

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

if (!supabaseUrl || !supabaseKey) {
  console.error('Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY')
  process.exit(1)
}

const supabase = createClient(supabaseUrl, supabaseKey)

const HALL_COUNTY_ID = 'a1b2c3d4-0000-0000-0000-000000000001'

async function seed() {
  console.log('🌱 Seeding Hall County, GA — parcels + additional zones...\n')

  // ── Verify jurisdiction exists ──
  const { data: jur } = await supabase
    .from('jurisdictions')
    .select('id')
    .eq('id', HALL_COUNTY_ID)
    .single()

  if (!jur) {
    console.error('❌ Hall County jurisdiction not found.')
    process.exit(1)
  }
  console.log('✅ Hall County jurisdiction found: ' + jur.id)

  // ── Get existing zones ──
  const { data: existingZones } = await supabase
    .from('zoning_districts')
    .select('id, code')
    .eq('jurisdiction_id', HALL_COUNTY_ID)

  const zoneMap: Record<string, string> = {}
  for (const z of existingZones || []) {
    zoneMap[z.code] = z.id
  }
  console.log('   Existing zones:', Object.keys(zoneMap).join(', '))

  // ── Add AR zone if missing ──
  if (!zoneMap['AR']) {
    console.log('\n🏗️  Adding AR (Agricultural Residential) zone...')
    const { data: ar, error } = await supabase
      .from('zoning_districts')
      .insert({
        jurisdiction_id: HALL_COUNTY_ID,
        code: 'AR',
        name: 'Agricultural Residential',
        category: 'residential',
        permitted_uses: ['single_family'],
        conditional_uses: ['adu', 'duplex'],
        development_standards: {
          min_lot_sqft: 43560,
          max_height_ft: 35,
          max_stories: 2,
          max_far: 0.25,
          min_parking_spaces: 2,
          setbacks: { front_ft: 50, side_ft: 15, rear_ft: 40 },
        },
      })
      .select()
      .single()

    if (error) {
      console.error('   ❌ Failed:', error.message)
    } else {
      zoneMap['AR'] = ar.id
      console.log('   ✅ AR zone created: ' + ar.id)
    }
  }

  // ── Add I-1 zone if missing ──
  if (!zoneMap['I-1']) {
    console.log('🏗️  Adding I-1 (Light Industrial) zone...')
    const { data: i1, error } = await supabase
      .from('zoning_districts')
      .insert({
        jurisdiction_id: HALL_COUNTY_ID,
        code: 'I-1',
        name: 'Light Industrial',
        category: 'industrial',
        permitted_uses: ['industrial', 'commercial'],
        conditional_uses: ['mixed_use'],
        development_standards: {
          min_lot_sqft: 43560,
          max_height_ft: 50,
          max_stories: 3,
          max_far: 0.6,
          min_parking_spaces: 3,
          setbacks: { front_ft: 50, side_ft: 20, rear_ft: 30 },
        },
      })
      .select()
      .single()

    if (error) {
      console.error('   ❌ Failed:', error.message)
    } else {
      zoneMap['I-1'] = i1.id
      console.log('   ✅ I-1 zone created: ' + i1.id)
    }
  }

  console.log('\n   Zone map:', zoneMap)

  // ── Check if parcels already exist ──
  const { data: existingParcels } = await supabase
    .from('parcels')
    .select('id')
    .eq('jurisdiction_id', HALL_COUNTY_ID)
    .limit(1)

  if (existingParcels && existingParcels.length > 0) {
    console.log('\n⚠️  Parcels already exist for Hall County. Skipping parcel seed.')
    return
  }

  // ── Insert parcels ──
  // Actual schema: id, address, jurisdiction_id, zoning_district_id, apn, metadata, created_at
  // lat/lng, acreage, lot dimensions go into metadata JSONB
  console.log('\n📦 Inserting 10 parcels...')

  const parcels = [
    {
      jurisdiction_id: HALL_COUNTY_ID,
      zoning_district_id: zoneMap['AR'],
      apn: '08-0001-0001',
      address: '2875 Tumbling Creek Rd, Gainesville, GA 30504',
      metadata: { lat: 34.2671, lng: -83.8401, acreage: 2.5, lot_width_ft: 250, lot_depth_ft: 435 },
    },
    {
      jurisdiction_id: HALL_COUNTY_ID,
      zoning_district_id: zoneMap['R-1'],
      apn: '08-0023-0012',
      address: '1234 Thompson Bridge Rd, Gainesville, GA 30501',
      metadata: { lat: 34.3105, lng: -83.8356, acreage: 0.5, lot_width_ft: 100, lot_depth_ft: 218 },
    },
    {
      jurisdiction_id: HALL_COUNTY_ID,
      zoning_district_id: zoneMap['R-1'],
      apn: '08-0045-0003',
      address: '456 Green St, Gainesville, GA 30501',
      metadata: { lat: 34.2979, lng: -83.8241, acreage: 0.35, lot_width_ft: 80, lot_depth_ft: 190 },
    },
    {
      jurisdiction_id: HALL_COUNTY_ID,
      zoning_district_id: zoneMap['C-1'],
      apn: '08-0067-0008',
      address: '789 Jesse Jewell Pkwy, Gainesville, GA 30501',
      metadata: { lat: 34.2903, lng: -83.8279, acreage: 0.8, lot_width_ft: 150, lot_depth_ft: 232 },
    },
    {
      jurisdiction_id: HALL_COUNTY_ID,
      zoning_district_id: zoneMap['C-1'],
      apn: '08-0089-0015',
      address: '321 Browns Bridge Rd, Gainesville, GA 30501',
      metadata: { lat: 34.3042, lng: -83.8512, acreage: 1.2, lot_width_ft: 180, lot_depth_ft: 290 },
    },
    {
      jurisdiction_id: HALL_COUNTY_ID,
      zoning_district_id: zoneMap['R-3'],
      apn: '08-0102-0022',
      address: '100 Memorial Park Dr, Gainesville, GA 30504',
      metadata: { lat: 34.2752, lng: -83.8143, acreage: 3.0, lot_width_ft: 300, lot_depth_ft: 435 },
    },
    {
      jurisdiction_id: HALL_COUNTY_ID,
      zoning_district_id: zoneMap['I-1'],
      apn: '08-0134-0007',
      address: '555 Athens Hwy, Gainesville, GA 30507',
      metadata: { lat: 34.2589, lng: -83.7945, acreage: 5.0, lot_width_ft: 400, lot_depth_ft: 544 },
    },
    {
      jurisdiction_id: HALL_COUNTY_ID,
      zoning_district_id: zoneMap['C-1'],
      apn: '08-0056-0019',
      address: '200 Main St, Gainesville, GA 30501',
      metadata: { lat: 34.2965, lng: -83.8236, acreage: 0.25, lot_width_ft: 60, lot_depth_ft: 181 },
    },
    {
      jurisdiction_id: HALL_COUNTY_ID,
      zoning_district_id: zoneMap['R-3'],
      apn: '08-0078-0031',
      address: '1500 Dawsonville Hwy, Gainesville, GA 30501',
      metadata: { lat: 34.3167, lng: -83.8601, acreage: 1.5, lot_width_ft: 200, lot_depth_ft: 327 },
    },
    {
      jurisdiction_id: HALL_COUNTY_ID,
      zoning_district_id: zoneMap['R-1'],
      apn: '08-0091-0004',
      address: '800 McEver Rd, Gainesville, GA 30504',
      metadata: { lat: 34.2834, lng: -83.8467, acreage: 0.45, lot_width_ft: 90, lot_depth_ft: 218 },
    },
  ]

  const { data: inserted, error: parcelError } = await supabase
    .from('parcels')
    .insert(parcels)
    .select()

  if (parcelError) {
    console.error('❌ Failed to insert parcels:', parcelError.message)
    process.exit(1)
  }

  for (const p of inserted!) {
    const zoneCode = Object.entries(zoneMap).find(([, id]) => id === p.zoning_district_id)?.[0] || '?'
    console.log(`   ✅ ${p.address} (${zoneCode})`)
  }

  console.log('\n' + '═'.repeat(50))
  console.log('✅ Seed complete! ' + inserted!.length + ' parcels inserted.')
  console.log('═'.repeat(50))
}

seed().catch((err) => {
  console.error('Seed failed:', err)
  process.exit(1)
})
