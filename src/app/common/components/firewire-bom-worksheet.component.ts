import { CommonModule } from '@angular/common'
import { Component, Input, inject } from '@angular/core'
import { FormsModule } from '@angular/forms'
import { firstValueFrom } from 'rxjs'

import { MatButtonModule } from '@angular/material/button'
import { MAT_DIALOG_DATA, MatDialog, MatDialogActions, MatDialogClose, MatDialogContent, MatDialogRef, MatDialogTitle } from '@angular/material/dialog'
import { MatFormFieldModule } from '@angular/material/form-field'
import { MatIconModule } from '@angular/material/icon'
import { MatSelectModule } from '@angular/material/select'

import { AutosizeTextareaDirective } from '../directives/autosize-textarea.directive'

interface BomRowSourcePart {
    bomRowPartId?: string
    deviceId?: string | null
    devicePartId?: string | null
    partId?: string | null
    vendorId?: string | null
    vendorName?: string | null
    partNumber: string
    description: string
    parentCategory?: string | null
    category?: string | null
    msrp?: number | null
    cost?: number | null
    quantityPerDevice?: number | null
}

interface BomRowSourceDialogData {
    kind: 'device' | 'part'
    row: any
    device?: any
    part?: BomRowSourcePart
    parts: BomRowSourcePart[]
}

interface BomRowDeleteConfirmDialogData {
    symbolCount: number
    partNumber: string
}

type BomCsvExportMode = 'device' | 'itemized'

interface BomCsvExportDialogData {
    selectedMode: BomCsvExportMode
}

const BOM_CSV_EXPORT_MODE_STORAGE_KEY = 'firewire.bomWorksheet.csvExportMode'

@Component({
    standalone: true,
    selector: 'firewire-bom-worksheet',
    imports: [
        CommonModule,
        FormsModule,
        MatButtonModule,
        MatFormFieldModule,
        MatIconModule,
        MatSelectModule,
        AutosizeTextareaDirective
    ],
    templateUrl: './firewire-bom-worksheet.component.html',
    styleUrls: ['../../pages/sales/sales-project.page.scss']
})
export class FirewireBomWorksheetComponent {
    private readonly dialog = inject(MatDialog)
    private floorplanSymbolDeleteConfirmed = false

    @Input({ required: true }) host!: any
    @Input() context: 'sales' | 'project' = 'project'

    get locked(): boolean {
        return this.context === 'project' && !!this.host?.isActiveFirewireWorkspaceLocked?.()
    }

    get saveWorking(): boolean {
        return this.context === 'sales' ? !!this.host?.saveWorking : !!this.host?.firewireSaveWorking
    }

    get saveMessage(): string {
        return this.context === 'sales' ? String(this.host?.saveMessage || '') : String(this.host?.firewireSaveMessage || '')
    }

    get canAddDeviceSet(): boolean {
        return Array.isArray(this.host?.deviceSets) && typeof this.host?.addSelectedDeviceSetToBom === 'function'
    }

    get canAddSection(): boolean {
        return typeof this.host?.addBomSection === 'function'
    }

    get canExportCsv(): boolean {
        return this.getSections().length > 0
    }

    get canRemoveSection(): boolean {
        return typeof this.host?.removeBomSection === 'function'
    }

    onBomShapeChanged(): void {
        if (this.context === 'project') {
            this.host?.refreshTakeoffColumnDefinitions?.()
        }
    }

    onBomQuantityChanged(): void {
        this.onBomShapeChanged()
        this.onBomLaborChanged()
    }

    onBomLaborChanged(): void {
        this.host?.syncBomLaborToInstallLaborEstimate?.()
    }

    onBomLaborBlur(row: any): void {
        this.host?.normalizeBomMoneyField?.(row, 'labor')
        this.onBomLaborChanged()
    }

    getBomRowIconStyle(row: any): Record<string, string> {
        const dataUrl = String(row?.iconDataUrl || '').trim()
        const color = String(row?.iconForegroundColor || '#210507').trim() || '#210507'
        return dataUrl
            ? {
                'background-color': color,
                'mask-image': `url("${dataUrl}")`,
                '-webkit-mask-image': `url("${dataUrl}")`,
            }
            : {}
    }

