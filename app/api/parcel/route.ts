import { NextRequest, NextResponse } from 'next/server'
import { getServiceClient } from '@/lib/supabase'
import { geocodeAddress } from '@/lib/mapbox'

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  const address = request.nextUrl.searchParams.get('address')

  if (!address) {
    return NextResponse.json({ error: 'Address is required' }, { status: 400 })
  }

  try {
    // 1. Geocode address via Mapbox
    const geocoded = await geocodeAddress(address)

    if (!geocoded) {
      return NextResponse.json({ error: 'Could not geocode address' }, { status: 404 })
    }

    const supabase = getServiceClient()

    // 2. Search parcels table for matching address
    const { data: parcels } = await supabase
      .from('parcels')
      .select('*, current_zone_id')
      .ilike('address', `%${address.split(',')[0]}%`)
      .limit(1)

    const parcel = parcels?.[0] || null

    if (parcel) {
      // Found parcel in DB — get zone and jurisdiction
      const { data: zone } = await supabase
        .from('zoning_districts')
        .select('*')
        .eq('id', parcel.current_zone_id)
        .single()

      const { data: jurisdiction } = await supabase
        .from('jurisdictions')
        .select('*')
        .eq('id', parcel.jurisdiction_id)
        .single()

      return NextResponse.json({
        parcel: { ...parcel, lat: geocoded.lat, lng: geocoded.lng },
        jurisdiction,
        zone,
        coverage_status: jurisdiction?.coverage_status || 'partial',
      })
    }

    // 3. Parcel not found — try to find jurisdiction by address context
    // For Phase 1, return geocoded location with limited data warning
    const { data: jurisdictions } = await supabase
      .from('jurisdictions')
      .select('*')
      .limit(1)

    const fallbackJurisdiction = jurisdictions?.[0] || null

    // Get first zone for the jurisdiction as a fallback
    let fallbackZone = null
    if (fallbackJurisdiction) {
      const { data: zones } = await supabase
        .from('zoning_districts')
        .select('*')
        .eq('jurisdiction_id', fallbackJurisdiction.id)
        .limit(1)

      fallbackZone = zones?.[0] || null
    }

    return NextResponse.json({
      parcel: {
        id: null,
        address: geocoded.address,
        lat: geocoded.lat,
        lng: geocoded.lng,
        acreage: null,
        jurisdiction_id: fallbackJurisdiction?.id || null,
        current_zone_id: fallbackZone?.id || null,
      },
      jurisdiction: fallbackJurisdiction,
      zone: fallbackZone,
      coverage_status: 'none',
      warning: 'This parcel was not found in our database. Results are based on limited data and may not be accurate.',
    })
  } catch (error) {
    console.error('Parcel lookup error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
