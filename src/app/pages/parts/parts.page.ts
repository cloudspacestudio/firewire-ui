import { Component, OnInit, AfterViewInit, ViewChild, inject } from "@angular/core"
import { ActivatedRoute, Router, RouterLink } from "@angular/router"
import { FormsModule } from "@angular/forms"
import { firstValueFrom } from "rxjs"

import { HttpClient } from "@angular/common/http"
import { CommonModule } from "@angular/common"

import { MatButtonModule } from "@angular/material/button"
import { MatDialog, MAT_DIALOG_DATA, MatDialogActions, MatDialogClose, MatDialogContent, MatDialogRef, MatDialogTitle } from "@angular/material/dialog"
import { MatIconModule } from "@angular/material/icon"
import { MatMenuModule } from "@angular/material/menu"
import { MatDividerModule } from "@angular/material/divider"
import {MatPaginator, MatPaginatorModule, PageEvent} from '@angular/material/paginator';
import {MatSort, MatSortModule, Sort, SortDirection} from '@angular/material/sort';
import {MatTableDataSource, MatTableModule} from '@angular/material/table';
import {MatInputModule} from '@angular/material/input';
import {MatFormFieldModule} from '@angular/material/form-field';
import { MatSelectModule } from "@angular/material/select"
import { MatSlideToggleModule } from "@angular/material/slide-toggle"
import { MatTooltipModule } from "@angular/material/tooltip"

import { PageToolbar } from '../../common/components/page-toolbar';
import { Part } from "../../schemas/part.schema"
import { NavToolbar } from "../../common/components/nav-toolbar"
import { VwPart } from "../../schemas/vwpart.schema"
import { VwDevice } from "../../schemas/vwdevice.schema"
import { Vendor } from "../../schemas/vendor.schema"
import { VendorImportConfig, VendorImportPreview, VendorImportRun, VendorImportSnapshot } from "../../schemas/vendor-import-config.schema"
import { ViewPreferencesService } from "../../common/services/view-preferences.service"

interface PartsVendorView {
    key: string
    caption: string
    datasetLabel: string
    vendorName: string
    vendorId?: string
    listEndpoint: string
    createDeviceEndpoint: (part: VwPart) => string
    addToDeviceEndpoint: (part: VwPart) => string
    deletePartEndpoint: (part: VwPart) => string
}

const PARTS_VENDOR_VIEWS: PartsVendorView[] = [
    {
        key: 'all',
        caption: 'PARTS',
        datasetLabel: 'Master Parts',
        vendorName: 'All Vendors',
        listEndpoint: '/api/firewire/parts',
        createDeviceEndpoint: (part: VwPart) => `/api/firewire/vendors/${encodeURIComponent(String(part.vendorId || ''))}/parts/${encodeURIComponent(part.PartNumber)}/create-device`,
        addToDeviceEndpoint: (part: VwPart) => `/api/firewire/vendors/${encodeURIComponent(String(part.vendorId || ''))}/parts/${encodeURIComponent(part.PartNumber)}/add-to-device`,
        deletePartEndpoint: (part: VwPart) => `/api/firewire/vendors/${encodeURIComponent(String(part.vendorId || ''))}/parts/${encodeURIComponent(part.PartNumber)}`
    }
]

@Component({
    standalone: true,
    selector: 'prices-page',
    imports: [CommonModule, FormsModule, MatButtonModule, 
        RouterLink, MatMenuModule,
        MatDividerModule,
        MatPaginatorModule, MatSortModule,
        MatTableModule, MatInputModule,
        MatFormFieldModule, MatSelectModule,
        MatIconModule, MatTooltipModule, PageToolbar, NavToolbar],
    providers: [HttpClient],
    templateUrl: './parts.page.html',
    styleUrls: ['./parts.page.scss']
})
export class PartsPage implements OnInit, AfterViewInit  {
    displayedColumns: string[] = [
        'PartNumber',
        'LongDescription',
        'ParentCategory',
        'Category',
        'MSRPPrice',
        'cost',
        'MinOrderQuantity',
        //'ProductStatus',
        'UPC',
        //'FuturePrice',
        //'FutureEffectiveDate',
        //'FutureSalesPrice',
        //'FutureSalesEffectiveDate',
        //'Agency',
        //'CountryOfOrigin',
        'actions'
    ];

    @ViewChild(MatPaginator) paginator?: MatPaginator;
    @ViewChild(MatSort) sort?: MatSort;

    pageWorking = true
    parts: VwPart[] = []
    navItems = NavToolbar.DeviceNavItems
    vendorViews: PartsVendorView[] = [...PARTS_VENDOR_VIEWS]
    vendors: Vendor[] = []
    availablePartsVendors: Vendor[] = []
    errText?: string
    statusText = ''
    textFilter = ''
    actionWorking = false
    devices: VwDevice[] = []
    selectedCategories: string[] = []
    activeVendorView = PARTS_VENDOR_VIEWS[0]
    activeVendor: Vendor | null = null
    activeImportConfig: VendorImportConfig | null = null
    activeImportRun: VendorImportRun | null = null
    selectedVendorId = ''
    currentSortActive = 'PartNumber'
    currentSortDirection: SortDirection = 'asc'
    pageSize = 25

    datasource: MatTableDataSource<VwPart> = new MatTableDataSource(this.parts);
    
    constructor(
        private http: HttpClient,
        private dialog: MatDialog,
        private route: ActivatedRoute,
        private router: Router,
        private viewPreferences: ViewPreferencesService
    ) {}

    ngOnInit(): void {
        this.route.paramMap.subscribe((params) => {
            const vendorKey = String(params.get('vendorKey') || '').trim().toLowerCase()
            this.statusText = ''
            void this.initializeVendorRoute(vendorKey)
        })
    }

    ngAfterViewInit(): void {
        this.datasource.paginator = this.paginator||null;
        this.datasource.sort = this.sort||null;
        this.applyStoredSortState()
        this.applyStoredPageSizeState()
    }

