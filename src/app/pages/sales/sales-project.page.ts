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
import { FirewireCustomerInfo, FirewireCustomerInfoCardComponent } from '../../common/components/firewire-customer-info-card.component'
import { FirewireDocLibraryExplorerComponent } from '../../common/components/firewire-doc-library-explorer.component'
import { FirewireEstimateSummaryComponent, FirewireEstimateSummaryModel } from '../../common/components/firewire-estimate-summary.component'
import { FirewireFloorplanFolderRenameEvent, FirewireFloorplanMoveEvent, FirewireFloorplansComponent } from '../../common/components/firewire-floorplans.component'
import { createEmptyProjectSettingsCatalog, ProjectSettingsCatalogSchema } from '../../schemas/project-settings.schema'
import { FIREWIRE_PROJECT_TYPE_OPTIONS, FirewireProjectSchema, FirewireProjectType } from '../../schemas/firewire-project.schema'
import { ProjectSettingsApi } from '../projects/project-settings.api'
import {
    ProjectDocLibraryDirectoryRecord,
    ProjectDocLibraryFileRecord,
    ProjectDocLibraryFileVersionRecord,
    ProjectFloorplanDesignAnnotation,
    ProjectFloorplanSymbolAttribute,
    ProjectFloorplanSymbolMediaFile,
    ProjectFloorplanSymbolTag,
    ProjectFloorplanDesignState,
    ProjectDocLibraryStorageService
} from '../../common/services/project-doc-library-storage.service'
import { PdfThumbnailService } from '../../common/services/pdf-thumbnail.service'
import { DevicePartPriceSyncService } from '../../common/services/device-part-price-sync.service'
import { DeviceSetSummary, DeviceSetDetail } from '../../schemas/device-set.schema'
import { VwDeviceMaterial } from '../../schemas/vwdevicematerial.schema'
import { VwDevice } from '../../schemas/vwdevice.schema'
import { VwPart } from '../../schemas/vwpart.schema'
import { MaterialAttribute } from '../../schemas/materialattribute.schema'
import { FloorplanDesignerDialog, FloorplanDesignerDialogResult, FloorplanSymbolBalanceDialog, FloorplanSymbolBalanceDialogData } from '../design/floorplan-designer.dialog'
import { FloorplanDesignerSymbolOption } from '../design/floorplan-designer.component'

type SalesWorkspaceTab = 'PROJECT DETAILS' | 'CUSTOMER INFO' | 'BOM' | 'FLOORPLANS' | 'DOC LIBRARY' | 'QUICK ESTIMATE'
type SalesBomSortKey = 'partNbr' | 'description' | 'qty' | 'cost' | 'extCost' | 'labor' | 'extLabor' | 'includeOnFloorplan' | 'type'

interface SalesBomRowPart {
    bomRowPartId: string
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
    quantityPerDevice: number
}

interface SalesBomRow {
    id: string
    deviceId?: string | null
    partNbr: string
    description: string
    qty: number
    cost: number
    labor: number
    includeOnFloorplan: boolean
    type: string
    iconId?: string | null
    iconLabel?: string | null
    iconDataUrl?: string | null
    iconForegroundColor?: string | null
    shortName?: string | null
    floorplanLabelText?: string | null
    customAttributes?: ProjectFloorplanSymbolAttribute[]
    tags?: ProjectFloorplanSymbolTag[]
    mediaFiles?: ProjectFloorplanSymbolMediaFile[]
    lookupQuery?: string
    bomRowParts?: SalesBomRowPart[]
}

interface SalesBomDeviceFloorplanSnapshot {
    customAttributes: ProjectFloorplanSymbolAttribute[]
    tags: ProjectFloorplanSymbolTag[]
    mediaFiles: ProjectFloorplanSymbolMediaFile[]
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

interface SalesCustomerInfo extends FirewireCustomerInfo {}

interface SalesFloorplanFolder {
    id: string
    name: string
    expanded?: boolean
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
        FirewireCustomerInfoCardComponent,
        FirewireDocLibraryExplorerComponent,
        FirewireEstimateSummaryComponent,
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
    private readonly defaultFloorplanFolderId = 'general'
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
    readonly workspaceTabs: SalesWorkspaceTab[] = ['PROJECT DETAILS', 'CUSTOMER INFO', 'BOM', 'FLOORPLANS', 'DOC LIBRARY', 'QUICK ESTIMATE']
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
    floorplanSavingFileIds: string[] = []
    floorplanUploadBusy = false
    floorplanFolders: SalesFloorplanFolder[] = [{ id: 'general', name: 'General', expanded: true }]
    private pendingFloorplanUploadFolderId = 'general'
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
        this.floorplanFolders = this.normalizeFloorplanFolders(undefined)
        this.pendingFloorplanUploadFolderId = this.defaultFloorplanFolderId
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
                this.floorplanFolders = this.normalizeFloorplanFolders(this.project?.worksheetData?.floorplanFolders)
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

    getSalesProjectTitle(): string {
        return this.projectForm.name?.trim() || this.project?.name?.trim() || 'Sales Project'
    }

    getSalesProjectStatus(): string {
        return this.projectForm.projectStatus?.trim() || this.project?.projectStatus?.trim() || ''
    }

