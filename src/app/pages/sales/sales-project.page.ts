import { CommonModule } from '@angular/common'
import { HttpClient } from '@angular/common/http'
import { Component, ElementRef, HostListener, Input, ViewChild, inject } from '@angular/core'
import { FormsModule } from '@angular/forms'
import { RouterLink } from '@angular/router'
import { firstValueFrom } from 'rxjs'

import { MatButtonModule } from '@angular/material/button'
import { MatCardModule } from '@angular/material/card'
import { MAT_DIALOG_DATA, MatDialog, MatDialogActions, MatDialogClose, MatDialogContent, MatDialogRef, MatDialogTitle } from '@angular/material/dialog'
import { MatFormFieldModule } from '@angular/material/form-field'
import { MatIconModule } from '@angular/material/icon'
import { MatInputModule } from '@angular/material/input'
import { MatSelectModule } from '@angular/material/select'

import { PageToolbar } from '../../common/components/page-toolbar'
import { FirewireBomWorksheetComponent } from '../../common/components/firewire-bom-worksheet.component'
import { FirewireDocLibraryExplorerComponent } from '../../common/components/firewire-doc-library-explorer.component'
import { FirewireFloorplansComponent } from '../../common/components/firewire-floorplans.component'
import { createEmptyProjectSettingsCatalog, ProjectSettingsCatalogSchema } from '../../schemas/project-settings.schema'
import { FIREWIRE_PROJECT_TYPE_OPTIONS, FirewireProjectSchema, FirewireProjectType } from '../../schemas/firewire-project.schema'
import { ProjectSettingsApi } from '../projects/project-settings.api'
import {
    ProjectDocLibraryDirectoryRecord,
    ProjectDocLibraryFileRecord,
    ProjectDocLibraryFileVersionRecord,
    ProjectFloorplanDesignState,
    ProjectDocLibraryStorageService
} from '../../common/services/project-doc-library-storage.service'
import { PdfThumbnailService } from '../../common/services/pdf-thumbnail.service'
import { DevicePartPriceSyncService } from '../../common/services/device-part-price-sync.service'
import { DeviceSetSummary, DeviceSetDetail } from '../../schemas/device-set.schema'
import { VwDeviceMaterial } from '../../schemas/vwdevicematerial.schema'
import { VwDevice } from '../../schemas/vwdevice.schema'
import { VwPart } from '../../schemas/vwpart.schema'
import { FloorplanDesignerDialog, FloorplanDesignerDialogResult, FloorplanSymbolBalanceDialog, FloorplanSymbolBalanceDialogData } from '../design/floorplan-designer.dialog'
import { FloorplanDesignerSymbolOption } from '../design/floorplan-designer.component'

type SalesWorkspaceTab = 'PROJECT DETAILS' | 'CUSTOMER INFO' | 'BOM' | 'FLOORPLANS' | 'DOC LIBRARY'
type SalesBomSortKey = 'partNbr' | 'description' | 'qty' | 'cost' | 'extCost' | 'labor' | 'extLabor' | 'includeOnFloorplan' | 'type'

interface SalesBomRow {
    partNbr: string
    description: string
    qty: number
    cost: number
    labor: number
    includeOnFloorplan: boolean
    type: string
    lookupQuery?: string
}

interface SalesBomSection {
    title: string
    rows: SalesBomRow[]
    sectionKey?: string
    vendorIds?: string[]
    vendorNames?: string[]
}

interface SalesProjectForm {
    name: string
    bidDueDate: string
    projectStatus: string
    projectType: FirewireProjectType | null
    salesman: string
    jobType: string
    scopeType: string
    projectScope: string
    difficulty: string
    totalSqFt: number | null
    address: string
}

interface SalesCustomerInfo {
    billingName: string
    billingAddress: string
    billingEmail: string
    billingPhone: string
    contractOrPoNumber: string
}

interface SalesDocLibraryCategoryDialogData {
    title: string
    confirmLabel: string
    selectedFolderId: string
    folders: Array<{ id: string, label: string }>
}

interface SalesFloorplanDeleteDialogData {
    fileName: string
}

@Component({
    standalone: true,
    selector: 'sales-project-page',
    imports: [
        CommonModule,
        FormsModule,
        RouterLink,
        MatButtonModule,
        MatCardModule,
        MatFormFieldModule,
        MatIconModule,
        MatInputModule,
        MatSelectModule,
        PageToolbar,
        FirewireBomWorksheetComponent,
        FirewireDocLibraryExplorerComponent,
        FirewireFloorplansComponent,
    ],
    providers: [HttpClient],
    templateUrl: './sales-project.page.html',
    styleUrls: ['./sales-project.page.scss']
})
export class SalesProjectPage {
    private readonly defaultLaborHourlyRate = 56
    private readonly defaultLaborCost = this.defaultLaborHourlyRate * 2
    private readonly floorplansFolderId = 'floorplans'
    @Input() projectId?: string

    @ViewChild('docLibraryUploadInput')
    docLibraryUploadInput?: ElementRef<HTMLInputElement>
    @ViewChild('floorplanUploadInput')
    floorplanUploadInput?: ElementRef<HTMLInputElement>

    private readonly projectSettingsApi = inject(ProjectSettingsApi)
    private readonly projectDocLibraryStorage = inject(ProjectDocLibraryStorageService)
    private readonly pdfThumbnailService = inject(PdfThumbnailService)
    private readonly devicePartPriceSync = inject(DevicePartPriceSyncService)
    private readonly dialog = inject(MatDialog)
    readonly projectTypeOptions = FIREWIRE_PROJECT_TYPE_OPTIONS
    readonly workspaceTabs: SalesWorkspaceTab[] = ['PROJECT DETAILS', 'CUSTOMER INFO', 'BOM', 'FLOORPLANS', 'DOC LIBRARY']
    readonly docLibraryImageTileMaxBytes = 4 * 1024 * 1024

    get bomWorksheetHost(): SalesProjectPage {
        return this
    }

    pageWorking = true
    saveWorking = false
    pageMessage = ''
    saveMessage = ''
    docLibraryStatusMessage = ''
    docLibraryUploadBusy = false
    floorplanStatusMessage = ''
    floorplanUploadBusy = false
    activeTab: SalesWorkspaceTab = 'PROJECT DETAILS'
    selectedDocLibraryFolder = 'all'
    selectedDeviceSetId = ''
    project?: FirewireProjectSchema
    projectForm: SalesProjectForm = this.createDefaultForm()
    customerInfo: SalesCustomerInfo = this.createDefaultCustomerInfo()
    initialFormSnapshot = ''
    initialCustomerInfoSnapshot = ''
    initialBomSnapshot = '[]'
    projectSettings: ProjectSettingsCatalogSchema = createEmptyProjectSettingsCatalog()
    docLibraryFiles: ProjectDocLibraryFileRecord[] = []
    docLibraryDirectories: ProjectDocLibraryDirectoryRecord[] = []
    deviceSets: DeviceSetSummary[] = []
    bomSections: SalesBomSection[] = []
    bomFilter = ''
    bomSortKey: SalesBomSortKey = 'partNbr'
    bomSortDirection: 'asc' | 'desc' = 'asc'
    deviceRows: VwDevice[] = []
    deviceLookupLoaded = false
    vendorPartRows: VwPart[] = []
    vendorPartLookupLoaded = false
    vendorPartLookupWorking = false
    activeBomLookupSectionKey = ''
    activeBomLookupRow: SalesBomRow | null = null
    bomLookupMenuStyle: Record<string, string> = {}
    private activeBomLookupInput: HTMLInputElement | null = null

    constructor(private http: HttpClient) {}

    ngOnChanges(): void {
        this.pageWorking = true
        this.pageMessage = ''
        this.saveMessage = ''
        this.project = undefined
        this.projectForm = this.createDefaultForm()
        this.customerInfo = this.createDefaultCustomerInfo()
        this.initialFormSnapshot = ''
        this.initialCustomerInfoSnapshot = ''
        this.initialBomSnapshot = '[]'
        this.docLibraryFiles = []
        this.selectedDocLibraryFolder = 'all'
        this.selectedDeviceSetId = ''
        this.bomSections = []
        void this.loadProjectSettings()

        if (!this.projectId) {
            this.pageMessage = 'Invalid sales project.'
            this.pageWorking = false
            return
        }

        Promise.all([
            this.http.get<{ data?: FirewireProjectSchema }>(`/api/firewire/projects/firewire/${this.projectId}`).toPromise(),
            this.http.get<{ rows?: DeviceSetSummary[] }>('/api/firewire/device-sets').toPromise()
        ]).then(async([projectResponse, deviceSetsResponse]) => {
            this.project = projectResponse?.data ? { ...projectResponse.data } : undefined
            this.deviceSets = Array.isArray(deviceSetsResponse?.rows)
                ? [...deviceSetsResponse.rows].sort((left, right) => String(left.name || '').localeCompare(String(right.name || '')))
                : []
            if (this.project) {
                this.projectForm = this.buildForm(this.project)
                this.customerInfo = this.buildCustomerInfo(this.project)
                this.bomSections = this.cloneBomSections(this.project?.worksheetData?.bomSections)
                this.captureInitialFormState()
                this.captureInitialCustomerInfoState()
                this.captureInitialBomState()
                await this.loadDocLibraryWorkspace()
            }
            this.pageWorking = false
        }).catch((err: any) => {
            this.pageMessage = err?.error?.message || err?.message || 'Unable to load sales project.'
            this.pageWorking = false
        })
    }