    getBomSectionMaterialTotal(section: any): number {
        return this.getSectionRows(section).reduce((sum, row) => sum + this.getRowMaterialTotal(row), 0)
    }

    getBomSectionLaborTotal(section: any): number {
        return this.getSectionRows(section).reduce((sum, row) => sum + this.getRowLaborTotal(row), 0)
    }

    getBomSectionTotal(section: any): number {
        return this.getBomSectionMaterialTotal(section) + this.getBomSectionLaborTotal(section)
    }

    getBomMaterialTotal(): number {
        return this.getSections().reduce((sum, section) => sum + this.getBomSectionMaterialTotal(section), 0)
    }

    getBomLaborTotal(): number {
        return this.getSections().reduce((sum, section) => sum + this.getBomSectionLaborTotal(section), 0)
    }

    getBomTotal(): number {
        return this.getBomMaterialTotal() + this.getBomLaborTotal()
    }

    hasChangeOrderBaseline(): boolean {
        return this.getBaselineSections().length > 0 || this.getBaselineFloorplans().length > 0
    }

    getBaselineProjectLabel(): string {
        const baseline = this.getChangeOrderBaseline()
        const name = String(baseline?.rootProjectName || '').trim()
        const nbr = String(baseline?.rootProjectNbr || '').trim()
        if (name && nbr) {
            return `${name} (${nbr})`
        }
        return name || nbr || 'Original Project'
    }

    getBaselineBomRowCount(): number {
        return this.getBaselineSections().reduce((sum, section) => sum + this.getSectionRows(section).length, 0)
    }

    getBaselineFloorplanCount(): number {
        return this.getBaselineFloorplans().length
    }

    getBaselineSymbolCount(): number {
        return this.getBaselineFloorplans().reduce((sum, file) => {
            const annotations = Array.isArray(file?.floorplanDesign?.annotations) ? file.floorplanDesign.annotations : []
            return sum + annotations.filter((annotation: any) => annotation?.kind === 'symbol').length
        }, 0)
    }

    getBaselineCircuitCount(): number {
        return this.getBaselineFloorplans().reduce((sum, file) => {
            const circuits = Array.isArray(file?.floorplanDesign?.circuits) ? file.floorplanDesign.circuits : []
            return sum + circuits.length
        }, 0)
    }

    getBaselineMaterialTotal(): number {
        return this.getBaselineSections().reduce((sum, section) => sum + this.getBomSectionMaterialTotal(section), 0)
    }

    getBaselineLaborTotal(): number {
        return this.getBaselineSections().reduce((sum, section) => sum + this.getBomSectionLaborTotal(section), 0)
    }

    getBomRowSource(row: any): BomRowSourceDialogData | null {
        const parts = this.getBomRowSourceParts(row)
        if (parts.length <= 0) {
            return null
        }

        const deviceId = String(parts.find((part) => String(part.deviceId || '').trim())?.deviceId || '').trim()
        if (deviceId) {
            const device = Array.isArray(this.host?.deviceRows)
                ? this.host.deviceRows.find((candidate: any) => String(candidate?.deviceId || '').trim().toLowerCase() === deviceId.toLowerCase())
                : undefined
            return {
                kind: 'device',
                row,
                device,
                parts,
            }
        }

        const part = parts.find((candidate) => String(candidate.partId || candidate.vendorId || candidate.partNumber || '').trim()) || parts[0]
        return part
            ? {
                kind: 'part',
                row,
                part,
                parts: [part],
            }
            : null
    }

    getBomRowSourceLabel(row: any): string {
        const source = this.getBomRowSource(row)
        if (!source) {
            return ''
        }
        return source.kind === 'device' ? 'View Device' : 'View Part'
    }

    openBomRowSource(row: any): void {
        const source = this.getBomRowSource(row)
        if (!source) {
            return
        }

        this.dialog.open(BomRowSourceDialog, {
            data: source,
            panelClass: 'fw-fit-content-dialog-pane',
            maxWidth: 'calc(100vw - 48px)',
        })
    }