    onUploadFloorplansClick(folderId?: string): void {
        if (!this.floorplanUploadInput?.nativeElement) {
            return
        }

        this.activeTab = 'FLOORPLANS'
        this.floorplanStatusMessage = ''
        this.pendingFloorplanUploadFolderId = this.getValidFloorplanFolderId(folderId)
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
        this.removeFloorplanSymbolsMissingFromBom()
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
                floorplanFolders: this.floorplanFolders,
                bomSections: this.buildWorksheetBomSections()
            }
        }).subscribe({
            next: async(response: any) => {
                this.project = response?.data ? { ...response.data } : this.project
                if (response?.data) {
                    this.projectForm = this.buildForm(response.data)
                    this.customerInfo = this.buildCustomerInfo(response.data)
                    this.floorplanFolders = this.normalizeFloorplanFolders(response?.data?.worksheetData?.floorplanFolders)
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
        this.removeFloorplanSymbolsMissingFromBom()
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
            floorplanFolders: this.floorplanFolders,
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
                    this.floorplanFolders = this.normalizeFloorplanFolders(response?.data?.worksheetData?.floorplanFolders)
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

    getFloorplanFolderId(file: ProjectDocLibraryFileRecord): string {
        return this.getValidFloorplanFolderId(file.floorplanFolderId)
    }

    createFloorplanFolder(): void {
        const baseName = 'New Folder'
        const existingNames = new Set(this.floorplanFolders.map((folder) => folder.name.toLowerCase()))
        let name = baseName
        let counter = 2
        while (existingNames.has(name.toLowerCase())) {
            name = `${baseName} ${counter}`
            counter += 1
        }

        this.floorplanFolders = [
            ...this.floorplanFolders.map((folder) => ({ ...folder, expanded: false })),
            { id: this.createClientId(), name, expanded: true }
        ]
        this.floorplanStatusMessage = `Created ${name}.`
        this.persistSalesWorksheetState()
    }

    renameFloorplanFolder(event: FirewireFloorplanFolderRenameEvent): void {
        const folder = this.floorplanFolders.find((item) => item.id === event.folderId)
        if (!folder) {
            return
        }

        const nextName = String(event.name || '').trim() || 'Folder'
        this.floorplanFolders = this.floorplanFolders.map((item) => item.id === folder.id ? { ...item, name: nextName } : item)
        this.floorplanStatusMessage = `Renamed folder to ${nextName}.`
        this.persistSalesWorksheetState()
    }

    async deleteFloorplanFolder(folderId: string): Promise<void> {
        if (this.floorplanFolders.length <= 1) {
            this.floorplanStatusMessage = 'At least one floorplan folder is required.'
            return
        }

        const folder = this.floorplanFolders.find((item) => item.id === folderId)
        if (!folder) {
            return
        }

        const remainingFolders = this.floorplanFolders.filter((item) => item.id !== folderId)
        const targetFolderId = remainingFolders[0]?.id || this.defaultFloorplanFolderId
        const fileCount = this.getFloorplanFiles().filter((file) => this.getFloorplanFolderId(file) === folderId).length
        const confirmed = window.confirm(fileCount > 0
            ? `Delete ${folder.name}? ${fileCount} floorplan${fileCount === 1 ? '' : 's'} will be moved to ${remainingFolders[0]?.name || 'General'}.`
            : `Delete ${folder.name}?`)
        if (!confirmed) {
            return
        }

        this.floorplanFolders = remainingFolders.length > 0
            ? remainingFolders.map((item, index) => ({ ...item, expanded: index === 0 ? true : item.expanded }))
            : this.normalizeFloorplanFolders(undefined)
        for (const file of this.getFloorplanFiles()) {
            if (this.getFloorplanFolderId(file) === folderId) {
                file.floorplanFolderId = targetFolderId
                file.updatedAt = new Date().toISOString()
            }
        }
        await this.persistDocLibraryWorkspace()
        this.floorplanStatusMessage = `Deleted ${folder.name}.`
        this.persistSalesWorksheetState()
    }

    toggleFloorplanFolder(folderId: string): void {
        this.floorplanFolders = this.floorplanFolders.map((folder) =>
            folder.id === folderId ? { ...folder, expanded: !folder.expanded } : folder)
        this.persistSalesWorksheetState()
    }

    async moveFloorplanFileToFolder(event: FirewireFloorplanMoveEvent): Promise<void> {
        const file = this.docLibraryFiles.find((item) => item.id === event.fileId && item.folderId === this.floorplansFolderId)
        const targetFolderId = this.getValidFloorplanFolderId(event.folderId)
        if (!file || this.getFloorplanFolderId(file) === targetFolderId) {
            return
        }

        file.floorplanFolderId = targetFolderId
        file.updatedAt = new Date().toISOString()
        await this.persistDocLibraryWorkspace()
        const folderName = this.floorplanFolders.find((folder) => folder.id === targetFolderId)?.name || 'General'
        this.floorplanStatusMessage = `Moved ${file.name} to ${folderName}.`
    }

    private getValidFloorplanFolderId(folderId: string | null | undefined): string {
        const normalizedId = String(folderId || '').trim()
        if (normalizedId && this.floorplanFolders.some((folder) => folder.id === normalizedId)) {
            return normalizedId
        }
        return this.floorplanFolders[0]?.id || this.defaultFloorplanFolderId
    }

    private normalizeFloorplanFolders(folders: SalesFloorplanFolder[] | undefined): SalesFloorplanFolder[] {
        const normalized = Array.isArray(folders)
            ? folders.map((folder) => ({
                id: String(folder?.id || '').trim(),
                name: String(folder?.name || 'Folder').trim() || 'Folder',
                expanded: folder?.expanded !== false
            })).filter((folder) => !!folder.id)
            : []

        if (normalized.length <= 0) {
            return [{ id: this.defaultFloorplanFolderId, name: 'General', expanded: true }]
        }

        const seenIds = new Set<string>()
        return normalized.filter((folder) => {
            if (seenIds.has(folder.id)) {
                return false
            }
            seenIds.add(folder.id)
            return true
        })
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
        this.syncFloorplanAnnotationsToBomRows()
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
        this.ensureBomRowIds()
        const bySymbol = new Map<string, FloorplanDesignerSymbolOption>()
        for (const section of this.bomSections) {
            for (const row of section.rows || []) {
                const categoryName = this.getFloorplanSymbolCategoryName(row)
                const qty = Math.max(0, Math.trunc(Number(row.qty || 0)))
                if (!row.includeOnFloorplan) {
                    continue
                }

                const categoryKey = `category-${this.normalizeFloorplanSymbolKey(categoryName)}`
                const partNumber = String(row.partNbr || '').trim()
                const deviceName = String(row.description || row.partNbr || categoryName).trim()
                const partDescription = this.getBomRowPartDescription(row)
                const id = this.getFloorplanSymbolIdForBomRow(row)
                const existing = bySymbol.get(id)
                if (existing) {
                    existing.totalQty += qty
                    existing.partDescription = existing.partDescription || partDescription
                    existing.iconDataUrl = existing.iconDataUrl || row.iconDataUrl || null
                    existing.customAttributes = existing.customAttributes?.length ? existing.customAttributes : this.cloneFloorplanSymbolAttributes(row.customAttributes)
                    existing.tags = existing.tags?.length ? existing.tags : this.cloneFloorplanSymbolTags(row.tags)
                    existing.mediaFiles = existing.mediaFiles?.length ? existing.mediaFiles : this.cloneFloorplanSymbolMediaFiles(row.mediaFiles)
                    continue
                }

                bySymbol.set(id, {
                    id,
                    bomRowId: row.id,
                    deviceId: String(row.deviceId || '').trim() || undefined,
                    code: this.createFloorplanSymbolCode(categoryName, deviceName),
                    floorplanLabelText: this.getBomRowFloorplanLabelText(row, categoryName, deviceName),
                    label: deviceName,
                    color: this.getFloorplanSymbolColor(categoryKey),
                    totalQty: qty,
                    placedQty: 0,
                    remainingQty: qty,
                    categoryKey,
                    categoryName,
                    partNumber,
                    deviceName,
                    shortName: String(row.shortName || '').trim(),
                    partDescription,
                    iconId: row.iconId || null,
                    iconLabel: row.iconLabel || null,
                    iconDataUrl: row.iconDataUrl || null,
                    iconForegroundColor: row.iconForegroundColor || null,
                    materialCost: Number(row.cost || 0),
                    laborHours: Number(row.labor || 0),
                    customAttributes: this.cloneFloorplanSymbolAttributes(row.customAttributes),
                    tags: this.cloneFloorplanSymbolTags(row.tags),
                    mediaFiles: this.cloneFloorplanSymbolMediaFiles(row.mediaFiles)
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
        this.syncFloorplanAnnotationsToBomRows(overrideFileId, overrideDesign)
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
        this.syncFloorplanAnnotationsToBomRows()
        const placedCounts = this.getFloorplanSymbolPlacementCounts()
        const synchronized = new Set<string>()
        for (const section of this.bomSections) {
            for (const row of section.rows || []) {
                if (!row.includeOnFloorplan) {
                    continue
                }
                const symbolId = this.getFloorplanSymbolIdForBomRow(row)
                row.qty = synchronized.has(symbolId) ? 0 : (placedCounts.get(symbolId) || 0)
                synchronized.add(symbolId)
            }
        }
        this.bomSections = [...this.bomSections]
    }

    private removeFloorplanSymbolsForBomRows(rows: SalesBomRow[]): number {
        const rowIds = new Set<string>()
        const symbolIds = new Set<string>()
        for (const row of rows || []) {
            const rowId = String(row?.id || '').trim()
            if (rowId) {
                rowIds.add(rowId)
            }
            if (row) {
                symbolIds.add(this.getFloorplanSymbolIdForBomRow(row))
            }
        }

        if (rowIds.size <= 0 && symbolIds.size <= 0) {
            return 0
        }

        let removedCount = 0
        let changedFiles = false
        for (const file of this.getFloorplanFiles()) {
            const design = file.floorplanDesign
            const annotations = design?.annotations || []
            if (annotations.length <= 0) {
                continue
            }

            const nextAnnotations = annotations.filter((annotation) => {
                if (annotation.kind !== 'symbol') {
                    return true
                }
                const matchesDeletedRow =
                    (annotation.symbolId && symbolIds.has(annotation.symbolId))
                    || (annotation.bomRowId && rowIds.has(annotation.bomRowId))
                if (matchesDeletedRow) {
                    removedCount += 1
                    return false
                }
                return true
            })

            if (nextAnnotations.length !== annotations.length && design) {
                file.floorplanDesign = {
                    ...design,
                    annotations: nextAnnotations
                }
                file.updatedAt = new Date().toISOString()
                changedFiles = true
            }
        }

        this.afterFloorplanSymbolCleanup(changedFiles)

        return removedCount
    }

    private removeFloorplanSymbolsMissingFromBom(): number {
        const symbols = this.getFloorplanSymbolInventory()
        const validSymbolIds = new Set(symbols.map((symbol) => symbol.id))
        const validBomRowIds = new Set(symbols.map((symbol) => String(symbol.bomRowId || '').trim()).filter(Boolean))
        let removedCount = 0
        let changedFiles = false

        for (const file of this.getFloorplanFiles()) {
            const design = file.floorplanDesign
            const annotations = design?.annotations || []
            if (annotations.length <= 0) {
                continue
            }

            const nextAnnotations = annotations.filter((annotation) => {
                if (annotation.kind !== 'symbol') {
                    return true
                }
                const symbolId = String(annotation.symbolId || '').trim()
                const bomRowId = String(annotation.bomRowId || '').trim()
                const hasBomMatch = !!bomRowId && validBomRowIds.has(bomRowId)
                const hasSymbolMatch = !!symbolId && validSymbolIds.has(symbolId)
                if (!hasBomMatch && !hasSymbolMatch) {
                    removedCount += 1
                    return false
                }
                return true
            })

            if (nextAnnotations.length !== annotations.length && design) {
                file.floorplanDesign = {
                    ...design,
                    annotations: nextAnnotations
                }
                file.updatedAt = new Date().toISOString()
                changedFiles = true
            }
        }

        this.afterFloorplanSymbolCleanup(changedFiles)
        return removedCount
    }

    private afterFloorplanSymbolCleanup(changedFiles: boolean): void {
        if (!changedFiles) {
            return
        }
        this.docLibraryFiles = [...this.docLibraryFiles]
        void this.persistDocLibraryWorkspace().catch((err) => {
            this.saveMessage = err?.message || 'Unable to persist floorplan symbol cleanup.'
        })
    }

    private getFloorplanSymbolIdForBomRow(row: SalesBomRow): string {
        if (!String(row.id || '').trim()) {
            row.id = this.createClientId()
        }
        return `bom-row-${row.id}`
    }

    private getFloorplanSymbolCategoryName(row: SalesBomRow): string {
        return String(row.type || row.description || row.partNbr || 'BOM Item').trim() || 'BOM Item'
    }

    private ensureBomRowIds(): void {
        for (const section of this.bomSections || []) {
            for (const row of section.rows || []) {
                if (!String(row.id || '').trim()) {
                    row.id = this.createClientId()
                }
            }
        }
    }

    private syncFloorplanAnnotationsToBomRows(overrideFileId?: string, overrideDesign?: ProjectFloorplanDesignState): void {
        const symbolsById = new Map(this.getFloorplanSymbolInventory().map((symbol) => [symbol.id, symbol]))
        const syncDesign = (design?: ProjectFloorplanDesignState): boolean => {
            let changed = false
            for (const annotation of design?.annotations || []) {
                if (annotation.kind !== 'symbol') {
                    continue
                }
                const symbol = symbolsById.get(annotation.symbolId || '')
                    || (annotation.bomRowId ? symbolsById.get(`bom-row-${annotation.bomRowId}`) : undefined)
                if (!symbol) {
                    continue
                }
                const updates: Partial<ProjectFloorplanDesignAnnotation> = {
                    bomRowId: symbol.bomRowId,
                    symbolId: symbol.id,
                    categoryKey: symbol.categoryKey,
                    deviceId: symbol.deviceId,
                    categoryName: symbol.categoryName,
                    partNumber: symbol.partNumber,
                    deviceName: symbol.deviceName,
                    shortName: symbol.shortName,
                    floorplanLabelText: symbol.floorplanLabelText,
                    partDescription: symbol.partDescription,
                    iconId: symbol.iconId,
                    iconLabel: symbol.iconLabel,
                    iconDataUrl: symbol.iconDataUrl,
                    iconForegroundColor: symbol.iconForegroundColor,
                    materialCost: symbol.materialCost,
                    laborHours: symbol.laborHours,
                    customAttributes: this.cloneFloorplanSymbolAttributes(symbol.customAttributes),
                    tags: this.cloneFloorplanSymbolTags(symbol.tags),
                    mediaFiles: this.cloneFloorplanSymbolMediaFiles(symbol.mediaFiles),
                    symbol: symbol.floorplanLabelText || symbol.code,
                    label: symbol.label,
                    color: symbol.color
                }
                for (const [key, value] of Object.entries(updates) as [keyof ProjectFloorplanDesignAnnotation, any][]) {
                    if (key === 'customAttributes' || key === 'tags' || key === 'mediaFiles') {
                        if (typeof (annotation as any)[key] === 'undefined') {
                            ;(annotation as any)[key] = value
                            changed = true
                        }
                        continue
                    }
                    if ((annotation as any)[key] !== value) {
                        ;(annotation as any)[key] = value
                        changed = true
                    }
                }
            }
            return changed
        }

        if (overrideDesign) {
            syncDesign(overrideDesign)
        }

        for (const file of this.getFloorplanFiles()) {
            if (overrideFileId && file.id === overrideFileId) {
                continue
            }
            if (syncDesign(file.floorplanDesign)) {
                file.updatedAt = new Date().toISOString()
            }
        }
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

    private getBomRowFloorplanLabelText(row: SalesBomRow, categoryName: string, deviceName: string): string {
        return String(row.floorplanLabelText || '').trim().replace(/\s+/g, '').slice(0, 4)
            || this.createFloorplanSymbolCode(categoryName, deviceName)
    }

    private getDeviceFloorplanLabelText(device: VwDevice): string | null {
        const explicit = String(device.floorplanLabelText || '').trim().replace(/\s+/g, '').slice(0, 4)
        if (explicit) {
            return explicit
        }
        const fallback = this.createFloorplanSymbolCode(String(device.categoryName || ''), String(device.shortName || device.name || device.partNumber || ''))
        return fallback || null
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

    getQuickEstimateSummary(): FirewireEstimateSummaryModel {
        const installationMaterialTotal = this.getQuickEstimateInstallationMaterialTotal()
        const installationLaborTotal = this.getQuickEstimateInstallationLaborTotal()
        const projectManagement = this.getWorksheetServiceSupportSummary('ssPm')
        const cadDesign = this.getWorksheetServiceSupportSummary('ssCad')
        const technicalLabor = this.getWorksheetServiceSupportSummary('ssTech')
        const projectSupportCost = projectManagement.cost + cadDesign.cost + technicalLabor.cost
        const projectSupportHours = projectManagement.hours + cadDesign.hours + technicalLabor.hours
        const equipmentMaterialTotal = this.getWorksheetNumber('equipmentMaterialTotal', 0)
        const rentalEquipmentTotal = this.getWorksheetExpenseSectionTotalByTitle('Rental Equipment')
        const summaryEquipmentTotal = equipmentMaterialTotal + rentalEquipmentTotal
        const generalExpenseTotal = this.getWorksheetGeneralExpenseTotal()
        const subcontractTotal = this.getWorksheetExpenseSectionTotalByTitle('Subcontracts')
        const specialMarkupTotal = this.getWorksheetExpenseSectionTotalByTitle('Special Markup Items')
        const projectSupportRows = [
            { label: 'Project Management', hours: projectManagement.hours, cost: projectManagement.cost },
            { label: 'CAD Design', hours: cadDesign.hours, cost: cadDesign.cost },
            { label: 'Technical Labor', hours: technicalLabor.hours, cost: technicalLabor.cost }
        ]
        const installationLaborRows = [
            { label: 'Pipe & Wire Labor', hours: this.getQuickEstimateLaborHours(), overtimeHours: 0, cost: installationLaborTotal },
            { label: 'Supervision Labor', hours: 0, overtimeHours: 0, cost: 0 },
            { label: 'Mobilization Labor', hours: 0, overtimeHours: 0, cost: 0 }
        ]
        const totalCost = projectSupportCost
            + installationLaborTotal
            + installationMaterialTotal
            + summaryEquipmentTotal
            + generalExpenseTotal
            + subcontractTotal
            + specialMarkupTotal
        const riskMultiplier = 1 + (this.getWorksheetSummaryNumber('summaryRiskProficiencyPercent', 0) / 100)
        const totalCostWithRisk = this.roundUpSummaryPricingAmount(totalCost * riskMultiplier)
        const marginPercent = this.getWorksheetSummaryNumber('summaryMarginPercent', this.getDefaultSummaryMarginPercent())
        const marginAmount = this.roundUpSummaryPricingAmount(totalCostWithRisk * (marginPercent / 100))
        const quotedPrice = this.roundUpSummaryPricingAmount(totalCostWithRisk + marginAmount)
        const taxSummary = this.getQuickEstimateMaterialTaxSummary(installationMaterialTotal, equipmentMaterialTotal)
        const materialTaxAmount = taxSummary.installationTax + taxSummary.equipmentTax
        const quotedPriceWithTax = this.roundUpSummaryPricingAmount(quotedPrice + materialTaxAmount)

        return {
            projectSupport: projectSupportRows,
            installationLabor: installationLaborRows,
            costs: [
                { label: 'Project Support', cost: projectSupportCost },
                { label: 'Installation Labor', cost: installationLaborTotal },
                { label: 'Installation Material', cost: installationMaterialTotal },
                { label: 'Equipment', cost: summaryEquipmentTotal },
                { label: 'Expenses', cost: generalExpenseTotal },
                { label: 'Subcontracts', cost: subcontractTotal },
                { label: 'Special Markup Items', cost: specialMarkupTotal }
            ],
            installationMaterialTotal,
            equipmentMaterialTotal,
            rentalEquipmentTotal,
            summaryEquipmentTotal,
            materialTaxAmount,
            installationMaterialTaxAmount: taxSummary.installationTax,
            equipmentMaterialTaxAmount: taxSummary.equipmentTax,
            useInstallationMaterialTax: taxSummary.useInstallationMaterialTax,
            useEquipmentMaterialTax: taxSummary.useEquipmentMaterialTax,
            totalCost,
            totalCostWithRisk,
            preTax: quotedPrice,
            marginAmount,
            quotedPrice,
            quotedPriceWithTax,
            scopeLabel: this.isQuickEstimateTurnkeyScope() ? 'Turnkey' : 'Smarts & Parts',
            deviceCount: this.getQuickEstimateDeviceCount(),
            totalSqFt: Number(this.projectForm.totalSqFt || 0),
            engineeringHours: projectSupportHours,
            engineeringDollars: projectSupportCost,
            fieldHours: this.getQuickEstimateLaborHours(),
            fieldDollars: installationLaborTotal
        }
    }

    private getQuickEstimateInstallationMaterialTotal(): number {
        return this.bomSections.reduce((sectionSum, section) => {
            return sectionSum + (section.rows || []).reduce((rowSum, row) => rowSum + this.getBomRowExtCost(row), 0)
        }, 0)
    }

    private getQuickEstimateInstallationLaborTotal(): number {
        return this.bomSections.reduce((sectionSum, section) => {
            return sectionSum + (section.rows || []).reduce((rowSum, row) => rowSum + this.getBomRowExtLabor(row), 0)
        }, 0)
    }

    private getQuickEstimateLaborHours(): number {
        return this.bomSections.reduce((sectionSum, section) => {
            return sectionSum + (section.rows || []).reduce((rowSum, row) => {
                const rowLabor = this.getBomRowExtLabor(row)
                return rowSum + (this.defaultLaborHourlyRate > 0 ? rowLabor / this.defaultLaborHourlyRate : 0)
            }, 0)
        }, 0)
    }

    private getQuickEstimateDeviceCount(): number {
        return this.bomSections.reduce((sectionSum, section) => {
            return sectionSum + (section.rows || []).reduce((rowSum, row) => rowSum + Math.max(0, Math.trunc(Number(row.qty || 0))), 0)
        }, 0)
    }

    private getQuickEstimateMaterialTaxSummary(installationMaterialTotal: number, equipmentMaterialTotal: number): {
        useInstallationMaterialTax: boolean
        useEquipmentMaterialTax: boolean
        installationTax: number
        equipmentTax: number
    } {
        const worksheetData = (this.project?.worksheetData || {}) as Record<string, any>
        const useInstallationMaterialTax = Boolean(
            worksheetData['summaryUseInstallationMaterialTax']
            ?? worksheetData['summaryUseMaterialTax']
            ?? false
        )
        const useEquipmentMaterialTax = Boolean(
            worksheetData['summaryUseEquipmentMaterialTax']
            ?? worksheetData['summaryUseMaterialTax']
            ?? false
        )
        const installationTaxRate = this.getWorksheetSummaryNumber('summaryInstallationMaterialTaxRate', Number(worksheetData['summaryMaterialTaxRate'] ?? 8.25))
        const equipmentTaxRate = this.getWorksheetSummaryNumber('summaryEquipmentMaterialTaxRate', Number(worksheetData['summaryMaterialTaxRate'] ?? 8.25))
        const installationTax = useInstallationMaterialTax ? installationMaterialTotal * (installationTaxRate / 100) : 0
        const equipmentTax = useEquipmentMaterialTax ? equipmentMaterialTotal * (equipmentTaxRate / 100) : 0
        return {
            useInstallationMaterialTax,
            useEquipmentMaterialTax,
            installationTax,
            equipmentTax
        }
    }

    private getWorksheetSummaryNumber(key: string, fallback: number): number {
        const worksheetData = (this.project?.worksheetData || {}) as Record<string, any>
        const value = Number(worksheetData[key])
        return Number.isFinite(value) ? value : fallback
    }

    private getWorksheetNumber(key: string, fallback: number): number {
        const worksheetData = (this.project?.worksheetData || {}) as Record<string, any>
        const value = Number(worksheetData[key])
        return Number.isFinite(value) ? value : fallback
    }

    private getWorksheetServiceSupportSummary(prefix: 'ssPm' | 'ssCad' | 'ssTech'): { hours: number, cost: number } {
        const worksheetData = (this.project?.worksheetData || {}) as Record<string, any>
        const rate = Number(worksheetData[`${prefix}Rate`] || 0)
        const fixedAmount = Number(worksheetData[`${prefix}FixedAmount`] || 0)
        const laborRows = Array.isArray(worksheetData[`${prefix}LaborRows`]) ? worksheetData[`${prefix}LaborRows`] : []
        const expenseRows = Array.isArray(worksheetData[`${prefix}ExpenseRows`]) ? worksheetData[`${prefix}ExpenseRows`] : []
        const hours = laborRows.reduce((sum: number, row: any) => sum + (Number(row?.hours || 0) * Number(row?.quantity || 0)), 0)
        const expenses = expenseRows.reduce((sum: number, row: any) => sum + (Number(row?.cost || 0) * Number(row?.qty || 0)), 0)
        return {
            hours,
            cost: (hours * rate) + expenses + fixedAmount
        }
    }

    private getWorksheetExpenseSections(): any[] {
        const worksheetData = (this.project?.worksheetData || {}) as Record<string, any>
        return Array.isArray(worksheetData['expenseSections']) ? worksheetData['expenseSections'] : []
    }

    private getWorksheetExpenseRowExtended(row: any, section: any): number {
        const qty = Number(row?.qty || 0)
        const mode = String(section?.mode || '')
        const baseValue = mode === 'cost-qty' ? Number(row?.cost || 0) : Number(row?.rate || 0)
        if (mode === 'markup') {
            return qty * baseValue * (1 + (Number(row?.markupPercent || 0) / 100))
        }
        if (row?.isToggle) {
            return row?.toggleValue ? baseValue : 0
        }
        return qty * baseValue
    }

    private getWorksheetExpenseSectionTotal(section: any): number {
        return Array.isArray(section?.rows)
            ? section.rows.reduce((sum: number, row: any) => sum + this.getWorksheetExpenseRowExtended(row, section), 0)
            : 0
    }

    private getWorksheetExpenseSectionTotalByTitle(title: string): number {
        const section = this.getWorksheetExpenseSections().find((row) => String(row?.title || '').trim().toLowerCase() === title.toLowerCase())
        return section ? this.getWorksheetExpenseSectionTotal(section) : 0
    }

    private getWorksheetGeneralExpenseTotal(): number {
        return this.getWorksheetExpenseSections()
            .filter((section) => !['Rental Equipment', 'Subcontracts', 'Special Markup Items'].includes(String(section?.title || '').trim()))
            .reduce((sum, section) => sum + this.getWorksheetExpenseSectionTotal(section), 0)
    }

    private roundUpSummaryPricingAmount(amount: number): number {
        return Math.ceil(Math.max(0, Number(amount || 0)))
    }

    private getDefaultSummaryMarginPercent(): number {
        return this.isQuickEstimateTurnkeyScope() ? 35 : 20
    }

    private isQuickEstimateTurnkeyScope(): boolean {
        return String(this.projectForm.projectScope || '').toLowerCase().includes('turnkey')
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
        this.removeFloorplanSymbolsForBomRows([row])
        section.rows = (section.rows || []).filter((item) => item !== row)
        this.bomSections = [...this.bomSections]
        this.removeFloorplanSymbolsMissingFromBom()
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

        return this.deviceRows
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
        row.deviceId = null
        row.shortName = null
        row.floorplanLabelText = null
        row.customAttributes = []
        row.tags = []
        row.mediaFiles = []
        row.iconId = null
        row.iconLabel = null
        row.iconDataUrl = null
        row.iconForegroundColor = null
        row.labor = this.roundBomMoney(this.getDefaultLaborCost(null))
        row.bomRowParts = this.createBomRowPartsFromVendorPart(part)
        this.closeBomPartLookup()
        this.saveMessage = `Loaded ${row.partNbr} from vendor parts.`
    }

    async selectBomDevice(section: SalesBomSection, row: SalesBomRow, device: VwDevice): Promise<void> {
        const partNumber = String(device.partNumber || '').trim()
        let materials: VwDeviceMaterial[] = []
        try {
            const response = await firstValueFrom(this.http.get<VwDeviceMaterial[] | { rows?: VwDeviceMaterial[] }>(`/api/firewire/vwdevicematerials/${device.deviceId}`))
            materials = Array.isArray(response) ? response : (Array.isArray(response?.rows) ? response.rows : [])
        } catch {
            materials = []
        }
        row.partNbr = partNumber
        row.lookupQuery = partNumber
        row.cost = this.roundBomMoney(device.cost || 0)
        row.type = String(device.categoryName || '').trim()
        row.includeOnFloorplan = !!device.includeOnFloorplan
        row.labor = this.roundBomMoney(this.getDefaultLaborCost(device.defaultLabor))
        row.bomRowParts = this.createBomRowPartsFromDeviceMaterials(device, materials)
        row.description = this.getBomDeviceDescription(device, row.bomRowParts)
        this.applyDeviceFloorplanSnapshot(row, device, await this.loadDeviceFloorplanSnapshot(device.deviceId))
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
        const section = this.bomSections[sectionIndex]
        this.removeFloorplanSymbolsForBomRows(section?.rows || [])
        this.bomSections = this.bomSections.filter((_, idx) => idx !== sectionIndex)
        this.removeFloorplanSymbolsMissingFromBom()
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
                const [response, floorplanSnapshot] = await Promise.all([
                    firstValueFrom(this.http.get<{ rows?: VwDeviceMaterial[] }>(`/api/firewire/vwdevicematerials/${device.deviceId}`)),
                    this.loadDeviceFloorplanSnapshot(device.deviceId)
                ])
                return {
                    device,
                    materials: Array.isArray(response?.rows) ? response.rows : [],
                    floorplanSnapshot
                }
            }))

            const nextSection: SalesBomSection = {
                title: this.createUniqueBomSectionTitle(detail.name),
                sectionKey: this.createClientId(),
                vendorIds: Array.from(new Set(detail.devices.map((device) => String(device.vendorId || '').trim()).filter(Boolean))),
                vendorNames: Array.from(new Set(detail.devices.map((device) => String(device.vendorName || '').trim()).filter(Boolean))),
                rows: materialResults.flatMap(({ device, materials, floorplanSnapshot }) => this.createBomRowsFromDevice(device, materials, vendorPartMap, floorplanSnapshot))
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
        this.syncFloorplanQuantitiesToBom()
        await this.persistBomAfterFloorplanSync()
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
            const targetFolderId = this.getValidFloorplanFolderId(this.pendingFloorplanUploadFolderId)
            let uploadedCount = 0
            let skippedCount = 0

            for (const file of files) {
                if (!this.isFloorplanUploadFile(file)) {
                    skippedCount += 1
                    continue
                }

                await this.uploadFileToDocLibraryFolder(file, this.floorplansFolderId, false, await this.createFloorplanThumbnailIfNeeded(file), targetFolderId)
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
            this.pendingFloorplanUploadFolderId = this.getValidFloorplanFolderId(undefined)
            input.value = ''
        }
    }

    async renameFloorplanFile(file: ProjectDocLibraryFileRecord): Promise<void> {
        this.setFloorplanSaving(file.id, true)
        try {
            const normalizedName = String(file.name || '').trim() || 'Floorplan'
            file.name = normalizedName
            file.updatedAt = new Date().toISOString()
            await this.persistDocLibraryWorkspace()
            this.floorplanStatusMessage = `Renamed ${file.name}.`
        } finally {
            this.setFloorplanSaving(file.id, false)
        }
    }

    async openFloorplanDesigner(file: ProjectDocLibraryFileRecord): Promise<void> {
        const result = await firstValueFrom(this.dialog.open(FloorplanDesignerDialog, {
            panelClass: 'fw-fullscreen-dialog-pane',
            maxWidth: '100vw',
            width: '100vw',
            data: {
                file,
                imageUrl: this.getFloorplanVersionContent(file),
                baselineDesign: this.getChangeOrderBaselineFloorplanDesign(file),
                symbols: this.getFloorplanDesignerSymbols(),
                validateDesign: (design: ProjectFloorplanDesignState) => this.getFloorplanSymbolBalanceErrors(file.id, design)
            }
        }).afterClosed()) as FloorplanDesignerDialogResult | undefined

        if (!result?.design) {
            return
        }

        this.setFloorplanSaving(file.id, true)
        try {
            file.floorplanDesign = result.design
            file.updatedAt = new Date().toISOString()
            await this.persistDocLibraryWorkspace()
            this.syncFloorplanQuantitiesToBom()
            await this.persistBomAfterFloorplanSync()
            this.floorplanStatusMessage = `Saved design markup for ${file.name}.`
        } finally {
            this.setFloorplanSaving(file.id, false)
        }
    }

    private getChangeOrderBaselineFloorplanDesign(file: ProjectDocLibraryFileRecord): ProjectFloorplanDesignState | undefined {
        const baseline = this.project?.worksheetData?.changeOrderBaseline
        const baselineFloorplans = Array.isArray(baseline?.floorplans)
            ? baseline.floorplans
            : []
        if (baselineFloorplans.length <= 0) {
            return undefined
        }

        const sourceFileId = String(file.changeOrderSourceFileId || '').trim()
        const sourceFileName = String(file.sourceFileName || '').trim().toLowerCase()
        const displayName = String(file.name || '').trim().toLowerCase()
        const match = baselineFloorplans.find((candidate: any) => {
            const candidateId = String(candidate?.id || candidate?.fileId || '').trim()
            const candidateSourceName = String(candidate?.sourceFileName || '').trim().toLowerCase()
            const candidateName = String(candidate?.name || '').trim().toLowerCase()
            return (!!sourceFileId && candidateId === sourceFileId)
                || (!!sourceFileName && candidateSourceName === sourceFileName)
                || (!!displayName && candidateName === displayName)
        })
        const design = match?.floorplanDesign || match?.design
        return design ? JSON.parse(JSON.stringify(design)) : undefined
    }

    private setFloorplanSaving(fileId: string, saving: boolean): void {
        if (!fileId) {
            return
        }
        const ids = new Set(this.floorplanSavingFileIds)
        if (saving) {
            ids.add(fileId)
        } else {
            ids.delete(fileId)
        }
        this.floorplanSavingFileIds = [...ids]
    }

    private async persistBomAfterFloorplanSync(): Promise<void> {
        if (!this.projectId || !this.project) {
            return
        }
        const worksheetData = {
            ...(this.project.worksheetData || {}),
            customerInfo: this.customerInfo,
            floorplanFolders: this.floorplanFolders,
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
            this.floorplanFolders = this.normalizeFloorplanFolders(response.data.worksheetData?.floorplanFolders)
            this.bomSections = this.cloneBomSections((response.data.worksheetData || worksheetData).bomSections)
            this.captureInitialFormState()
            this.captureInitialCustomerInfoState()
            this.captureInitialBomState()
        }
    }

    private persistSalesWorksheetState(): void {
        if (!this.projectId || !this.project) {
            return
        }

        const worksheetData = {
            ...(this.project.worksheetData || {}),
            customerInfo: this.customerInfo,
            floorplanFolders: this.floorplanFolders,
            bomSections: this.buildWorksheetBomSections()
        }

        void firstValueFrom(this.http.patch(`/api/firewire/projects/firewire/${this.projectId}`, {
            ...this.projectForm,
            worksheetData
        })).then((response: any) => {
            if (response?.data) {
                this.project = { ...response.data }
                this.projectForm = this.buildForm(response.data)
                this.customerInfo = this.buildCustomerInfo(response.data)
                this.floorplanFolders = this.normalizeFloorplanFolders(response.data.worksheetData?.floorplanFolders)
                this.bomSections = this.cloneBomSections((response.data.worksheetData || worksheetData).bomSections)
                this.captureInitialFormState()
                this.captureInitialCustomerInfoState()
                this.captureInitialBomState()
            } else {
                this.project = {
                    ...(this.project as FirewireProjectSchema),
                    worksheetData
                }
            }
        }).catch((err: any) => {
            this.floorplanStatusMessage = err?.error?.message || err?.message || 'Unable to save floorplan folders.'
        })
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

    private createBomRowsFromDevice(device: any, materials: VwDeviceMaterial[], vendorPartMap?: Map<string, VwPart>, floorplanSnapshot?: SalesBomDeviceFloorplanSnapshot): SalesBomRow[] {
        const typeValue = String(device?.categoryName || '').trim()
        const includeOnFloorplan = !!device?.includeOnFloorplan
        const partNumber = String(device.partNumber || '').trim()
        const bomRowParts = this.createBomRowPartsFromDeviceMaterials(device, materials)
        const snapshotCost = bomRowParts.length > 0
            ? bomRowParts.reduce((sum, part) => sum + (Number(part.cost || 0) * Math.max(1, Number(part.quantityPerDevice || 1))), 0)
            : Number(device.cost || 0)

        return [{
            id: this.createClientId(),
            deviceId: String(device.deviceId || '').trim() || null,
            partNbr: partNumber,
            lookupQuery: partNumber,
            description: this.getBomDeviceDescription(device, bomRowParts),
            qty: 0,
            cost: this.roundBomMoney(this.getCurrentVendorPrice(partNumber, vendorPartMap, snapshotCost)),
            labor: this.roundBomMoney(this.getDefaultLaborCost(device.defaultLabor)),
            includeOnFloorplan,
            type: typeValue,
            iconId: device.iconId || null,
            iconLabel: device.iconLabel || null,
            iconDataUrl: device.iconDataUrl || null,
            iconForegroundColor: device.iconForegroundColor || null,
            shortName: String(device.shortName || '').trim() || null,
            floorplanLabelText: this.getDeviceFloorplanLabelText(device),
            customAttributes: this.cloneFloorplanSymbolAttributes(floorplanSnapshot?.customAttributes),
            tags: this.cloneFloorplanSymbolTags(floorplanSnapshot?.tags),
            mediaFiles: this.cloneFloorplanSymbolMediaFiles(floorplanSnapshot?.mediaFiles),
            bomRowParts
        }]
    }

    private applyDeviceFloorplanSnapshot(row: SalesBomRow, device: VwDevice, floorplanSnapshot?: SalesBomDeviceFloorplanSnapshot): void {
        row.deviceId = String(device.deviceId || '').trim() || null
        row.iconId = device.iconId || null
        row.iconLabel = device.iconLabel || null
        row.iconDataUrl = device.iconDataUrl || null
        row.iconForegroundColor = device.iconForegroundColor || null
        row.shortName = String(device.shortName || '').trim() || null
        row.floorplanLabelText = this.getDeviceFloorplanLabelText(device)
        row.customAttributes = this.cloneFloorplanSymbolAttributes(floorplanSnapshot?.customAttributes)
        row.tags = this.cloneFloorplanSymbolTags(floorplanSnapshot?.tags)
        row.mediaFiles = this.cloneFloorplanSymbolMediaFiles(floorplanSnapshot?.mediaFiles)
    }

    private async loadDeviceFloorplanSnapshot(deviceId: unknown): Promise<SalesBomDeviceFloorplanSnapshot> {
        const normalizedDeviceId = String(deviceId || '').trim()
        if (!normalizedDeviceId) {
            return { customAttributes: [], tags: [], mediaFiles: [] }
        }

        try {
            const [attributesResponse, tagsResponse, mediaResponse] = await Promise.all([
                firstValueFrom(this.http.get<{ rows?: MaterialAttribute[] }>(`/api/firewire/devices/${encodeURIComponent(normalizedDeviceId)}/attributes`)),
                firstValueFrom(this.http.get<{ data?: { tags?: ProjectFloorplanSymbolTag[] } }>(`/api/firewire/devices/${encodeURIComponent(normalizedDeviceId)}/tags`)),
                firstValueFrom(this.http.get<{ data?: { files?: ProjectFloorplanSymbolMediaFile[] } }>(`/api/firewire/devices/${encodeURIComponent(normalizedDeviceId)}/media`))
            ])
            return {
                customAttributes: this.cloneFloorplanSymbolAttributes((attributesResponse?.rows || []).map((attribute) => ({
                    name: String(attribute.name || '').trim(),
                    value: String(attribute.defaultValue || '').trim(),
                    defaultValue: String(attribute.defaultValue || '').trim(),
                    valueType: String(attribute.valueType || 'text').trim() || 'text',
                    isReadOnly: !!attribute.isReadOnly
                }))),
                tags: this.cloneFloorplanSymbolTags(tagsResponse?.data?.tags),
                mediaFiles: this.cloneFloorplanSymbolMediaFiles(mediaResponse?.data?.files)
            }
        } catch {
            return { customAttributes: [], tags: [], mediaFiles: [] }
        }
    }

    private cloneFloorplanSymbolAttributes(input: unknown): ProjectFloorplanSymbolAttribute[] {
        if (!Array.isArray(input)) {
            return []
        }
        return input.map((attribute: any) => ({
            name: String(attribute?.name || '').trim(),
            value: String(attribute?.value ?? attribute?.defaultValue ?? '').trim(),
            defaultValue: String(attribute?.defaultValue || '').trim(),
            valueType: String(attribute?.valueType || 'text').trim() || 'text',
            isReadOnly: !!attribute?.isReadOnly
        })).filter((attribute) => !!attribute.name)
    }

    private cloneFloorplanSymbolTags(input: unknown): ProjectFloorplanSymbolTag[] {
        if (!Array.isArray(input)) {
            return []
        }
        const seen = new Set<string>()
        const tags: ProjectFloorplanSymbolTag[] = []
        for (const raw of input) {
            const label = String((raw as any)?.label ?? raw ?? '').replace(/\s+/g, ' ').trim().slice(0, 80)
            if (!label) {
                continue
            }
            const key = label.toLowerCase()
            if (seen.has(key)) {
                continue
            }
            seen.add(key)
            tags.push({
                id: String((raw as any)?.id || '').trim() || this.createClientId(),
                label
            })
        }
        return tags
    }

    private cloneFloorplanSymbolMediaFiles(input: unknown): ProjectFloorplanSymbolMediaFile[] {
        if (!Array.isArray(input)) {
            return []
        }
        return input.map((file: any) => ({
            id: String(file?.id || '').trim(),
            fileName: String(file?.fileName || file?.name || '').trim(),
            mimeType: String(file?.mimeType || '').trim() || undefined,
            sizeBytes: typeof file?.sizeBytes === 'undefined' || file?.sizeBytes === null ? undefined : Number(file.sizeBytes),
            uploadedAt: String(file?.uploadedAt || '').trim() || undefined
        })).filter((file) => !!file.id && !!file.fileName)
    }

    private createBomRowPartsFromVendorPart(part: VwPart): SalesBomRowPart[] {
        const partNumber = String(part.PartNumber || part.partNumber || '').trim()
        if (!partNumber) {
            return []
        }
        const cost = this.roundBomMoney(part.SalesPrice ?? part.cost ?? 0)
        return [{
            bomRowPartId: this.createClientId(),
            deviceId: null,
            devicePartId: null,
            partId: String(part.partId || part.ProductID || '').trim() || null,
            vendorId: String(part.vendorId || '').trim() || null,
            vendorName: String(part.vendorName || part.sourceVendorName || part.brand || '').trim() || null,
            partNumber,
            description: String(part.LongDescription || part.description || '').trim(),
            parentCategory: String(part.ParentCategory || part.parentCategory || '').trim() || null,
            category: String(part.Category || part.category || '').trim() || null,
            msrp: Number(part.MSRPPrice ?? part.msrp ?? 0),
            cost,
            quantityPerDevice: 1
        }]
    }

    private createBomRowPartsFromDeviceMaterials(device: any, materials: VwDeviceMaterial[]): SalesBomRowPart[] {
        return (materials || []).map((material) => {
            const row = material as VwDeviceMaterial & {
                partNumber?: string
                description?: string
                materialCategoryName?: string
                msrp?: number
                cost?: number
            }
            return {
                bomRowPartId: this.createClientId(),
                deviceId: String(device?.deviceId || '').trim() || null,
                devicePartId: String(row.devicePartId || row.materialId || '').trim() || null,
                partId: String(row.partId || '').trim() || null,
                vendorId: String(row.vendorId || device?.vendorId || '').trim() || null,
                vendorName: String(row.vendorName || row.org || device?.vendorName || '').trim() || null,
                partNumber: String(row.materialPartNumber || row.partNumber || '').trim(),
                description: String(row.materialName || row.description || '').trim(),
                parentCategory: String(row.parentCategory || '').trim() || null,
                category: String(row.category || row.materialCategoryName || '').trim() || null,
                msrp: Number(row.materialMsrp ?? row.msrp ?? 0),
                cost: Number(row.materialCost ?? row.cost ?? 0),
                quantityPerDevice: Math.max(1, Math.floor(Number(row.quantityPerDevice || 1)))
            }
        }).filter((part) => !!part.partNumber)
    }

    private getBomDeviceDescription(device: any, parts: SalesBomRowPart[]): string {
        const deviceName = String(device?.name || device?.shortName || '').replace(/\s+/g, ' ').trim()
        const partDescription = this.getBomPartsDescription(parts)
        return [deviceName, partDescription]
            .filter(Boolean)
            .filter((value, index, values) => values.findIndex((candidate) => candidate.toLowerCase() === value.toLowerCase()) === index)
            .join(' - ')
    }

    private getBomRowPartDescription(row: SalesBomRow): string {
        return this.getBomPartsDescription(row.bomRowParts || [])
    }

    private getBomPartsDescription(parts: SalesBomRowPart[]): string {
        const seen = new Set<string>()
        return (parts || [])
            .map((part) => String(part.description || '').replace(/\s+/g, ' ').trim())
            .filter(Boolean)
            .filter((description) => {
                const key = description.toLowerCase()
                if (seen.has(key)) {
                    return false
                }
                seen.add(key)
                return true
            })
            .join('; ')
    }

    private getBomDescriptionWithParts(description: string, parts: SalesBomRowPart[]): string {
        const normalizedDescription = String(description || '').replace(/\s+/g, ' ').trim()
        const partDescription = this.getBomPartsDescription(parts)
        if (!partDescription || normalizedDescription.toLowerCase().includes(partDescription.toLowerCase())) {
            return normalizedDescription
        }
        return [normalizedDescription, partDescription].filter(Boolean).join(' - ')
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

    private async uploadFileToDocLibraryFolder(file: File, folderId: string, confirmVersion = false, thumbnailDataUrl = '', floorplanFolderId = ''): Promise<'uploaded' | 'versioned' | 'skipped'> {
        const duplicate = this.docLibraryFiles.find((item) =>
            item.folderId === folderId && this.projectDocLibraryStorage.hasSourceFileName(item, file.name))
        const now = new Date().toISOString()
        const projectKey = this.getDocLibraryStorageKey()

        if (duplicate) {
            const duplicateStorageKey = String(duplicate.storageKey || projectKey).trim() || projectKey
            const version = await this.projectDocLibraryStorage.uploadFileVersion(duplicateStorageKey, file, {
                fileId: duplicate.id,
                versionId: this.createClientId(),
                folderId,
                versionNumber: duplicate.versions.length + 1,
                lastModified: file.lastModified
            })
            version.thumbnailDataUrl = thumbnailDataUrl || version.thumbnailDataUrl
            duplicate.storageKey = duplicateStorageKey
            duplicate.versions.push(version)
            duplicate.updatedAt = now
            if (folderId === this.floorplansFolderId) {
                duplicate.floorplanFolderId = this.getValidFloorplanFolderId(floorplanFolderId)
            }
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
                sourceFileName: file.name,
                name: folderId === this.floorplansFolderId
                    ? this.projectDocLibraryStorage.getDisplayNameFromSourceFileName(file.name)
                    : file.name,
                extension: this.getDocLibraryExtension(file.name),
                createdAt: now,
                updatedAt: now,
                floorplanFolderId: folderId === this.floorplansFolderId
                    ? this.getValidFloorplanFolderId(floorplanFolderId)
                    : undefined,
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
            businessPointOfContactName: String(customerInfo?.businessPointOfContactName || '').trim(),
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
            businessPointOfContactName: '',
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
                ? section.rows.map((row: any) => {
                    const bomRowParts = this.cloneBomRowParts(row?.bomRowParts)
                    return {
                        id: String(row?.id || this.createClientId()),
                        deviceId: String(row?.deviceId || '').trim() || null,
                        partNbr: String(row?.partNbr || '').trim(),
                        lookupQuery: String(row?.partNbr || '').trim(),
                        description: this.getBomDescriptionWithParts(String(row?.description || '').trim(), bomRowParts),
                        qty: Number(row?.qty || 0),
                        cost: this.roundBomMoney(row?.cost),
                        labor: this.roundBomMoney(row?.labor),
                        includeOnFloorplan: this.normalizeBomRowFloorplanFlag(row),
                        type: String(row?.type || '').trim(),
                        iconId: String(row?.iconId || '').trim() || null,
                        iconLabel: String(row?.iconLabel || '').trim() || null,
                        iconDataUrl: String(row?.iconDataUrl || '').trim() || null,
                        iconForegroundColor: String(row?.iconForegroundColor || '').trim() || null,
                        shortName: String(row?.shortName || '').trim() || null,
                        floorplanLabelText: String(row?.floorplanLabelText || '').trim().slice(0, 4) || null,
                        customAttributes: this.cloneFloorplanSymbolAttributes(row?.customAttributes),
                        tags: this.cloneFloorplanSymbolTags(row?.tags),
                        mediaFiles: this.cloneFloorplanSymbolMediaFiles(row?.mediaFiles),
                        bomRowParts
                    }
                })
                : [this.createEmptyBomRow()]
        }))
    }

    private createEmptyBomRow(): SalesBomRow {
        return {
            id: this.createClientId(),
            deviceId: null,
            partNbr: '',
            lookupQuery: '',
            description: '',
            qty: 0,
            cost: 0,
            labor: 0,
            includeOnFloorplan: false,
            type: '',
            iconId: null,
            iconLabel: null,
            iconDataUrl: null,
            iconForegroundColor: null,
            shortName: null,
            floorplanLabelText: null,
            customAttributes: [],
            tags: [],
            mediaFiles: [],
            bomRowParts: []
        }
    }

    private buildWorksheetBomSections(source: SalesBomSection[] = this.bomSections): SalesBomSection[] {
        this.ensureBomRowIds()
        return (source || []).map((section) => ({
            title: String(section.title || '').trim(),
            sectionKey: String(section.sectionKey || this.createClientId()),
            vendorIds: Array.isArray(section.vendorIds) ? [...section.vendorIds] : [],
            vendorNames: Array.isArray(section.vendorNames) ? [...section.vendorNames] : [],
            rows: (section.rows || []).map((row) => ({
                id: String(row.id || this.createClientId()),
                deviceId: String(row.deviceId || '').trim() || null,
                partNbr: String(row.partNbr || '').trim(),
                description: this.getBomDescriptionWithParts(String(row.description || '').trim(), row.bomRowParts || []),
                qty: Number(row.qty || 0),
                cost: this.roundBomMoney(row.cost),
                labor: this.roundBomMoney(row.labor),
                includeOnFloorplan: !!row.includeOnFloorplan,
                type: String(row.type || '').trim(),
                iconId: row.iconId || null,
                iconLabel: row.iconLabel || null,
                iconDataUrl: row.iconDataUrl || null,
                iconForegroundColor: row.iconForegroundColor || null,
                shortName: row.shortName || null,
                floorplanLabelText: String(row.floorplanLabelText || '').trim().slice(0, 4) || null,
                customAttributes: this.cloneFloorplanSymbolAttributes(row.customAttributes),
                tags: this.cloneFloorplanSymbolTags(row.tags),
                mediaFiles: this.cloneFloorplanSymbolMediaFiles(row.mediaFiles),
                bomRowParts: this.cloneBomRowParts(row.bomRowParts)
            }))
        }))
    }

    private cloneBomRowParts(input: unknown): SalesBomRowPart[] {
        if (!Array.isArray(input)) {
            return []
        }
        return input.map((part: any) => ({
            bomRowPartId: String(part?.bomRowPartId || this.createClientId()),
            deviceId: String(part?.deviceId || '').trim() || null,
            devicePartId: String(part?.devicePartId || '').trim() || null,
            partId: String(part?.partId || '').trim() || null,
            vendorId: String(part?.vendorId || '').trim() || null,
            vendorName: String(part?.vendorName || '').trim() || null,
            partNumber: String(part?.partNumber || '').trim(),
            description: String(part?.description || '').trim(),
            parentCategory: String(part?.parentCategory || '').trim() || null,
            category: String(part?.category || '').trim() || null,
            msrp: typeof part?.msrp === 'undefined' || part?.msrp === null ? null : Number(part.msrp),
            cost: typeof part?.cost === 'undefined' || part?.cost === null ? null : Number(part.cost),
            quantityPerDevice: Math.max(1, Math.floor(Number(part?.quantityPerDevice || 1)))
        })).filter((part) => !!part.partNumber)
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
