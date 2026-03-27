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
import {MatPaginator, MatPaginatorModule} from '@angular/material/paginator';
import {MatSort, MatSortModule, Sort, SortDirection} from '@angular/material/sort';
import {MatTableDataSource, MatTableModule} from '@angular/material/table';
import {MatInputModule} from '@angular/material/input';
import {MatFormFieldModule} from '@angular/material/form-field';
import { MatSelectModule } from "@angular/material/select"

import { PageToolbar } from '../../common/components/page-toolbar';
import { EddyPricelist } from "../../schemas/eddypricelist.schema"
import { NavToolbar } from "../../common/components/nav-toolbar"
import { VwEddyPricelist } from "../../schemas/vwEddyPricelist"
import { Category } from "../../schemas/category.schema"
import { VwDevice } from "../../schemas/vwdevice.schema"
import { Vendor } from "../../schemas/vendor.schema"
import { VendorImportConfig, VendorImportPreview, VendorImportRun, VendorImportSnapshot } from "../../schemas/vendor-import-config.schema"

interface PartsVendorView {
    key: string
    caption: string
    datasetLabel: string
    vendorName: string
    listEndpoint: string
    createDeviceEndpoint: (partNumber: string) => string
    addToDeviceEndpoint: (partNumber: string) => string
}