    async openBomCsvExportDialog(): Promise<void> {
        const selectedMode = this.getPreferredBomCsvExportMode()
        const result = await firstValueFrom(this.dialog.open(BomCsvExportDialog, {
            width: '460px',
            maxWidth: '92vw',
            panelClass: 'fw-compact-dialog-pane',
            data: { selectedMode } as BomCsvExportDialogData
        }).afterClosed())

        if (result !== 'device' && result !== 'itemized') {
            return
        }

        this.setPreferredBomCsvExportMode(result)
        this.exportBomCsv(result)
    }

    async requestRemoveBomRow(section: any, row: any): Promise<void> {
        if (this.locked || typeof this.host?.removeBomRow !== 'function') {
            return
        }

        const symbolCount = this.getFloorplanSymbolCountForBomRow(row)
        if (symbolCount > 0 && !this.floorplanSymbolDeleteConfirmed) {
            const confirmed = await firstValueFrom(this.dialog.open(BomRowDeleteConfirmDialog, {
                width: '440px',
                maxWidth: '92vw',
                panelClass: 'fw-compact-dialog-pane',
                data: {
                    symbolCount,
                    partNumber: String(row?.partNbr || row?.description || 'this BOM row').trim()
                } as BomRowDeleteConfirmDialogData
            }).afterClosed())

            if (!confirmed) {
                return
            }
            this.floorplanSymbolDeleteConfirmed = true
        }

        this.host.removeBomRow(section, row)
    }

    private getBomRowSourceParts(row: any): BomRowSourcePart[] {
        return Array.isArray(row?.bomRowParts)
            ? row.bomRowParts
                .map((part: any) => ({
                    ...part,
                    partNumber: String(part?.partNumber || '').trim(),
                    description: String(part?.description || '').trim(),
                }))
                .filter((part: BomRowSourcePart) => !!part.partNumber)
            : []
    }

    private exportBomCsv(mode: BomCsvExportMode): void {
        const csvLines = mode === 'itemized'
            ? this.buildItemizedPartBomCsvLines()
            : this.buildDeviceLevelBomCsvLines()

        const blob = new Blob([csvLines.join('\r\n')], { type: 'text/csv;charset=utf-8;' })
        const url = URL.createObjectURL(blob)
        const anchor = document.createElement('a')
        anchor.href = url
        anchor.download = `${this.getBomCsvFileBaseName()}-${mode === 'itemized' ? 'itemized-parts' : 'device-level'}.csv`
        anchor.click()
        URL.revokeObjectURL(url)
    }

    private buildDeviceLevelBomCsvLines(): string[] {
        const headers = ['PART NBR', 'DESCRIPTION', 'QTY', 'COST', 'EXT COST', 'LABOR', 'EXT LABOR', 'FP', 'TYPE']
        return this.getSections().flatMap((section) => {
            const rows = this.getExportRows(section)
            return [
                this.toCsvCell(section?.title),
                headers.join(','),
                ...rows.map((row) => [
                    this.toCsvCell(row?.partNbr),
                    this.toCsvCell(row?.description),
                    this.toCsvCell(`${Number(row?.qty || 0)}`),
                    this.toCsvCell(`${this.roundBomMoney(row?.cost)}`),
                    this.toCsvCell(`${this.getRowMaterialTotal(row)}`),
                    this.toCsvCell(`${this.roundBomMoney(row?.labor)}`),
                    this.toCsvCell(`${this.getRowLaborTotal(row)}`),
                    this.toCsvCell(row?.includeOnFloorplan ? 'Yes' : 'No'),
                    this.toCsvCell(row?.type)
                ].join(',')),
                ''
            ]
        })
    }

