import { CommonModule } from '@angular/common'
import { Component, Input, inject } from '@angular/core'
import { FormsModule } from '@angular/forms'

import { MatButtonModule } from '@angular/material/button'
import { MAT_DIALOG_DATA, MatDialog, MatDialogActions, MatDialogClose, MatDialogContent, MatDialogTitle } from '@angular/material/dialog'
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
        return typeof this.host?.exportBomCsv === 'function'
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

    private getSections(): any[] {
        return Array.isArray(this.host?.bomSections) ? this.host.bomSections : []
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
                    <div class="bom-source-dialog__eyebrow">{{data.kind === 'device' ? 'Displaying Device' : 'Displaying Vendor Part'}}</div>
                    <div class="bom-source-dialog__title">{{getTitle()}}</div>
                    <div class="bom-source-dialog__subtitle">{{getSubtitle()}}</div>
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
        .bom-source-dialog__banner{display:grid;gap:4px;padding:12px 14px;border:1px solid rgba(72,221,255,.2);border-left:4px solid rgba(72,221,255,.78);border-radius:0;background:linear-gradient(90deg,rgba(72,221,255,.12),rgba(72,221,255,.02))}
        .bom-source-dialog__banner--part{border-left-color:rgba(255,164,61,.84);background:linear-gradient(90deg,rgba(255,164,61,.12),rgba(72,221,255,.02))}
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
        @media (max-width:760px){.bom-source-dialog{width:calc(100vw - 64px)}.bom-source-dialog__details{grid-template-columns:repeat(2,minmax(0,1fr))}}
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
}
