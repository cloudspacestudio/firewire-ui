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
import { MatSlideToggleModule } from "@angular/material/slide-toggle"

import { NavToolbar } from "../../common/components/nav-toolbar"
import { PageToolbar } from "../../common/components/page-toolbar"
import { DevicePartPriceSyncService } from "../../common/services/device-part-price-sync.service"
import { DeviceSetDetail } from "../../schemas/device-set.schema"
import { VwDevice } from "../../schemas/vwdevice.schema"
import { VwDeviceMaterial } from "../../schemas/vwdevicematerial.schema"
import { Vendor } from "../../schemas/vendor.schema"
import { VwPart } from "../../schemas/vwpart.schema"

interface DeviceSetImportResultRow {
    sourceName: string
    disposition: 'added' | 'already-linked' | 'not-found' | 'part-found' | 'created-from-part' | 'duplicate'
    matchedDeviceName?: string
    matchedPartNumber?: string
    vendorPart?: VwPart | null
    createWorking?: boolean
}

interface DeviceSetImportDialogData {
    vendors: Vendor[]
    devices: VwDevice[]
    selectedDeviceIds: string[]
}

interface DeviceSetVisibilityOption {
    value: string
    label: string
}

interface DeviceSetAddDevicesDialogData {
    devices: VwDevice[]
    selectedDeviceIds: string[]
}

interface DeviceSetLinkedPartsDialogData {
    deviceSetId: string
}