    private buildItemizedPartBomCsvLines(): string[] {
        const headers = [
            'SECTION',
            'DEVICE PART NBR',
            'DEVICE DESCRIPTION',
            'PART NBR',
            'PART DESCRIPTION',
            'PART CATEGORY',
            'QTY',
            'COST',
            'EXT COST',
            'LABOR',
            'EXT LABOR',
            'FP',
            'TYPE'
        ]
        const lines = [headers.join(',')]

        for (const section of this.getSections()) {
            for (const row of this.getExportRows(section)) {
                const rowQty = Number(row?.qty || 0)
                const rowLabor = this.roundBomMoney(row?.labor)
                const sourceParts = this.getBomRowSourceParts(row)
                const parts = sourceParts.length > 0 ? sourceParts : [this.createFallbackBomRowPart(row)]

                parts.forEach((part, index) => {
                    const quantityPerDevice = Math.max(1, Number(part?.quantityPerDevice || 1))
                    const quantity = rowQty * quantityPerDevice
                    const cost = this.roundBomMoney(part?.cost ?? row?.cost)
                    const extCost = this.roundBomMoney(quantity * cost)
                    const labor = index === 0 ? rowLabor : 0
                    const extLabor = index === 0 ? this.getRowLaborTotal(row) : 0
                    lines.push([
                        this.toCsvCell(section?.title),
                        this.toCsvCell(row?.partNbr),
                        this.toCsvCell(row?.description),
                        this.toCsvCell(part?.partNumber || row?.partNbr),
                        this.toCsvCell(part?.description || row?.description),
                        this.toCsvCell(part?.category || part?.parentCategory || ''),
                        this.toCsvCell(`${quantity}`),
                        this.toCsvCell(`${cost}`),
                        this.toCsvCell(`${extCost}`),
                        this.toCsvCell(`${labor}`),
                        this.toCsvCell(`${extLabor}`),
                        this.toCsvCell(row?.includeOnFloorplan ? 'Yes' : 'No'),
                        this.toCsvCell(row?.type)
                    ].join(','))
                })
            }
        }

        return lines
    }

    private createFallbackBomRowPart(row: any): BomRowSourcePart {
        return {
            partNumber: String(row?.partNbr || '').trim(),
            description: String(row?.description || '').trim(),
            category: String(row?.type || '').trim(),
            cost: Number(row?.cost || 0),
            quantityPerDevice: 1
        }
    }

    private getExportRows(section: any): any[] {
        return typeof this.host?.getFilteredBomRows === 'function'
            ? this.host.getFilteredBomRows(section)
            : this.getSectionRows(section)
    }

    private roundBomMoney(value: any): number {
        if (typeof this.host?.roundBomMoney === 'function') {
            return Number(this.host.roundBomMoney(value) || 0)
        }
        const numeric = Number(value || 0)
        return Math.round(numeric * 100) / 100
    }

    private toCsvCell(value: any): string {
        const raw = value === null || value === undefined ? '' : String(value)
        return `"${raw.replace(/"/g, '""')}"`
    }

    private getBomCsvFileBaseName(): string {
        const name = String(this.host?.firewireProject?.name || this.host?.project?.name || 'project-bom').trim() || 'project-bom'
        return name.replace(/[^a-z0-9]+/gi, '-').replace(/^-+|-+$/g, '').toLowerCase() || 'project-bom'
    }

    private getPreferredBomCsvExportMode(): BomCsvExportMode {
        try {
            const storedMode = window.localStorage.getItem(BOM_CSV_EXPORT_MODE_STORAGE_KEY)
            return storedMode === 'itemized' ? 'itemized' : 'device'
        } catch {
            return 'device'
        }
    }

    private setPreferredBomCsvExportMode(mode: BomCsvExportMode): void {
        try {
            window.localStorage.setItem(BOM_CSV_EXPORT_MODE_STORAGE_KEY, mode)
        } catch {
            // Export still works if browser storage is unavailable.
        }
    }

    private getSections(): any[] {
        return Array.isArray(this.host?.bomSections) ? this.host.bomSections : []
    }

    private getChangeOrderBaseline(): any {
        return this.host?.changeOrderBaseline || this.host?.project?.worksheetData?.changeOrderBaseline || null
    }

    private getBaselineSections(): any[] {
        const baseline = this.getChangeOrderBaseline()
        return Array.isArray(baseline?.bomSections) ? baseline.bomSections : []
    }

    private getBaselineFloorplans(): any[] {
        const baseline = this.getChangeOrderBaseline()
        return Array.isArray(baseline?.floorplans) ? baseline.floorplans : []
    }

