import { NextRequest, NextResponse } from 'next/server'
import { generatePermitApplication, generateRezoningApplication } from '@/lib/claude'
import { ApplicationFormData } from '@/lib/types'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const {
      application_type,
      address,
      zone_code,
      zone_name,
      requested_zone,
      jurisdiction,
      project_type,
      project_type_label,
      units,
      stories,
      sqft,
      applicant_info,
    } = body as {
      application_type: 'building_permit' | 'conditional_use' | 'rezoning'
      address: string
      zone_code: string
      zone_name: string | null
      requested_zone?: string
      jurisdiction: string
      project_type: string
      project_type_label: string
      units: number | null
      stories: number | null
      sqft: number | null
      applicant_info: ApplicationFormData
    }

    if (!application_type || !address || !zone_code || !jurisdiction) {
      return NextResponse.json(
        { error: 'application_type, address, zone_code, and jurisdiction are required' },
        { status: 400 }
      )
    }

    if (!applicant_info?.applicant_name || !applicant_info?.applicant_email) {
      return NextResponse.json(
        { error: 'Applicant name and email are required' },
        { status: 400 }
      )
    }

    if (application_type === 'rezoning') {
      if (!requested_zone) {
        return NextResponse.json(
          { error: 'requested_zone is required for rezoning applications' },
          { status: 400 }
        )
      }

      const projectDescription = `${project_type_label}${units ? `, ${units} units` : ''}${stories ? `, ${stories} stories` : ''}${sqft ? `, ${sqft.toLocaleString()} sq ft` : ''}`

      const rezoningResult = await generateRezoningApplication(
        address,
        zone_code,
        requested_zone,
        projectDescription,
        jurisdiction,
        {
          type: project_type,
          units,
          stories,
          sqft,
          applicant_name: applicant_info.applicant_name,
          applicant_email: applicant_info.applicant_email,
        }
      )

      // Convert the rezoning result into the standard sections format
      const sections = [
        { title: 'Applicant Justification', content: rezoningResult.applicant_justification },
        { title: 'Project Narrative', content: rezoningResult.project_narrative },
        { title: 'Community Impact', content: rezoningResult.community_impact },
        { title: 'Compatibility Statement', content: rezoningResult.compatibility_statement },
        { title: 'Comprehensive Plan Consistency', content: rezoningResult.comprehensive_plan_consistency },
        { title: 'Traffic Impact Summary', content: rezoningResult.traffic_impact_summary },
        { title: 'Environmental Considerations', content: rezoningResult.environmental_considerations },
        { title: 'Public Benefit Statement', content: rezoningResult.public_benefit_statement },
      ]

      const checklist = [
        'Completed rezoning application form',
        'Rezoning justification letter',
        'Site plan (to scale)',
        'Legal description of property',
        'Community impact statement',
        'Traffic impact analysis',
        'Environmental review (if applicable)',
        'Property survey',
        'Application fee',
        'Proof of ownership or authorization',
        'Notification to adjacent property owners',
      ]

      return NextResponse.json({ sections, checklist })
    }

    // Building permit or conditional use
    const result = await generatePermitApplication({
      application_type,
      address,
      zone_code,
      zone_name,
      jurisdiction,
      project_type,
      project_type_label,
      units,
      stories,
      sqft,
      applicant_info,
    })

    return NextResponse.json(result)
  } catch (error) {
    console.error('Generate application error:', error)
    const message = error instanceof Error ? error.message : 'Unknown error'

    if (message.includes('credit balance') || message.includes('billing') || message.includes('insufficient')) {
      return NextResponse.json(
        { error: 'AI application generation is temporarily unavailable (billing issue). Please try again later.' },
        { status: 402 }
      )
    }

    return NextResponse.json(
      { error: `Application generation failed: ${message.substring(0, 200)}` },
      { status: 500 }
    )
  }
}
