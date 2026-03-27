import { Component, Inject, OnInit, inject } from "@angular/core"
import { CommonModule } from "@angular/common"
import { ActivatedRoute, Router, RouterLink } from "@angular/router"
import { HttpClient } from "@angular/common/http"
import { FormsModule } from "@angular/forms"
import { firstValueFrom } from "rxjs"

import { MatButtonModule } from "@angular/material/button"
import { MAT_DIALOG_DATA, MatDialog, MatDialogActions, MatDialogClose, MatDialogContent, MatDialogRef, MatDialogTitle } from "@angular/material/dialog"
import { MatFormFieldModule } from "@angular/material/form-field"
import { MatIconModule } from "@angular/material/icon"
import { MatInputModule } from "@angular/material/input"
import { MatSelectModule } from "@angular/material/select"

import { NavToolbar } from "../../common/components/nav-toolbar"
import { PageToolbar } from "../../common/components/page-toolbar"
import { DeviceSetDetail } from "../../schemas/device-set.schema"
import { VwDevice } from "../../schemas/vwdevice.schema"
import { Vendor } from "../../schemas/vendor.schema"
import { Category } from "../../schemas/category.schema"
import { VwEddyPricelist } from "../../schemas/vwEddyPricelist"

interface DeviceSetImportResultRow {
    sourceName: string
    disposition: 'added' | 'already-linked' | 'not-found' | 'part-found' | 'created-from-part' | 'duplicate'
    matchedDeviceName?: string
    matchedPartNumber?: string
    vendorPart?: VwEddyPricelist | null
    createWorking?: boolean
}

interface DeviceSetImportDialogData {
    vendors: Vendor[]
    devices: VwDevice[]
    selectedDeviceIds: string[]
    categories: Category[]
}

@Component({
    standalone: true,
    selector: 'device-set-page',
    imports: [
        CommonModule,
        FormsModule,
        RouterLink,
        MatButtonModule,
        MatFormFieldModule,
        MatIconModule,
        MatInputModule,
        MatSelectModule,
        PageToolbar,
        NavToolbar
    ],
    providers: [HttpClient],
    templateUrl: './device-set.page.html',
    styleUrls: ['./device-set.page.scss']
})
export class DeviceSetPage implements OnInit {
    pageWorking = true
    saveWorking = false
    errText?: string
    statusText = ''
    navItems = NavToolbar.DeviceNavItems
    deviceSetId = ''
    detail: DeviceSetDetail | null = null
    editName = ''
    allDevices: VwDevice[] = []
    availableVendors: Vendor[] = []
    categories: Category[] = []
    selectedDeviceIds = new Set<string>()
    availableFilter = ''

    constructor(private route: ActivatedRoute, private http: HttpClient, private router: Router, private dialog: MatDialog) {}

    ngOnInit(): void {
        this.deviceSetId = String(this.route.snapshot.paramMap.get('deviceSetId') || '').trim()
        this.load()
    }

    load() {
        if (!this.deviceSetId) {
            this.errText = 'Missing device set id.'
            this.pageWorking = false
            return
        }
        this.pageWorking = true
        this.errText = undefined
        Promise.all([
            this.http.get<{ data?: DeviceSetDetail }>(`/api/firewire/device-sets/${this.deviceSetId}`).toPromise(),
            this.http.get<{ rows?: VwDevice[] }>('/api/firewire/vwdevices').toPromise(),
            this.http.get<{ rows?: Vendor[] }>('/api/firewire/vendors').toPromise(),
            this.http.get<{ rows?: Category[] }>('/api/firewire/categories').toPromise()
        ]).then(([detailResponse, devicesResponse, vendorsResponse, categoriesResponse]) => {
            this.detail = detailResponse?.data || null
            this.editName = String(this.detail?.name || '')
            this.allDevices = Array.isArray(devicesResponse?.rows) ? devicesResponse.rows : []
            const devicesVendorIds = new Set(this.allDevices.map((row) => String(row.vendorId || '').trim()).filter(Boolean))
            this.availableVendors = (Array.isArray(vendorsResponse?.rows) ? vendorsResponse.rows : [])
                .filter((row) => devicesVendorIds.has(String(row.vendorId || '').trim()))
                .sort((left, right) => String(left.name || '').localeCompare(String(right.name || '')))
            this.categories = Array.isArray(categoriesResponse?.rows) ? categoriesResponse.rows : []
            this.selectedDeviceIds = new Set((this.detail?.devices || []).map((row) => row.deviceId))
            this.pageWorking = false
        }).catch((err: any) => {
            this.errText = err?.error?.message || err?.message || 'Unable to load device set.'
            this.pageWorking = false
        })
    }

