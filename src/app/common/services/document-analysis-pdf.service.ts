import { Injectable } from '@angular/core'
import { PDFDocument, PDFFont, PDFPage, StandardFonts, rgb } from 'pdf-lib'
import { DocumentAnalysisRecord, DocumentAnalysisSource, DocumentInspectionResult } from './document-analysis.service'

const PAGE_WIDTH = 612
const PAGE_HEIGHT = 792
const MARGIN = 48
const CONTENT_WIDTH = PAGE_WIDTH - (MARGIN * 2)

@Injectable({ providedIn: 'root' })
export class DocumentAnalysisPdfService {
    async create(record: DocumentAnalysisRecord): Promise<Uint8Array> {
        if (!record.result) {
            throw new Error('A completed document analysis is required to create the PDF.')
        }
        const pdf = await PDFDocument.create()
        const regular = await pdf.embedFont(StandardFonts.Helvetica)
        const bold = await pdf.embedFont(StandardFonts.HelveticaBold)
        const writer = new AnalysisPdfWriter(pdf, regular, bold)
        const result = record.result

        writer.title('Document Findings')
        writer.keyValue('Source document', record.sourceFilename)
        writer.keyValue('Analysis ID', record.id)
        writer.keyValue('Status', record.status)
        writer.keyValue('Analyzed', record.completedAt || record.requestedAt)
        writer.keyValue('Model', record.model || 'Not recorded')

        writer.chapter('1. Overview')
        writer.keyValue('Title', result.document.title)
        writer.keyValue('Document type', result.document.documentType)
        writer.keyValue('Discipline', result.document.discipline)
        writer.keyValue('Document number', result.document.documentNumber)
        writer.keyValue('Revision', result.document.revision)
        writer.keyValue('Document date', result.document.documentDate)
        writer.keyValue('Issuing organization', result.document.issuingOrganization)
        writer.subheading('Executive Summary')
        writer.paragraph(result.executiveSummary || result.document.summary || 'No summary was returned.')

        writer.chapter(`2. Proposed Floorplans (${result.proposedFloorplanActions?.length || 0})`)
        for (const action of result.proposedFloorplanActions || []) {
            writer.subheading(action.name || `PDF page ${action.pageNumber}`)
            writer.keyValue('Page', action.pageNumber)
            writer.keyValue('Status', action.floorplanMatch?.status || 'PROPOSED')
            writer.keyValue('Confidence', this.confidence(action.confidence))
            writer.keyValue('Evidence', action.evidenceType)
            writer.paragraph(action.rationale)
            writer.keyValue('Source', this.source(action.source))
            writer.keyValue('Located symbols', action.symbolPlacements.length)
            for (const placement of action.symbolPlacements) {
                writer.bullet(`${placement.deviceType || 'Device'}${placement.symbolLabel ? ` [${placement.symbolLabel}]` : ''}; ${this.confidence(placement.confidence)}; position ${(placement.xRatio * 100).toFixed(1)}%, ${(placement.yRatio * 100).toFixed(1)}%; ${this.source(placement.source)}`)
            }
        }
        writer.emptyMessage(result.proposedFloorplanActions?.length || 0, 'No proposed floorplans.')

        writer.chapter(`3. Proposed BOM Actions (${result.proposedBomActions?.length || 0})`)
        for (const action of result.proposedBomActions || []) {
            writer.subheading(action.deviceType || action.description || 'Unidentified device')
            writer.keyValue('Document equipment', [action.manufacturer, action.modelNumber, action.partNumber].filter(Boolean).join(' / ') || 'Not identified')
            writer.keyValue('Symbol', action.symbolLabel || 'Not identified')
            writer.keyValue('Evidence / confidence', `${action.evidenceType}; ${this.confidence(action.confidence)}`)
            writer.keyValue('Quantities', `Schedule ${action.scheduleQuantityFound ? action.scheduleQuantity : 'not found'}; drawing ${action.drawingQuantityFound ? action.drawingQuantity : 'not counted'}; proposed ${action.reconciledQuantity}; placement target ${action.floorplanPlacementTarget}`)
            writer.keyValue('Quantity status', action.quantityStatus)
            writer.paragraph(action.quantityRationale)
            writer.keyValue('Catalog match', `${action.catalogMatch.status}; ${action.catalogMatch.entityType}; ${action.catalogMatch.deviceName || action.catalogMatch.partNumber || 'No item'}; vendor ${action.catalogMatch.vendorName || 'not identified'}; ${this.confidence(action.catalogMatch.confidence)}`)
            writer.paragraph(`Match basis: ${action.catalogMatch.rationale}`)
            if (action.projectBomMatch) {
                writer.keyValue('Project BOM', `${action.projectBomMatch.status}; section ${action.projectBomMatch.bomSectionTitle || 'not identified'}; quantity ${action.projectBomMatch.quantity}`)
                writer.paragraph(action.projectBomMatch.rationale)
            }
            if (action.scheduleQuantityFound) writer.keyValue('Schedule source', this.source(action.scheduleSource))
            if (action.drawingQuantityFound || action.floorplanSymbolFound) writer.keyValue('Drawing source', this.source(action.drawingSource))
        }
        writer.emptyMessage(result.proposedBomActions?.length || 0, 'No proposed BOM actions.')

        writer.chapter(`4. Proposed Project Actions (${result.proposedActions?.length || 0})`)
        for (const action of result.proposedActions || []) {
            writer.subheading(action.fieldLabel)
            writer.keyValue('Current', action.currentValue || 'Empty')
            writer.keyValue('Proposed', action.proposedValue)
            writer.keyValue('Evidence / confidence', `${action.evidenceType}; ${this.confidence(action.confidence)}`)
            writer.paragraph(action.rationale)
            writer.keyValue('Source', this.source(action.source))
        }
        writer.emptyMessage(result.proposedActions?.length || 0, 'No proposed project actions.')

        writer.chapter('5. Findings')
        for (const section of this.findingSections(result)) {
            if (!section.findings.length) continue
            writer.subheading(`${section.label} (${section.findings.length})`)
            for (const finding of section.findings) {
                writer.paragraph(finding.text)
                writer.keyValue('Evidence / confidence', `${finding.evidenceType}; ${this.confidence(finding.confidence)}`)
                writer.keyValue('Source', this.source(finding.source))
            }
        }

        writer.chapter(`6. Codes and Standards (${result.codes.length})`)
        for (const code of result.codes) {
            writer.subheading(`${code.code}${code.edition ? ` - ${code.edition}` : ''}`)
            writer.keyValue('Status', code.status)
            writer.keyValue('Verification required', code.verificationRequired ? 'Yes' : 'No')
            writer.paragraph(code.explanation)
            writer.keyValue('Source', this.source(code.source))
        }
        writer.emptyMessage(result.codes.length, 'No codes or standards identified.')

        writer.chapter(`7. Risks (${result.risks.length})`)
        for (const risk of result.risks) {
            writer.subheading(`${risk.category} - ${risk.severity}`)
            writer.paragraph(risk.description)
            writer.keyValue('Basis', risk.basis)
            writer.keyValue('Potential impact', risk.potentialImpact)
            writer.keyValue('Recommended action', risk.recommendedAction)
            writer.keyValue('Source', this.source(risk.source))
        }
        writer.emptyMessage(result.risks.length, 'No risks identified.')

        if (result.takeoffManifest) {
            const manifest = result.takeoffManifest
            const coverageAssessed = manifest.coverage.rows.some((row) => row.status !== 'NOT_SCANNED' && row.status !== 'BY_OTHERS')
            writer.chapter(`8. Analysis Coverage (${coverageAssessed ? `${manifest.coverage.completenessPercent}%` : 'Pending'})`)
            writer.keyValue('Coverage status', coverageAssessed ? `${manifest.coverage.completenessPercent}% assessed` : 'Pending focused symbol scan')
            writer.keyValue('Legend items', manifest.coverage.legendItemCount)
            writer.keyValue('Seen on plans', manifest.coverage.seenOnPlanCount)
            writer.keyValue('Counted', manifest.coverage.countedCount)
            writer.keyValue('Catalog resolved', manifest.coverage.catalogResolvedCount)
            writer.keyValue('Floorplan ready', manifest.coverage.floorplanReadyCount)
            writer.keyValue('Unresolved', manifest.coverage.unresolvedCount)
            for (const row of manifest.coverage.rows) {
                writer.subheading(row.description || row.symbolLabel)
                writer.keyValue('Coverage', `${row.status}; plan count ${row.countedQuantity}; catalog ${row.catalogStatus}; BOM ${row.bomStatus}; placements ${row.placementCount}`)
            }

            writer.chapter(`9. Legend Inventory (${manifest.legendItems.length})`)
            for (const item of manifest.legendItems) {
                writer.subheading(item.description || item.symbolLabel)
                writer.keyValue('Symbol / part', `${item.symbolLabel || 'None'}; ${item.partNumber || item.modelNumber || 'not identified'}`)
                writer.keyValue('Manufacturer', item.manufacturer || 'Not identified')
                writer.keyValue('Mounting / backbox', `${item.mountingHeight || 'Not stated'}; ${item.backbox || 'not stated'}; supplier ${item.backboxSupplier || 'not stated'}`)
                writer.keyValue('Responsibilities', `Furnish ${item.furnishBy || 'unknown'}; install ${item.installBy || 'unknown'}; wire ${item.wireBy || 'unknown'}; test ${item.testBy || 'unknown'}`)
                writer.keyValue('Source', this.source(item.source))
            }

            writer.chapter(`10. Systems and Topology`)
            writer.subheading(`Drawing Regions (${manifest.drawingRegions.length})`)
            for (const region of manifest.drawingRegions) writer.bullet(`${region.regionType}: ${region.name}; page ${region.pageNumber}; ${region.floor || 'floor not stated'}`)
            writer.subheading(`Circuits (${manifest.circuits.length})`)
            for (const circuit of manifest.circuits) writer.bullet(`${circuit.name}; ${circuit.circuitType}; panel ${circuit.panel || 'not stated'}; ${circuit.deviceCount} devices; wire ${circuit.wireType || 'not stated'}`)
            writer.subheading(`Device Instances (${manifest.deviceInstances.length})`)
            for (const instance of manifest.deviceInstances) writer.bullet(`${instance.deviceType || instance.symbolLabel}; ${instance.floor || 'floor unknown'}; ${instance.room || 'room unknown'}; circuit ${instance.circuit || 'unknown'}; address ${instance.address || 'unknown'}; candela ${instance.candela || 'n/a'}`)
            writer.subheading(`Riser Connections (${manifest.topologyEdges.length})`)
            for (const edge of manifest.topologyEdges) writer.bullet(`${edge.fromNodeId} -> ${edge.toNodeId}; ${edge.relationship}${edge.circuit ? `; ${edge.circuit}` : ''}`)

            writer.chapter(`11. Responsibilities and Coordination`)
            for (const item of manifest.responsibilities) {
                writer.subheading(item.item)
                writer.keyValue('Responsibility', `Furnish ${item.furnishBy || 'unknown'}; backbox ${item.backboxBy || 'unknown'}; install ${item.installBy || 'unknown'}; wire ${item.wireBy || 'unknown'}; program ${item.programBy || 'unknown'}; test ${item.testBy || 'unknown'}`)
                writer.paragraph(item.notes)
            }
            for (const item of manifest.coordinationItems) {
                writer.subheading(`${item.itemType}: ${item.title}`)
                writer.keyValue('Priority / owner', `${item.priority}; ${item.suggestedOwner || 'unassigned'}`)
                writer.paragraph(item.description)
                writer.keyValue('Source', this.source(item.source))
            }

            writer.chapter(`12. Estimate Completeness (${manifest.estimateChecks.length})`)
            for (const check of manifest.estimateChecks) {
                writer.subheading(`${check.status}: ${check.title}`)
                writer.paragraph(check.explanation)
                writer.keyValue('Recommended action', check.recommendedAction)
            }

            writer.chapter(`13. Revision Delta (${manifest.revisionChanges.length})`)
            for (const change of manifest.revisionChanges) {
                writer.subheading(`${change.changeType}: ${change.description}`)
                writer.keyValue('Previous', change.previousValue || 'Not available')
                writer.keyValue('Current', change.currentValue || 'Not available')
                writer.keyValue('Impact', change.impact)
                writer.keyValue('Source', this.source(change.source))
            }
            writer.emptyMessage(manifest.revisionChanges.length, 'No prior-version or document-stated revision delta was available.')
        }

        writer.finish(record.sourceFilename)
        return pdf.save()
    }