    private getSectionRows(section: any): any[] {
        return Array.isArray(section?.rows) ? section.rows : []
    }

    private getRowMaterialTotal(row: any): number {
        if (typeof this.host?.getBomRowExtCost === 'function') {
            return Number(this.host.getBomRowExtCost(row) || 0)
        }
        return Number(row?.qty || 0) * Number(row?.cost || 0)
    }

    private getRowLaborTotal(row: any): number {
        if (typeof this.host?.getBomRowExtLabor === 'function') {
            return Number(this.host.getBomRowExtLabor(row) || 0)
        }
        return Number(row?.qty || 0) * Number(row?.labor || 0)
    }

    private getFloorplanSymbolCountForBomRow(row: any): number {
        const rowId = String(row?.id || '').trim()
        const symbolId = rowId ? `bom-row-${rowId}` : ''
        if (!rowId && !symbolId) {
            return 0
        }

        const files = Array.isArray(this.host?.docLibraryFiles) ? this.host.docLibraryFiles : []
        return files.reduce((sum: number, file: any) => {
            const annotations = Array.isArray(file?.floorplanDesign?.annotations) ? file.floorplanDesign.annotations : []
            return sum + annotations.filter((annotation: any) => {
                if (annotation?.kind !== 'symbol') {
                    return false
                }
                return (!!rowId && String(annotation?.bomRowId || '').trim() === rowId)
                    || (!!symbolId && String(annotation?.symbolId || '').trim() === symbolId)
            }).length
        }, 0)
    }
}

@Component({
    standalone: true,
    selector: 'firewire-bom-row-delete-confirm-dialog',
    imports: [
        CommonModule,
        MatButtonModule,
        MatDialogActions,
        MatDialogClose,
        MatDialogContent,
        MatDialogTitle,
        MatIconModule,
    ],
    template: `
        <h2 mat-dialog-title>Delete BOM Row</h2>
        <mat-dialog-content>
            <p>
                Delete <strong>{{data.partNumber}}</strong>?
                This will also remove {{data.symbolCount}} placed floorplan symbol{{data.symbolCount === 1 ? '' : 's'}} tied to this BOM row.
            </p>
        </mat-dialog-content>
        <mat-dialog-actions align="end">
            <button mat-button mat-dialog-close type="button">Cancel</button>
            <button mat-flat-button color="warn" type="button" (click)="confirm()">Delete</button>
        </mat-dialog-actions>
    `
})
export class BomRowDeleteConfirmDialog {
    readonly data = inject<BomRowDeleteConfirmDialogData>(MAT_DIALOG_DATA)
    private readonly dialogRef = inject(MatDialogRef<BomRowDeleteConfirmDialog>)

    confirm(): void {
        this.dialogRef.close(true)
    }
}

