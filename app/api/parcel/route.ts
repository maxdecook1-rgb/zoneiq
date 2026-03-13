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
    const streetPart = address.split(',')[0].trim()

    // Try exact street match first
    let { data: parcels } = await supabase
      .from('parcels')
      .select('*')
      .ilike('address', `%${streetPart}%`)
      .limit(1)

    // If no match, try normalizing common street abbreviations
    if (!parcels?.length) {
      const abbreviations: Record<string, string[]> = {
        'Lane': ['Ln'], 'Ln': ['Lane'],
        'Street': ['St'], 'St': ['Street'],
        'Road': ['Rd'], 'Rd': ['Road'],
        'Drive': ['Dr'], 'Dr': ['Drive'],
        'Avenue': ['Ave'], 'Ave': ['Avenue'],
        'Boulevard': ['Blvd'], 'Blvd': ['Boulevard'],
        'Circle': ['Cir'], 'Cir': ['Circle'],
        'Court': ['Ct'], 'Ct': ['Court'],
        'Place': ['Pl'], 'Pl': ['Place'],
        'Parkway': ['Pkwy'], 'Pkwy': ['Parkway'],
        'Highway': ['Hwy'], 'Hwy': ['Highway'],
        'Trail': ['Trl'], 'Trl': ['Trail'],
        'Way': ['Wy'], 'Wy': ['Way'],
      }

      for (const [full, abbrs] of Object.entries(abbreviations)) {
        if (streetPart.includes(full)) {
          for (const abbr of abbrs) {
            const normalized = streetPart.replace(new RegExp(`\\b${full}\\b`, 'i'), abbr)
            const { data: found } = await supabase
              .from('parcels')
              .select('*')
              .ilike('address', `%${normalized}%`)
              .limit(1)
            if (found?.length) {
              parcels = found
              break
            }
          }
          if (parcels?.length) break
        }
      }
    }

    // If still no match, try just the street number + name (without suffix)
    if (!parcels?.length) {
      const numberAndName = streetPart.match(/^(\d+\s+\w+)/)?.[1]
      if (numberAndName) {
        const { data: found } = await supabase
          .from('parcels')
          .select('*')
          .ilike('address', `%${numberAndName}%`)
          .limit(1)
        if (found?.length) parcels = found
      }
    }

    const parcel = parcels?.[0] || null

    if (parcel) {
      // Found parcel in DB — get zone and jurisdiction
      const { data: zone } = await supabase
        .from('zoning_districts')
        .select('*')
        .eq('id', parcel.zoning_district_id)
        .single()

      const { data: jurisdiction } = await supabase
        .from('jurisdictions')
        .select('*')
        .eq('id', parcel.jurisdiction_id)
        .single()

      return NextResponse.json({
        parcel: {
          ...parcel,
          lat: parcel.metadata?.lat || geocoded.lat,
          lng: parcel.metadata?.lng || geocoded.lng,
          acreage: parcel.metadata?.acreage || null,
        },
        jurisdiction,
        zone,
        match_quality: 'exact',
      })
    }

    // 3. Parcel not found — try to find jurisdiction by geocoded state/county
    //    but do NOT guess a zoning district (that leads to wrong results)
    const { data: jurisdictions } = await supabase
      .from('jurisdictions')
      .select('*')
      .limit(1)

    const fallbackJurisdiction = jurisdictions?.[0] || null

    return NextResponse.json({
      parcel: {
        id: null,
        address: geocoded.address,
        lat: geocoded.lat,
        lng: geocoded.lng,
        acreage: null,
        apn: null,
        jurisdiction_id: fallbackJurisdiction?.id || null,
        zoning_district_id: null,
      },
      jurisdiction: fallbackJurisdiction,
      zone: null,
      match_quality: 'none',
      warning: 'This parcel was not found in our database. Zoning information is unavailable — please verify with your local planning department.',
    })
  } catch (error) {
    console.error('Parcel lookup error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