    get linkedDevices(): VwDevice[] {
        return this.allDevices
            .filter((row) => this.selectedDeviceIds.has(row.deviceId))
            .sort((left, right) => left.name.localeCompare(right.name))
    }

    get availableDevices(): VwDevice[] {
        const filter = this.availableFilter.trim().toLowerCase()
        return this.allDevices
            .filter((row) => !this.selectedDeviceIds.has(row.deviceId))
            .filter((row) => {
                if (!filter) {
                    return true
                }
                const haystack = [
                    row.name,
                    row.partNumber,
                    row.shortName,
                    row.vendorName,
                    row.categoryName
                ].join(' ').toLowerCase()
                return haystack.includes(filter)
            })
            .sort((left, right) => left.name.localeCompare(right.name))
            .slice(0, 100)
    }

    addDevice(deviceId: string) {
        this.selectedDeviceIds.add(deviceId)
        this.selectedDeviceIds = new Set(this.selectedDeviceIds)
    }

    removeDevice(deviceId: string) {
        this.selectedDeviceIds.delete(deviceId)
        this.selectedDeviceIds = new Set(this.selectedDeviceIds)
    }

    async openImportDialog() {
        const dialogRef = this.dialog.open(DeviceSetImportDialog, {
            width: '880px',
            maxWidth: '96vw',
            data: {
                vendors: this.availableVendors,
                devices: this.allDevices,
                selectedDeviceIds: Array.from(this.selectedDeviceIds),
                categories: this.categories
            } satisfies DeviceSetImportDialogData
        })
        const result = await dialogRef.afterClosed().toPromise()
        const addedDeviceIds = Array.isArray(result?.addedDeviceIds) ? result.addedDeviceIds as string[] : []
        if (addedDeviceIds.length <= 0) {
            return
        }
        for (const deviceId of addedDeviceIds) {
            this.selectedDeviceIds.add(deviceId)
        }
        this.selectedDeviceIds = new Set(this.selectedDeviceIds)
        this.statusText = `Imported ${addedDeviceIds.length} device${addedDeviceIds.length === 1 ? '' : 's'} into the working set. Save Changes to persist them.`
    }

    saveChanges() {
        const name = this.editName.trim()
        if (!this.deviceSetId || !name) {
            return
        }
        this.saveWorking = true
        this.statusText = 'Saving device set...'
        Promise.all([
            this.http.patch(`/api/firewire/device-sets/${this.deviceSetId}`, { name }).toPromise(),
            this.http.put(`/api/firewire/device-sets/${this.deviceSetId}/devices`, {
                deviceIds: Array.from(this.selectedDeviceIds)
            }).toPromise()
        ]).then(() => {
            this.statusText = 'Device set saved.'
            this.load()
        }).catch((err: any) => {
            this.statusText = err?.error?.message || err?.message || 'Unable to save device set.'
        }).finally(() => {
            this.saveWorking = false
        })
    }

    resetChanges() {
        this.statusText = 'Resetting unsaved changes...'
        this.load()
    }

    getVendorSummary(): string {
        const vendorNames = Array.from(new Set(this.linkedDevices.map((row) => String(row.vendorName || '').trim()).filter(Boolean)))
        if (vendorNames.length <= 0) {
            return 'No vendors represented yet.'
        }
        return vendorNames.join(', ')
    }
}

