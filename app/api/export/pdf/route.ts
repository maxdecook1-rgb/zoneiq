import { NextRequest, NextResponse } from 'next/server'
import jsPDF from 'jspdf'
import autoTable from 'jspdf-autotable'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { result, address, zone, jurisdiction, project_inputs } = body

    const doc = new jsPDF()

    // Title
    doc.setFontSize(20)
    doc.setTextColor(30, 64, 175)
    doc.text('ZoneIQ Feasibility Report', 20, 25)

    // Subtitle
    doc.setFontSize(10)
    doc.setTextColor(107, 114, 128)
    doc.text(`Generated ${new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}`, 20, 33)

    // Divider
    doc.setDrawColor(229, 231, 235)
    doc.line(20, 37, 190, 37)

    // Property Info
    doc.setFontSize(12)
    doc.setTextColor(17, 24, 39)
    doc.text('Property Information', 20, 47)

    doc.setFontSize(10)
    doc.setTextColor(55, 65, 81)
    doc.text(`Address: ${address || 'N/A'}`, 20, 55)
    doc.text(`Zone: ${zone?.code || 'N/A'} (${zone?.name || 'N/A'})`, 20, 62)
    doc.text(`Jurisdiction: ${jurisdiction?.name || 'N/A'}, ${jurisdiction?.state || 'N/A'}`, 20, 69)

    // Project Details
    doc.text(`Project Type: ${project_inputs?.type?.replace('_', ' ') || 'N/A'}`, 20, 79)
    doc.text(`Units: ${project_inputs?.units || 'N/A'} | Stories: ${project_inputs?.stories || 'N/A'} | Sq Ft: ${project_inputs?.sqft || 'N/A'} | Parking: ${project_inputs?.parking || 'N/A'}`, 20, 86)

    // Status
    doc.setFontSize(14)
    const statusColor = result.status === 'permitted' ? [22, 163, 74] : result.status === 'conditional' ? [202, 138, 4] : [220, 38, 38]
    doc.setTextColor(statusColor[0], statusColor[1], statusColor[2])
    const statusText = result.status === 'permitted' ? 'PERMITTED AS-OF-RIGHT' : result.status === 'conditional' ? 'CONDITIONAL APPROVAL REQUIRED' : 'NOT PERMITTED'
    doc.text(statusText, 20, 100)

    doc.setFontSize(9)
    doc.setTextColor(107, 114, 128)
    doc.text(`Confidence: ${result.confidence}`, 20, 107)

    // Summary
    if (result.summary) {
      doc.setFontSize(10)
      doc.setTextColor(55, 65, 81)
      const summaryLines = doc.splitTextToSize(result.summary, 170)
      doc.text(summaryLines, 20, 117)
    }

    // Standards Table
    if (result.standards_comparison?.length > 0) {
      const startY = result.summary ? 117 + (doc.splitTextToSize(result.summary, 170).length * 5) + 10 : 117

      autoTable(doc, {
        startY,
        head: [['Standard', 'Proposed', 'Allowed', 'Status']],
        body: result.standards_comparison.map((s: { standard: string; proposed: string | number; allowed: string | number; compliant: boolean }) => [
          s.standard,
          String(s.proposed),
          String(s.allowed),
          s.compliant ? 'Compliant' : 'Non-Compliant',
        ]),
        theme: 'grid',
        headStyles: { fillColor: [30, 64, 175] },
        styles: { fontSize: 9 },
      })
    }

    // Roadmap
    if (result.roadmap_steps?.length > 0) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const finalY = (doc as any).lastAutoTable?.finalY || 170
      let y = finalY + 15

      if (y > 260) {
        doc.addPage()
        y = 20
      }

      doc.setFontSize(12)
      doc.setTextColor(17, 24, 39)
      doc.text('Approval Roadmap', 20, y)
      y += 10

      doc.setFontSize(9)
      for (const step of result.roadmap_steps) {
        if (y > 270) {
          doc.addPage()
          y = 20
        }

        doc.setTextColor(30, 64, 175)
        doc.text(`${step.order}. ${step.action}`, 20, y)
        y += 5

        doc.setTextColor(107, 114, 128)
        doc.text(`Agency: ${step.agency} | Est. ${step.estimated_days} days`, 25, y)
        y += 8
      }
    }

    // Disclaimer
    const pageCount = doc.getNumberOfPages()
    for (let i = 1; i <= pageCount; i++) {
      doc.setPage(i)
      doc.setFontSize(7)
      doc.setTextColor(156, 163, 175)
      doc.text(
        'This result is informational only and does not constitute legal or professional zoning advice.',
        105,
        290,
        { align: 'center' }
      )
    }

    const pdfBuffer = doc.output('arraybuffer')

    return new NextResponse(pdfBuffer, {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="ZoneIQ-Report-${Date.now()}.pdf"`,
      },
    })
  } catch (error) {
    console.error('PDF generation error:', error)
    return NextResponse.json({ error: 'Failed to generate PDF' }, { status: 500 })
  }
}
