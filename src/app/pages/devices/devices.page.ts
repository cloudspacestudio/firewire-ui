import { Component, OnInit, AfterViewInit, ViewChild, inject } from "@angular/core"
import { NgIf, NgFor } from "@angular/common"
import { RouterLink } from "@angular/router"

import { HttpClient } from "@angular/common/http"
import { CommonModule } from "@angular/common"

import { MatButtonModule } from "@angular/material/button"
import { MatDialog, MAT_DIALOG_DATA, MatDialogActions, MatDialogClose, MatDialogContent, MatDialogRef, MatDialogTitle } from "@angular/material/dialog"
import { MatIconModule } from "@angular/material/icon"
import {MatPaginator, MatPaginatorModule} from '@angular/material/paginator';
import {MatSort, MatSortModule, Sort, SortDirection} from '@angular/material/sort';
import {MatTableDataSource, MatTableModule} from '@angular/material/table';
import {MatInputModule} from '@angular/material/input';
import {MatFormFieldModule} from '@angular/material/form-field';

import { PageToolbar } from '../../common/components/page-toolbar';
import { VwDevice } from "../../schemas/vwdevice.schema"
import { NavToolbar } from "../../common/components/nav-toolbar"
import { DevicePartPriceSyncService } from "../../common/services/device-part-price-sync.service"

interface DeviceVendorLinkIssue {
    deviceId: string
    deviceName: string
    vendorId: string
    vendorName: string
    partNumber: string
    sourceKind: 'device' | 'material'
    sourceLabel: string
    ignored: boolean
    ignoreReason?: string | null
}

interface DeviceSetMembershipSummary {
    deviceId: string
    deviceSetCount: number
}

@Component({
    standalone: true,
    selector: 'devices-page',
    imports: [CommonModule, MatButtonModule, 
        RouterLink, 
        MatPaginatorModule, MatSortModule,
        MatTableModule, MatInputModule,
        MatFormFieldModule,
        MatIconModule, PageToolbar, NavToolbar],
    providers: [HttpClient],
    templateUrl: './devices.page.html',
    styleUrls: ['./devices.page.scss']
})
export class DevicesPage implements OnInit, AfterViewInit  {
    readonly baseDisplayedColumns: string[] = ['name', 'partNumber', 'shortName', 'vendorName', 'deviceSetCount', 'cost', 'attributeCount', 'subTaskCount', 'categoryName', 'actions'];

    @ViewChild(MatPaginator) paginator?: MatPaginator;
    @ViewChild(MatSort) sort?: MatSort;

    pageWorking = true
    errText?: string
    devices: VwDevice[] = []
    navItems = NavToolbar.DeviceNavItems
    reconcileWorking = false
    priceSyncWorking = false
    reconcileStatusText = ''
    vendorLinkIssues: DeviceVendorLinkIssue[] = []
    lastReconciledAt: Date | null = null
    textFilter = ''
    currentSortActive = 'name'
    currentSortDirection: SortDirection = 'asc'
    deviceSetCounts = new Map<string, number>()

    datasource: MatTableDataSource<VwDevice> = new MatTableDataSource(this.devices);
    
    constructor(
        private http: HttpClient,
        private dialog: MatDialog,
        private priceSync: DevicePartPriceSyncService
    ) {}

    ngOnInit(): void {
        this.devices = []
        this.textFilter = this.readStoredDevicesFilter()
        const storedSort = this.readStoredDevicesSort()
        this.currentSortActive = storedSort.active
        this.currentSortDirection = storedSort.direction

        Promise.all([
            this.http.get<{ rows?: VwDevice[] }>('/api/firewire/vwdevices').toPromise(),
            this.http.get<{ rows?: DeviceSetMembershipSummary[] }>('/api/firewire/device-sets/device-membership-summary').toPromise()
        ]).then(([devicesResponse, membershipResponse]) => {
            const membershipRows = Array.isArray(membershipResponse?.rows) ? membershipResponse.rows : []
            this.deviceSetCounts = new Map(membershipRows.map((row) => [row.deviceId, Number(row.deviceSetCount || 0)] as const))
            const deviceRows = Array.isArray(devicesResponse?.rows) ? devicesResponse.rows : []
            this.devices = [...deviceRows]
            this.datasource = new MatTableDataSource(this.devices);
            this.datasource.paginator = this.paginator||null;
            this.datasource.sort = this.sort||null;
            this.applyStoredSortState()
            this.applyStoredFilterState()
            this.pageWorking = false
        }).catch((err: any) => {
            this.errText = err?.error?.message || err?.message || 'Unable to load devices.'
            this.pageWorking = false
        })
    }