    setActiveTab(tab: SalesWorkspaceTab): void {
        this.activeTab = tab
        if (tab !== 'DOC LIBRARY') {
            this.docLibraryStatusMessage = ''
        }
        if (tab !== 'FLOORPLANS') {
            this.floorplanStatusMessage = ''
        }
    }

    onUploadFloorplansClick(): void {
        if (!this.floorplanUploadInput?.nativeElement) {
            return
        }

        this.activeTab = 'FLOORPLANS'
        this.floorplanStatusMessage = ''
        this.floorplanUploadInput.nativeElement.click()
    }

    async onUploadDocsClick(): Promise<void> {
        if (!this.docLibraryUploadInput?.nativeElement) {
            return
        }

        this.activeTab = 'DOC LIBRARY'
        this.docLibraryStatusMessage = ''
        this.docLibraryUploadInput.nativeElement.click()
    }

    async saveProjectDetails(): Promise<void> {
        if (!this.projectId || !this.project) {
            return
        }
        this.syncFloorplanQuantitiesToBom()
        const symbolBalanceErrors = this.getFloorplanSymbolBalanceErrors()
        if (symbolBalanceErrors.length > 0) {
            this.showFloorplanSymbolBalanceErrors(symbolBalanceErrors)
            this.saveMessage = 'Project save blocked by floorplan symbol counts.'
            return
        }

        this.saveWorking = true
        this.saveMessage = 'Saving project...'

        this.http.patch(`/api/firewire/projects/firewire/${this.projectId}`, {
            ...this.projectForm,
            worksheetData: {
                ...(this.project.worksheetData || {}),
                customerInfo: this.customerInfo,
                bomSections: this.buildWorksheetBomSections()
            }
        }).subscribe({
            next: async(response: any) => {
                this.project = response?.data ? { ...response.data } : this.project
                if (response?.data) {
                    this.projectForm = this.buildForm(response.data)
                    this.customerInfo = this.buildCustomerInfo(response.data)
                    this.bomSections = this.cloneBomSections(response?.data?.worksheetData?.bomSections)
                    this.captureInitialFormState()
                    this.captureInitialCustomerInfoState()
                    this.captureInitialBomState()
                }
                await this.loadDocLibraryWorkspace()
                this.saveWorking = false
                this.saveMessage = 'Project saved.'
            },
            error: (err: any) => {
                this.saveWorking = false
                this.saveMessage = err?.error?.message || err?.message || 'Unable to save project.'
            }
        })
    }

    async saveBom(): Promise<void> {
        if (!this.projectId || !this.project) {
            return
        }
        this.syncFloorplanQuantitiesToBom()
        const symbolBalanceErrors = this.getFloorplanSymbolBalanceErrors()
        if (symbolBalanceErrors.length > 0) {
            this.showFloorplanSymbolBalanceErrors(symbolBalanceErrors)
            this.saveMessage = 'BOM save blocked by floorplan symbol counts.'
            return
        }

        this.saveWorking = true
        this.saveMessage = 'Saving BOM...'

        const worksheetData = {
            ...(this.project.worksheetData || {}),
            customerInfo: this.customerInfo,
            bomSections: this.buildWorksheetBomSections()
        }

        this.http.patch(`/api/firewire/projects/firewire/${this.projectId}`, {
            ...this.projectForm,
            worksheetData
        }).subscribe({
            next: async(response: any) => {
                this.project = response?.data ? { ...response.data } : {
                    ...this.project,
                    worksheetData
                }
                if (response?.data) {
                    this.projectForm = this.buildForm(response.data)
                    this.customerInfo = this.buildCustomerInfo(response.data)
                }
                this.bomSections = this.cloneBomSections((response?.data?.worksheetData || worksheetData)?.bomSections)
                this.captureInitialFormState()
                this.captureInitialCustomerInfoState()
                this.captureInitialBomState()
                this.saveWorking = false
                this.saveMessage = 'BOM saved.'
                await this.loadDocLibraryWorkspace()
            },
            error: (err: any) => {
                this.saveWorking = false
                this.saveMessage = err?.error?.message || err?.message || 'Unable to save BOM.'
            }
        })
    }

    get isProjectDirty(): boolean {
        return this.serializeForm(this.projectForm) !== this.initialFormSnapshot
    }

    get isCustomerInfoDirty(): boolean {
        return this.serializeCustomerInfo(this.customerInfo) !== this.initialCustomerInfoSnapshot
    }

    get isBomDirty(): boolean {
        return this.serializeBomSections(this.bomSections) !== this.initialBomSnapshot
    }

    getActiveSettings(listKey: keyof ProjectSettingsCatalogSchema) {
        return (this.projectSettings[listKey] || []).filter((item) => item.isActive)
    }

    getDocLibraryFoldersWithAll(): Array<{ id: string, label: string, itemCount: number }> {
        const visibleFiles = this.getDocLibraryFilesOnly()
        const allCount = visibleFiles.length
        return [
            { id: 'all', label: 'All Documents', itemCount: allCount },
            ...this.docLibraryDirectories.map((folder) => ({
                id: folder.id,
                label: folder.name,
                itemCount: visibleFiles.filter((file) => file.folderId === folder.id).length
            }))
        ]
    }

    getDocLibraryVisibleFiles(): ProjectDocLibraryFileRecord[] {
        if (this.selectedDocLibraryFolder === 'all') {
            return this.getDocLibraryFilesOnly()
        }
        return this.getDocLibraryFilesOnly().filter((file) => file.folderId === this.selectedDocLibraryFolder)
    }

    getFloorplanFiles(): ProjectDocLibraryFileRecord[] {
        return this.docLibraryFiles
            .filter((file) => file.folderId === this.floorplansFolderId)
            .sort((left, right) => this.compareFloorplanFilesByName(left, right))
    }

    private compareFloorplanFilesByName(left: ProjectDocLibraryFileRecord, right: ProjectDocLibraryFileRecord): number {
        const nameComparison = String(left.name || '').localeCompare(String(right.name || ''), undefined, { numeric: true, sensitivity: 'base' })
        if (nameComparison !== 0) {
            return nameComparison
        }
        return String(left.id || '').localeCompare(String(right.id || ''))
    }

    isFloorplanPdf(file: ProjectDocLibraryFileRecord): boolean {
        const version = this.getLatestDocLibraryVersion(file)
        return String(version?.mimeType || '').toLowerCase() === 'application/pdf'
            || String(file.extension || '').toLowerCase() === 'pdf'
    }

    getFloorplanPreviewContent(file: ProjectDocLibraryFileRecord): string {
        const version = this.getLatestDocLibraryVersion(file)
        return version?.thumbnailDataUrl || version?.dataUrl || ''
    }

    getFloorplanVersionContent(file: ProjectDocLibraryFileRecord): string {
        const version = this.getLatestDocLibraryVersion(file)
        return version?.dataUrl || version?.contentUrl || ''
    }

    getFloorplanTotalBytes(): number {
        return this.getFloorplanFiles().reduce((sum, file) => sum + Number(this.getLatestDocLibraryVersion(file)?.sizeBytes || 0), 0)
    }

    private getFloorplanDesignerSymbols(): FloorplanDesignerSymbolOption[] {
        const inventory = this.getFloorplanSymbolInventory()
        const placedCounts = this.getFloorplanSymbolPlacementCounts()
        return inventory.map((symbol) => {
            const placedQty = placedCounts.get(symbol.id) || 0
            return {
                ...symbol,
                placedQty,
                remainingQty: Math.max(0, symbol.totalQty - placedQty)
            }
        })
    }

    private getFloorplanSymbolInventory(): FloorplanDesignerSymbolOption[] {
        const bySymbol = new Map<string, FloorplanDesignerSymbolOption>()
        for (const section of this.bomSections) {
            for (const row of section.rows || []) {
                const categoryName = String(row.type || '').trim()
                const qty = Math.max(0, Math.trunc(Number(row.qty || 0)))
                if (!row.includeOnFloorplan || !categoryName) {
                    continue
                }

                const categoryKey = `category-${this.normalizeFloorplanSymbolKey(categoryName)}`
                const partNumber = String(row.partNbr || '').trim()
                const deviceName = String(row.description || row.partNbr || categoryName).trim()
                const id = this.getFloorplanSymbolIdForBomRow(row)
                const existing = bySymbol.get(id)
                if (existing) {
                    existing.totalQty += qty
                    continue
                }

                bySymbol.set(id, {
                    id,
                    code: this.createFloorplanSymbolCode(categoryName, deviceName),
                    label: deviceName,
                    color: this.getFloorplanSymbolColor(categoryKey),
                    totalQty: qty,
                    placedQty: 0,
                    remainingQty: qty,
                    categoryKey,
                    categoryName,
                    partNumber,
                    deviceName,
                    materialCost: Number(row.cost || 0),
                    laborHours: Number(row.labor || 0),
                    customAttributes: []
                })
            }
        }
        return [...bySymbol.values()]
    }