@Component({
    standalone: true,
    selector: 'device-set-import-dialog',
    imports: [
        CommonModule,
        FormsModule,
        MatButtonModule,
        MatDialogActions,
        MatDialogClose,
        MatDialogContent,
        MatDialogTitle,
        MatFormFieldModule,
        MatIconModule,
        MatInputModule,
        MatSelectModule
    ],
    template: `
        <h2 mat-dialog-title>Paste Device Names</h2>
        <mat-dialog-content class="device-set-import-dialog">
            <div class="device-set-import-form">
                <mat-form-field appearance="outline">
                    <mat-label>Vendor</mat-label>
                    <mat-select [(ngModel)]="selectedVendorId">
                        <mat-option *ngFor="let vendor of data.vendors" [value]="vendor.vendorId">{{vendor.name}}</mat-option>
                    </mat-select>
                </mat-form-field>

                <div class="device-set-import-file">
                    <label class="device-set-import-file__label">Excel / Clipboard Paste</label>
                    <div class="device-set-import-file__hint">Paste a single Excel column or newline-separated list of device names.</div>
                </div>
            </div>

            <mat-form-field appearance="outline" class="device-set-import-textarea">
                <mat-label>Pasted Device Names</mat-label>
                <textarea matInput rows="8" [(ngModel)]="pastedContents" placeholder="Paste Excel cells here"></textarea>
            </mat-form-field>

            <div class="device-set-import-actions-row">
                <button mat-flat-button type="button" [disabled]="working || !selectedVendorId || !pastedContents.trim()" (click)="processImport()">
                    <mat-icon>content_paste_search</mat-icon>
                    <span>Process Paste</span>
                </button>
                <div *ngIf="statusText" class="device-set-import-status">{{statusText}}</div>
            </div>

            <div *ngIf="results.length > 0" class="device-set-import-results">
                <div class="device-set-import-results__summary">
                    {{countCreatedLike()}} added · {{countByDisposition('already-linked')}} already linked · {{countByDisposition('duplicate')}} duplicate · {{countByDisposition('part-found')}} part found · {{countByDisposition('not-found')}} not found
                </div>
                <div class="device-set-import-results__table">
                    <div class="device-set-import-results__header">
                        <div>CSV Row</div>
                        <div>Disposition</div>
                        <div>Matched Device</div>
                        <div></div>
                    </div>
                    <div class="device-set-import-results__row" *ngFor="let row of results">
                        <div>{{row.sourceName || ' '}}</div>
                        <div>{{formatDisposition(row.disposition)}}</div>
                        <div>{{getMatchedSummary(row)}}</div>
                        <div class="device-set-import-results__action">
                            <button
                                *ngIf="row.disposition === 'part-found' && row.vendorPart"
                                mat-stroked-button
                                type="button"
                                [disabled]="!!row.createWorking"
                                (click)="createDeviceFromPart(row)"
                            >
                                Create Device
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        </mat-dialog-content>
        <mat-dialog-actions align="end">
            <button mat-stroked-button mat-dialog-close type="button">Close</button>
            <button mat-flat-button type="button" [disabled]="addedDeviceIds.length <= 0" (click)="applyImport()">Apply Added Devices</button>
        </mat-dialog-actions>
    `,
    styles: [`
        .device-set-import-dialog {
            display: flex;
            flex-direction: column;
            gap: 14px;
            min-width: min(820px, 92vw);
        }

        .device-set-import-form {
            display: grid;
            grid-template-columns: minmax(220px, 300px) minmax(0, 1fr);
            gap: 14px;
            align-items: start;
        }

        .device-set-import-file {
            padding-top: 6px;
        }

        .device-set-import-file__label {
            display: block;
            margin-bottom: 8px;
            color: var(--fw-muted);
            text-transform: uppercase;
            letter-spacing: 0.08em;
            font-size: 0.74rem;
        }

        .device-set-import-file__hint,
        .device-set-import-status,
        .device-set-import-results__summary {
            color: var(--fw-muted);
            font-size: 0.86rem;
        }

        .device-set-import-textarea {
            width: 100%;
        }

        .device-set-import-actions-row {
            display: flex;
            align-items: center;
            gap: 12px;
            flex-wrap: wrap;
        }

        .device-set-import-results__table {
            border: 1px solid rgba(72, 221, 255, 0.18);
            border-radius: 14px;
            overflow: hidden;
        }

        .device-set-import-results__header,
        .device-set-import-results__row {
            display: grid;
            grid-template-columns: minmax(180px, 1.1fr) 160px minmax(220px, 1fr) 150px;
            gap: 12px;
            padding: 10px 12px;
            align-items: center;
        }

        .device-set-import-results__header {
            background: rgba(72, 221, 255, 0.08);
            text-transform: uppercase;
            letter-spacing: 0.08em;
            font-size: 0.72rem;
        }

        .device-set-import-results__row {
            border-top: 1px solid rgba(72, 221, 255, 0.10);
        }

        .device-set-import-results__action {
            display: flex;
            justify-content: flex-end;
        }

        @media (max-width: 820px) {
            .device-set-import-dialog {
                min-width: 0;
            }

            .device-set-import-form,
            .device-set-import-results__header,
            .device-set-import-results__row {
                grid-template-columns: 1fr;
            }
        }
    `]
})
class DeviceSetImportDialog {
    selectedVendorId = ''
    pastedContents = ''
    statusText = ''
    working = false
    results: DeviceSetImportResultRow[] = []
    addedDeviceIds: string[] = []