@Component({
    standalone: true,
    selector: 'firewire-bom-csv-export-dialog',
    imports: [
        CommonModule,
        FormsModule,
        MatButtonModule,
        MatDialogActions,
        MatDialogContent,
        MatDialogTitle,
        MatIconModule,
    ],
    template: `
        <h2 mat-dialog-title>Export BOM CSV</h2>
        <mat-dialog-content>
            <section class="bom-csv-export-dialog">
                <button
                    type="button"
                    class="bom-csv-export-dialog__option"
                    [class.is-selected]="selectedMode === 'device'"
                    (click)="selectedMode = 'device'">
                    <span class="bom-csv-export-dialog__radio" aria-hidden="true"></span>
                    <span>
                        <strong>Device Level BOM Export</strong>
                        <small>Exports the worksheet rows as shown across all BOM sections.</small>
                    </span>
                </button>
                <button
                    type="button"
                    class="bom-csv-export-dialog__option"
                    [class.is-selected]="selectedMode === 'itemized'"
                    (click)="selectedMode = 'itemized'">
                    <span class="bom-csv-export-dialog__radio" aria-hidden="true"></span>
                    <span>
                        <strong>Itemized Part BOM Export</strong>
                        <small>Exports underlying device parts with quantities, costs, labor, floorplan, and type.</small>
                    </span>
                </button>
            </section>
        </mat-dialog-content>
        <mat-dialog-actions align="end">
            <button mat-button type="button" (click)="cancel()">Cancel</button>
            <button mat-flat-button color="primary" type="button" (click)="export()">Export CSV</button>
        </mat-dialog-actions>
    `,
    styles: [`
        .bom-csv-export-dialog{display:grid;gap:10px;color:var(--fw-text)}
        .bom-csv-export-dialog__option{display:grid;grid-template-columns:auto minmax(0,1fr);align-items:center;gap:12px;width:100%;padding:12px 14px;border:1px solid rgba(72,221,255,.22);background:rgba(3,12,22,.52);color:inherit;text-align:left;cursor:pointer}
        .bom-csv-export-dialog__option:hover{border-color:rgba(72,221,255,.45);background:rgba(72,221,255,.08)}
        .bom-csv-export-dialog__option.is-selected{border-color:rgba(72,221,255,.78);box-shadow:inset 3px 0 0 rgba(72,221,255,.9);background:linear-gradient(90deg,rgba(72,221,255,.14),rgba(3,12,22,.58))}
        .bom-csv-export-dialog__option strong{display:block;color:#f4fbff;font-size:.92rem;letter-spacing:.02em}
        .bom-csv-export-dialog__option small{display:block;margin-top:3px;color:rgba(214,238,255,.72);font-size:.78rem;line-height:1.35}
        .bom-csv-export-dialog__radio{display:inline-grid;place-items:center;width:18px;height:18px;border:1px solid rgba(165,214,236,.58);border-radius:50%;background:rgba(3,12,22,.86)}
        .bom-csv-export-dialog__option.is-selected .bom-csv-export-dialog__radio::after{content:'';width:8px;height:8px;border-radius:50%;background:rgba(72,221,255,.95);box-shadow:0 0 10px rgba(72,221,255,.68)}
    `]
})
export class BomCsvExportDialog {
    readonly data = inject<BomCsvExportDialogData>(MAT_DIALOG_DATA)
    private readonly dialogRef = inject(MatDialogRef<BomCsvExportDialog>)

    selectedMode: BomCsvExportMode = this.data.selectedMode

    cancel(): void {
        this.dialogRef.close()
    }

    export(): void {
        this.dialogRef.close(this.selectedMode)
    }
}