interface DeviceSetLinkedPartRow extends VwDeviceMaterial {
    sourceDeviceName: string
    sourceDevicePartNumber: string
    sourceDeviceVendorName: string
    currentVendorPrice: number | null
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
    readonly visibilityOptions: DeviceSetVisibilityOption[] = [
        { value: 'all-users', label: 'All Users' },
        { value: 'current-user', label: 'Just Me' },
        { value: 'fire-alarm', label: 'Fire Alarm' },
        { value: 'sprinkler', label: 'Sprinkler' },
        { value: 'security', label: 'Security' }
    ]
    pageWorking = true
    saveWorking = false
    errText?: string
    statusText = ''
    navItems = NavToolbar.DeviceNavItems
    deviceSetId = ''
    detail: DeviceSetDetail | null = null
    editName = ''
    editVisibility: string[] = ['all-users']
    allDevices: VwDevice[] = []
    availableVendors: Vendor[] = []
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
            this.http.get<{ rows?: Vendor[] }>('/api/firewire/vendors').toPromise()
        ]).then(([detailResponse, devicesResponse, vendorsResponse]) => {
            this.detail = detailResponse?.data || null
            this.editName = String(this.detail?.name || '')
            this.editVisibility = this.normalizeVisibility(this.detail?.visibility)
            this.allDevices = Array.isArray(devicesResponse?.rows) ? devicesResponse.rows : []
            const devicesVendorIds = new Set(this.allDevices.map((row) => String(row.vendorId || '').trim()).filter(Boolean))
            this.availableVendors = (Array.isArray(vendorsResponse?.rows) ? vendorsResponse.rows : [])
                .filter((row) => devicesVendorIds.has(String(row.vendorId || '').trim()))
                .sort((left, right) => String(left.name || '').localeCompare(String(right.name || '')))
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

    addDevice(deviceId: string) {
        this.selectedDeviceIds.add(deviceId)
        this.selectedDeviceIds = new Set(this.selectedDeviceIds)
    }

    removeDevice(deviceId: string) {
        this.selectedDeviceIds.delete(deviceId)
        this.selectedDeviceIds = new Set(this.selectedDeviceIds)
    }

    async openImportDialog() {
        this.releaseFocusedElementBeforeDialog()
        const dialogRef = this.dialog.open(DeviceSetImportDialog, {
            width: '880px',
            maxWidth: '96vw',
            panelClass: 'fw-fit-content-dialog-pane',
            data: {
                vendors: this.availableVendors,
                devices: this.allDevices,
                selectedDeviceIds: Array.from(this.selectedDeviceIds)
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

    openLinkedPartsDialog(): void {
        if (!this.deviceSetId) {
            return
        }
        this.releaseFocusedElementBeforeDialog()
        this.dialog.open(DeviceSetLinkedPartsDialog, {
            width: '1180px',
            maxWidth: '96vw',
            maxHeight: '88vh',
            panelClass: 'fw-fit-content-dialog-pane',
            data: {
                deviceSetId: this.deviceSetId
            } satisfies DeviceSetLinkedPartsDialogData
        })
    }

    async openAddDevicesDialog() {
        this.releaseFocusedElementBeforeDialog()
        const dialogRef = this.dialog.open(DeviceSetAddDevicesDialog, {
            width: '960px',
            maxWidth: '96vw',
            panelClass: 'fw-fit-content-dialog-pane',
            data: {
                devices: this.allDevices,
                selectedDeviceIds: Array.from(this.selectedDeviceIds)
            } satisfies DeviceSetAddDevicesDialogData
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
        this.statusText = `Added ${addedDeviceIds.length} device${addedDeviceIds.length === 1 ? '' : 's'} to the working set. Save Changes to persist them.`
    }

    saveChanges() {
        const name = this.editName.trim()
        if (!this.deviceSetId || !name) {
            return
        }
        this.saveWorking = true
        this.statusText = 'Saving device set...'
        Promise.all([
            this.http.patch(`/api/firewire/device-sets/${this.deviceSetId}`, { name, visibility: this.normalizeVisibility(this.editVisibility) }).toPromise(),
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

    getVisibilitySummary(): string {
        return this.normalizeVisibility(this.editVisibility)
            .map((value) => this.visibilityOptions.find((option) => option.value === value)?.label || value)
            .join(', ')
    }

    private normalizeVisibility(value: unknown): string[] {
        const allowed = new Set(this.visibilityOptions.map((option) => option.value))
        const source = Array.isArray(value) ? value : []
        const normalized = Array.from(new Set(source
            .map((item) => String(item || '').trim().toLowerCase())
            .filter((item) => allowed.has(item))))
        return normalized.length > 0 ? normalized : ['all-users']
    }

    private releaseFocusedElementBeforeDialog(): void {
        const active = document.activeElement
        if (active instanceof HTMLElement) {
            active.blur()
        }
    }
}

@Component({
    standalone: true,
    selector: 'device-set-add-devices-dialog',
    imports: [CommonModule, FormsModule, MatButtonModule, MatDialogActions, MatDialogClose, MatDialogContent, MatDialogTitle, MatFormFieldModule, MatIconModule, MatInputModule],
    template: `
        <div class="fw-dialog-titlebar" mat-dialog-title>
            <div class="fw-dialog-titlebar__text">Add Devices</div>
            <button mat-icon-button type="button" class="fw-dialog-titlebar__close" aria-label="Cancel add devices" mat-dialog-close>
                <mat-icon>close</mat-icon>
            </button>
        </div>
        <mat-dialog-content class="device-set-add-dialog">
            <div class="device-set-add-dialog__grid">
                <section class="device-set-add-dialog__column">
                    <mat-form-field appearance="outline" class="device-set-add-dialog__filter">
                        <mat-label>Find Devices</mat-label>
                        <input matInput [(ngModel)]="filterText" placeholder="Name, part number, vendor, category" />
                    </mat-form-field>
                    <div class="device-set-add-dialog__hint">Showing up to 100 devices that are not already in this set.</div>
                    <div *ngIf="availableDevices.length <= 0" class="device-set-add-dialog__empty">No matching devices available.</div>
                    <div class="device-set-add-dialog__list" *ngIf="availableDevices.length > 0">
                        <div class="device-set-add-dialog__row" *ngFor="let row of availableDevices">
                            <div class="device-set-add-dialog__copy">
                                <div class="device-set-add-dialog__title">{{row.name}}</div>
                                <div class="device-set-add-dialog__meta">{{row.partNumber}} · {{row.vendorName}} · {{row.categoryName}} · {{row.cost | currency}}</div>
                            </div>
                            <button mat-flat-button type="button" (click)="addDevice(row.deviceId)">Add</button>
                        </div>
                    </div>
                </section>

                <section class="device-set-add-dialog__column device-set-add-dialog__column--selection">
                    <div class="device-set-add-dialog__selection-group">
                        <div class="device-set-add-dialog__selection-heading">Pending Devices</div>
                        <div *ngIf="pendingDevices.length <= 0" class="device-set-add-dialog__empty">No pending devices selected yet.</div>
                        <div class="device-set-add-dialog__list device-set-add-dialog__list--compact" *ngIf="pendingDevices.length > 0">
                            <div class="device-set-add-dialog__row device-set-add-dialog__row--pending" *ngFor="let row of pendingDevices">
                                <div class="device-set-add-dialog__copy">
                                    <div class="device-set-add-dialog__title">{{row.name}}</div>
                                    <div class="device-set-add-dialog__meta">{{row.partNumber}} · {{row.vendorName}} · {{row.categoryName}}</div>
                                </div>
                                <button mat-icon-button type="button" [attr.aria-label]="'Remove pending ' + row.name" (click)="removePendingDevice(row.deviceId)">
                                    <mat-icon>close</mat-icon>
                                </button>
                            </div>
                        </div>
                    </div>

                    <div class="device-set-add-dialog__selection-group">
                        <div class="device-set-add-dialog__selection-heading">Existing Devices</div>
                        <div *ngIf="existingDevices.length <= 0" class="device-set-add-dialog__empty">No devices are saved in this set yet.</div>
                        <div class="device-set-add-dialog__list device-set-add-dialog__list--compact" *ngIf="existingDevices.length > 0">
                            <div class="device-set-add-dialog__row device-set-add-dialog__row--existing" *ngFor="let row of existingDevices">
                                <div class="device-set-add-dialog__copy">
                                    <div class="device-set-add-dialog__title">{{row.name}}</div>
                                    <div class="device-set-add-dialog__meta">{{row.partNumber}} · {{row.vendorName}} · {{row.categoryName}}</div>
                                </div>
                                <span class="device-set-add-dialog__badge">In Set</span>
                            </div>
                        </div>
                    </div>
                </section>
            </div>
        </mat-dialog-content>
        <mat-dialog-actions align="end">
            <button mat-stroked-button mat-dialog-close type="button">Cancel</button>
            <button mat-flat-button type="button" [disabled]="addedDeviceIds.length <= 0" (click)="apply()">Add Pending</button>
        </mat-dialog-actions>
    `,
    styles: [`
        .device-set-add-dialog {
            width: min(1120px, 94vw);
            padding-top: 12px;
        }

        .device-set-add-dialog__grid {
            display: grid;
            grid-template-columns: minmax(0, 1.15fr) minmax(340px, 0.85fr);
            gap: 14px;
            align-items: start;
        }

        .device-set-add-dialog__column {
            display: grid;
            gap: 10px;
            min-width: 0;
        }

        .device-set-add-dialog__column--selection {
            border-left: 1px solid rgba(72, 221, 255, 0.16);
            padding-left: 14px;
        }

        .device-set-add-dialog__filter {
            width: 100%;
        }

        .device-set-add-dialog__hint,
        .device-set-add-dialog__empty,
        .device-set-add-dialog__meta {
            color: var(--fw-muted);
        }

        .device-set-add-dialog__selection-group {
            display: grid;
            gap: 8px;
        }

        .device-set-add-dialog__selection-heading {
            color: var(--fw-accent-2);
            font-size: 0.74rem;
            letter-spacing: 0.08em;
            text-transform: uppercase;
        }

        .device-set-add-dialog__list {
            display: grid;
            gap: 8px;
            max-height: min(52vh, 520px);
            overflow: auto;
        }

        .device-set-add-dialog__list--compact {
            max-height: min(24vh, 250px);
        }

        .device-set-add-dialog__row {
            display: grid;
            grid-template-columns: minmax(0, 1fr) auto;
            gap: 10px;
            align-items: center;
            padding: 10px 12px;
            border: 1px solid rgba(72, 221, 255, 0.16);
            background: linear-gradient(180deg, rgba(17, 37, 58, 0.7), rgba(10, 19, 33, 0.92));
        }

        .device-set-add-dialog__row--pending {
            border-color: rgba(255, 164, 61, 0.42);
            background: linear-gradient(180deg, rgba(70, 47, 19, 0.56), rgba(21, 19, 16, 0.92));
        }

        .device-set-add-dialog__row--existing {
            opacity: 0.82;
        }

        .device-set-add-dialog__copy {
            min-width: 0;
        }

        .device-set-add-dialog__title {
            font-size: 1rem;
        }

        .device-set-add-dialog__meta {
            white-space: nowrap;
            overflow: hidden;
            text-overflow: ellipsis;
        }

        .device-set-add-dialog__badge {
            color: var(--fw-muted);
            font-size: 0.72rem;
            letter-spacing: 0.08em;
            text-transform: uppercase;
        }

        @media (max-width: 920px) {
            .device-set-add-dialog__grid {
                grid-template-columns: 1fr;
            }

            .device-set-add-dialog__column--selection {
                border-left: 0;
                border-top: 1px solid rgba(72, 221, 255, 0.16);
                padding-left: 0;
                padding-top: 14px;
            }
        }

        @media (max-width: 720px) {
            .device-set-add-dialog__row {
                grid-template-columns: 1fr;
            }
        }
    `]
})
class DeviceSetAddDevicesDialog {
    filterText = ''
    addedDeviceIds: string[] = []
    private selectedDeviceIds: Set<string>
    private existingDeviceIds: Set<string>

    constructor(
        @Inject(MAT_DIALOG_DATA) public data: DeviceSetAddDevicesDialogData,
        private dialogRef: MatDialogRef<DeviceSetAddDevicesDialog>
    ) {
        this.selectedDeviceIds = new Set(this.data.selectedDeviceIds)
        this.existingDeviceIds = new Set(this.data.selectedDeviceIds)
    }

    get availableDevices(): VwDevice[] {
        const filter = this.filterText.trim().toLowerCase()
        return this.data.devices
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

    get existingDevices(): VwDevice[] {
        return this.data.devices
            .filter((row) => this.existingDeviceIds.has(row.deviceId))
            .sort((left, right) => left.name.localeCompare(right.name))
    }

    get pendingDevices(): VwDevice[] {
        const pendingIds = new Set(this.addedDeviceIds)
        return this.data.devices
            .filter((row) => pendingIds.has(row.deviceId))
            .sort((left, right) => left.name.localeCompare(right.name))
    }

    addDevice(deviceId: string): void {
        this.selectedDeviceIds.add(deviceId)
        if (!this.addedDeviceIds.includes(deviceId)) {
            this.addedDeviceIds = [...this.addedDeviceIds, deviceId]
        }
    }

    removePendingDevice(deviceId: string): void {
        if (this.existingDeviceIds.has(deviceId)) {
            return
        }
        this.selectedDeviceIds.delete(deviceId)
        this.addedDeviceIds = this.addedDeviceIds.filter((item) => item !== deviceId)
    }

    apply(): void {
        this.dialogRef.close({ addedDeviceIds: this.addedDeviceIds })
    }
}

@Component({
    standalone: true,
    selector: 'device-set-linked-parts-dialog',
    imports: [CommonModule, FormsModule, MatButtonModule, MatDialogActions, MatDialogClose, MatDialogContent, MatDialogTitle, MatFormFieldModule, MatIconModule, MatInputModule],
    template: `
        <div class="fw-dialog-titlebar" mat-dialog-title>
            <div class="fw-dialog-titlebar__text">Linked Parts</div>
            <button mat-icon-button type="button" class="fw-dialog-titlebar__close" aria-label="Close linked parts" mat-dialog-close>
                <mat-icon>close</mat-icon>
            </button>
        </div>
        <mat-dialog-content class="device-set-linked-parts-dialog">
            <div class="device-set-linked-parts-dialog__topline">
                <div>
                    <div class="device-set-linked-parts-dialog__title">{{detail?.name || 'Device Set'}}</div>
                    <div class="device-set-linked-parts-dialog__subtitle">Underlying linked parts for every device in this set.</div>
                </div>
                <button mat-stroked-button type="button" [disabled]="syncWorking || pageWorking" (click)="syncDeviceSetPartPrices()">
                    <mat-icon>sync</mat-icon>
                    <span>{{syncWorking ? 'Refreshing...' : 'Refresh Prices'}}</span>
                </button>
            </div>

            <div *ngIf="errText" class="device-set-linked-parts-dialog__status">{{errText}}</div>
            <div *ngIf="statusText" class="device-set-linked-parts-dialog__status">{{statusText}}</div>

            <div class="device-set-linked-parts-dialog__summary">
                <div class="device-set-linked-parts-dialog__stat">
                    <span>Devices</span>
                    <strong>{{deviceCount}}</strong>
                </div>
                <div class="device-set-linked-parts-dialog__stat">
                    <span>Linked Parts</span>
                    <strong>{{partRows.length}}</strong>
                </div>
                <div class="device-set-linked-parts-dialog__stat">
                    <span>Material Cost</span>
                    <strong>{{totalMaterialCost | currency}}</strong>
                </div>
                <div class="device-set-linked-parts-dialog__stat">
                    <span>Vendor Cost</span>
                    <strong>{{totalVendorCost | currency}}</strong>
                </div>
                <div class="device-set-linked-parts-dialog__stat">
                    <span>Out Of Sync</span>
                    <strong>{{outOfSyncCount}}</strong>
                </div>
            </div>

            <mat-form-field appearance="outline" class="device-set-linked-parts-dialog__filter">
                <mat-label>Filter linked parts</mat-label>
                <input matInput [(ngModel)]="filterText" placeholder="Device, part number, vendor, category" />
            </mat-form-field>

            <div class="device-set-linked-parts-dialog__table">
                <div class="device-set-linked-parts-dialog__row device-set-linked-parts-dialog__row--header">
                    <span>Device</span>
                    <span>Device Part</span>
                    <span>Linked Part</span>
                    <span>Description</span>
                    <span>Stored Cost</span>
                    <span>Vendor Price</span>
                    <span>Labor</span>
                    <span>Category</span>
                </div>

                <div *ngIf="pageWorking" class="device-set-linked-parts-dialog__empty">Loading linked part details...</div>
                <div *ngIf="!pageWorking && filteredPartRows.length <= 0" class="device-set-linked-parts-dialog__empty">
                    No linked parts match the current filter.
                </div>

                <div class="device-set-linked-parts-dialog__row" *ngFor="let row of filteredPartRows">
                    <span>
                        <strong>{{row.sourceDeviceName}}</strong>
                        <small>{{row.sourceDeviceVendorName}}</small>
                    </span>
                    <span>{{row.sourceDevicePartNumber}}</span>
                    <span>{{row.materialPartNumber}}</span>
                    <span>
                        <strong>{{row.materialName}}</strong>
                        <small>{{row.materialShortName || row.org}}</small>
                    </span>
                    <span [class.is-out-of-sync]="isPriceOutOfSync(row)">{{row.materialCost | currency}}</span>
                    <span>{{row.currentVendorPrice === null ? 'No match' : (row.currentVendorPrice | currency)}}</span>
                    <span>{{row.materialDefaultLabor || 0}}</span>
                    <span>{{row.deviceCategoryName || row.deviceCategoryShortName}}</span>
                </div>
            </div>
        </mat-dialog-content>
        <mat-dialog-actions align="end">
            <button mat-stroked-button mat-dialog-close type="button">Cancel</button>
        </mat-dialog-actions>
    `,
    styles: [`
        .device-set-linked-parts-dialog {
            width: min(1120px, 94vw);
            display: grid;
            gap: 14px;
            padding-top: 12px;
        }

        .device-set-linked-parts-dialog__topline {
            display: flex;
            align-items: flex-start;
            justify-content: space-between;
            gap: 16px;
        }

        .device-set-linked-parts-dialog__title {
            font-size: 1.2rem;
            letter-spacing: 0.04em;
        }

        .device-set-linked-parts-dialog__subtitle,
        .device-set-linked-parts-dialog__status,
        .device-set-linked-parts-dialog__empty {
            color: var(--fw-muted);
        }

        .device-set-linked-parts-dialog__summary {
            display: grid;
            grid-template-columns: repeat(5, minmax(0, 1fr));
            gap: 8px;
        }

        .device-set-linked-parts-dialog__stat {
            display: grid;
            gap: 6px;
            padding: 10px;
            border: 1px solid rgba(72, 221, 255, 0.16);
            background: rgba(8, 14, 25, 0.72);
        }

        .device-set-linked-parts-dialog__stat span {
            color: var(--fw-muted);
            font-size: 0.72rem;
            letter-spacing: 0.08em;
            text-transform: uppercase;
        }

        .device-set-linked-parts-dialog__stat strong {
            color: var(--fw-accent-2);
            font-size: 1.02rem;
        }

        .device-set-linked-parts-dialog__filter {
            width: min(520px, 100%);
        }

        .device-set-linked-parts-dialog__table {
            max-height: min(48vh, 520px);
            overflow: auto;
            border: 1px solid rgba(72, 221, 255, 0.14);
            background: rgba(7, 12, 22, 0.9);
        }

        .device-set-linked-parts-dialog__row {
            display: grid;
            grid-template-columns: minmax(180px, 1.1fr) 130px 140px minmax(250px, 1.35fr) 110px 110px 80px minmax(150px, 0.85fr);
            min-width: 1210px;
            align-items: center;
            gap: 12px;
            padding: 10px 12px;
            border-top: 1px solid rgba(72, 221, 255, 0.08);
        }

        .device-set-linked-parts-dialog__row--header {
            position: sticky;
            top: 0;
            z-index: 1;
            border-top: 0;
            background: rgba(8, 14, 25, 0.98);
            color: var(--fw-accent-2);
            font-size: 0.72rem;
            letter-spacing: 0.08em;
            text-transform: uppercase;
        }

        .device-set-linked-parts-dialog__row span {
            min-width: 0;
            overflow: hidden;
            text-overflow: ellipsis;
        }

        .device-set-linked-parts-dialog__row strong,
        .device-set-linked-parts-dialog__row small {
            display: block;
            min-width: 0;
            overflow: hidden;
            text-overflow: ellipsis;
            white-space: nowrap;
        }

        .device-set-linked-parts-dialog__row small {
            color: var(--fw-muted);
        }

        .device-set-linked-parts-dialog__row .is-out-of-sync {
            color: #ffd36b;
            font-weight: 700;
        }

        .device-set-linked-parts-dialog__empty {
            padding: 16px 12px;
        }

        @media (max-width: 800px) {
            .device-set-linked-parts-dialog__topline {
                flex-direction: column;
            }

            .device-set-linked-parts-dialog__summary {
                grid-template-columns: 1fr;
            }
        }
    `]
})
class DeviceSetLinkedPartsDialog implements OnInit {
    detail: DeviceSetDetail | null = null
    partRows: DeviceSetLinkedPartRow[] = []
    vendorPartMap = new Map<string, VwPart>()
    pageWorking = true
    syncWorking = false
    errText = ''
    statusText = ''
    filterText = ''

    constructor(
        @Inject(MAT_DIALOG_DATA) public data: DeviceSetLinkedPartsDialogData,
        private http: HttpClient,
        private priceSync: DevicePartPriceSyncService
    ) {}

    ngOnInit(): void {
        void this.load()
    }

    async load(): Promise<void> {
        const deviceSetId = String(this.data.deviceSetId || '').trim()
        if (!deviceSetId) {
            this.errText = 'Missing device set id.'
            this.pageWorking = false
            return
        }

        this.pageWorking = true
        this.errText = ''

        try {
            const [detailResponse, vendorParts] = await Promise.all([
                firstValueFrom(this.http.get<{ data?: DeviceSetDetail }>(`/api/firewire/device-sets/${deviceSetId}`)),
                this.priceSync.getVendorPartRows()
            ])
            this.detail = detailResponse?.data || null
            this.vendorPartMap = this.priceSync.createVendorPartMap(vendorParts)
            const devices = this.detail?.devices || []
            const materialResults = await Promise.all(devices.map(async (device) => {
                const response = await firstValueFrom(this.http.get<{ rows?: VwDeviceMaterial[] }>(`/api/firewire/vwdevicematerials/${device.deviceId}`))
                return (Array.isArray(response?.rows) ? response.rows : []).map((material) => ({
                    ...material,
                    sourceDeviceName: device.name,
                    sourceDevicePartNumber: device.partNumber,
                    sourceDeviceVendorName: device.vendorName,
                    currentVendorPrice: this.getCurrentVendorPrice(material.materialPartNumber)
                } as DeviceSetLinkedPartRow))
            }))

            this.partRows = materialResults
                .flat()
                .sort((left, right) => {
                    const deviceCompare = left.sourceDeviceName.localeCompare(right.sourceDeviceName)
                    return deviceCompare || String(left.materialName || '').localeCompare(String(right.materialName || ''))
                })
        } catch (err: any) {
            this.errText = err?.error?.message || err?.message || 'Unable to load linked part details.'
        } finally {
            this.pageWorking = false
        }
    }

    async syncDeviceSetPartPrices(): Promise<void> {
        const devices = this.detail?.devices || []
        if (devices.length <= 0) {
            this.statusText = 'No devices are linked to this set.'
            return
        }

        this.syncWorking = true
        this.statusText = 'Refreshing linked part prices from vendor list...'
        try {
            const results = []
            for (const device of devices) {
                results.push(await this.priceSync.syncDevice(device.deviceId))
            }
            const updatedCount = results.filter((result) => result.updated).length
            const missingCount = results.reduce((total, result) => total + result.missingPartNumbers.length, 0)
            this.statusText = `Updated ${updatedCount} device${updatedCount === 1 ? '' : 's'} from vendor prices.${missingCount > 0 ? ` ${missingCount} linked part${missingCount === 1 ? '' : 's'} still missing vendor price matches.` : ''}`
            await this.load()
        } catch (err: any) {
            this.statusText = err?.error?.message || err?.message || 'Unable to refresh linked part prices.'
        } finally {
            this.syncWorking = false
        }
    }

    get filteredPartRows(): DeviceSetLinkedPartRow[] {
        const filter = this.filterText.trim().toLowerCase()
        if (!filter) {
            return this.partRows
        }

        return this.partRows.filter((row) => [
            row.sourceDeviceName,
            row.sourceDevicePartNumber,
            row.sourceDeviceVendorName,
            row.materialName,
            row.materialPartNumber,
            row.materialShortName,
            row.deviceCategoryName,
            row.org
        ].join(' ').toLowerCase().includes(filter))
    }

    get deviceCount(): number {
        return this.detail?.devices?.length || 0
    }

    get totalMaterialCost(): number {
        return this.partRows.reduce((total, row) => total + Number(row.materialCost || 0), 0)
    }

    get totalVendorCost(): number {
        return this.partRows.reduce((total, row) => total + Number(row.currentVendorPrice ?? row.materialCost ?? 0), 0)
    }

    get outOfSyncCount(): number {
        return this.partRows.filter((row) => this.isPriceOutOfSync(row)).length
    }

    isPriceOutOfSync(row: DeviceSetLinkedPartRow): boolean {
        if (row.currentVendorPrice === null) {
            return false
        }
        return Math.abs(Number(row.materialCost || 0) - Number(row.currentVendorPrice || 0)) >= 0.005
    }

    private getCurrentVendorPrice(partNumber: string): number | null {
        const vendorPart = this.vendorPartMap.get(this.priceSync.normalizePartNumber(partNumber))
        return vendorPart ? this.priceSync.getVendorPartPrice(vendorPart) : null
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
        <div class="fw-dialog-titlebar" mat-dialog-title>
            <div class="fw-dialog-titlebar__text">Paste Device Names</div>
            <button mat-icon-button type="button" class="fw-dialog-titlebar__close" aria-label="Cancel paste device names" mat-dialog-close>
                <mat-icon>close</mat-icon>
            </button>
        </div>
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
            <button mat-stroked-button mat-dialog-close type="button">Cancel</button>
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
        if (!vendor || !config || this.normalizePartsTargetTable(config.targetTable) !== 'parts') {
            this.statusText = 'Create Device from part is not configured for this vendor yet.'
            return
        }

        this.releaseFocusedElementBeforeDialog()
        const dialogRef = this.dialog.open(DeviceSetCreateDeviceFromPartDialog, {
            width: '560px',
            maxWidth: '95vw',
            panelClass: 'fw-fit-content-dialog-pane',
            data: {
                part: row.vendorPart
            }
        })

        const result = await firstValueFrom(dialogRef.afterClosed())
        if (!result) {
            return
        }

        row.createWorking = true
        this.statusText = `Creating device from ${row.vendorPart.PartNumber}...`
        this.http.post<{ data?: { device?: VwDevice } }>(
            `/api/firewire/vendors/${encodeURIComponent(vendor.vendorId)}/parts/${encodeURIComponent(row.vendorPart.PartNumber)}/create-device`,
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

        let partByPartNumber = new Map<string, VwPart>()
        if (config && this.normalizePartsTargetTable(config.targetTable) === 'parts') {
            const response = await firstValueFrom(this.http.get<{ rows?: VwPart[] }>(`/api/firewire/vendors/${encodeURIComponent(vendorId)}/parts`))
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
            const config = JSON.parse(raw) as { partsVendorKey?: string, targetTable?: string }
            config.targetTable = this.normalizePartsTargetTable(config.targetTable)
            return config
        } catch {
            return null
        }
    }

    private normalizePartsTargetTable(value: string | null | undefined): string {
        const normalized = String(value || '').trim().toLowerCase()
        if (!normalized || normalized === 'part' || normalized === 'parts' || normalized === 'eddypricelist' || normalized === 'vendorpricelist') {
            return 'parts'
        }
        return normalized
    }

    private releaseFocusedElementBeforeDialog(): void {
        const active = document.activeElement
        if (active instanceof HTMLElement) {
            active.blur()
        }
    }
}

interface DeviceSetCreateDeviceFromPartDialogData {
    part: VwPart
}

@Component({
    standalone: true,
    selector: 'fw-device-set-create-device-from-part-dialog',
    imports: [CommonModule, FormsModule, MatButtonModule, MatDialogActions, MatDialogClose, MatDialogContent, MatDialogTitle, MatFormFieldModule, MatIconModule, MatInputModule, MatSelectModule, MatSlideToggleModule],
    template: `
        <div class="fw-dialog-titlebar" mat-dialog-title>
            <div class="fw-dialog-titlebar__text">Create Device From Part</div>
            <button mat-icon-button type="button" class="fw-dialog-titlebar__close" aria-label="Cancel create device" mat-dialog-close>
                <mat-icon>close</mat-icon>
            </button>
        </div>
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
                    <input matInput [(ngModel)]="model.categoryName" />
                    <mat-hint>This becomes the BOM category/type text for this device.</mat-hint>
                </mat-form-field>
                <div>
                    <mat-slide-toggle [(ngModel)]="model.includeOnFloorplan">Include on Floorplan</mat-slide-toggle>
                    <div class="fw-dialog-hint">When enabled, floorplan drops and install task labels use this category with the device name.</div>
                </div>
            </div>
        </mat-dialog-content>
        <mat-dialog-actions align="end">
            <button mat-stroked-button mat-dialog-close type="button">Cancel</button>
            <button mat-flat-button type="button" [mat-dialog-close]="getResult()" [disabled]="!canSave()">Create Device</button>
        </mat-dialog-actions>
    `,
    styles: [`.fw-dialog-stack{display:grid;gap:12px;min-width:min(460px,100%)}.fw-dialog-hint{margin-top:4px;color:rgba(214,238,255,.72);font-size:12px;line-height:1.35}`]
})
class DeviceSetCreateDeviceFromPartDialog {
    readonly data = inject<DeviceSetCreateDeviceFromPartDialogData>(MAT_DIALOG_DATA)
    readonly partCategoryName = String(this.data.part.Category || '').trim()
    model = {
        name: this.getDefaultDeviceName(),
        shortName: this.data.part.PartNumber || '',
        categoryName: this.partCategoryName,
        includeOnFloorplan: !!this.partCategoryName
    }

    private getDefaultDeviceName(): string {
        const description = String(this.data.part.LongDescription || '').trim()
        if (!description || description.length > 30) {
            return String(this.data.part.PartNumber || '').trim()
        }
        return description
    }

    canSave(): boolean {
        return !!this.model.name.trim() && !!this.model.shortName.trim()
    }

    getResult() {
        return this.canSave() ? {
            name: this.model.name.trim(),
            shortName: this.model.shortName.trim(),
            categoryName: this.model.categoryName.trim(),
            includeOnFloorplan: !!this.model.includeOnFloorplan
        } : null
    }
}