const PARTS_VENDOR_VIEWS: PartsVendorView[] = [
    {
        key: 'edwards',
        caption: 'EDWARDS',
        datasetLabel: 'Edwards Price List',
        vendorName: 'Edwards',
        listEndpoint: '/api/firewire/vweddypricelist',
        createDeviceEndpoint: (partNumber: string) => `/api/firewire/eddypricelist/${encodeURIComponent(partNumber)}/create-device`,
        addToDeviceEndpoint: (partNumber: string) => `/api/firewire/eddypricelist/${encodeURIComponent(partNumber)}/add-to-device`
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
        MatIconModule, PageToolbar, NavToolbar],
    providers: [HttpClient],
    templateUrl: './eddypricelist.page.html',
    styleUrls: ['./eddypricelist.page.scss']
})
export class EddyPricelistPage implements OnInit, AfterViewInit  {
    displayedColumns: string[] = [
        'PartNumber',
        'LongDescription',
        'ParentCategory',
        'Category',
        'MSRPPrice',
        'MinOrderQuantity',
        //'ProductStatus',
        'UPC',
        //'SalesPrice',
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
    eddypricelists: VwEddyPricelist[] = []
    navItems = NavToolbar.DeviceNavItems
    vendorViews = PARTS_VENDOR_VIEWS
    vendors: Vendor[] = []
    availablePartsVendors: Vendor[] = []
    errText?: string
    statusText = ''
    textFilter = ''
    actionWorking = false
    categories: Category[] = []
    devices: VwDevice[] = []
    selectedCategories: string[] = []
    activeVendorView = PARTS_VENDOR_VIEWS[0]
    activeVendor: Vendor | null = null
    activeImportConfig: VendorImportConfig | null = null
    activeImportRun: VendorImportRun | null = null
    selectedVendorId = ''
    currentSortActive = 'PartNumber'
    currentSortDirection: SortDirection = 'asc'

    datasource: MatTableDataSource<VwEddyPricelist> = new MatTableDataSource(this.eddypricelists);
    
    constructor(
        private http: HttpClient,
        private dialog: MatDialog,
        private route: ActivatedRoute,
        private router: Router
    ) {}

    ngOnInit(): void {
        this.route.paramMap.subscribe((params) => {
            const vendorKey = String(params.get('vendorKey') || '').trim().toLowerCase()
            const nextView = this.vendorViews.find((view) => view.key === vendorKey) || this.vendorViews[0]
            this.activeVendorView = nextView
            this.selectedCategories = this.readStoredCategoryFilter()
            const storedSort = this.readStoredPartsSort()
            this.currentSortActive = storedSort.active
            this.currentSortDirection = storedSort.direction
            this.configureFilterPredicate()
            this.statusText = ''
            void this.loadActiveVendorContext()
            void this.ensureCategoriesLoaded()
            this.loadParts()
        })
    }

    ngAfterViewInit(): void {
        this.datasource.paginator = this.paginator||null;
        this.datasource.sort = this.sort||null;
        this.applyStoredSortState()
    }

    applyFilter(event: Event) {
        this.textFilter = (event.target as HTMLInputElement).value || ''
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

    async openCreateDeviceDialog(row: VwEddyPricelist) {
        await this.ensureCategoriesLoaded()

        const dialogRef = this.dialog.open(CreateDeviceFromPartDialog, {
            width: '560px',
            maxWidth: '95vw',
            data: {
                part: row,
                categories: this.categories
            }
        })

        const result = await firstValueFrom(dialogRef.afterClosed())
        if (!result) {
            return
        }

        this.actionWorking = true
        this.statusText = `Creating device from ${row.PartNumber}...`

        this.http.post<{ data?: { device?: VwDevice } }>(this.activeVendorView.createDeviceEndpoint(row.PartNumber), result).subscribe({
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

    async openAddToExistingDeviceDialog(row: VwEddyPricelist) {
        await this.ensureDevicesLoaded()

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

        this.http.post(this.activeVendorView.addToDeviceEndpoint(row.PartNumber), result).subscribe({
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

    private async ensureCategoriesLoaded() {
        if (this.categories.length > 0) {
            return
        }

        const response = await firstValueFrom(this.http.get<{ rows?: Category[] }>('/api/firewire/categories'))
        this.categories = Array.isArray(response?.rows) ? response.rows : []
    }

    private async ensureDevicesLoaded() {
        if (this.devices.length > 0) {
            return
        }

        const response = await firstValueFrom(this.http.get<{ rows?: VwDevice[] }>('/api/firewire/vwdevices'))
        const rows = Array.isArray(response?.rows) ? response.rows : []
        const activeVendorId = this.eddypricelists.find((row) => row.vendorId)?.vendorId || null

        this.devices = activeVendorId
            ? rows.filter((device) => device.vendorId === activeVendorId)
            : rows.filter((device) => String(device.vendorName || '').trim().toLowerCase() === this.activeVendorView.vendorName.toLowerCase())
    }

    async openImportDialog() {
        if (!this.activeVendor || !this.activeImportConfig) {
            this.statusText = `Configure import rules for ${this.activeVendorView.vendorName} before importing.`
            return
        }

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

        await this.router.navigate(['/parts', targetView.key])
    }

    private async loadActiveVendorContext() {
        try {
            const vendorsResponse = await firstValueFrom(this.http.get<{ rows?: Vendor[] }>('/api/firewire/vendors'))
            this.vendors = Array.isArray(vendorsResponse?.rows) ? vendorsResponse.rows : []
            this.availablePartsVendors = this.vendors.filter((row) => !!this.resolveVendorViewForVendor(row))
            this.activeVendor = this.vendors.find((row) => {
                const vendorView = this.resolveVendorViewForVendor(row)
                return vendorView?.key === this.activeVendorView.key
            }) || this.vendors.find((row) => String(row.name || '').trim().toLowerCase() === this.activeVendorView.vendorName.toLowerCase()) || null
            if (!this.activeVendor) {
                this.activeImportConfig = null
                this.activeImportRun = null
                this.selectedVendorId = ''
                return
            }
            this.selectedVendorId = this.activeVendor.vendorId

            const configResponse = await firstValueFrom(this.http.get<{ data?: VendorImportConfig }>(`/api/firewire/vendors/${this.activeVendor.vendorId}/import-config`))
            this.activeImportConfig = configResponse?.data || null
            const statusResponse = await firstValueFrom(this.http.get<{ data?: VendorImportRun | null }>(`/api/firewire/vendors/${this.activeVendor.vendorId}/parts-import-status`, {
                params: {
                    targetTable: this.activeImportConfig?.targetTable || 'EddyPricelist'
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
            return this.vendorViews.find((view) => view.key === config.partsVendorKey) || null
        }
        return this.vendorViews.find((view) => String(vendor.name || '').trim().toLowerCase() === view.vendorName.toLowerCase()) || null
    }

    private parseVendorImportConfig(raw: string | null | undefined): VendorImportConfig | null {
        if (!raw) {
            return null
        }
        try {
            return JSON.parse(raw) as VendorImportConfig
        } catch {
            return null
        }
    }

    private loadParts() {
        this.eddypricelists = []
        this.devices = []
        this.pageWorking = true
        this.errText = undefined
        this.datasource.data = []

        this.http.get<{ rows?: VwEddyPricelist[] }>(this.activeVendorView.listEndpoint).subscribe({
            next: (response) => {
                if (response && Array.isArray(response.rows)) {
                    this.eddypricelists = [...response.rows]
                    this.datasource = new MatTableDataSource(this.eddypricelists)
                    this.configureFilterPredicate()
                    this.datasource.paginator = this.paginator || null
                    this.datasource.sort = this.sort || null
                    this.applyStoredSortState()
                    this.applyCombinedFilter()
                    this.pageWorking = false
                    return
                }

                this.eddypricelists = []
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
        const categories = this.eddypricelists
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
        this.datasource.filterPredicate = (row: VwEddyPricelist, filter: string) => {
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

    private getPartsSortStorageKey(): string {
        return `firewire.parts.${this.activeVendorView.key}.sort`
    }

    private storeCategoryFilter() {
        if (typeof localStorage === 'undefined') {
            return
        }
        try {
            localStorage.setItem(this.getPartsCategoryFilterStorageKey(), JSON.stringify(this.selectedCategories))
        } catch {
            return
        }
    }

    private readStoredCategoryFilter(): string[] {
        if (typeof localStorage === 'undefined') {
            return []
        }
        try {
            const value = JSON.parse(localStorage.getItem(this.getPartsCategoryFilterStorageKey()) || '[]')
            return Array.isArray(value) ? value.filter((item): item is string => typeof item === 'string') : []
        } catch {
            return []
        }
    }

    private storePartsSort() {
        if (typeof localStorage === 'undefined') {
            return
        }
        try {
            localStorage.setItem(this.getPartsSortStorageKey(), JSON.stringify({
                active: this.currentSortActive,
                direction: this.currentSortDirection
            }))
        } catch {
            return
        }
    }

    private readStoredPartsSort(): { active: string, direction: SortDirection } {
        if (typeof localStorage === 'undefined') {
            return { active: 'PartNumber', direction: 'asc' }
        }
        try {
            const parsed = JSON.parse(localStorage.getItem(this.getPartsSortStorageKey()) || '{}') as { active?: unknown, direction?: unknown }
            const active = typeof parsed.active === 'string' && parsed.active.trim() ? parsed.active : 'PartNumber'
            const direction = parsed.direction === 'desc' || parsed.direction === 'asc' ? parsed.direction : 'asc'
            return { active, direction }
        } catch {
            return { active: 'PartNumber', direction: 'asc' }
        }
    }

    private applyStoredSortState() {
        if (!this.sort) {
            return
        }
        this.sort.active = this.currentSortActive
        this.sort.direction = this.currentSortDirection
    }

}

interface CreateDeviceFromPartDialogData {
    part: VwEddyPricelist
    categories: Category[]
}

interface CreateDeviceFromPartCategoryOption {
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
export class CreateDeviceFromPartDialog {
    readonly data = inject<CreateDeviceFromPartDialogData>(MAT_DIALOG_DATA)
    readonly partCategoryName = String(this.data.part.Category || '').trim()
    readonly categoryOptions: CreateDeviceFromPartCategoryOption[] = this.buildCategoryOptions()
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

    private buildCategoryOptions(): CreateDeviceFromPartCategoryOption[] {
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

    getSelectedCategoryOption(): CreateDeviceFromPartCategoryOption | null {
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

interface AddPartToExistingDeviceDialogData {
    part: VwEddyPricelist
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

interface PartsImportDialogData {
    vendor: Vendor
    config: VendorImportConfig
}

@Component({
    standalone: true,
    imports: [CommonModule, MatButtonModule, MatDialogActions, MatDialogClose, MatDialogContent, MatDialogTitle],
    template: `
        <div mat-dialog-title>Import Parts</div>
        <mat-dialog-content>
            <div class="fw-dialog-stack">
                <p><strong>{{data.vendor.name}}</strong> will import into <strong>{{data.config.targetTable}}</strong> using the stored normalization rules.</p>
                <input type="file" accept=".csv,text/csv" (change)="onFileSelected($event)" />
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
            <button mat-button mat-dialog-close type="button">Close</button>
            <button mat-stroked-button type="button" [disabled]="!selectedFile || working" (click)="verify()">Verify File</button>
            <button mat-flat-button type="button" [disabled]="!selectedFile || !preview?.valid || working" (click)="importFile()">Import</button>
        </mat-dialog-actions>
    `,
    styles: [`
        .parts-dialog-status { color: var(--fw-muted); font-size: 0.84rem; }
        .parts-dialog-preview { display: grid; gap: 8px; padding: 12px; border: 1px solid rgba(72, 221, 255, 0.18); border-radius: 12px; }
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
        this.selectedFile = input.files && input.files.length > 0 ? input.files[0] : null
        this.preview = null
        this.statusText = this.selectedFile ? `${this.selectedFile.name} selected.` : ''
    }

    async verify() {
        if (!this.selectedFile) {
            return
        }
        this.working = true
        this.statusText = `Verifying ${this.selectedFile.name}...`
        try {
            const formData = new FormData()
            formData.append('file', this.selectedFile)
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
            formData.append('file', this.selectedFile)
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
}

interface PartsImportProcessDialogData {
    vendor: Vendor
    config: VendorImportConfig
}

@Component({
    standalone: true,
    imports: [CommonModule, MatButtonModule, MatDialogActions, MatDialogClose, MatDialogContent, MatDialogTitle],
    template: `
        <div mat-dialog-title>Import Process</div>
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
            <button mat-button mat-dialog-close type="button">Close</button>
        </mat-dialog-actions>
    `,
    styles: [`
        .parts-process-list { margin: 0; padding-left: 18px; }
        .parts-process-snapshots { display: grid; gap: 10px; }
        .parts-process-snapshots__title { font-weight: 600; }
        .parts-process-snapshot { display: flex; align-items: center; justify-content: space-between; gap: 12px; padding: 12px; border: 1px solid rgba(72, 221, 255, 0.18); border-radius: 12px; }
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