    ngAfterViewInit(): void {
        this.datasource.paginator = this.paginator||null;
        this.datasource.sort = this.sort||null;
        this.applyStoredSortState()
    }

    applyFilter(event: Event) {
        this.textFilter = (event.target as HTMLInputElement).value || ''
        this.datasource.filter = this.textFilter.trim().toLowerCase();
        this.storeDevicesFilter()

        if (this.datasource.paginator) {
            this.datasource.paginator.firstPage();
        }
    }

    onSortChange(sort: Sort) {
        this.currentSortActive = sort.active || 'name'
        this.currentSortDirection = sort.direction || 'asc'
        this.storeDevicesSort()
    }

    get displayedColumns(): string[] {
        if (!this.lastReconciledAt) {
            return [...this.baseDisplayedColumns]
        }

        return ['name', 'partNumber', 'shortName', 'vendorName', 'deviceSetCount', 'vendorLinkStatus', 'cost', 'attributeCount', 'subTaskCount', 'categoryName', 'actions']
    }

    getNoDataRowText(filterValue: string) {
        if (this.pageWorking) {
            return "Loading, please wait..."
        }
        if (this.errText) {
            return this.errText
        }
        if (!filterValue) {
            return "No Data Found"
        }
        return `No data matching the filter "${filterValue}"`
    }

    async reconcileVendorLinks() {
        this.reconcileWorking = true
        this.reconcileStatusText = 'Reconciling device part links and syncing latest part prices...'
        try {
            const response = await this.http.get<{ rows?: DeviceVendorLinkIssue[] }>('/api/firewire/devices/vendor-link-issues', {
                params: {
                    state: 'all'
                }
            }).toPromise()
            this.vendorLinkIssues = Array.isArray(response?.rows) ? response.rows : []
            this.lastReconciledAt = new Date()
            const activeCount = this.vendorLinkIssues.filter((issue) => !issue.ignored).length
            const ignoredCount = this.vendorLinkIssues.filter((issue) => issue.ignored).length
            const priceSummary = await this.syncVisibleDevicePrices()
            this.reconcileStatusText = `Reconciled ${this.devices.length} devices. ${activeCount} active issue${activeCount === 1 ? '' : 's'}, ${ignoredCount} ignored. Updated ${priceSummary.updatedCount} device price${priceSummary.updatedCount === 1 ? '' : 's'} from vendor parts.${priceSummary.missingCount > 0 ? ` ${priceSummary.missingCount} linked part${priceSummary.missingCount === 1 ? '' : 's'} still missing vendor price matches.` : ''}`
            await this.reloadDevices()
        } catch (err: any) {
            this.reconcileStatusText = err?.error?.message || err?.message || 'Unable to reconcile vendor links.'
        } finally {
            this.reconcileWorking = false
        }
    }

    async refreshDevicePartPrices() {
        this.priceSyncWorking = true
        this.reconcileStatusText = `Refreshing part prices for ${this.devices.length} device${this.devices.length === 1 ? '' : 's'}...`
        try {
            const priceSummary = await this.syncVisibleDevicePrices()
            this.reconcileStatusText = `Updated ${priceSummary.updatedCount} device price${priceSummary.updatedCount === 1 ? '' : 's'} from vendor parts.${priceSummary.missingCount > 0 ? ` ${priceSummary.missingCount} linked part${priceSummary.missingCount === 1 ? '' : 's'} still missing vendor price matches.` : ''}`
            await this.reloadDevices()
        } catch (err: any) {
            this.reconcileStatusText = err?.error?.message || err?.message || 'Unable to refresh device part prices.'
        } finally {
            this.priceSyncWorking = false
        }
    }