    private confidence(value: number): string {
        return `${Math.round((Number(value) || 0) * 100)}% confidence`
    }

    private source(source: DocumentAnalysisSource): string {
        return [source?.filename, source?.page ? `Page ${source.page}` : '', source?.section, source?.location].filter(Boolean).join(' - ') || 'Source not recorded'
    }

    private findingSections(result: DocumentInspectionResult) {
        return [
            { label: 'Project and Customer Details', findings: result.projectDetails },
            { label: 'Inclusions', findings: result.scope.inclusions },
            { label: 'Exclusions', findings: result.scope.exclusions },
            { label: 'Assumptions', findings: result.scope.assumptions },
            { label: 'Customer Responsibilities', findings: result.scope.customerResponsibilities },
            { label: 'Other-Trade Responsibilities', findings: result.scope.otherTradeResponsibilities },
            { label: 'Specific Instructions', findings: result.scope.specificInstructions },
            { label: 'Limitations', findings: result.scope.limitations },
            { label: 'Alternates', findings: result.scope.alternates },
            { label: 'Technical Requirements', findings: result.requirements },
            { label: 'Open Questions', findings: result.openQuestions }
        ]
    }
}

class AnalysisPdfWriter {
    private page!: PDFPage
    private y = 0

    constructor(private pdf: PDFDocument, private regular: PDFFont, private bold: PDFFont) {
        this.newPage()
    }