    private getFloorplanSymbolPlacementCounts(overrideFileId?: string, overrideDesign?: ProjectFloorplanDesignState): Map<string, number> {
        const counts = new Map<string, number>()
        for (const file of this.getFloorplanFiles()) {
            const design = overrideFileId && file.id === overrideFileId ? overrideDesign : file.floorplanDesign
            for (const annotation of design?.annotations || []) {
                if (annotation.kind !== 'symbol' || !annotation.symbolId) {
                    continue
                }
                counts.set(annotation.symbolId, (counts.get(annotation.symbolId) || 0) + 1)
            }
        }
        return counts
    }

    private getFloorplanSymbolBalanceErrors(overrideFileId?: string, overrideDesign?: ProjectFloorplanDesignState): string[] {
        const inventory = new Map(this.getFloorplanSymbolInventory().map((symbol) => [symbol.id, symbol]))
        const placedCounts = this.getFloorplanSymbolPlacementCounts(overrideFileId, overrideDesign)
        const errors: string[] = []
        for (const [symbolId, placedQty] of placedCounts) {
            const symbol = inventory.get(symbolId)
            if (!symbol) {
                errors.push(`A placed symbol no longer exists on the BOM. Remove ${placedQty} orphaned placement${placedQty === 1 ? '' : 's'} from the floorplans.`)
            }
        }
        return errors
    }

    private syncFloorplanQuantitiesToBom(): void {
        const placedCounts = this.getFloorplanSymbolPlacementCounts()
        const synchronized = new Set<string>()
        for (const section of this.bomSections) {
            for (const row of section.rows || []) {
                if (!row.includeOnFloorplan || !String(row.type || '').trim()) {
                    continue
                }
                const symbolId = this.getFloorplanSymbolIdForBomRow(row)
                row.qty = synchronized.has(symbolId) ? 0 : (placedCounts.get(symbolId) || 0)
                synchronized.add(symbolId)
            }
        }
        this.bomSections = [...this.bomSections]
    }

    private getFloorplanSymbolIdForBomRow(row: SalesBomRow): string {
        const categoryName = String(row.type || '').trim()
        const categoryKey = `category-${this.normalizeFloorplanSymbolKey(categoryName)}`
        const partNumber = String(row.partNbr || '').trim()
        const deviceName = String(row.description || row.partNbr || categoryName).trim()
        return `${categoryKey}::${this.normalizeFloorplanSymbolKey(partNumber || deviceName)}`
    }

    private showFloorplanSymbolBalanceErrors(errors: string[]): void {
        if (errors.length <= 0) {
            return
        }
        this.dialog.open(FloorplanSymbolBalanceDialog, {
            width: '520px',
            maxWidth: '92vw',
            panelClass: 'fw-compact-dialog-pane',
            data: { errors } as FloorplanSymbolBalanceDialogData
        })
    }