    async openVendorLinkIssues(mode: 'active' | 'ignored') {
        if (!this.lastReconciledAt) {
            await this.reconcileVendorLinks()
        }

        const filtered = this.vendorLinkIssues.filter((issue) => mode === 'ignored' ? issue.ignored : !issue.ignored)
        const dialogRef = this.dialog.open(DeviceVendorLinkIssuesDialog, {
            width: '880px',
            maxWidth: '96vw',
            data: {
                mode,
                issues: filtered
            }
        })
        const result = await dialogRef.afterClosed().toPromise()
        if (result?.changed) {
            await this.reconcileVendorLinks()
        }
    }

    getVendorLinkSummary(row: VwDevice): string {
        if (!this.lastReconciledAt) {
            return 'Not Checked'
        }
        const matching = this.vendorLinkIssues.filter((issue) => issue.deviceId === row.deviceId)
        const activeCount = matching.filter((issue) => !issue.ignored).length
        const ignoredCount = matching.filter((issue) => issue.ignored).length
        if (activeCount <= 0 && ignoredCount <= 0) {
            return 'OK'
        }
        if (activeCount > 0 && ignoredCount > 0) {
            return `${activeCount} missing / ${ignoredCount} ignored`
        }
        if (activeCount > 0) {
            return `${activeCount} missing`
        }
        return `${ignoredCount} ignored`
    }

    getDeviceSetSummary(row: VwDevice): string {
        const count = this.deviceSetCounts.get(row.deviceId) || 0
        if (count <= 0) {
            return 'None'
        }
        if (count === 1) {
            return '1 set'
        }
        return `${count} sets`
    }

    private storeDevicesFilter() {
        if (typeof localStorage === 'undefined') {
            return
        }
        try {
            localStorage.setItem(this.getDevicesFilterStorageKey(), this.textFilter)
        } catch {}
    }

    private async reloadDevices(): Promise<void> {
        const response = await this.http.get<{ rows?: VwDevice[] }>('/api/firewire/vwdevices').toPromise()
        this.devices = Array.isArray(response?.rows) ? response.rows : []
        this.datasource = new MatTableDataSource(this.devices)
        this.datasource.paginator = this.paginator || null
        this.datasource.sort = this.sort || null
        this.applyStoredSortState()
        this.applyStoredFilterState()
    }

    private async syncVisibleDevicePrices(): Promise<{ updatedCount: number, missingCount: number }> {
        const results = []
        for (const device of this.devices) {
            results.push(await this.priceSync.syncDevice(device.deviceId))
        }

        return {
            updatedCount: results.filter((result) => result.updated).length,
            missingCount: results.reduce((total, result) => total + result.missingPartNumbers.length, 0)
        }
    }

    private readStoredDevicesFilter(): string {
        if (typeof localStorage === 'undefined') {
            return ''
        }
        try {
            return localStorage.getItem(this.getDevicesFilterStorageKey()) || ''
        } catch {
            return ''
        }
    }

    private storeDevicesSort() {
        if (typeof localStorage === 'undefined') {
            return
        }
        try {
            localStorage.setItem(this.getDevicesSortStorageKey(), JSON.stringify({
                active: this.currentSortActive,
                direction: this.currentSortDirection
            }))
        } catch {}
    }

    private readStoredDevicesSort(): { active: string, direction: SortDirection } {
        if (typeof localStorage === 'undefined') {
            return { active: 'name', direction: 'asc' }
        }
        try {
            const parsed = JSON.parse(localStorage.getItem(this.getDevicesSortStorageKey()) || '{}') as { active?: unknown, direction?: unknown }
            const active = typeof parsed.active === 'string' && parsed.active.trim() ? parsed.active.trim() : 'name'
            const direction = parsed.direction === 'asc' || parsed.direction === 'desc' ? parsed.direction : 'asc'
            return { active, direction }
        } catch {
            return { active: 'name', direction: 'asc' }
        }
    }

    private applyStoredSortState() {
        if (!this.sort) {
            return
        }
        this.sort.active = this.currentSortActive
        this.sort.direction = this.currentSortDirection
    }

    private applyStoredFilterState() {
        this.datasource.filter = this.textFilter.trim().toLowerCase()
    }

    private getDevicesFilterStorageKey(): string {
        return 'firewire.devices.filter'
    }

    private getDevicesSortStorageKey(): string {
        return 'firewire.devices.sort'
    }

}

interface DeviceVendorLinkIssuesDialogData {
    mode: 'active' | 'ignored'
    issues: DeviceVendorLinkIssue[]
}