    constructor(
        @Inject(MAT_DIALOG_DATA) public data: DeviceSetImportDialogData,
        private dialogRef: MatDialogRef<DeviceSetImportDialog>,
        private dialog: MatDialog,
        private http: HttpClient
    ) {}

    processImport() {
        const vendorId = String(this.selectedVendorId || '').trim()
        if (!vendorId) {
            this.statusText = 'Select a vendor first.'
            return
        }
        this.working = true
        this.results = []
        this.addedDeviceIds = []

        const selectedIds = new Set(this.data.selectedDeviceIds)
        this.runLookup(vendorId, selectedIds).finally(() => {
            this.working = false
        })
    }

    applyImport() {
        this.dialogRef.close({
            addedDeviceIds: this.addedDeviceIds
        })
    }

    countByDisposition(disposition: DeviceSetImportResultRow['disposition']): number {
        return this.results.filter((row) => row.disposition === disposition).length
    }

    formatDisposition(disposition: DeviceSetImportResultRow['disposition']): string {
        if (disposition === 'already-linked') {
            return 'Already Linked'
        }
        if (disposition === 'part-found') {
            return 'Part Found'
        }
        if (disposition === 'duplicate') {
            return 'Duplicate'
        }
        if (disposition === 'created-from-part') {
            return 'Created'
        }
        if (disposition === 'not-found') {
            return 'Not Found'
        }
        return 'Added'
    }

    getMatchedSummary(row: DeviceSetImportResultRow): string {
        if (row.matchedDeviceName) {
            return row.matchedDeviceName + (row.matchedPartNumber ? ` · ${row.matchedPartNumber}` : '')
        }
        if (row.vendorPart) {
            return `${row.vendorPart.PartNumber} · ${row.vendorPart.LongDescription || row.vendorPart.Category || ''}`.trim()
        }
        return ' '
    }

    countCreatedLike(): number {
        return this.results.filter((row) => row.disposition === 'added' || row.disposition === 'created-from-part').length
    }