    private normalizeFloorplanSymbolKey(value: string): string {
        return String(value || '').trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '') || 'item'
    }

    private createFloorplanSymbolCode(categoryName: string, deviceName: string): string {
        const source = String(categoryName || deviceName || 'SY').trim()
        const words = source.split(/[^a-z0-9]+/i).filter(Boolean)
        const code = words.length > 1
            ? words.map((word) => word[0]).join('')
            : source.slice(0, 3)
        return code.slice(0, 3).toUpperCase() || 'SY'
    }

    private getFloorplanSymbolColor(key: string): string {
        const palette = ['#77d7ff', '#ffcf7a', '#ff8d8d', '#9effb6', '#d49bff', '#8dd7ff', '#ffd07f', '#a5f3fc']
        let hash = 0
        for (const char of key) {
            hash = ((hash << 5) - hash) + char.charCodeAt(0)
            hash |= 0
        }
        return palette[Math.abs(hash) % palette.length]
    }

    formatFloorplanBytes(sizeBytes: number): string {
        if (sizeBytes >= 1024 * 1024) {
            return `${(sizeBytes / (1024 * 1024)).toFixed(2)} MB`
        }
        if (sizeBytes >= 1024) {
            return `${Math.round(sizeBytes / 1024)} KB`
        }
        return `${sizeBytes} B`
    }

    getDocLibraryDocumentRows(): ProjectDocLibraryFileRecord[] {
        return this.getDocLibraryVisibleFiles().filter((file) => !this.isDocLibraryDisplayableImage(file))
    }

    getDocLibraryImageTiles(): ProjectDocLibraryFileRecord[] {
        return this.getDocLibraryVisibleFiles().filter((file) => this.isDocLibraryDisplayableImage(file))
    }

    getLatestDocLibraryVersion(file: ProjectDocLibraryFileRecord): ProjectDocLibraryFileVersionRecord | undefined {
        return file.versions?.[file.versions.length - 1]
    }

    isDocLibraryDisplayableImage(file: ProjectDocLibraryFileRecord): boolean {
        const version = this.getLatestDocLibraryVersion(file)
        const mimeType = String(version?.mimeType || '').toLowerCase()
        return mimeType.startsWith('image/') && Number(version?.sizeBytes || 0) <= this.docLibraryImageTileMaxBytes && !!(version?.dataUrl || version?.contentUrl)
    }

    canEditDocLibraryMarkup(file: ProjectDocLibraryFileRecord): boolean {
        const version = this.getLatestDocLibraryVersion(file)
        return this.projectDocLibraryStorage.isDrawing(file)
            && String(version?.mimeType || '').toLowerCase().startsWith('image/')
            && !!(version?.dataUrl || version?.contentUrl)
            && !!this.getDocLibraryStorageKey()
    }

    getDocLibraryMarkupLink(file: ProjectDocLibraryFileRecord): any[] {
        return ['/edit-markup']
    }

    getDocLibraryMarkupQueryParams(file: ProjectDocLibraryFileRecord): Record<string, string> {
        return {
            projectKey: file.storageKey || this.getDocLibraryStorageKey(),
            bomProjectKey: this.projectId || this.project?.uuid || this.getDocLibraryStorageKey(),
            fileId: file.id,
            returnTo: `/sales/${this.projectId || this.project?.uuid || ''}`
        }
    }

    readonly getDocLibraryRecordMarkupQueryParams = (file: ProjectDocLibraryFileRecord): Record<string, string> => {
        return this.getDocLibraryMarkupQueryParams(file)
    }

    readonly getFloorplanPreview = (file: ProjectDocLibraryFileRecord): string => {
        return this.getFloorplanPreviewContent(file)
    }

    getReadableDocLibraryFileSize(file: ProjectDocLibraryFileRecord): string {
        const sizeBytes = Number(this.getLatestDocLibraryVersion(file)?.sizeBytes || 0)
        if (sizeBytes >= 1024 * 1024) {
            return `${(sizeBytes / (1024 * 1024)).toFixed(2)} MB`
        }
        if (sizeBytes >= 1024) {
            return `${Math.round(sizeBytes / 1024)} KB`
        }
        return `${sizeBytes} B`
    }

    getDocLibraryFolderLabel(folderId: string): string {
        if (folderId === 'all') {
            return 'Project Files'
        }
        return this.docLibraryDirectories.find((directory) => directory.id === folderId)?.name || 'Unfiled'
    }

    getBomRowExtCost(row: SalesBomRow): number {
        return Number(row.qty || 0) * this.roundBomMoney(row.cost)
    }

    getBomRowExtLabor(row: SalesBomRow): number {
        return Number(row.qty || 0) * this.roundBomMoney(row.labor)
    }

    getBomSectionGrandTotal(section: SalesBomSection): number {
        return section.rows.reduce((sum, row) => sum + this.getBomRowExtCost(row) + this.getBomRowExtLabor(row), 0)
    }

    getBomGrandTotal(): number {
        return this.bomSections.reduce((sum, section) => sum + this.getBomSectionGrandTotal(section), 0)
    }

    normalizeBomMoneyField(row: SalesBomRow, field: 'cost' | 'labor'): void {
        row[field] = this.roundBomMoney(row[field])
    }

    getFilteredBomRows(section: SalesBomSection): SalesBomRow[] {
        const filterValue = this.bomFilter.trim().toLowerCase()
        const filteredRows = filterValue
            ? section.rows.filter((row) => {
                const haystack = [
                    row.partNbr,
                    row.description,
                    row.type,
                    `${row.qty}`,
                    `${row.cost}`,
                    `${this.getBomRowExtCost(row)}`,
                    `${row.labor}`,
                    `${this.getBomRowExtLabor(row)}`,
                    row.includeOnFloorplan ? 'floorplan fp yes' : 'no floorplan fp no'
                ].join(' ').toLowerCase()
                return haystack.includes(filterValue)
            })
            : [...section.rows]

        return filteredRows.sort((left, right) => {
            const direction = this.bomSortDirection === 'asc' ? 1 : -1
            switch (this.bomSortKey) {
                case 'partNbr':
                    return left.partNbr.localeCompare(right.partNbr) * direction
                case 'description':
                    return left.description.localeCompare(right.description) * direction
                case 'qty':
                    return (left.qty - right.qty) * direction
                case 'cost':
                    return (left.cost - right.cost) * direction
                case 'extCost':
                    return (this.getBomRowExtCost(left) - this.getBomRowExtCost(right)) * direction
                case 'labor':
                    return (left.labor - right.labor) * direction
                case 'extLabor':
                    return (this.getBomRowExtLabor(left) - this.getBomRowExtLabor(right)) * direction
                case 'includeOnFloorplan':
                    return (Number(!!left.includeOnFloorplan) - Number(!!right.includeOnFloorplan)) * direction
                case 'type':
                    return left.type.localeCompare(right.type) * direction
                default:
                    return left.partNbr.localeCompare(right.partNbr) * direction
            }
        })
    }

    setBomSort(sortKey: SalesBomSortKey): void {
        if (this.bomSortKey === sortKey) {
            this.bomSortDirection = this.bomSortDirection === 'asc' ? 'desc' : 'asc'
            return
        }
        this.bomSortKey = sortKey
        this.bomSortDirection = 'asc'
    }

    isBomSortActive(sortKey: SalesBomSortKey): boolean {
        return this.bomSortKey === sortKey
    }

    addBomRow(section: SalesBomSection): void {
        section.rows = [...section.rows, this.createEmptyBomRow()]
        this.bomSections = [...this.bomSections]
    }

    removeBomRow(section: SalesBomSection, row: SalesBomRow): void {
        section.rows = (section.rows || []).filter((item) => item !== row)
        this.bomSections = [...this.bomSections]
        this.closeBomPartLookup()
    }

    @HostListener('window:resize')
    onWindowResize(): void {
        this.positionBomPartLookup()
    }

    @HostListener('window:scroll')
    onWindowScroll(): void {
        this.positionBomPartLookup()
    }

    @HostListener('document:mousedown', ['$event'])
    onDocumentMouseDown(event: MouseEvent): void {
        if (!this.activeBomLookupRow) {
            return
        }
        const target = event.target as HTMLElement | null
        if (!target) {
            this.closeBomPartLookup()
            return
        }
        if (
            target === this.activeBomLookupInput ||
            target.closest('.sales-bom-part-lookup') ||
            target.closest('.sales-bom-part-lookup__menu')
        ) {
            return
        }
        this.closeBomPartLookup()
    }

    async onBomPartLookupFocus(section: SalesBomSection, row: SalesBomRow, event?: FocusEvent): Promise<void> {
        this.activeBomLookupSectionKey = String(section.sectionKey || '')
        this.activeBomLookupRow = row
        this.activeBomLookupInput = event?.target instanceof HTMLInputElement ? event.target : this.activeBomLookupInput
        this.positionBomPartLookup()
        await this.ensureVendorPartLookupLoaded()
        this.positionBomPartLookup()
    }

    onBomPartLookupBlur(section: SalesBomSection, row: SalesBomRow): void {
        const value = String(row.lookupQuery || row.partNbr || '').trim()
        row.lookupQuery = value
        row.partNbr = value
        globalThis.setTimeout(() => {
            if (this.activeBomLookupSectionKey === String(section.sectionKey || '') && this.activeBomLookupRow === row) {
                this.closeBomPartLookup()
            }
        }, 120)
    }

    onBomPartLookupChanged(section: SalesBomSection, row: SalesBomRow, value: string): void {
        row.lookupQuery = value
        row.partNbr = value
        this.activeBomLookupSectionKey = String(section.sectionKey || '')
        this.activeBomLookupRow = row
        this.positionBomPartLookup()
    }

    isBomLookupActive(section: SalesBomSection, row: SalesBomRow): boolean {
        return this.activeBomLookupSectionKey === String(section.sectionKey || '') && this.activeBomLookupRow === row
    }

    getBomPartLookupResults(section: SalesBomSection, row: SalesBomRow): VwPart[] {
        const activeSectionKey = String(section.sectionKey || '')
        const query = String(row.lookupQuery || '').trim().toLowerCase()
        if (this.activeBomLookupSectionKey !== activeSectionKey || query.length < 2) {
            return []
        }

        const allowedVendorIds = new Set((section.vendorIds || []).map((value) => String(value || '').trim().toLowerCase()).filter(Boolean))
        const allowedVendorNames = new Set((section.vendorNames || []).map((value) => String(value || '').trim().toLowerCase()).filter(Boolean))

        return this.vendorPartRows
            .filter((part) => {
                if (allowedVendorIds.size <= 0 && allowedVendorNames.size <= 0) {
                    return true
                }
                const partVendorId = String(part.vendorId || '').trim().toLowerCase()
                const partVendorName = String(part.vendorName || '').trim().toLowerCase()
                return allowedVendorIds.has(partVendorId) || allowedVendorNames.has(partVendorName)
            })
            .filter((part) => {
                const haystack = [
                    part.PartNumber,
                    part.LongDescription,
                    part.Category,
                    part.ParentCategory
                ].join(' ').toLowerCase()
                return haystack.includes(query)
            })
            .slice(0, 12)
    }

    getBomDeviceLookupResults(section: SalesBomSection, row: SalesBomRow): VwDevice[] {
        const activeSectionKey = String(section.sectionKey || '')
        const query = String(row.lookupQuery || '').trim().toLowerCase()
        if (this.activeBomLookupSectionKey !== activeSectionKey || query.length < 2) {
            return []
        }

        const allowedVendorIds = new Set((section.vendorIds || []).map((value) => String(value || '').trim().toLowerCase()).filter(Boolean))
        const allowedVendorNames = new Set((section.vendorNames || []).map((value) => String(value || '').trim().toLowerCase()).filter(Boolean))

        return this.deviceRows
            .filter((device) => {
                if (allowedVendorIds.size <= 0 && allowedVendorNames.size <= 0) {
                    return true
                }
                const deviceVendorId = String(device.vendorId || '').trim().toLowerCase()
                const deviceVendorName = String(device.vendorName || '').trim().toLowerCase()
                return allowedVendorIds.has(deviceVendorId) || allowedVendorNames.has(deviceVendorName)
            })
            .filter((device) => {
                const haystack = [
                    device.name,
                    device.shortName,
                    device.partNumber,
                    device.categoryName,
                    device.vendorName
                ].join(' ').toLowerCase()
                return haystack.includes(query)
            })
            .slice(0, 12)
    }

    hasBomLookupResults(section: SalesBomSection, row: SalesBomRow): boolean {
        return this.getBomDeviceLookupResults(section, row).length > 0 || this.getBomPartLookupResults(section, row).length > 0
    }

    selectBomPart(section: SalesBomSection, row: SalesBomRow, part: VwPart): void {
        const categoryName = String(part.Category || '').trim()
        row.partNbr = String(part.PartNumber || '').trim()
        row.lookupQuery = row.partNbr
        row.description = String(part.LongDescription || '').trim()
        row.cost = this.roundBomMoney(part.SalesPrice || part.MSRPPrice || 0)
        row.type = categoryName
        row.includeOnFloorplan = false
        row.labor = this.roundBomMoney(this.getDefaultLaborCost(null))
        this.closeBomPartLookup()
        this.saveMessage = `Loaded ${row.partNbr} from vendor parts.`
    }

    selectBomDevice(section: SalesBomSection, row: SalesBomRow, device: VwDevice): void {
        const partNumber = String(device.partNumber || '').trim()
        row.partNbr = partNumber
        row.lookupQuery = partNumber
        row.description = String(device.name || device.shortName || '').trim()
        row.cost = this.roundBomMoney(device.cost || 0)
        row.type = String(device.categoryName || '').trim()
        row.includeOnFloorplan = !!device.includeOnFloorplan
        row.labor = this.roundBomMoney(this.getDefaultLaborCost(device.defaultLabor))
        this.closeBomPartLookup()
        this.saveMessage = `Loaded ${row.partNbr || row.description} from devices.`
    }

    positionBomPartLookup(event?: Event): void {
        if (event?.target instanceof HTMLInputElement) {
            this.activeBomLookupInput = event.target
        }
        if (!this.activeBomLookupInput || !this.activeBomLookupRow) {
            this.bomLookupMenuStyle = {}
            return
        }

        const rect = this.activeBomLookupInput.getBoundingClientRect()
        const viewportWidth = window.innerWidth || document.documentElement.clientWidth || 1024
        const viewportHeight = window.innerHeight || document.documentElement.clientHeight || 768
        const menuWidth = Math.min(920, Math.max(320, viewportWidth - 32))
        const activeSection = this.bomSections.find((section) => String(section.sectionKey || '') === this.activeBomLookupSectionKey)
        const resultCount = activeSection
            ? this.getBomDeviceLookupResults(activeSection, this.activeBomLookupRow).length + this.getBomPartLookupResults(activeSection, this.activeBomLookupRow).length + 2
            : 12
        const preferredMenuHeight = Math.min(320, Math.max(72, resultCount * 48))
        const belowSpace = Math.max(0, viewportHeight - rect.bottom - 16)
        const aboveSpace = Math.max(0, rect.top - 16)
        const openBelow = belowSpace >= preferredMenuHeight || belowSpace >= aboveSpace
        const menuHeight = Math.max(72, Math.min(preferredMenuHeight, openBelow ? belowSpace : aboveSpace))
        const left = Math.max(16, Math.min(rect.left, viewportWidth - menuWidth - 16))
        const top = openBelow
            ? Math.min(rect.bottom + 6, viewportHeight - menuHeight - 16)
            : Math.max(16, rect.top - menuHeight - 6)

        this.bomLookupMenuStyle = {
            left: `${left}px`,
            top: `${top}px`,
            width: `${menuWidth}px`,
            maxHeight: `${menuHeight}px`
        }
    }

    private closeBomPartLookup(): void {
        this.activeBomLookupSectionKey = ''
        this.activeBomLookupRow = null
        this.activeBomLookupInput = null
        this.bomLookupMenuStyle = {}
    }

    removeBomSection(sectionIndex: number): void {
        this.bomSections = this.bomSections.filter((_, idx) => idx !== sectionIndex)
    }

    addBomSection(): void {
        const nextNumber = this.bomSections.length + 1
        this.bomSections = [
            ...this.bomSections,
            {
                title: `NEW SECTION ${nextNumber}`,
                sectionKey: this.createClientId(),
                rows: [this.createEmptyBomRow()]
            }
        ]
    }

    exportBomCsv(): void {
        const headers = ['PART NBR', 'DESCRIPTION', 'QTY', 'COST', 'EXT COST', 'LABOR', 'EXT LABOR', 'FP', 'TYPE']
        const csvLines = this.bomSections.flatMap((section) => {
            const rows = this.getFilteredBomRows(section)
            return [
                this.toCsvCell(section.title),
                headers.join(','),
                ...rows.map((row) => {
                    return [
                        this.toCsvCell(row.partNbr),
                        this.toCsvCell(row.description),
                        this.toCsvCell(`${row.qty}`),
                        this.toCsvCell(`${this.roundBomMoney(row.cost)}`),
                        this.toCsvCell(`${this.getBomRowExtCost(row)}`),
                        this.toCsvCell(`${this.roundBomMoney(row.labor)}`),
                        this.toCsvCell(`${this.getBomRowExtLabor(row)}`),
                        this.toCsvCell(row.includeOnFloorplan ? 'Yes' : 'No'),
                        this.toCsvCell(row.type)
                    ].join(',')
                }),
                ''
            ]
        })

        const blob = new Blob([csvLines.join('\r\n')], { type: 'text/csv;charset=utf-8;' })
        const url = URL.createObjectURL(blob)
        const anchor = document.createElement('a')
        anchor.href = url
        anchor.download = `${(this.project?.name || 'sales-bom').replace(/[^a-z0-9]+/gi, '-').toLowerCase()}.csv`
        anchor.click()
        URL.revokeObjectURL(url)
    }

    async addSelectedDeviceSetToBom(): Promise<void> {
        const deviceSetId = String(this.selectedDeviceSetId || '').trim()
        if (!deviceSetId) {
            this.saveMessage = 'Choose a device set first.'
            return
        }

        this.saveWorking = true
        this.saveMessage = 'Refreshing device set prices and loading BOM...'

        try {
            const detailResponse = await firstValueFrom(this.http.get<{ data?: DeviceSetDetail }>(`/api/firewire/device-sets/${deviceSetId}`))
            const detail = detailResponse?.data
            if (!detail) {
                throw new Error('Unable to load device set.')
            }

            await Promise.all(detail.devices.map((device) => this.devicePartPriceSync.syncDevice(device.deviceId)))
            const vendorParts = await this.devicePartPriceSync.getVendorPartRows()
            const vendorPartMap = this.devicePartPriceSync.createVendorPartMap(vendorParts)
            const materialResults = await Promise.all(detail.devices.map(async(device) => {
                const response = await firstValueFrom(this.http.get<{ rows?: VwDeviceMaterial[] }>(`/api/firewire/vwdevicematerials/${device.deviceId}`))
                return {
                    device,
                    materials: Array.isArray(response?.rows) ? response.rows : []
                }
            }))

            const nextSection: SalesBomSection = {
                title: this.createUniqueBomSectionTitle(detail.name),
                sectionKey: this.createClientId(),
                vendorIds: Array.from(new Set(detail.devices.map((device) => String(device.vendorId || '').trim()).filter(Boolean))),
                vendorNames: Array.from(new Set(detail.devices.map((device) => String(device.vendorName || '').trim()).filter(Boolean))),
                rows: materialResults.flatMap(({ device, materials }) => this.createBomRowsFromDevice(device, materials, vendorPartMap))
            }

            if (nextSection.rows.length <= 0) {
                nextSection.rows.push(this.createEmptyBomRow())
            }

            this.bomSections = [...this.bomSections, nextSection]
            this.selectedDeviceSetId = ''
            this.saveMessage = `Added ${detail.name} to BOM.`
        } catch (err: any) {
            this.saveMessage = err?.error?.message || err?.message || 'Unable to add device set to BOM.'
        } finally {
            this.saveWorking = false
        }
    }

    async downloadDocLibraryFile(fileId: string): Promise<void> {
        const file = this.docLibraryFiles.find((item) => item.id === fileId)
        const version = file?.versions?.[file.versions.length - 1]
        if (!file || !version) {
            return
        }

        const blob = version.dataUrl
            ? this.dataUrlToBlob(version.dataUrl)
            : await this.projectDocLibraryStorage.downloadVersion(file.storageKey || this.getDocLibraryStorageKey(), file.id, version)
        const url = URL.createObjectURL(blob)
        const link = document.createElement('a')
        link.href = url
        link.download = version.sourceFileName || file.name
        link.click()
        URL.revokeObjectURL(url)
    }

    async deleteFloorplanFile(fileId: string): Promise<void> {
        const file = this.docLibraryFiles.find((item) => item.id === fileId)
        if (!file) {
            return
        }

        const confirmed = await firstValueFrom(this.dialog.open(SalesFloorplanDeleteDialog, {
            width: '420px',
            maxWidth: '92vw',
            panelClass: 'fw-compact-dialog-pane',
            data: {
                fileName: file.name
            } as SalesFloorplanDeleteDialogData
        }).afterClosed())

        if (!confirmed) {
            return
        }

        const workspace = await this.projectDocLibraryStorage.deleteFile(file.storageKey || this.getDocLibraryStorageKey(), fileId)
        this.docLibraryFiles = [...(workspace.files || [])]
        this.docLibraryDirectories = [...(workspace.directories || this.docLibraryDirectories)]
        this.floorplanStatusMessage = `Deleted ${file.name}.`
    }

    async deleteDocLibraryFile(fileId: string): Promise<void> {
        const file = this.docLibraryFiles.find((item) => item.id === fileId)
        if (!file) {
            return
        }

        const confirmed = await firstValueFrom(this.dialog.open(SalesFloorplanDeleteDialog, {
            width: '420px',
            maxWidth: '92vw',
            panelClass: 'fw-compact-dialog-pane',
            data: {
                fileName: file.name
            } as SalesFloorplanDeleteDialogData
        }).afterClosed())

        if (!confirmed) {
            return
        }

        const workspace = await this.projectDocLibraryStorage.deleteFile(file.storageKey || this.getDocLibraryStorageKey(), fileId)
        this.docLibraryFiles = [...(workspace.files || [])]
        this.docLibraryDirectories = [...(workspace.directories || this.docLibraryDirectories)]
        this.docLibraryStatusMessage = `Deleted ${file.name}.`
    }

    async createDocLibraryDirectory(parentId: string): Promise<void> {
        const name = window.prompt('New directory name', 'New Folder')
        const normalizedName = String(name || '').trim()
        if (!normalizedName) {
            return
        }
        const now = new Date().toISOString()
        const directory: ProjectDocLibraryDirectoryRecord = {
            id: this.createClientId(),
            name: normalizedName,
            parentId: parentId && parentId !== 'all' ? parentId : undefined,
            createdAt: now,
            updatedAt: now
        }
        this.docLibraryDirectories = [...this.docLibraryDirectories, directory]
        this.selectedDocLibraryFolder = directory.id
        await this.persistDocLibraryWorkspace()
        this.docLibraryStatusMessage = `Created ${normalizedName}.`
    }

    async renameDocLibraryDirectory(directoryId: string): Promise<void> {
        const directory = this.docLibraryDirectories.find((item) => item.id === directoryId)
        if (!directory) {
            return
        }
        const name = window.prompt('Directory name', directory.name)
        const normalizedName = String(name || '').trim()
        if (!normalizedName || normalizedName === directory.name) {
            return
        }
        directory.name = normalizedName
        directory.updatedAt = new Date().toISOString()
        this.docLibraryDirectories = [...this.docLibraryDirectories]
        await this.persistDocLibraryWorkspace()
        this.docLibraryStatusMessage = `Renamed directory to ${normalizedName}.`
    }

    async deleteDocLibraryDirectory(directoryId: string): Promise<void> {
        const directory = this.docLibraryDirectories.find((item) => item.id === directoryId)
        if (!directory) {
            return
        }
        const descendantIds = this.getDocLibraryDirectoryDescendantIds(directoryId)
        const fileCount = this.docLibraryFiles.filter((file) => descendantIds.has(file.folderId)).length
        const confirmed = window.confirm(fileCount > 0
            ? `Delete ${directory.name} and ${fileCount} file${fileCount === 1 ? '' : 's'} inside it?`
            : `Delete ${directory.name}?`)
        if (!confirmed) {
            return
        }
        this.docLibraryDirectories = this.docLibraryDirectories.filter((item) => !descendantIds.has(item.id))
        this.docLibraryFiles = this.docLibraryFiles.filter((file) => !descendantIds.has(file.folderId))
        if (descendantIds.has(this.selectedDocLibraryFolder)) {
            this.selectedDocLibraryFolder = directory.parentId || 'all'
        }
        await this.persistDocLibraryWorkspace()
        this.docLibraryStatusMessage = `Deleted ${directory.name}.`
    }

    async onDocLibraryFileSelected(event: Event): Promise<void> {
        const input = event.target as HTMLInputElement | null
        if (!input?.files?.length) {
            return
        }

        this.docLibraryUploadBusy = true
        this.docLibraryStatusMessage = ''

        try {
            const files = Array.from(input.files)
            let uploadedCount = 0
            let versionedCount = 0

            for (const file of files) {
                const result = await this.uploadDocLibraryFile(file)
                if (result === 'uploaded') {
                    uploadedCount += 1
                } else if (result === 'versioned') {
                    versionedCount += 1
                }
            }

            await this.persistDocLibraryWorkspace()

            const summaryParts: string[] = []
            if (uploadedCount > 0) {
                summaryParts.push(`${uploadedCount} new`)
            }
            if (versionedCount > 0) {
                summaryParts.push(`${versionedCount} updated`)
            }

            this.docLibraryStatusMessage = summaryParts.length > 0
                ? `Uploaded ${summaryParts.join(', ')} file${uploadedCount + versionedCount === 1 ? '' : 's'}.`
                : 'No document changes were made.'
        } catch (err: any) {
            this.docLibraryStatusMessage = err?.message || 'Document upload failed.'
        } finally {
            this.docLibraryUploadBusy = false
            input.value = ''
        }
    }

    async onFloorplanFileSelected(event: Event): Promise<void> {
        const input = event.target as HTMLInputElement | null
        if (!input?.files?.length) {
            return
        }

        this.floorplanUploadBusy = true
        this.floorplanStatusMessage = ''

        try {
            const files = Array.from(input.files)
            let uploadedCount = 0
            let skippedCount = 0

            for (const file of files) {
                if (!this.isFloorplanUploadFile(file)) {
                    skippedCount += 1
                    continue
                }

                await this.uploadFileToDocLibraryFolder(file, this.floorplansFolderId, false, await this.createFloorplanThumbnailIfNeeded(file))
                uploadedCount += 1
            }

            await this.persistDocLibraryWorkspace()

            const parts: string[] = []
            if (uploadedCount > 0) {
                parts.push(`${uploadedCount} uploaded`)
            }
            if (skippedCount > 0) {
                parts.push(`${skippedCount} skipped`)
            }
            this.floorplanStatusMessage = parts.length > 0
                ? `Floorplans updated: ${parts.join(', ')}.`
                : 'No floorplan changes were made.'
        } catch (err: any) {
            this.floorplanStatusMessage = err?.message || 'Floorplan upload failed.'
        } finally {
            this.floorplanUploadBusy = false
            input.value = ''
        }
    }

    async renameFloorplanFile(file: ProjectDocLibraryFileRecord): Promise<void> {
        const normalizedName = String(file.name || '').trim() || 'Floorplan'
        file.name = normalizedName
        file.extension = this.getDocLibraryExtension(normalizedName) || file.extension
        file.updatedAt = new Date().toISOString()
        await this.persistDocLibraryWorkspace()
        this.floorplanStatusMessage = `Renamed ${file.name}.`
    }

    async openFloorplanDesigner(file: ProjectDocLibraryFileRecord): Promise<void> {
        const result = await firstValueFrom(this.dialog.open(FloorplanDesignerDialog, {
            panelClass: 'fw-fullscreen-dialog-pane',
            maxWidth: '100vw',
            width: '100vw',
            data: {
                file,
                imageUrl: this.getFloorplanVersionContent(file),
                symbols: this.getFloorplanDesignerSymbols(),
                validateDesign: (design: ProjectFloorplanDesignState) => this.getFloorplanSymbolBalanceErrors(file.id, design)
            }
        }).afterClosed()) as FloorplanDesignerDialogResult | undefined

        if (!result?.design) {
            return
        }

        file.floorplanDesign = result.design
        file.updatedAt = new Date().toISOString()
        await this.persistDocLibraryWorkspace()
        this.syncFloorplanQuantitiesToBom()
        await this.persistBomAfterFloorplanSync()
        this.floorplanStatusMessage = `Saved design markup for ${file.name}.`
    }

    private async persistBomAfterFloorplanSync(): Promise<void> {
        if (!this.projectId || !this.project) {
            return
        }
        const worksheetData = {
            ...(this.project.worksheetData || {}),
            customerInfo: this.customerInfo,
            bomSections: this.buildWorksheetBomSections()
        }
        const response: any = await firstValueFrom(this.http.patch(`/api/firewire/projects/firewire/${this.projectId}`, {
            ...this.projectForm,
            worksheetData
        }))
        if (response?.data) {
            this.project = { ...response.data }
            this.projectForm = this.buildForm(response.data)
            this.customerInfo = this.buildCustomerInfo(response.data)
            this.bomSections = this.cloneBomSections((response.data.worksheetData || worksheetData).bomSections)
            this.captureInitialFormState()
            this.captureInitialCustomerInfoState()
            this.captureInitialBomState()
        }
    }

    private async loadProjectSettings(): Promise<void> {
        try {
            this.projectSettings = await firstValueFrom(this.projectSettingsApi.getCatalog())
        } catch (err) {
            console.error(err)
        }
    }

    private async loadDocLibraryWorkspace(): Promise<void> {
        const key = this.getDocLibraryStorageKey()
        if (!key) {
            this.docLibraryFiles = []
            return
        }
        const workspace = await this.projectDocLibraryStorage.loadWorkspace(key)
        this.docLibraryFiles = [...(workspace.files || [])]
        this.docLibraryDirectories = [...(workspace.directories || [])]
        await this.ensureFloorplanPdfThumbnails()
    }

    private async persistDocLibraryWorkspace(): Promise<void> {
        const key = this.getDocLibraryStorageKey()
        if (!key) {
            return
        }

        await this.projectDocLibraryStorage.saveWorkspace(key, {
            files: this.docLibraryFiles,
            directories: this.docLibraryDirectories
        })
    }

    private getDocLibraryStorageKey(): string {
        return String(this.projectId || this.project?.uuid || '').trim()
    }

    private createBomRowsFromDevice(device: any, materials: VwDeviceMaterial[], vendorPartMap?: Map<string, VwPart>): SalesBomRow[] {
        const typeValue = String(device?.categoryName || '').trim()
        const includeOnFloorplan = !!device?.includeOnFloorplan

        if (!materials.length) {
            const partNumber = String(device.partNumber || '').trim()
            return [{
                partNbr: partNumber,
                lookupQuery: partNumber,
                description: String(device.name || '').trim(),
                qty: 0,
                cost: this.roundBomMoney(this.getCurrentVendorPrice(partNumber, vendorPartMap, Number(device.cost || 0))),
                labor: this.roundBomMoney(this.getDefaultLaborCost(device.defaultLabor)),
                includeOnFloorplan,
                type: typeValue
            }]
        }

        return materials.map((material, index) => {
            const partNumber = String(material.materialPartNumber || material.partNumber || device.partNumber || '').trim()
            return {
                partNbr: partNumber,
                lookupQuery: partNumber,
                description: String(material.materialName || material.deviceName || device.name || '').trim(),
                qty: 0,
                cost: this.roundBomMoney(this.getCurrentVendorPrice(partNumber, vendorPartMap, Number(material.materialCost || material.cost || device.cost || 0))),
                labor: index === 0 ? this.roundBomMoney(this.getDefaultLaborCost(device.defaultLabor ?? material.materialDefaultLabor)) : 0,
                includeOnFloorplan,
                type: typeValue
            }
        })
    }

    private getDefaultLaborCost(value: unknown): number {
        const baselineLaborCost = value === null || typeof value === 'undefined' || value === ''
            ? this.defaultLaborCost
            : Number(value)
        const normalizedBaseline = Number.isFinite(baselineLaborCost) ? baselineLaborCost : this.defaultLaborCost
        return (normalizedBaseline / this.defaultLaborHourlyRate) * this.getInstallationLaborRate()
    }

    private getInstallationLaborRate(): number {
        const rates = Array.isArray(this.project?.worksheetData?.laborRates)
            ? this.project?.worksheetData?.laborRates
            : []
        const installationRate = rates.find((row: any) => String(row?.label || '').trim().toLowerCase() === 'installation')
        return Number(installationRate?.effectiveRate || installationRate?.payRate || this.defaultLaborHourlyRate)
    }

    private getCurrentVendorPrice(partNumber: string, vendorPartMap: Map<string, VwPart> | undefined, fallbackCost: number): number {
        const vendorPart = vendorPartMap?.get(this.devicePartPriceSync.normalizePartNumber(partNumber))
        return vendorPart ? this.devicePartPriceSync.getVendorPartPrice(vendorPart) : Number(fallbackCost || 0)
    }

    private createUniqueBomSectionTitle(baseTitle: string): string {
        const normalizedBase = String(baseTitle || 'DEVICE SET').trim() || 'DEVICE SET'
        const existingTitles = new Set(this.bomSections.map((section) => String(section.title || '').trim().toLowerCase()))
        if (!existingTitles.has(normalizedBase.toLowerCase())) {
            return normalizedBase
        }

        let counter = 2
        while (existingTitles.has(`${normalizedBase} ${counter}`.toLowerCase())) {
            counter += 1
        }
        return `${normalizedBase} ${counter}`
    }

    private async uploadDocLibraryFile(file: File): Promise<'uploaded' | 'versioned' | 'skipped'> {
        return this.uploadFileToDocLibraryFolder(file, this.selectedDocLibraryFolder || 'all')
    }

    private async uploadFileToDocLibraryFolder(file: File, folderId: string, confirmVersion = false, thumbnailDataUrl = ''): Promise<'uploaded' | 'versioned' | 'skipped'> {
        const duplicate = this.docLibraryFiles.find((item) =>
            item.folderId === folderId && item.name.toLowerCase() === file.name.toLowerCase())
        const now = new Date().toISOString()
        const projectKey = this.getDocLibraryStorageKey()

        if (duplicate) {
            const version = await this.projectDocLibraryStorage.uploadFileVersion(projectKey, file, {
                fileId: duplicate.id,
                versionId: this.createClientId(),
                folderId,
                versionNumber: duplicate.versions.length + 1,
                lastModified: file.lastModified
            })
            version.thumbnailDataUrl = thumbnailDataUrl || version.thumbnailDataUrl
            duplicate.versions.push(version)
            duplicate.updatedAt = now
            return 'versioned'
        }

        const fileId = this.createClientId()
        const version = await this.projectDocLibraryStorage.uploadFileVersion(projectKey, file, {
            fileId,
            versionId: this.createClientId(),
            folderId,
            versionNumber: 1,
            lastModified: file.lastModified
        })
        version.thumbnailDataUrl = thumbnailDataUrl || version.thumbnailDataUrl

        this.docLibraryFiles = [
            {
                id: fileId,
                folderId,
                storageKey: projectKey,
                documentKind: this.projectDocLibraryStorage.getDocumentKindForFolder(folderId),
                name: file.name,
                extension: this.getDocLibraryExtension(file.name),
                createdAt: now,
                updatedAt: now,
                versions: [version]
            },
            ...this.docLibraryFiles
        ]
        return 'uploaded'
    }

    private getDocLibraryFilesOnly(): ProjectDocLibraryFileRecord[] {
        return this.docLibraryFiles.filter((file) => file.folderId !== this.floorplansFolderId)
    }

    private getDocLibraryDirectoryDescendantIds(directoryId: string): Set<string> {
        const ids = new Set([directoryId])
        let changed = true
        while (changed) {
            changed = false
            for (const directory of this.docLibraryDirectories) {
                if (!ids.has(directory.id) && directory.parentId && ids.has(directory.parentId)) {
                    ids.add(directory.id)
                    changed = true
                }
            }
        }
        return ids
    }

    private isFloorplanUploadFile(file: File): boolean {
        const mimeType = String(file.type || '').toLowerCase()
        const extension = this.getDocLibraryExtension(file.name)
        return mimeType.startsWith('image/')
            || mimeType === 'application/pdf'
            || ['jpg', 'jpeg', 'png', 'gif', 'webp', 'bmp', 'tif', 'tiff', 'pdf'].includes(extension)
    }

    private async createFloorplanThumbnailIfNeeded(file: File): Promise<string> {
        const mimeType = String(file.type || '').toLowerCase()
        const extension = this.getDocLibraryExtension(file.name)
        if (mimeType.startsWith('image/') || ['jpg', 'jpeg', 'png', 'gif', 'webp', 'bmp'].includes(extension)) {
            return this.readFileAsDataUrl(file)
        }
        if (mimeType === 'application/pdf' || extension === 'pdf') {
            return this.pdfThumbnailService.createThumbnail(file)
        }
        return ''
    }

    private async ensureFloorplanPdfThumbnails(): Promise<void> {
        let changed = false
        for (const file of this.getFloorplanFiles()) {
            const version = this.getLatestDocLibraryVersion(file)
            if (!version || version.thumbnailDataUrl) {
                continue
            }

            const blob = version.dataUrl
                ? this.dataUrlToBlob(version.dataUrl)
                : await this.projectDocLibraryStorage.downloadVersion(file.storageKey || this.getDocLibraryStorageKey(), file.id, version)
            if (this.isFloorplanPdf(file)) {
                version.thumbnailDataUrl = await this.pdfThumbnailService.createThumbnail(blob)
            } else if (String(version.mimeType || '').toLowerCase().startsWith('image/')) {
                version.thumbnailDataUrl = await this.blobToDataUrl(blob)
            }
            changed = true
        }

        if (changed) {
            await this.persistDocLibraryWorkspace()
        }
    }

    private buildForm(project: FirewireProjectSchema): SalesProjectForm {
        return {
            name: project.name || '',
            bidDueDate: this.toDateInputValue(project.bidDueDate),
            projectStatus: project.projectStatus || 'Estimation',
            projectType: project.projectType || 'Fire Alarm',
            salesman: project.salesman || '',
            jobType: project.jobType || '',
            scopeType: project.scopeType || '',
            projectScope: project.projectScope || '',
            difficulty: project.difficulty || '',
            totalSqFt: typeof project.totalSqFt === 'number' ? project.totalSqFt : Number(project.totalSqFt || 0),
            address: project.address || ''
        }
    }

    private buildCustomerInfo(project: FirewireProjectSchema): SalesCustomerInfo {
        const customerInfo = project?.worksheetData?.customerInfo || {}
        return {
            billingName: String(customerInfo?.billingName || '').trim(),
            billingAddress: String(customerInfo?.billingAddress || '').trim(),
            billingEmail: String(customerInfo?.billingEmail || '').trim(),
            billingPhone: String(customerInfo?.billingPhone || '').trim(),
            contractOrPoNumber: String(customerInfo?.contractOrPoNumber || '').trim()
        }
    }

    private createDefaultForm(): SalesProjectForm {
        return {
            name: '',
            bidDueDate: '',
            projectStatus: 'Estimation',
            projectType: 'Fire Alarm',
            salesman: '',
            jobType: '',
            scopeType: '',
            projectScope: '',
            difficulty: '',
            totalSqFt: 0,
            address: ''
        }
    }

    private createDefaultCustomerInfo(): SalesCustomerInfo {
        return {
            billingName: '',
            billingAddress: '',
            billingEmail: '',
            billingPhone: '',
            contractOrPoNumber: ''
        }
    }

    private captureInitialFormState(): void {
        this.initialFormSnapshot = this.serializeForm(this.projectForm)
    }

    private captureInitialCustomerInfoState(): void {
        this.initialCustomerInfoSnapshot = this.serializeCustomerInfo(this.customerInfo)
    }

    private captureInitialBomState(): void {
        this.initialBomSnapshot = this.serializeBomSections(this.bomSections)
    }

    private serializeForm(form: SalesProjectForm): string {
        return JSON.stringify(form)
    }

    private serializeCustomerInfo(value: SalesCustomerInfo): string {
        return JSON.stringify(value)
    }

    private serializeBomSections(sections: SalesBomSection[]): string {
        return JSON.stringify(this.buildWorksheetBomSections(sections))
    }

    private cloneBomSections(input: any): SalesBomSection[] {
        if (!Array.isArray(input)) {
            return []
        }

        return input.map((section) => ({
            title: String(section?.title || 'NEW SECTION').trim() || 'NEW SECTION',
            sectionKey: String(section?.sectionKey || this.createClientId()),
            vendorIds: Array.isArray(section?.vendorIds) ? section.vendorIds.map((value: any) => String(value || '').trim()).filter(Boolean) : [],
            vendorNames: Array.isArray(section?.vendorNames) ? section.vendorNames.map((value: any) => String(value || '').trim()).filter(Boolean) : [],
            rows: Array.isArray(section?.rows) && section.rows.length > 0
                ? section.rows.map((row: any) => ({
                    partNbr: String(row?.partNbr || '').trim(),
                    lookupQuery: String(row?.partNbr || '').trim(),
                    description: String(row?.description || '').trim(),
                    qty: Number(row?.qty || 0),
                    cost: this.roundBomMoney(row?.cost),
                    labor: this.roundBomMoney(row?.labor),
                    includeOnFloorplan: this.normalizeBomRowFloorplanFlag(row),
                    type: String(row?.type || '').trim()
                }))
                : [this.createEmptyBomRow()]
        }))
    }

    private createEmptyBomRow(): SalesBomRow {
        return {
            partNbr: '',
            lookupQuery: '',
            description: '',
            qty: 0,
            cost: 0,
            labor: 0,
            includeOnFloorplan: false,
            type: ''
        }
    }

    private buildWorksheetBomSections(source: SalesBomSection[] = this.bomSections): SalesBomSection[] {
        return (source || []).map((section) => ({
            title: String(section.title || '').trim(),
            sectionKey: String(section.sectionKey || this.createClientId()),
            vendorIds: Array.isArray(section.vendorIds) ? [...section.vendorIds] : [],
            vendorNames: Array.isArray(section.vendorNames) ? [...section.vendorNames] : [],
            rows: (section.rows || []).map((row) => ({
                partNbr: String(row.partNbr || '').trim(),
                description: String(row.description || '').trim(),
                qty: Number(row.qty || 0),
                cost: this.roundBomMoney(row.cost),
                labor: this.roundBomMoney(row.labor),
                includeOnFloorplan: !!row.includeOnFloorplan,
                type: String(row.type || '').trim()
            }))
        }))
    }

    private normalizeBomRowFloorplanFlag(row: any): boolean {
        if (typeof row?.includeOnFloorplan === 'boolean') {
            return row.includeOnFloorplan
        }
        return false
    }

    private roundBomMoney(value: unknown): number {
        const numeric = Number(value || 0)
        return Number.isFinite(numeric) && numeric > 0 ? Math.ceil(numeric) : 0
    }

    private async ensureVendorPartLookupLoaded(): Promise<void> {
        if ((this.vendorPartLookupLoaded && this.deviceLookupLoaded) || this.vendorPartLookupWorking) {
            return
        }

        this.vendorPartLookupWorking = true
        try {
            const [partsResponse, devicesResponse] = await Promise.all([
                this.vendorPartLookupLoaded
                    ? Promise.resolve({ rows: this.vendorPartRows })
                    : firstValueFrom(this.http.get<{ rows?: VwPart[] }>('/api/firewire/parts')),
                this.deviceLookupLoaded
                    ? Promise.resolve({ rows: this.deviceRows })
                    : firstValueFrom(this.http.get<{ rows?: VwDevice[] }>('/api/firewire/vwdevices'))
            ])
            this.vendorPartRows = Array.isArray(partsResponse?.rows) ? partsResponse.rows : []
            this.deviceRows = Array.isArray(devicesResponse?.rows) ? devicesResponse.rows : []
            this.vendorPartLookupLoaded = true
            this.deviceLookupLoaded = true
        } finally {
            this.vendorPartLookupWorking = false
        }
    }

    private toDateInputValue(value: string | Date | null | undefined): string {
        if (!value) {
            return ''
        }
        const parsed = new Date(value)
        if (Number.isNaN(parsed.getTime())) {
            return ''
        }
        return parsed.toISOString().slice(0, 10)
    }

    private toCsvCell(value: string): string {
        const escaped = String(value || '').replace(/"/g, '""')
        return `"${escaped}"`
    }

    private dataUrlToBlob(dataUrl: string): Blob {
        const commaIndex = dataUrl.indexOf(',')
        const header = commaIndex >= 0 ? dataUrl.slice(0, commaIndex) : ''
        const base64 = commaIndex >= 0 ? dataUrl.slice(commaIndex + 1) : dataUrl
        const mimeTypeMatch = header.match(/data:(.*?);base64/)
        const mimeType = mimeTypeMatch ? mimeTypeMatch[1] : 'application/octet-stream'
        const binary = atob(base64)
        const bytes = new Uint8Array(binary.length)
        for (let i = 0; i < binary.length; i += 1) {
            bytes[i] = binary.charCodeAt(i)
        }
        return new Blob([bytes], { type: mimeType })
    }

    private readFileAsDataUrl(file: File): Promise<string> {
        return new Promise((resolve, reject) => {
            const reader = new FileReader()
            reader.onload = () => resolve(String(reader.result || ''))
            reader.onerror = () => reject(reader.error || new Error('Unable to read file.'))
            reader.readAsDataURL(file)
        })
    }

    private blobToDataUrl(blob: Blob): Promise<string> {
        return new Promise((resolve, reject) => {
            const reader = new FileReader()
            reader.onload = () => resolve(String(reader.result || ''))
            reader.onerror = () => reject(reader.error || new Error('Unable to read file.'))
            reader.readAsDataURL(blob)
        })
    }

    private getDocLibraryExtension(fileName: string): string {
        const dotIndex = fileName.lastIndexOf('.')
        if (dotIndex <= 0 || dotIndex === fileName.length - 1) {
            return ''
        }
        return fileName.slice(dotIndex + 1).toLowerCase()
    }

    private createClientId(): string {
        const cryptoApi = globalThis.crypto as Crypto | undefined
        if (cryptoApi?.randomUUID) {
            return cryptoApi.randomUUID()
        }
        return `sales-doc-${Date.now()}-${Math.random().toString(16).slice(2, 10)}`
    }

    getDocLibraryVersionContent(file: ProjectDocLibraryFileRecord): string {
        const version = this.getLatestDocLibraryVersion(file)
        return version?.dataUrl || version?.contentUrl || ''
    }
}

