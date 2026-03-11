import Anthropic from '@anthropic-ai/sdk'

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY!,
})

const MODEL = 'claude-sonnet-4-20250514'

export async function parseDocument(base64Content: string, mimeType: string): Promise<{
  type: string | null
  units: number | null
  stories: number | null
  sqft: number | null
  parking: number | null
  address: string | null
}> {
  const isPdf = mimeType === 'application/pdf'

  const systemPrompt = 'You are a document parser for a zoning compliance platform. Extract the following fields from the uploaded building plan, permit application, or site diagram: project_type (single_family/multifamily/commercial/mixed_use/adu/industrial/other), units (number), stories (number), gross_sqft (number), parking_spaces (number), property_address (string if visible). Return only valid JSON with these keys. If a field is not found, return null for that field.'

  // Build the content block based on file type
  const fileContent = isPdf
    ? {
        type: 'document' as const,
        source: {
          type: 'base64' as const,
          media_type: 'application/pdf' as const,
          data: base64Content,
        },
      }
    : {
        type: 'image' as const,
        source: {
          type: 'base64' as const,
          media_type: mimeType as 'image/jpeg' | 'image/png' | 'image/gif' | 'image/webp',
          data: base64Content,
        },
      }

  const response = await anthropic.messages.create({
    model: MODEL,
    max_tokens: 1024,
    system: systemPrompt,
    messages: [
      {
        role: 'user',
        content: [
          fileContent,
          {
            type: 'text',
            text: 'Extract project details from this document. Return only JSON.',
          },
        ],
      },
    ],
  })

  const textContent = response.content.find((c) => c.type === 'text')
  if (!textContent || textContent.type !== 'text') {
    throw new Error('No text response from Claude')
  }

  try {
    const jsonStr = textContent.text.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim()
    const parsed = JSON.parse(jsonStr)
    return {
      type: parsed.project_type || null,
      units: parsed.units || null,
      stories: parsed.stories || null,
      sqft: parsed.gross_sqft || null,
      parking: parsed.parking_spaces || null,
      address: parsed.property_address || null,
    }
  } catch {
    throw new Error('Failed to parse Claude response as JSON')
  }
}

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