    async createDeviceFromPart(row: DeviceSetImportResultRow) {
        if (!row.vendorPart || row.createWorking) {
            return
        }
        const vendor = this.data.vendors.find((item) => item.vendorId === this.selectedVendorId) || null
        const config = this.parseVendorConfig(vendor)
        if (!vendor || !config || config.targetTable !== 'EddyPricelist' || String(config.partsVendorKey || '').trim().toLowerCase() !== 'edwards') {
            this.statusText = 'Create Device from part is not configured for this vendor yet.'
            return
        }

        const dialogRef = this.dialog.open(DeviceSetCreateDeviceFromPartDialog, {
            width: '560px',
            maxWidth: '95vw',
            data: {
                part: row.vendorPart,
                categories: this.data.categories
            }
        })

        const result = await firstValueFrom(dialogRef.afterClosed())
        if (!result) {
            return
        }

        row.createWorking = true
        this.statusText = `Creating device from ${row.vendorPart.PartNumber}...`
        this.http.post<{ data?: { device?: VwDevice } }>(
            `/api/firewire/eddypricelist/${encodeURIComponent(row.vendorPart.PartNumber)}/create-device`,
            result
        ).subscribe({
            next: (response) => {
                row.createWorking = false
                const createdDevice = response?.data?.device || null
                if (createdDevice?.deviceId) {
                    if (!this.data.devices.some((item) => item.deviceId === createdDevice.deviceId)) {
                        this.data.devices.push(createdDevice)
                    }
                    if (!this.addedDeviceIds.includes(createdDevice.deviceId)) {
                        this.addedDeviceIds = [...this.addedDeviceIds, createdDevice.deviceId]
                    }
                    row.disposition = 'created-from-part'
                    row.matchedDeviceName = createdDevice.name
                    row.matchedPartNumber = createdDevice.partNumber
                    row.vendorPart = null
                    this.statusText = `${createdDevice.name} created from ${createdDevice.partNumber}.`
                    return
                }
                this.statusText = 'Device was created but did not return correctly.'
            },
            error: (err: any) => {
                row.createWorking = false
                const existingDevice = err?.error?.data || null
                if (err?.status === 409 && existingDevice?.deviceId) {
                    if (!this.data.devices.some((item) => item.deviceId === existingDevice.deviceId)) {
                        this.data.devices.push(existingDevice)
                    }
                    if (!this.addedDeviceIds.includes(existingDevice.deviceId)) {
                        this.addedDeviceIds = [...this.addedDeviceIds, existingDevice.deviceId]
                    }
                    row.disposition = 'added'
                    row.matchedDeviceName = existingDevice.name
                    row.matchedPartNumber = existingDevice.partNumber
                    row.vendorPart = null
                    this.statusText = `${existingDevice.name} already existed and was added to the working set.`
                    return
                }
                this.statusText = err?.error?.message || err?.message || 'Unable to create device from part.'
            }
        })
    }

    private parsePastedNames(contents: string): string[] {
        const normalized = String(contents || '').replace(/\r\n/g, '\n').replace(/\r/g, '\n').replace(/^\uFEFF/, '')
        return normalized
            .split('\n')
            .map((line) => {
                const firstTabColumn = line.split('\t')[0] || ''
                const firstCsvColumn = firstTabColumn.split(',')[0] || ''
                return firstCsvColumn.replace(/^"(.*)"$/, '$1').trim()
            })
    }

    private normalizeName(value: string): string {
        return String(value || '').trim().replace(/\s+/g, ' ').toLowerCase()
    }

