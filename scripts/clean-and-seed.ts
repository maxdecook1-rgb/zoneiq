import { createClient } from '@supabase/supabase-js'
import * as fs from 'fs'
import * as path from 'path'

const envPath = path.join(process.cwd(), '.env.local')
const envContent = fs.readFileSync(envPath, 'utf-8')
for (const line of envContent.split('\n')) {
  const [key, ...valueParts] = line.split('=')
  if (key && valueParts.length) process.env[key.trim()] = valueParts.join('=').trim()
}

const s = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)

const HALL_COUNTY_ID = 'a1b2c3d4-0000-0000-0000-000000000001'

async function run() {
  // Delete test parcel
  const { error: delErr } = await s.from('parcels').delete().eq('address', 'TEST_DELETE_ME')
  if (delErr) console.log('Delete error:', delErr.message)
  else console.log('Deleted test parcel')

  const { error: delErr2 } = await s.from('parcels').delete().eq('address', 'TEST_SCHEMA_CHECK')
  if (!delErr2) console.log('Deleted schema check parcel')

  // Get zone map
  const { data: zones } = await s.from('zoning_districts').select('id, code').eq('jurisdiction_id', HALL_COUNTY_ID)
  const zoneMap: Record<string, string> = {}
  for (const z of zones || []) zoneMap[z.code] = z.id
  console.log('Zone map:', zoneMap)

  // Insert parcels
  const parcels = [
    { jurisdiction_id: HALL_COUNTY_ID, zoning_district_id: zoneMap['AR'], apn: '08-0001-0001', address: '2875 Tumbling Creek Rd, Gainesville, GA 30504', metadata: { lat: 34.2671, lng: -83.8401, acreage: 2.5, lot_width_ft: 250, lot_depth_ft: 435 } },
    { jurisdiction_id: HALL_COUNTY_ID, zoning_district_id: zoneMap['R-1'], apn: '08-0023-0012', address: '1234 Thompson Bridge Rd, Gainesville, GA 30501', metadata: { lat: 34.3105, lng: -83.8356, acreage: 0.5, lot_width_ft: 100, lot_depth_ft: 218 } },
    { jurisdiction_id: HALL_COUNTY_ID, zoning_district_id: zoneMap['R-1'], apn: '08-0045-0003', address: '456 Green St, Gainesville, GA 30501', metadata: { lat: 34.2979, lng: -83.8241, acreage: 0.35, lot_width_ft: 80, lot_depth_ft: 190 } },
    { jurisdiction_id: HALL_COUNTY_ID, zoning_district_id: zoneMap['C-1'], apn: '08-0067-0008', address: '789 Jesse Jewell Pkwy, Gainesville, GA 30501', metadata: { lat: 34.2903, lng: -83.8279, acreage: 0.8, lot_width_ft: 150, lot_depth_ft: 232 } },
    { jurisdiction_id: HALL_COUNTY_ID, zoning_district_id: zoneMap['C-1'], apn: '08-0089-0015', address: '321 Browns Bridge Rd, Gainesville, GA 30501', metadata: { lat: 34.3042, lng: -83.8512, acreage: 1.2, lot_width_ft: 180, lot_depth_ft: 290 } },
    { jurisdiction_id: HALL_COUNTY_ID, zoning_district_id: zoneMap['R-3'], apn: '08-0102-0022', address: '100 Memorial Park Dr, Gainesville, GA 30504', metadata: { lat: 34.2752, lng: -83.8143, acreage: 3.0, lot_width_ft: 300, lot_depth_ft: 435 } },
    { jurisdiction_id: HALL_COUNTY_ID, zoning_district_id: zoneMap['I-1'], apn: '08-0134-0007', address: '555 Athens Hwy, Gainesville, GA 30507', metadata: { lat: 34.2589, lng: -83.7945, acreage: 5.0, lot_width_ft: 400, lot_depth_ft: 544 } },
    { jurisdiction_id: HALL_COUNTY_ID, zoning_district_id: zoneMap['C-1'], apn: '08-0056-0019', address: '200 Main St, Gainesville, GA 30501', metadata: { lat: 34.2965, lng: -83.8236, acreage: 0.25, lot_width_ft: 60, lot_depth_ft: 181 } },
    { jurisdiction_id: HALL_COUNTY_ID, zoning_district_id: zoneMap['R-3'], apn: '08-0078-0031', address: '1500 Dawsonville Hwy, Gainesville, GA 30501', metadata: { lat: 34.3167, lng: -83.8601, acreage: 1.5, lot_width_ft: 200, lot_depth_ft: 327 } },
    { jurisdiction_id: HALL_COUNTY_ID, zoning_district_id: zoneMap['R-1'], apn: '08-0091-0004', address: '800 McEver Rd, Gainesville, GA 30504', metadata: { lat: 34.2834, lng: -83.8467, acreage: 0.45, lot_width_ft: 90, lot_depth_ft: 218 } },
  ]

  const { data: inserted, error } = await s.from('parcels').insert(parcels).select()
  if (error) {
    console.error('❌ Insert error:', error.message)
    process.exit(1)
  }

  console.log(`\n✅ Inserted ${inserted!.length} parcels:`)
  for (const p of inserted!) {
    const zone = Object.entries(zoneMap).find(([, id]) => id === p.zoning_district_id)?.[0] || '?'
    console.log(`   ${p.address} (${zone})`)
  }
}

run().catch(console.error)