@Component({
    standalone: true,
    selector: 'firewire-bom-row-source-dialog',
    imports: [
        CommonModule,
        MatButtonModule,
        MatDialogActions,
        MatDialogClose,
        MatDialogContent,
        MatDialogTitle,
        MatIconModule,
    ],
    template: `
        <div mat-dialog-title class="fw-dialog-titlebar bom-source-dialog__titlebar">
            <span class="fw-dialog-titlebar__text">{{data.kind === 'device' ? 'Device Source' : 'Vendor Part Source'}}</span>
            <button mat-icon-button type="button" class="fw-dialog-titlebar__close" aria-label="Close source details" mat-dialog-close>
                <mat-icon fontIcon="close"></mat-icon>
            </button>
        </div>

        <mat-dialog-content>
            <section class="bom-source-dialog">
                <div class="bom-source-dialog__banner" [class.bom-source-dialog__banner--part]="data.kind === 'part'">
                    <div class="bom-source-dialog__banner-copy">
                        <div class="bom-source-dialog__eyebrow">{{data.kind === 'device' ? 'Displaying Device' : 'Displaying Vendor Part'}}</div>
                        <div class="bom-source-dialog__title">{{getTitle()}}</div>
                        <div class="bom-source-dialog__subtitle">{{getSubtitle()}}</div>
                    </div>
                    <span *ngIf="getIconDataUrl()" class="bom-source-dialog__icon-canvas">
                        <span class="bom-source-dialog__icon" [ngStyle]="getSourceIconStyle()" [attr.aria-label]="getIconLabel()"></span>
                    </span>
                </div>

                <div class="bom-source-dialog__details">
                    <div>
                        <span>Part Number</span>
                        <strong>{{data.row?.partNbr || data.part?.partNumber || 'N/A'}}</strong>
                    </div>
                    <div>
                        <span>Category</span>
                        <strong>{{data.row?.type || data.part?.category || 'N/A'}}</strong>
                    </div>
                    <div>
                        <span>Cost</span>
                        <strong>{{(data.row?.cost || data.part?.cost || 0) | currency:'USD':'symbol':'1.0-0'}}</strong>
                    </div>
                    <div>
                        <span>Vendor</span>
                        <strong>{{getVendorName()}}</strong>
                    </div>
                </div>

                <div class="bom-source-dialog__description">{{getDescription()}}</div>

                <section class="bom-source-dialog__parts" *ngIf="data.kind === 'device'">
                    <div class="bom-source-dialog__section-title">Device Parts Included</div>
                    <table>
                        <thead>
                            <tr>
                                <th>Part Number</th>
                                <th>Description</th>
                                <th>Category</th>
                                <th class="right-align">Qty / Device</th>
                                <th class="right-align">Cost</th>
                                <th class="right-align">MSRP</th>
                            </tr>
                        </thead>
                        <tbody>
                            <tr *ngFor="let part of data.parts">
                                <td>{{part.partNumber}}</td>
                                <td>{{part.description}}</td>
                                <td>{{part.category || part.parentCategory || 'N/A'}}</td>
                                <td class="right-align">{{part.quantityPerDevice || 1}}</td>
                                <td class="right-align">{{(part.cost || 0) | currency:'USD':'symbol':'1.0-0'}}</td>
                                <td class="right-align">{{(part.msrp || 0) | currency:'USD':'symbol':'1.0-0'}}</td>
                            </tr>
                        </tbody>
                    </table>
                </section>
            </section>
        </mat-dialog-content>

        <mat-dialog-actions align="end">
            <button mat-button type="button" mat-dialog-close>Close</button>
        </mat-dialog-actions>
    `,
    styles: [`
        .bom-source-dialog{display:grid;gap:14px;width:min(940px,calc(100vw - 96px));color:var(--fw-text)}
        .bom-source-dialog__titlebar{border-bottom:1px solid rgba(72,221,255,.14)}
        .bom-source-dialog__banner{display:grid;grid-template-columns:minmax(0,1fr) auto;align-items:center;gap:14px;padding:12px 14px;border:1px solid rgba(72,221,255,.2);border-left:4px solid rgba(72,221,255,.78);border-radius:0;background:linear-gradient(90deg,rgba(72,221,255,.12),rgba(72,221,255,.02))}
        .bom-source-dialog__banner-copy{display:grid;gap:4px;min-width:0}
        .bom-source-dialog__banner--part{border-left-color:rgba(255,164,61,.84);background:linear-gradient(90deg,rgba(255,164,61,.12),rgba(72,221,255,.02))}
        .bom-source-dialog__icon-canvas{display:inline-grid;place-items:center;width:54px;height:54px;border:1px solid rgba(72,221,255,.46);background:#fff;box-shadow:0 0 0 1px rgba(255,255,255,.08),0 0 18px rgba(72,221,255,.18),inset 0 0 0 1px rgba(7,16,24,.06)}
        .bom-source-dialog__icon{display:inline-block;width:34px;height:34px;mask-repeat:no-repeat;mask-position:center;mask-size:contain;-webkit-mask-repeat:no-repeat;-webkit-mask-position:center;-webkit-mask-size:contain}
        .bom-source-dialog__eyebrow,.bom-source-dialog__section-title{color:var(--fw-accent-2);font-size:.72rem;font-weight:700;letter-spacing:.14em;text-transform:uppercase}
        .bom-source-dialog__title{color:#f4fbff;font-size:1.12rem;font-weight:800}
        .bom-source-dialog__subtitle,.bom-source-dialog__description{color:rgba(214,238,255,.78);font-size:.86rem;line-height:1.45}
        .bom-source-dialog__details{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:8px}
        .bom-source-dialog__details div{display:grid;gap:4px;padding:10px 12px;border:1px solid rgba(72,221,255,.12);background:rgba(3,12,22,.42)}
        .bom-source-dialog__details span{color:rgba(165,214,236,.72);font-size:.7rem;letter-spacing:.1em;text-transform:uppercase}
        .bom-source-dialog__details strong{min-width:0;overflow:hidden;text-overflow:ellipsis;color:#f4fbff;font-size:.9rem}
        .bom-source-dialog__parts{display:grid;gap:8px;overflow-x:auto}
        .bom-source-dialog__parts table{width:100%;min-width:820px;border-collapse:collapse;background:rgba(3,12,22,.42)}
        .bom-source-dialog__parts th,.bom-source-dialog__parts td{padding:9px 10px;border-top:1px solid rgba(72,221,255,.1);text-align:left;vertical-align:top}
        .bom-source-dialog__parts th{border-top:0;background:rgba(72,221,255,.08);color:var(--fw-accent-2);font-size:.68rem;letter-spacing:.12em;text-transform:uppercase}
        .bom-source-dialog__parts .right-align{text-align:right}
        .bom-source-dialog__parts th:nth-child(1),.bom-source-dialog__parts td:nth-child(1){width:140px}
        .bom-source-dialog__parts th:nth-child(2),.bom-source-dialog__parts td:nth-child(2){width:auto}
        .bom-source-dialog__parts th:nth-child(3),.bom-source-dialog__parts td:nth-child(3){width:180px}
        .bom-source-dialog__parts th:nth-child(4),.bom-source-dialog__parts td:nth-child(4){width:110px}
        .bom-source-dialog__parts th:nth-child(5),.bom-source-dialog__parts td:nth-child(5),.bom-source-dialog__parts th:nth-child(6),.bom-source-dialog__parts td:nth-child(6){width:110px}
        @media (max-width:760px){.bom-source-dialog{width:calc(100vw - 64px)}.bom-source-dialog__details{grid-template-columns:repeat(2,minmax(0,1fr))}.bom-source-dialog__banner{grid-template-columns:minmax(0,1fr)}.bom-source-dialog__icon-canvas{justify-self:start}}
    `]
})
export class BomRowSourceDialog {
    readonly data = inject<BomRowSourceDialogData>(MAT_DIALOG_DATA)