    private async runLookup(vendorId: string, selectedIds: Set<string>) {
        const importRows = this.parsePastedNames(this.pastedContents)
        const vendor = this.data.vendors.find((row) => String(row.vendorId || '').trim() === vendorId) || null
        const config = this.parseVendorConfig(vendor)
        const vendorDevices = this.data.devices.filter((row) => String(row.vendorId || '').trim() === vendorId)
        const deviceByName = new Map<string, VwDevice>()
        const deviceByPartNumber = new Map<string, VwDevice>()
        for (const row of vendorDevices) {
            const normalized = this.normalizeName(row.name)
            if (normalized && !deviceByName.has(normalized)) {
                deviceByName.set(normalized, row)
            }
            const normalizedPartNumber = String(row.partNumber || '').trim().toLowerCase()
            if (normalizedPartNumber && !deviceByPartNumber.has(normalizedPartNumber)) {
                deviceByPartNumber.set(normalizedPartNumber, row)
            }
        }

        let partByPartNumber = new Map<string, VwEddyPricelist>()
        if (config && config.targetTable === 'EddyPricelist' && String(config.partsVendorKey || '').trim().toLowerCase() === 'edwards') {
            const response = await firstValueFrom(this.http.get<{ rows?: VwEddyPricelist[] }>('/api/firewire/vweddypricelist'))
            const rows = Array.isArray(response?.rows) ? response.rows : []
            partByPartNumber = new Map(rows.map((row) => [String(row.PartNumber || '').trim().toLowerCase(), row] as const))
        }

        const pendingAddedIds = new Set<string>()
        const seenPastedNames = new Set<string>()
        for (const sourceName of importRows) {
            const trimmed = String(sourceName || '').trim()
            if (!trimmed) {
                continue
            }
            const normalizedPastedName = this.normalizeName(trimmed)
            if (seenPastedNames.has(normalizedPastedName)) {
                this.results.push({
                    sourceName: trimmed,
                    disposition: 'duplicate'
                })
                continue
            }
            seenPastedNames.add(normalizedPastedName)

            const match = deviceByName.get(normalizedPastedName)
            if (match) {
                if (selectedIds.has(match.deviceId) || pendingAddedIds.has(match.deviceId)) {
                    this.results.push({
                        sourceName: trimmed,
                        disposition: 'already-linked',
                        matchedDeviceName: match.name,
                        matchedPartNumber: match.partNumber
                    })
                } else {
                    pendingAddedIds.add(match.deviceId)
                    this.results.push({
                        sourceName: trimmed,
                        disposition: 'added',
                        matchedDeviceName: match.name,
                        matchedPartNumber: match.partNumber
                    })
                }
                continue
            }

            const vendorPart = partByPartNumber.get(trimmed.toLowerCase()) || null
            if (vendorPart) {
                const existingDeviceForPart = deviceByPartNumber.get(String(vendorPart.PartNumber || '').trim().toLowerCase()) || null
                if (existingDeviceForPart) {
                    if (selectedIds.has(existingDeviceForPart.deviceId) || pendingAddedIds.has(existingDeviceForPart.deviceId)) {
                        this.results.push({
                            sourceName: trimmed,
                            disposition: 'already-linked',
                            matchedDeviceName: existingDeviceForPart.name,
                            matchedPartNumber: existingDeviceForPart.partNumber
                        })
                    } else {
                        pendingAddedIds.add(existingDeviceForPart.deviceId)
                        this.results.push({
                            sourceName: trimmed,
                            disposition: 'added',
                            matchedDeviceName: existingDeviceForPart.name,
                            matchedPartNumber: existingDeviceForPart.partNumber
                        })
                    }
                    continue
                }
                this.results.push({
                    sourceName: trimmed,
                    disposition: 'part-found',
                    matchedPartNumber: vendorPart.PartNumber,
                    vendorPart
                })
                continue
            }

            this.results.push({
                sourceName: trimmed,
                disposition: 'not-found'
            })
        }

        this.addedDeviceIds = Array.from(pendingAddedIds)
        this.statusText = `Processed ${this.results.length} pasted row${this.results.length === 1 ? '' : 's'}.`
    }

    private parseVendorConfig(vendor: Vendor | null): { partsVendorKey?: string, targetTable?: string } | null {
        const raw = String(vendor?.importConfigJson || '').trim()
        if (!raw) {
            return null
        }
        try {
            return JSON.parse(raw) as { partsVendorKey?: string, targetTable?: string }
        } catch {
            return null
        }
    }
}

interface DeviceSetCreateDeviceFromPartDialogData {
    part: VwEddyPricelist
    categories: Category[]
}

interface DeviceSetCreateDeviceFromPartCategoryOption {
    categoryId: string
    name: string
    pendingCreate?: boolean
}