@Component({
    standalone: true,
    imports: [CommonModule, MatButtonModule, MatDialogActions, MatDialogContent, MatDialogTitle],
    template: `
        <div mat-dialog-title>{{data.mode === 'ignored' ? 'Ignored Vendor Link Issues' : 'Vendor Link Issues'}}</div>
        <mat-dialog-content>
            <div class="device-link-issues__stack">
                <div *ngIf="statusText" class="device-link-issues__status">{{statusText}}</div>
                <div *ngIf="issues.length <= 0" class="device-link-issues__empty">
                    {{data.mode === 'ignored' ? 'No ignored issues.' : 'No active issues.'}}
                </div>
                <div *ngFor="let issue of issues" class="device-link-issues__row">
                    <div class="device-link-issues__summary">
                        <div><strong>{{issue.deviceName}}</strong></div>
                        <div>{{issue.vendorName}} · {{issue.partNumber}} · {{issue.sourceLabel}}</div>
                    </div>
                    <button
                        *ngIf="data.mode !== 'ignored'"
                        mat-stroked-button
                        type="button"
                        [disabled]="working"
                        (click)="ignoreIssue(issue)">
                        Ignore
                    </button>
                    <button
                        *ngIf="data.mode === 'ignored'"
                        mat-stroked-button
                        type="button"
                        [disabled]="working"
                        (click)="reattemptIssue(issue)">
                        Reattempt
                    </button>
                </div>
            </div>
        </mat-dialog-content>
        <mat-dialog-actions align="end">
            <button mat-button type="button" (click)="close()">Close</button>
        </mat-dialog-actions>
    `,
    styles: [`
        .device-link-issues__stack { display: grid; gap: 12px; min-width: min(760px, 100%); }
        .device-link-issues__row { display: flex; align-items: center; justify-content: space-between; gap: 12px; padding: 12px; border: 1px solid rgba(72, 221, 255, 0.18); border-radius: 12px; }
        .device-link-issues__summary { display: grid; gap: 4px; min-width: 0; }
        .device-link-issues__status, .device-link-issues__empty { color: var(--fw-muted); }
    `]
})
export class DeviceVendorLinkIssuesDialog {
    readonly data = inject<DeviceVendorLinkIssuesDialogData>(MAT_DIALOG_DATA)
    private readonly http = inject(HttpClient)
    private readonly dialogRef = inject(MatDialogRef<DeviceVendorLinkIssuesDialog>)
    issues = [...this.data.issues]
    statusText = ''
    working = false
    changed = false

    async ignoreIssue(issue: DeviceVendorLinkIssue) {
        this.working = true
        this.statusText = `Ignoring ${issue.partNumber} for ${issue.deviceName}...`
        try {
            await this.http.post('/api/firewire/devices/vendor-link-issues/ignore', {
                deviceId: issue.deviceId,
                vendorId: issue.vendorId,
                partNumber: issue.partNumber,
                sourceKind: issue.sourceKind
            }).toPromise()
            this.issues = this.issues.filter((row) => !(row.deviceId === issue.deviceId && row.partNumber === issue.partNumber && row.sourceKind === issue.sourceKind))
            this.changed = true
            this.statusText = `${issue.partNumber} ignored.`
        } catch (err: any) {
            this.statusText = err?.error?.message || err?.message || 'Unable to ignore issue.'
        } finally {
            this.working = false
        }
    }

    async reattemptIssue(issue: DeviceVendorLinkIssue) {
        this.working = true
        this.statusText = `Reattempting ${issue.partNumber} for ${issue.deviceName}...`
        try {
            await this.http.post('/api/firewire/devices/vendor-link-issues/unignore', {
                deviceId: issue.deviceId,
                vendorId: issue.vendorId,
                partNumber: issue.partNumber,
                sourceKind: issue.sourceKind
            }).toPromise()
            this.issues = this.issues.filter((row) => !(row.deviceId === issue.deviceId && row.partNumber === issue.partNumber && row.sourceKind === issue.sourceKind))
            this.changed = true
            this.statusText = `${issue.partNumber} is active again for future reconciliation.`
        } catch (err: any) {
            this.statusText = err?.error?.message || err?.message || 'Unable to reattempt issue.'
        } finally {
            this.working = false
        }
    }

    close() {
        this.dialogRef.close({
            changed: this.changed
        })
    }
}