@Component({
    standalone: true,
    selector: 'sales-doc-library-category-dialog',
    imports: [
        CommonModule,
        FormsModule,
        MatButtonModule,
        MatFormFieldModule,
        MatSelectModule,
        MatDialogTitle,
        MatDialogContent,
        MatDialogActions,
        MatDialogClose
    ],
    template: `
        <h2 mat-dialog-title>{{data.title}}</h2>
        <mat-dialog-content class="project-doc-library-category-dialog">
            <div class="project-doc-library-category-dialog__hint">Choose the document category for this upload.</div>
            <mat-form-field>
                <mat-label>Category</mat-label>
                <mat-select [(ngModel)]="selectedFolderId">
                    <mat-option *ngFor="let folder of data.folders" [value]="folder.id">{{folder.label}}</mat-option>
                </mat-select>
            </mat-form-field>
        </mat-dialog-content>
        <mat-dialog-actions align="end">
            <button mat-button mat-dialog-close type="button">Cancel</button>
            <button mat-flat-button type="button" (click)="confirmSelection()">{{data.confirmLabel}}</button>
        </mat-dialog-actions>
    `
})
export class SalesDocLibraryCategoryDialog {
    readonly data = inject<SalesDocLibraryCategoryDialogData>(MAT_DIALOG_DATA)
    private readonly dialogRef = inject(MatDialogRef<SalesDocLibraryCategoryDialog>)
    selectedFolderId = this.data.selectedFolderId

    confirmSelection(): void {
        this.dialogRef.close(this.selectedFolderId)
    }
}

@Component({
    standalone: true,
    selector: 'sales-floorplan-delete-dialog',
    imports: [CommonModule, MatButtonModule, MatDialogActions, MatDialogClose, MatDialogContent, MatDialogTitle],
    template: `
        <h2 mat-dialog-title>Delete Floorplan</h2>
        <mat-dialog-content>
            Delete <strong>{{data.fileName}}</strong>? This removes it from this workspace.
        </mat-dialog-content>
        <mat-dialog-actions align="end">
            <button mat-button mat-dialog-close type="button">Cancel</button>
            <button mat-flat-button color="warn" type="button" (click)="confirm()">Delete</button>
        </mat-dialog-actions>
    `
})
export class SalesFloorplanDeleteDialog {
    readonly data = inject<SalesFloorplanDeleteDialogData>(MAT_DIALOG_DATA)
    private readonly dialogRef = inject(MatDialogRef<SalesFloorplanDeleteDialog>)

    confirm(): void {
        this.dialogRef.close(true)
    }
}