@Component({
    standalone: true,
    imports: [CommonModule, FormsModule, MatButtonModule, MatDialogActions, MatDialogClose, MatDialogContent, MatDialogTitle, MatFormFieldModule, MatInputModule, MatSelectModule],
    template: `
        <div mat-dialog-title>Create Device From Part</div>
        <mat-dialog-content>
            <div class="fw-dialog-stack">
                <p><strong>{{data.part.PartNumber}}</strong> will be used as the default part number for the new device.</p>
                <mat-form-field>
                    <mat-label>Device Name</mat-label>
                    <input matInput [(ngModel)]="model.name" />
                </mat-form-field>
                <mat-form-field>
                    <mat-label>Short Name</mat-label>
                    <input matInput [(ngModel)]="model.shortName" />
                </mat-form-field>
                <mat-form-field>
                    <mat-label>Category</mat-label>
                    <mat-select [(ngModel)]="model.categoryId">
                        <mat-option *ngFor="let category of categoryOptions" [value]="category.categoryId">
                            {{category.name}}
                        </mat-option>
                    </mat-select>
                    <mat-hint *ngIf="getSelectedCategoryOption()?.pendingCreate">
                        This part category does not exist yet. A new category will be created when the device is created.
                    </mat-hint>
                </mat-form-field>
            </div>
        </mat-dialog-content>
        <mat-dialog-actions align="end">
            <button mat-button mat-dialog-close type="button">Cancel</button>
            <button mat-flat-button type="button" [mat-dialog-close]="getResult()" [disabled]="!canSave()">Create Device</button>
        </mat-dialog-actions>
    `,
    styles: [`.fw-dialog-stack{display:grid;gap:12px;min-width:min(460px,100%)}`]
})
class DeviceSetCreateDeviceFromPartDialog {
    readonly data = inject<DeviceSetCreateDeviceFromPartDialogData>(MAT_DIALOG_DATA)
    readonly partCategoryName = String(this.data.part.Category || '').trim()
    readonly categoryOptions: DeviceSetCreateDeviceFromPartCategoryOption[] = this.buildCategoryOptions()
    model = {
        name: this.getDefaultDeviceName(),
        shortName: this.data.part.PartNumber || '',
        categoryId: this.getDefaultCategoryId()
    }

    private getDefaultDeviceName(): string {
        const description = String(this.data.part.LongDescription || '').trim()
        if (!description || description.length > 30) {
            return String(this.data.part.PartNumber || '').trim()
        }
        return description
    }

    private buildCategoryOptions(): DeviceSetCreateDeviceFromPartCategoryOption[] {
        const baseOptions = this.data.categories.map((category) => ({
            categoryId: category.categoryId,
            name: category.name,
            pendingCreate: false
        }))
        const normalizedPartCategory = this.normalizeCategoryName(this.partCategoryName)
        if (!normalizedPartCategory) {
            return baseOptions
        }
        const existing = baseOptions.find((category) => this.normalizeCategoryName(category.name) === normalizedPartCategory)
        if (existing) {
            return baseOptions
        }
        return [
            {
                categoryId: `__pending__:${this.partCategoryName}`,
                name: this.partCategoryName,
                pendingCreate: true
            },
            ...baseOptions
        ]
    }

    private getDefaultCategoryId(): string {
        const normalizedPartCategory = this.normalizeCategoryName(this.partCategoryName)
        const match = this.categoryOptions.find((category) => this.normalizeCategoryName(category.name) === normalizedPartCategory)
        return match?.categoryId || this.categoryOptions[0]?.categoryId || ''
    }

    private normalizeCategoryName(value: string): string {
        return String(value || '').trim().replace(/\s+/g, ' ').toLowerCase()
    }

    getSelectedCategoryOption(): DeviceSetCreateDeviceFromPartCategoryOption | null {
        return this.categoryOptions.find((category) => category.categoryId === this.model.categoryId) || null
    }

    canSave(): boolean {
        return !!this.model.name.trim() && !!this.model.shortName.trim() && !!this.model.categoryId
    }

    getResult() {
        return this.canSave() ? {
            name: this.model.name.trim(),
            shortName: this.model.shortName.trim(),
            categoryId: this.model.categoryId,
            categoryName: this.getSelectedCategoryOption()?.name || ''
        } : null
    }
}