    title(text: string): void {
        this.lines(text, this.bold, 22, 28, rgb(0.05, 0.32, 0.48), 14)
    }

    chapter(text: string): void {
        this.ensure(52)
        this.y -= 16
        this.page.drawRectangle({ x: MARGIN, y: this.y - 4, width: CONTENT_WIDTH, height: 28, color: rgb(0.04, 0.16, 0.23) })
        this.lines(text, this.bold, 15, 20, rgb(0.25, 0.78, 0.95), 12)
    }

    subheading(text: string): void {
        this.ensure(34)
        this.y -= 8
        this.lines(text || 'Untitled', this.bold, 12, 16, rgb(0.08, 0.3, 0.42), 4)
    }

    paragraph(text: unknown): void {
        this.lines(String(text || 'Not provided'), this.regular, 9.5, 13, rgb(0.12, 0.16, 0.19), 7)
    }

    keyValue(label: string, value: unknown): void {
        const safeValue = String(value ?? '').trim() || 'Not provided'
        const size = 9.5
        const lineHeight = 13
        const labelWidth = 126
        const valueX = MARGIN + labelWidth
        const valueLines = this.wrap(this.clean(safeValue), this.regular, size, CONTENT_WIDTH - labelWidth)
        for (let index = 0; index < valueLines.length; index += 1) {
            this.ensure(lineHeight)
            if (index === 0) {
                this.page.drawText(this.clean(`${label}:`), {
                    x: MARGIN,
                    y: this.y,
                    size,
                    font: this.bold,
                    color: rgb(0.08, 0.24, 0.32)
                })
            }
            this.page.drawText(valueLines[index], {
                x: valueX,
                y: this.y,
                size,
                font: this.regular,
                color: rgb(0.12, 0.16, 0.19)
            })
            this.y -= lineHeight
        }
        this.y -= 3
    }