    getTitle(): string {
        if (this.data.kind === 'device') {
            return String(this.data.device?.name || this.data.row?.description || this.data.row?.partNbr || 'Device').trim()
        }
        return String(this.data.part?.partNumber || this.data.row?.partNbr || 'Vendor Part').trim()
    }

    getSubtitle(): string {
        if (this.data.kind === 'device') {
            const shortName = String(this.data.device?.shortName || '').trim()
            const deviceId = String(this.data.parts.find((part) => part.deviceId)?.deviceId || '').trim()
            return [shortName, deviceId ? `Device ID ${deviceId}` : ''].filter(Boolean).join(' · ') || 'Device snapshot retained on this BOM row.'
        }
        const partId = String(this.data.part?.partId || '').trim()
        return partId ? `Part ID ${partId}` : 'Vendor part snapshot retained on this BOM row.'
    }

    getVendorName(): string {
        return String(this.data.device?.vendorName || this.data.part?.vendorName || this.data.parts.find((part) => part.vendorName)?.vendorName || 'N/A').trim()
    }

    getDescription(): string {
        return String(this.data.kind === 'device'
            ? this.data.row?.description || this.data.device?.name || ''
            : this.data.part?.description || this.data.row?.description || ''
        ).trim() || 'No description captured.'
    }

    getIconDataUrl(): string {
        return String(this.data.device?.iconDataUrl || this.data.row?.iconDataUrl || '').trim()
    }

    getIconLabel(): string {
        return String(this.data.device?.iconLabel || this.data.row?.iconLabel || this.getTitle()).trim()
    }

    getSourceIconStyle(): Record<string, string> {
        const dataUrl = this.getIconDataUrl()
        const color = String(this.data.device?.iconForegroundColor || this.data.row?.iconForegroundColor || '#210507').trim() || '#210507'
        return dataUrl
            ? {
                'background-color': color,
                'mask-image': `url("${dataUrl}")`,
                '-webkit-mask-image': `url("${dataUrl}")`,
            }
            : {}
    }
}