    applyFilter(event: Event) {
        this.textFilter = (event.target as HTMLInputElement).value || ''
        this.storePartsTextFilter()
        this.applyCombinedFilter()
    }

    onCategoryFilterChange() {
        this.storeCategoryFilter()
        this.applyCombinedFilter()
    }

    clearCategoryFilter() {
        this.selectedCategories = []
        this.storeCategoryFilter()
        this.applyCombinedFilter()
    }

    onSortChange(sort: Sort) {
        this.currentSortActive = sort.active || 'PartNumber'
        this.currentSortDirection = sort.direction || 'asc'
        this.storePartsSort()
    }

    onPageChange(event: PageEvent) {
        this.pageSize = Number(event.pageSize || 25)
        this.storePartsPageSize()
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

    async openCreateDeviceDialog(row: VwPart) {
        await this.releaseFocusedElementBeforeDialog()
        const dialogRef = this.dialog.open(CreateDeviceFromPartDialog, {
            panelClass: 'fw-medium-dialog-pane',
            data: {
                part: row
            }
        })

        const result = await firstValueFrom(dialogRef.afterClosed())
        if (!result) {
            return
        }

        this.actionWorking = true
        this.statusText = `Creating device from ${row.PartNumber}...`

        this.http.post<{ data?: { device?: VwDevice } }>(this.activeVendorView.createDeviceEndpoint(row), result).subscribe({
            next: (response) => {
                this.actionWorking = false
                const deviceName = response?.data?.device?.name || result.name || row.LongDescription || row.PartNumber
                this.statusText = `${deviceName} created from ${row.PartNumber}.`
            },
            error: (err: any) => {
                this.actionWorking = false
                this.statusText = err?.error?.message || err?.message || 'Unable to create device from part.'
            }
        })
    }

    async openAddToExistingDeviceDialog(row: VwPart) {
        await this.ensureDevicesLoaded()

        await this.releaseFocusedElementBeforeDialog()
        const dialogRef = this.dialog.open(AddPartToExistingDeviceDialog, {
            width: '560px',
            maxWidth: '95vw',
            data: {
                part: row,
                devices: this.devices
            }
        })

        const result = await firstValueFrom(dialogRef.afterClosed())
        if (!result) {
            return
        }

        this.actionWorking = true
        this.statusText = `Adding ${row.PartNumber} to selected device...`

        this.http.post(this.activeVendorView.addToDeviceEndpoint(row), result).subscribe({
            next: () => {
                const target = this.devices.find((device) => device.deviceId === result.deviceId)
                this.actionWorking = false
                this.statusText = `${row.PartNumber} linked to ${target?.name || 'selected device'}.`
            },
            error: (err: any) => {
                this.actionWorking = false
                this.statusText = err?.error?.message || err?.message || 'Unable to add part to existing device.'
            }
        })
    }

    async openDeletePartDialog(row: VwPart) {
        if (!row.vendorId) {
            this.statusText = 'Unable to delete part because the vendor is unknown.'
            return
        }

        await this.releaseFocusedElementBeforeDialog()
        const dialogRef = this.dialog.open(DeletePartDialog, {
            width: '440px',
            maxWidth: 'calc(100vw - 40px)',
            panelClass: 'fw-confirmation-dialog-pane',
            data: {
                part: row,
                vendorName: row.sourceVendorName || this.activeVendor?.name || this.activeVendorView.vendorName
            }
        })

        const confirmed = await firstValueFrom(dialogRef.afterClosed())
        if (!confirmed) {
            return
        }

        this.actionWorking = true
        this.statusText = `Deleting part ${row.PartNumber}...`
        this.http.delete<{ data?: { vendorId: string, partNumber: string } }>(this.activeVendorView.deletePartEndpoint(row)).subscribe({
            next: () => {
                this.actionWorking = false
                this.parts = this.parts.filter((part) =>
                    !(part.vendorId === row.vendorId && String(part.PartNumber || '') === String(row.PartNumber || ''))
                )
                this.datasource.data = [...this.parts]
                this.applyCombinedFilter()
                this.statusText = `Deleted part ${row.PartNumber}. Existing device/material snapshots were not changed.`
            },
            error: (err: any) => {
                this.actionWorking = false
                this.statusText = err?.error?.message || err?.message || `Unable to delete part ${row.PartNumber}.`
            }
        })
    }

    private async ensureDevicesLoaded() {
        if (this.devices.length > 0) {
            return
        }

        const response = await firstValueFrom(this.http.get<{ rows?: VwDevice[] }>('/api/firewire/vwdevices'))
        const rows = Array.isArray(response?.rows) ? response.rows : []
        const activeVendorId = this.parts.find((row) => row.vendorId)?.vendorId || null

        this.devices = activeVendorId
            ? rows.filter((device) => device.vendorId === activeVendorId)
            : rows.filter((device) => String(device.vendorName || '').trim().toLowerCase() === this.activeVendorView.vendorName.toLowerCase())
    }

    async openImportDialog() {
        if (this.activeVendorView.key === 'all') {
            await this.releaseFocusedElementBeforeDialog()
            const dialogRef = this.dialog.open(AllPartsWorkbookImportDialog, {
                width: '840px',
                maxWidth: '96vw'
            })
            const result = await firstValueFrom(dialogRef.afterClosed())
            if (result?.message) {
                this.statusText = result.message
                if (result.imported) {
                    this.loadParts()
                }
            }
            return
        }

        if (!this.activeVendor || !this.activeImportConfig) {
            this.statusText = `Configure import rules for ${this.activeVendorView.vendorName} before importing.`
            return
        }

        await this.releaseFocusedElementBeforeDialog()
        const dialogRef = this.dialog.open(PartsImportDialog, {
            width: '840px',
            maxWidth: '96vw',
            data: {
                vendor: this.activeVendor,
                config: this.activeImportConfig
            }
        })
        const result = await firstValueFrom(dialogRef.afterClosed())
        if (result?.message) {
            this.statusText = result.message
            if (result.imported) {
                this.loadParts()
            }
        }
    }

    async openProcessDialog() {
        if (!this.activeVendor || !this.activeImportConfig) {
            this.statusText = `Configure import rules for ${this.activeVendorView.vendorName} before opening the process view.`
            return
        }

        await this.releaseFocusedElementBeforeDialog()
        const dialogRef = this.dialog.open(PartsImportProcessDialog, {
            width: '920px',
            maxWidth: '96vw',
            data: {
                vendor: this.activeVendor,
                config: this.activeImportConfig
            }
        })
        const result = await firstValueFrom(dialogRef.afterClosed())
        if (result?.message) {
            this.statusText = result.message
            if (result.restored) {
                this.loadParts()
            }
        }
    }

    async onVendorSelectionChange(vendorId: string) {
        if (vendorId === '__create_new_vendor__') {
            await this.router.navigate(['/vendors'])
            return
        }

        if (vendorId === '__all_parts__') {
            this.storePartsVendorChannel('all')
            await this.router.navigate(['/parts', 'all'])
            return
        }

        const vendor = this.vendors.find((row) => row.vendorId === vendorId) || null
        if (!vendor) {
            return
        }

        const targetView = this.resolveVendorViewForVendor(vendor)
        if (!targetView) {
            this.selectedVendorId = this.activeVendor?.vendorId || ''
            this.statusText = `${vendor.name} is not mapped to a Parts source yet. Use Vendors to configure its import definition later.`
            return
        }

        this.storePartsVendorChannel(targetView.key)
        await this.router.navigate(['/parts', targetView.key])
    }

    private async initializeVendorRoute(vendorKey: string) {
        await this.loadVendorViews()
        const storedVendorKey = this.readStoredPartsVendorChannel()
        const hasStoredVendorView = storedVendorKey !== 'all' && this.vendorViews.some((view) => view.key === storedVendorKey)
        const shouldRestoreStoredVendor = !vendorKey || (vendorKey === 'all' && hasStoredVendorView)
        const requestedVendorKey = shouldRestoreStoredVendor ? storedVendorKey : vendorKey || storedVendorKey
        this.activeVendorView = this.vendorViews.find((view) => view.key === requestedVendorKey) || this.vendorViews[0]
        this.storePartsVendorChannel(this.activeVendorView.key)
        if (shouldRestoreStoredVendor) {
            await this.router.navigate(['/parts', this.activeVendorView.key], { replaceUrl: true })
            return
        }
        this.applyStoredViewPreferences()
        await this.loadActiveVendorContext()
        this.loadParts()
    }

    private applyStoredViewPreferences() {
        this.textFilter = this.readStoredPartsTextFilter()
        this.selectedCategories = this.readStoredCategoryFilter()
        const storedSort = this.readStoredPartsSort()
        this.currentSortActive = storedSort.active
        this.currentSortDirection = storedSort.direction
        this.pageSize = this.readStoredPartsPageSize()
        this.configureFilterPredicate()
        this.applyStoredSortState()
        this.applyStoredPageSizeState()
    }

    private async loadVendorViews() {
        const vendorsResponse = await firstValueFrom(this.http.get<{ rows?: Vendor[] }>('/api/firewire/vendors'))
        this.vendors = Array.isArray(vendorsResponse?.rows) ? vendorsResponse.rows : []
        const resolvedViews = this.vendors
            .map((row) => this.resolveVendorViewForVendor(row))
            .filter((row): row is PartsVendorView => !!row)
            .sort((left, right) => this.compareVendorLabels(left.vendorName, right.vendorName))
        const viewsByKey = new Map<string, PartsVendorView>()
        for (const view of [...PARTS_VENDOR_VIEWS, ...resolvedViews]) {
            viewsByKey.set(view.key, view)
        }
        this.vendorViews = Array.from(viewsByKey.values())
        this.availablePartsVendors = this.vendors
            .filter((row) => !!this.resolveVendorViewForVendor(row))
            .sort((left, right) => this.compareVendorLabels(left.name, right.name))
    }

    private compareVendorLabels(left: string | null | undefined, right: string | null | undefined): number {
        return String(left || '').trim().localeCompare(String(right || '').trim(), undefined, {
            numeric: true,
            sensitivity: 'base'
        })
    }

    private async loadActiveVendorContext() {
        try {
            this.activeVendor = this.vendors.find((row) => {
                const vendorView = this.resolveVendorViewForVendor(row)
                return vendorView?.key === this.activeVendorView.key
            }) || this.vendors.find((row) => String(row.name || '').trim().toLowerCase() === this.activeVendorView.vendorName.toLowerCase()) || null
            if (!this.activeVendor) {
                this.activeImportConfig = null
                this.activeImportRun = null
            this.selectedVendorId = this.activeVendorView.key === 'all' ? '__all_parts__' : ''
            return
        }
            this.selectedVendorId = this.activeVendor.vendorId

            const configResponse = await firstValueFrom(this.http.get<{ data?: VendorImportConfig }>(`/api/firewire/vendors/${this.activeVendor.vendorId}/import-config`))
            this.activeImportConfig = configResponse?.data || null
            const statusResponse = await firstValueFrom(this.http.get<{ data?: VendorImportRun | null }>(`/api/firewire/vendors/${this.activeVendor.vendorId}/parts-import-status`, {
                params: {
                    targetTable: this.activeImportConfig?.targetTable || 'parts'
                }
            }))
            this.activeImportRun = statusResponse?.data || null
        } catch (err: any) {
            this.activeImportConfig = null
            this.activeImportRun = null
            this.statusText = err?.error?.message || err?.message || `Unable to load ${this.activeVendorView.vendorName} import configuration.`
        }
    }

    private resolveVendorViewForVendor(vendor: Vendor): PartsVendorView | null {
        const config = this.parseVendorImportConfig(vendor.importConfigJson)
        if (config?.partsVendorKey) {
            const staticView = PARTS_VENDOR_VIEWS.find((view) => view.key === config.partsVendorKey)
            if (staticView) {
                return staticView
            }
            if (this.normalizePartsTargetTable(config.targetTable) === 'parts') {
                const key = String(config.partsVendorKey || vendor.vendorId || '').trim().toLowerCase()
                return {
                    key,
                    caption: String(vendor.name || key).toUpperCase(),
                    datasetLabel: config.sourceLabel || `${vendor.name} Parts`,
                    vendorName: vendor.name,
                    vendorId: vendor.vendorId,
                    listEndpoint: `/api/firewire/vendors/${encodeURIComponent(vendor.vendorId)}/parts`,
                    createDeviceEndpoint: (part: VwPart) => `/api/firewire/vendors/${encodeURIComponent(vendor.vendorId)}/parts/${encodeURIComponent(part.PartNumber)}/create-device`,
                    addToDeviceEndpoint: (part: VwPart) => `/api/firewire/vendors/${encodeURIComponent(vendor.vendorId)}/parts/${encodeURIComponent(part.PartNumber)}/add-to-device`,
                    deletePartEndpoint: (part: VwPart) => `/api/firewire/vendors/${encodeURIComponent(vendor.vendorId)}/parts/${encodeURIComponent(part.PartNumber)}`
                }
            }
            return null
        }
        const key = String(vendor.vendorId || vendor.name || '').trim().toLowerCase()
        if (!key) {
            return null
        }
        return {
            key,
            caption: String(vendor.name || key).toUpperCase(),
            datasetLabel: `${vendor.name || 'Vendor'} Parts`,
            vendorName: vendor.name,
            vendorId: vendor.vendorId,
            listEndpoint: `/api/firewire/vendors/${encodeURIComponent(vendor.vendorId)}/parts`,
            createDeviceEndpoint: (part: VwPart) => `/api/firewire/vendors/${encodeURIComponent(vendor.vendorId)}/parts/${encodeURIComponent(part.PartNumber)}/create-device`,
            addToDeviceEndpoint: (part: VwPart) => `/api/firewire/vendors/${encodeURIComponent(vendor.vendorId)}/parts/${encodeURIComponent(part.PartNumber)}/add-to-device`,
            deletePartEndpoint: (part: VwPart) => `/api/firewire/vendors/${encodeURIComponent(vendor.vendorId)}/parts/${encodeURIComponent(part.PartNumber)}`
        }
    }

    private parseVendorImportConfig(raw: string | null | undefined): VendorImportConfig | null {
        if (!raw) {
            return null
        }
        try {
            const config = JSON.parse(raw) as VendorImportConfig
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

    private loadParts() {
        this.parts = []
        this.devices = []
        this.pageWorking = true
        this.errText = undefined
        this.datasource.data = []

        this.http.get<{ rows?: VwPart[] }>(this.activeVendorView.listEndpoint).subscribe({
            next: (response) => {
                if (response && Array.isArray(response.rows)) {
                    this.parts = [...response.rows]
                    this.datasource = new MatTableDataSource(this.parts)
                    this.configureFilterPredicate()
                    this.datasource.paginator = this.paginator || null
                    this.datasource.sort = this.sort || null
                    this.applyStoredSortState()
                    this.applyStoredPageSizeState()
                    this.applyCombinedFilter()
                    this.pageWorking = false
                    return
                }

                this.parts = []
                this.datasource.data = []
                this.pageWorking = false
            },
            error: (err: Error) => {
                this.errText = err.message
                this.pageWorking = false
            }
        })
    }

    getCategoryFilterOptions(): string[] {
        const categories = this.parts
            .map((row) => String(row.Category || '').trim())
            .filter((value) => !!value)
        return Array.from(new Set(categories)).sort((left, right) => left.localeCompare(right))
    }

    private applyCombinedFilter() {
        this.datasource.filter = JSON.stringify({
            text: this.textFilter.trim().toLowerCase(),
            categories: [...this.selectedCategories]
        })

        if (this.datasource.paginator) {
            this.datasource.paginator.firstPage()
        }
    }

    private configureFilterPredicate() {
        this.datasource.filterPredicate = (row: VwPart, filter: string) => {
            let parsed: { text?: string, categories?: string[] } = {}
            try {
                parsed = JSON.parse(filter || '{}')
            } catch {
                parsed = { text: filter }
            }

            const text = String(parsed.text || '').trim()
            const categories = Array.isArray(parsed.categories) ? parsed.categories.filter((value): value is string => typeof value === 'string' && !!value) : []
            const textHaystack = [
                row.PartNumber,
                row.LongDescription,
                row.ParentCategory,
                row.Category,
                row.UPC
            ].map((value) => String(value || '').toLowerCase()).join(' ')

            const matchesText = !text || textHaystack.includes(text)
            const matchesCategory = categories.length <= 0 || categories.includes(String(row.Category || '').trim())
            return matchesText && matchesCategory
        }
    }

    private getPartsCategoryFilterStorageKey(): string {
        return `firewire.parts.${this.activeVendorView.key}.categoryFilter`
    }

    private getPartsTextFilterStorageKey(): string {
        return `firewire.parts.${this.activeVendorView.key}.textFilter`
    }

    private getPartsSortStorageKey(): string {
        return `firewire.parts.${this.activeVendorView.key}.sort`
    }

    private getPartsPageSizeStorageKey(): string {
        return `firewire.parts.${this.activeVendorView.key}.pageSize`
    }

    private getPartsVendorChannelStorageKey(): string {
        return 'firewire.parts.vendorChannel'
    }

    private storePartsVendorChannel(vendorKey: string) {
        this.viewPreferences.writeText(this.getPartsVendorChannelStorageKey(), vendorKey || 'all')
    }

    private readStoredPartsVendorChannel(): string {
        return this.viewPreferences.readText(this.getPartsVendorChannelStorageKey(), 'all')
    }

    private storePartsTextFilter() {
        this.viewPreferences.writeText(this.getPartsTextFilterStorageKey(), this.textFilter)
    }

    private readStoredPartsTextFilter(): string {
        return this.viewPreferences.readText(this.getPartsTextFilterStorageKey(), '')
    }

    private storeCategoryFilter() {
        this.viewPreferences.writeJson(this.getPartsCategoryFilterStorageKey(), this.selectedCategories)
    }

    private readStoredCategoryFilter(): string[] {
        return this.viewPreferences.readJson<string[]>(this.getPartsCategoryFilterStorageKey(), [], (value) => {
            return Array.isArray(value) ? value.filter((item): item is string => typeof item === 'string') : []
        })
    }

    private storePartsSort() {
        this.viewPreferences.writeSort(this.getPartsSortStorageKey(), {
            active: this.currentSortActive,
            direction: this.currentSortDirection
        })
    }

    private readStoredPartsSort(): { active: string, direction: SortDirection } {
        return this.viewPreferences.readSort(this.getPartsSortStorageKey(), { active: 'PartNumber', direction: 'asc' }) as { active: string, direction: SortDirection }
    }

    private applyStoredSortState() {
        if (!this.sort) {
            return
        }
        this.sort.active = this.currentSortActive
        this.sort.direction = this.currentSortDirection
    }

    private applyStoredPageSizeState() {
        if (this.paginator) {
            this.paginator.pageSize = this.pageSize
        }
    }

    private storePartsPageSize() {
        this.viewPreferences.writeNumber(this.getPartsPageSizeStorageKey(), this.pageSize)
    }

    private readStoredPartsPageSize(): number {
        return this.viewPreferences.readNumber(this.getPartsPageSizeStorageKey(), 25, [5, 10, 25, 100])
    }

    private async releaseFocusedElementBeforeDialog(): Promise<void> {
        const activeElement = typeof document !== 'undefined' ? document.activeElement : null
        if (activeElement instanceof HTMLElement) {
            activeElement.blur()
        }
        await new Promise<void>((resolve) => setTimeout(resolve, 0))
    }

}

interface CreateDeviceFromPartDialogData {
    part: VwPart
}

@Component({
    standalone: true,
    selector: 'fw-create-device-from-part-dialog',
    imports: [CommonModule, FormsModule, MatButtonModule, MatDialogActions, MatDialogClose, MatDialogContent, MatDialogTitle, MatFormFieldModule, MatIconModule, MatInputModule, MatSelectModule, MatSlideToggleModule],
    template: `
        <div mat-dialog-title class="fw-dialog-titlebar">
            <span class="fw-dialog-titlebar__text">Create Device From Part</span>
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
            <button mat-button mat-dialog-close type="button">Cancel</button>
            <button mat-flat-button type="button" [mat-dialog-close]="getResult()" [disabled]="!canSave()">Create Device</button>
        </mat-dialog-actions>
    `,
    styles: [`.fw-dialog-stack{display:grid;gap:12px;width:100%;max-width:100%}.fw-dialog-stack p{margin:0}.fw-dialog-hint{margin-top:4px;color:rgba(214,238,255,.72);font-size:12px;line-height:1.35}`]
})
export class CreateDeviceFromPartDialog {
    readonly data = inject<CreateDeviceFromPartDialogData>(MAT_DIALOG_DATA)
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

interface AddPartToExistingDeviceDialogData {
    part: VwPart
    devices: VwDevice[]
}

@Component({
    standalone: true,
    imports: [CommonModule, FormsModule, MatButtonModule, MatDialogActions, MatDialogClose, MatDialogContent, MatDialogTitle, MatFormFieldModule, MatSelectModule],
    template: `
        <div mat-dialog-title>Add Part To Existing Device</div>
        <mat-dialog-content>
            <div class="fw-dialog-stack">
                <p><strong>{{data.part.PartNumber}}</strong> will be linked into an existing device’s part list.</p>
                <mat-form-field>
                    <mat-label>Device</mat-label>
                    <mat-select [(ngModel)]="deviceId">
                        <mat-option *ngFor="let device of data.devices" [value]="device.deviceId">
                            {{device.name}} · {{device.partNumber}} · {{device.vendorName}}
                        </mat-option>
                    </mat-select>
                </mat-form-field>
            </div>
        </mat-dialog-content>
        <mat-dialog-actions align="end">
            <button mat-button mat-dialog-close type="button">Cancel</button>
            <button mat-flat-button type="button" [mat-dialog-close]="getResult()" [disabled]="!deviceId">Add Part</button>
        </mat-dialog-actions>
    `,
    styles: [`.fw-dialog-stack{display:grid;gap:12px;min-width:min(460px,100%)}`]
})
export class AddPartToExistingDeviceDialog {
    readonly data = inject<AddPartToExistingDeviceDialogData>(MAT_DIALOG_DATA)
    deviceId = ''

    getResult() {
        return this.deviceId ? { deviceId: this.deviceId } : null
    }
}

interface DeletePartDialogData {
    part: VwPart
    vendorName: string
}

@Component({
    standalone: true,
    selector: 'fw-delete-part-dialog',
    imports: [CommonModule, MatButtonModule, MatDialogActions, MatDialogClose, MatDialogContent, MatDialogTitle, MatIconModule],
    template: `
        <div mat-dialog-title class="fw-dialog-titlebar">
            <span class="fw-dialog-titlebar__text">Delete Part</span>
            <button mat-icon-button type="button" class="fw-dialog-titlebar__close" aria-label="Cancel delete part" mat-dialog-close>
                <mat-icon>close</mat-icon>
            </button>
        </div>
        <mat-dialog-content>
            <div class="fw-confirmation-dialog">
                <p>Delete <strong>{{data.part.PartNumber}}</strong> from {{data.vendorName}}?</p>
                <p class="parts-dialog-status">Existing devices and BOM material snapshots keep their copied part details.</p>
            </div>
        </mat-dialog-content>
        <mat-dialog-actions align="end">
            <button mat-button mat-dialog-close type="button">Cancel</button>
            <button mat-flat-button color="warn" type="button" class="fw-danger-button" [mat-dialog-close]="true">Delete Part</button>
        </mat-dialog-actions>
    `
})
export class DeletePartDialog {
    readonly data = inject<DeletePartDialogData>(MAT_DIALOG_DATA)
}

interface PartsImportDialogData {
    vendor: Vendor
    config: VendorImportConfig
}

interface BulkPartsWorkbookVendorResult {
    sheetName: string
    vendorId?: string
    vendorName?: string
    matched: boolean
    valid: boolean
    rowCount: number
    importedRowCount?: number
    issues: string[]
    sampleErrors: string[]
}

interface BulkPartsWorkbookResult {
    fileName: string
    sheetCount: number
    matchedVendorCount: number
    skippedSheetCount: number
    importedVendorCount: number
    importedRowCount: number
    valid: boolean
    results: BulkPartsWorkbookVendorResult[]
}

@Component({
    standalone: true,
    imports: [CommonModule, MatButtonModule, MatDialogActions, MatDialogClose, MatDialogContent, MatDialogTitle, MatIconModule],
    template: `
        <div mat-dialog-title class="fw-dialog-titlebar">
            <span class="fw-dialog-titlebar__text">Import All Vendor Parts</span>
            <button mat-icon-button type="button" class="fw-dialog-titlebar__close" aria-label="Cancel import" mat-dialog-close>
                <mat-icon>close</mat-icon>
            </button>
        </div>
        <mat-dialog-content>
            <div class="fw-dialog-stack">
                <p>Import an Excel workbook with one vendor per worksheet. Worksheet names must match existing vendor names.</p>
                <input type="file" accept=".xlsx,.xls" (change)="onFileSelected($event)" />
                <div
                    class="parts-dialog-status"
                    [class.parts-dialog-status--error]="preview && !preview.valid"
                    [class.parts-dialog-status--success]="preview?.valid"
                    *ngIf="statusText">
                    {{statusText}}
                </div>
                <div *ngIf="preview && !preview.valid" class="parts-dialog-blocker">
                    <strong>Workbook cannot be imported yet.</strong>
                    <span>Fix the worksheet issues listed below, then verify the workbook again.</span>
                </div>
                <div *ngIf="preview" class="parts-dialog-preview" [class.parts-dialog-preview--invalid]="!preview.valid">
                    <div><strong>Sheets:</strong> {{preview.sheetCount}}</div>
                    <div><strong>Matched Vendors:</strong> {{preview.matchedVendorCount}}</div>
                    <div><strong>Skipped Sheets:</strong> {{preview.skippedSheetCount}}</div>
                    <div><strong>Status:</strong> {{preview.valid ? 'Ready to import' : 'Needs attention'}}</div>
                    <div *ngFor="let row of preview.results" [class.parts-dialog-preview__row--invalid]="row.matched && (!row.valid || row.sampleErrors.length > 0 || row.issues.length > 0)">
                        <strong>{{row.sheetName}}</strong>:
                        {{row.matched ? (row.vendorName + ' · ' + row.rowCount + ' rows') : 'Skipped'}}
                        <span *ngIf="row.issues.length > 0"> · {{row.issues.join(' | ')}}</span>
                        <span *ngIf="row.sampleErrors.length > 0"> · {{row.sampleErrors.join(' | ')}}</span>
                    </div>
                </div>
            </div>
        </mat-dialog-content>
        <mat-dialog-actions align="end">
            <button mat-button mat-dialog-close type="button">Cancel</button>
            <button mat-stroked-button type="button" [disabled]="!selectedFile || working" (click)="verify()">Verify Workbook</button>
            <button
                mat-flat-button
                type="button"
                class="parts-dialog-import-button"
                [class.parts-dialog-import-button--disabled]="isImportDisabled()"
                [attr.title]="getImportDisabledReason()"
                [disabled]="isImportDisabled()"
                (click)="importFile()">
                Import Workbook
            </button>
        </mat-dialog-actions>
    `,
    styles: [`
        .parts-dialog-status { color: var(--fw-muted); font-size: 0.84rem; }
        .parts-dialog-status--error { color: #ffb4ab; font-weight: 600; }
        .parts-dialog-status--success { color: #9be7c0; }
        .parts-dialog-blocker { display: grid; gap: 4px; padding: 12px; border: 1px solid rgba(255, 90, 90, 0.52); border-left: 4px solid #ff6b6b; background: rgba(255, 75, 75, 0.12); color: #ffd6d6; border-radius: 0; }
        .parts-dialog-blocker span { color: #ffc0c0; font-size: 0.86rem; }
        .parts-dialog-preview { display: grid; gap: 8px; padding: 12px; border: 1px solid rgba(72, 221, 255, 0.18); border-radius: 0; }
        .parts-dialog-preview--invalid { border-color: rgba(255, 90, 90, 0.42); }
        .parts-dialog-preview__row--invalid { color: #ffc7c7; }
        .parts-dialog-import-button--disabled { opacity: 0.34 !important; filter: grayscale(0.7); cursor: not-allowed !important; }
    `]
})
export class AllPartsWorkbookImportDialog {
    private readonly http = inject(HttpClient)
    private readonly dialogRef = inject(MatDialogRef<AllPartsWorkbookImportDialog>)

    selectedFile: File | null = null
    preview: BulkPartsWorkbookResult | null = null
    statusText = ''
    working = false

    onFileSelected(event: Event) {
        const input = event.target as HTMLInputElement
        const file = input.files && input.files.length > 0 ? input.files[0] : null
        this.selectedFile = this.isWorkbookFile(file) ? file : null
        this.preview = null
        this.statusText = file && !this.selectedFile
            ? 'Choose an Excel workbook with an .xlsx or .xls file extension.'
            : this.selectedFile ? `${this.selectedFile.name} selected.` : ''
        input.value = ''
    }

    async verify() {
        if (!this.selectedFile) {
            return
        }
        this.working = true
        this.statusText = `Verifying ${this.selectedFile.name}...`
        try {
            const formData = new FormData()
            formData.append('file', this.selectedFile, this.selectedFile.name)
            const response = await firstValueFrom(this.http.post<{ data?: BulkPartsWorkbookResult }>('/api/firewire/parts-import/workbook/preview', formData))
            this.preview = response?.data || null
            this.statusText = this.preview?.valid
                ? 'Workbook verified. Import is available.'
                : 'Import is blocked until the workbook issues are fixed.'
        } catch (err: any) {
            this.statusText = err?.error?.message || err?.message || 'Unable to verify workbook.'
        } finally {
            this.working = false
        }
    }

    async importFile() {
        if (!this.selectedFile) {
            return
        }
        this.working = true
        this.statusText = `Importing ${this.selectedFile.name}...`
        try {
            const formData = new FormData()
            formData.append('file', this.selectedFile, this.selectedFile.name)
            const response = await firstValueFrom(this.http.post<{ data?: BulkPartsWorkbookResult }>('/api/firewire/parts-import/workbook', formData))
            const result = response?.data || null
            this.dialogRef.close({
                imported: true,
                message: result
                    ? `Imported ${result.importedRowCount} parts across ${result.importedVendorCount} vendor worksheet${result.importedVendorCount === 1 ? '' : 's'}.`
                    : 'Workbook import completed.'
            })
        } catch (err: any) {
            this.statusText = err?.error?.message || err?.message || 'Unable to import workbook.'
        } finally {
            this.working = false
        }
    }

    isImportDisabled(): boolean {
        return !this.selectedFile || !this.preview?.valid || this.working
    }

    getImportDisabledReason(): string {
        if (this.working) {
            return 'Workbook operation is still running.'
        }
        if (!this.selectedFile) {
            return 'Choose an Excel workbook first.'
        }
        if (!this.preview) {
            return 'Verify the workbook before importing.'
        }
        if (!this.preview.valid) {
            return 'Fix the workbook issues and verify again before importing.'
        }
        return ''
    }

    private isWorkbookFile(file: File | null): file is File {
        const fileName = String(file?.name || '').trim().toLowerCase()
        return fileName.endsWith('.xlsx') || fileName.endsWith('.xls')
    }
}

@Component({
    standalone: true,
    imports: [CommonModule, MatButtonModule, MatDialogActions, MatDialogClose, MatDialogContent, MatDialogTitle, MatIconModule],
    template: `
        <div mat-dialog-title class="fw-dialog-titlebar">
            <span class="fw-dialog-titlebar__text">Import Parts</span>
            <button mat-icon-button type="button" class="fw-dialog-titlebar__close" aria-label="Cancel import" mat-dialog-close>
                <mat-icon>close</mat-icon>
            </button>
        </div>
        <mat-dialog-content>
            <div class="fw-dialog-stack">
                <p><strong>{{data.vendor.name}}</strong> will import into <strong>{{data.config.targetTable}}</strong> using the stored normalization rules.</p>
                <input type="file" accept=".csv,.xlsx,.xls" (change)="onFileSelected($event)" />
                <div class="parts-dialog-status" *ngIf="statusText">{{statusText}}</div>
                <div *ngIf="preview" class="parts-dialog-preview">
                    <div><strong>Rows:</strong> {{preview.rowCount}}</div>
                    <div><strong>Valid:</strong> {{preview.valid ? 'Yes' : 'No'}}</div>
                    <div><strong>Missing Headers:</strong> {{preview.missingHeaders.length > 0 ? preview.missingHeaders.join(', ') : 'None'}}</div>
                    <div><strong>Unexpected Headers:</strong> {{preview.unexpectedHeaders.length > 0 ? preview.unexpectedHeaders.join(', ') : 'None'}}</div>
                    <div><strong>Backup:</strong> {{preview.snapshotStrategy}}</div>
                    <div *ngIf="preview.issues.length > 0"><strong>Issues:</strong> {{preview.issues.join(' | ')}}</div>
                    <div *ngIf="preview.sampleErrors.length > 0"><strong>Sample Errors:</strong> {{preview.sampleErrors.join(' | ')}}</div>
                </div>
            </div>
        </mat-dialog-content>
        <mat-dialog-actions align="end">
            <button mat-button mat-dialog-close type="button">Cancel</button>
            <button mat-stroked-button type="button" [disabled]="!selectedFile || working" (click)="verify()">Verify File</button>
            <button mat-flat-button type="button" [disabled]="!selectedFile || !preview?.valid || working" (click)="importFile()">Import</button>
        </mat-dialog-actions>
    `,
    styles: [`
        .parts-dialog-status { color: var(--fw-muted); font-size: 0.84rem; }
        .parts-dialog-preview { display: grid; gap: 8px; padding: 12px; border: 1px solid rgba(72, 221, 255, 0.18); border-radius: 0; }
    `]
})
export class PartsImportDialog {
    readonly data = inject<PartsImportDialogData>(MAT_DIALOG_DATA)
    private readonly http = inject(HttpClient)
    private readonly dialogRef = inject(MatDialogRef<PartsImportDialog>)

    selectedFile: File | null = null
    preview: VendorImportPreview | null = null
    statusText = ''
    working = false

    onFileSelected(event: Event) {
        const input = event.target as HTMLInputElement
        const file = input.files && input.files.length > 0 ? input.files[0] : null
        this.selectedFile = this.isPartsImportFile(file) ? file : null
        this.preview = null
        this.statusText = file && !this.selectedFile
            ? 'Choose a CSV or Excel file with a .csv, .xlsx, or .xls file extension.'
            : this.selectedFile ? `${this.selectedFile.name} selected.` : ''
        input.value = ''
    }

    async verify() {
        if (!this.selectedFile) {
            return
        }
        this.working = true
        this.statusText = `Verifying ${this.selectedFile.name}...`
        try {
            const formData = new FormData()
            formData.append('file', this.selectedFile, this.selectedFile.name)
            const response = await firstValueFrom(this.http.post<{ data?: VendorImportPreview }>(`/api/firewire/vendors/${this.data.vendor.vendorId}/parts-import/preview`, formData))
            this.preview = response?.data || null
            this.statusText = this.preview?.valid ? 'File verified and ready to import.' : 'Verification found issues that must be resolved first.'
        } catch (err: any) {
            this.statusText = err?.error?.message || err?.message || 'Unable to verify file.'
        } finally {
            this.working = false
        }
    }

    async importFile() {
        if (!this.selectedFile) {
            return
        }
        this.working = true
        this.statusText = `Importing ${this.selectedFile.name}...`
        try {
            const formData = new FormData()
            formData.append('file', this.selectedFile, this.selectedFile.name)
            const response = await firstValueFrom(this.http.post<{ data?: { snapshotId?: string, insertedRowCount?: number } }>(`/api/firewire/vendors/${this.data.vendor.vendorId}/parts-import`, formData))
            const inserted = response?.data?.insertedRowCount || 0
            const snapshotId = response?.data?.snapshotId || ''
            this.dialogRef.close({
                imported: true,
                message: `Imported ${inserted} parts for ${this.data.vendor.name}. Snapshot ${snapshotId} created before replace.`
            })
        } catch (err: any) {
            this.statusText = err?.error?.message || err?.message || 'Unable to import file.'
        } finally {
            this.working = false
        }
    }

    private isPartsImportFile(file: File | null): file is File {
        const fileName = String(file?.name || '').trim().toLowerCase()
        return fileName.endsWith('.csv') || fileName.endsWith('.xlsx') || fileName.endsWith('.xls')
    }
}

interface PartsImportProcessDialogData {
    vendor: Vendor
    config: VendorImportConfig
}

@Component({
    standalone: true,
    imports: [CommonModule, MatButtonModule, MatDialogActions, MatDialogClose, MatDialogContent, MatDialogTitle, MatIconModule],
    template: `
        <div mat-dialog-title class="fw-dialog-titlebar">
            <span class="fw-dialog-titlebar__text">Import Process</span>
            <button mat-icon-button type="button" class="fw-dialog-titlebar__close" aria-label="Cancel import process" mat-dialog-close>
                <mat-icon>close</mat-icon>
            </button>
        </div>
        <mat-dialog-content>
            <div class="fw-dialog-stack">
                <div><strong>Vendor:</strong> {{data.vendor.name}}</div>
                <div><strong>Source:</strong> {{data.config.sourceLabel}}</div>
                <div><strong>Target:</strong> {{data.config.targetTable}}</div>
                <div><strong>Verified Sample:</strong> {{data.config.verifiedSampleFile || 'N/A'}}<span *ngIf="data.config.verifiedOn"> on {{data.config.verifiedOn}}</span></div>
                <div><strong>Expected Headers:</strong> {{data.config.expectedHeaders.join(', ')}}</div>
                <div><strong>Normalization Steps:</strong></div>
                <ul class="parts-process-list">
                    <li *ngFor="let step of data.config.normalizationSteps">{{step}}</li>
                </ul>
                <div><strong>Analysis Notes:</strong></div>
                <ul class="parts-process-list">
                    <li *ngFor="let note of data.config.analysisSummary">{{note}}</li>
                </ul>
                <div class="parts-process-snapshots">
                    <div class="parts-process-snapshots__title">Snapshots</div>
                    <div *ngIf="statusText" class="parts-dialog-status">{{statusText}}</div>
                    <div *ngIf="snapshots.length <= 0" class="parts-dialog-status">No snapshots found yet.</div>
                    <div *ngFor="let snapshot of snapshots" class="parts-process-snapshot">
                        <div>{{snapshot.createdAt | date:'medium'}} · {{snapshot.fileName}} · {{snapshot.rowCount}} rows</div>
                        <button mat-stroked-button type="button" [disabled]="working" (click)="restoreSnapshot(snapshot)">Restore</button>
                    </div>
                </div>
            </div>
        </mat-dialog-content>
        <mat-dialog-actions align="end">
            <button mat-button mat-dialog-close type="button">Cancel</button>
        </mat-dialog-actions>
    `,
    styles: [`
        .fw-dialog-stack { display: grid; gap: 10px; }
        .parts-process-list { margin: 0; padding-left: 18px; }
        .parts-process-snapshots { display: grid; gap: 10px; }
        .parts-process-snapshots__title { font-weight: 600; }
        .parts-process-snapshot { display: flex; align-items: center; justify-content: space-between; gap: 12px; padding: 12px; border: 1px solid rgba(72, 221, 255, 0.18); border-radius: 0; background: rgba(7, 15, 27, 0.52); }
    `]
})
export class PartsImportProcessDialog {
    readonly data = inject<PartsImportProcessDialogData>(MAT_DIALOG_DATA)
    private readonly http = inject(HttpClient)
    private readonly dialogRef = inject(MatDialogRef<PartsImportProcessDialog>)
    snapshots: VendorImportSnapshot[] = []
    statusText = ''
    working = false

    constructor() {
        void this.loadSnapshots()
    }

    private async loadSnapshots() {
        try {
            const response = await firstValueFrom(this.http.get<{ rows?: VendorImportSnapshot[] }>(`/api/firewire/vendors/${this.data.vendor.vendorId}/parts-import-snapshots`, {
                params: {
                    targetTable: this.data.config.targetTable
                }
            }))
            this.snapshots = Array.isArray(response?.rows) ? response.rows : []
        } catch (err: any) {
            this.statusText = err?.error?.message || err?.message || 'Unable to load snapshots.'
        }
    }

    async restoreSnapshot(snapshot: VendorImportSnapshot) {
        this.working = true
        this.statusText = `Restoring snapshot from ${snapshot.fileName}...`
        try {
            await firstValueFrom(this.http.post(`/api/firewire/vendors/${this.data.vendor.vendorId}/parts-import-snapshots/${snapshot.snapshotId}/restore`, {}))
            this.dialogRef.close({
                restored: true,
                message: `Restored ${this.data.config.targetTable} from snapshot ${snapshot.snapshotId}.`
            })
        } catch (err: any) {
            this.statusText = err?.error?.message || err?.message || 'Unable to restore snapshot.'
        } finally {
            this.working = false
        }
    }
}