    bullet(text: string): void {
        this.lines(`- ${text}`, this.regular, 9, 12, rgb(0.16, 0.2, 0.23), 3)
    }

    emptyMessage(count: number, message: string): void {
        if (!count) this.paragraph(message)
    }

    finish(sourceFilename: string): void {
        const pages = this.pdf.getPages()
        pages.forEach((page, index) => {
            page.drawLine({ start: { x: MARGIN, y: 34 }, end: { x: PAGE_WIDTH - MARGIN, y: 34 }, thickness: 0.5, color: rgb(0.7, 0.76, 0.79) })
            page.drawText(this.clean(sourceFilename), { x: MARGIN, y: 20, size: 7.5, font: this.regular, color: rgb(0.4, 0.46, 0.5), maxWidth: 390 })
            page.drawText(`Page ${index + 1} of ${pages.length}`, { x: PAGE_WIDTH - 110, y: 20, size: 7.5, font: this.regular, color: rgb(0.4, 0.46, 0.5) })
        })
    }

    private lines(text: string, font: PDFFont, size: number, lineHeight: number, color: ReturnType<typeof rgb>, after: number): void {
        const wrapped = this.wrap(this.clean(text), font, size)
        for (const line of wrapped) {
            this.ensure(lineHeight)
            this.page.drawText(line, { x: MARGIN, y: this.y, size, font, color })
            this.y -= lineHeight
        }
        this.y -= after
    }

    private wrap(text: string, font: PDFFont, size: number, maxWidth = CONTENT_WIDTH): string[] {
        const output: string[] = []
        for (const paragraph of text.split(/\r?\n/)) {
            const words = paragraph.split(/\s+/).filter(Boolean).flatMap((word) => this.splitLongWord(word, font, size, maxWidth))
            let line = ''
            for (const word of words) {
                const candidate = line ? `${line} ${word}` : word
                if (font.widthOfTextAtSize(candidate, size) <= maxWidth) {
                    line = candidate
                } else {
                    if (line) output.push(line)
                    line = word
                }
            }
            output.push(line || ' ')
        }
        return output
    }

    private splitLongWord(word: string, font: PDFFont, size: number, maxWidth: number): string[] {
        if (font.widthOfTextAtSize(word, size) <= maxWidth) {
            return [word]
        }
        const chunks: string[] = []
        let chunk = ''
        for (const character of word) {
            const candidate = chunk + character
            if (chunk && font.widthOfTextAtSize(candidate, size) > maxWidth) {
                chunks.push(chunk)
                chunk = character
            } else {
                chunk = candidate
            }
        }
        if (chunk) chunks.push(chunk)
        return chunks
    }

    private ensure(height: number): void {
        if (this.y - height < 50) this.newPage()
    }

    private newPage(): void {
        this.page = this.pdf.addPage([PAGE_WIDTH, PAGE_HEIGHT])
        this.y = PAGE_HEIGHT - MARGIN
    }

    private clean(value: string): string {
        return value
            .replace(/[\u2018\u2019]/g, "'")
            .replace(/[\u201C\u201D]/g, '"')
            .replace(/[\u2013\u2014]/g, '-')
            .replace(/\u00B7/g, '-')
            .replace(/[^\x20-\x7E\r\n]/g, '?')
    }
}
