import { CommonModule } from '@angular/common'
import { HttpClient } from '@angular/common/http'
import { Component, ElementRef, HostListener, Input, ViewChild, inject } from '@angular/core'
import { FormsModule } from '@angular/forms'
import { RouterLink } from '@angular/router'
import { firstValueFrom } from 'rxjs'

import { MatButtonModule } from '@angular/material/button'
import { MatCardModule } from '@angular/material/card'
import { MatFormFieldModule } from '@angular/material/form-field'
import { MatIconModule } from '@angular/material/icon'
import { MatInputModule } from '@angular/material/input'
import { MatSelectModule } from '@angular/material/select'

import { PageToolbar } from '../../common/components/page-toolbar'
import { ProjectSettingsCatalogSchema } from '../../schemas/project-settings.schema'
import { FIREWIRE_PROJECT_TYPE_OPTIONS, FirewireProjectSchema, FirewireProjectType } from '../../schemas/firewire-project.schema'
import { ProjectSettingsApi } from '../projects/project-settings.api'
import {
    ProjectDocLibraryFileRecord,
    ProjectDocLibraryFileVersionRecord,
    ProjectDocLibraryFolderDefinition,
    ProjectDocLibraryStorageService
} from '../../common/services/project-doc-library-storage.service'
import { DevicePartPriceSyncService } from '../../common/services/device-part-price-sync.service'
import { DeviceSetSummary, DeviceSetDetail } from '../../schemas/device-set.schema'
import { Category } from '../../schemas/category.schema'
import { VwDeviceMaterial } from '../../schemas/vwdevicematerial.schema'
import { VwDevice } from '../../schemas/vwdevice.schema'
import { VwEddyPricelist } from '../../schemas/vwEddyPricelist'

type SalesWorkspaceTab = 'PROJECT DETAILS' | 'CUSTOMER INFO' | 'BOM' | 'DOC LIBRARY'
type SalesBomSortKey = 'partNbr' | 'description' | 'qty' | 'cost' | 'extCost' | 'labor' | 'extLabor' | 'type'

interface SalesBomRow {
    partNbr: string
    description: string
    qty: number
    cost: number
    labor: number
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
        PageToolbar
    ],
    providers: [HttpClient],
    templateUrl: './sales-project.page.html',
    styleUrls: ['./sales-project.page.scss']
})
export class SalesProjectPage {
    @Input() projectId?: string

    @ViewChild('docLibraryUploadInput')
    docLibraryUploadInput?: ElementRef<HTMLInputElement>

    private readonly projectSettingsApi = inject(ProjectSettingsApi)
    private readonly projectDocLibraryStorage = inject(ProjectDocLibraryStorageService)
    private readonly devicePartPriceSync = inject(DevicePartPriceSyncService)
    readonly projectTypeOptions = FIREWIRE_PROJECT_TYPE_OPTIONS
    readonly workspaceTabs: SalesWorkspaceTab[] = ['PROJECT DETAILS', 'CUSTOMER INFO', 'BOM', 'DOC LIBRARY']
    readonly docLibraryFolders: ProjectDocLibraryFolderDefinition[] = this.projectDocLibraryStorage.getFolderDefinitions()
    readonly docLibraryImageTileMaxBytes = 4 * 1024 * 1024

    pageWorking = true
    saveWorking = false
    pageMessage = ''
    saveMessage = ''
    docLibraryStatusMessage = ''
    docLibraryUploadBusy = false
    activeTab: SalesWorkspaceTab = 'PROJECT DETAILS'
    selectedDocLibraryFolder = 'all'
    selectedDeviceSetId = ''
    project?: FirewireProjectSchema
    projectForm: SalesProjectForm = this.createDefaultForm()
    customerInfo: SalesCustomerInfo = this.createDefaultCustomerInfo()
    initialFormSnapshot = ''
    initialCustomerInfoSnapshot = ''
    initialBomSnapshot = '[]'
    projectSettings: ProjectSettingsCatalogSchema = {
        jobType: [],
        scopeType: [],
        projectScope: [],
        difficulty: [],
        projectStatus: []
    }
    docLibraryFiles: ProjectDocLibraryFileRecord[] = []
    deviceSets: DeviceSetSummary[] = []
    categories: Category[] = []
    bomSections: SalesBomSection[] = []
    bomFilter = ''
    bomSortKey: SalesBomSortKey = 'partNbr'
    bomSortDirection: 'asc' | 'desc' = 'asc'
    deviceRows: VwDevice[] = []
    deviceLookupLoaded = false
    vendorPartRows: VwEddyPricelist[] = []
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
            this.http.get<{ rows?: DeviceSetSummary[] }>('/api/firewire/device-sets').toPromise(),
            this.http.get<{ rows?: Category[] }>('/api/firewire/categories').toPromise()
        ]).then(async([projectResponse, deviceSetsResponse, categoriesResponse]) => {
            this.project = projectResponse?.data ? { ...projectResponse.data } : undefined
            this.deviceSets = Array.isArray(deviceSetsResponse?.rows)
                ? [...deviceSetsResponse.rows].sort((left, right) => String(left.name || '').localeCompare(String(right.name || '')))
                : []
            this.categories = Array.isArray(categoriesResponse?.rows) ? categoriesResponse.rows : []
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
    }

    onUploadDocsClick(): void {
        if (!this.docLibraryUploadInput?.nativeElement) {
            return
        }

        this.activeTab = 'DOC LIBRARY'
        this.docLibraryStatusMessage = ''

        if (this.selectedDocLibraryFolder === 'all') {
            this.docLibraryStatusMessage = 'Choose a document category before uploading.'
            return
        }

        this.docLibraryUploadInput.nativeElement.click()
    }

    async saveProjectDetails(): Promise<void> {
        if (!this.projectId || !this.project) {
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
        const allCount = this.docLibraryFiles.length
        return [
            { id: 'all', label: 'All Documents', itemCount: allCount },
            ...this.docLibraryFolders.map((folder) => ({
                id: folder.id,
                label: folder.label,
                itemCount: this.docLibraryFiles.filter((file) => file.folderId === folder.id).length
            }))
        ]
    }

    getDocLibraryVisibleFiles(): ProjectDocLibraryFileRecord[] {
        if (this.selectedDocLibraryFolder === 'all') {
            return this.docLibraryFiles
        }
        return this.docLibraryFiles.filter((file) => file.folderId === this.selectedDocLibraryFolder)
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
        return mimeType.startsWith('image/') && Number(version?.sizeBytes || 0) <= this.docLibraryImageTileMaxBytes && !!version?.dataUrl
    }

    canEditDocLibraryMarkup(file: ProjectDocLibraryFileRecord): boolean {
        const version = this.getLatestDocLibraryVersion(file)
        return file.folderId === 'drawings'
            && String(version?.mimeType || '').toLowerCase().startsWith('image/')
            && !!version?.dataUrl
            && !!this.getDocLibraryStorageKey()
    }

    getDocLibraryMarkupLink(file: ProjectDocLibraryFileRecord): any[] {
        return ['/edit-markup']
    }

    getDocLibraryMarkupQueryParams(file: ProjectDocLibraryFileRecord): Record<string, string> {
        return {
            projectKey: this.getDocLibraryStorageKey(),
            bomProjectKey: this.projectId || this.project?.uuid || this.getDocLibraryStorageKey(),
            fileId: file.id,
            returnTo: `/sales/${this.projectId || this.project?.uuid || ''}`
        }
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
        return this.docLibraryFolders.find((folder) => folder.id === folderId)?.label || 'Unfiled'
    }

    getBomRowExtCost(row: SalesBomRow): number {
        return Number(row.qty || 0) * Number(row.cost || 0)
    }

    getBomRowExtLabor(row: SalesBomRow): number {
        return Number(row.qty || 0) * Number(row.labor || 0)
    }

    getBomSectionGrandTotal(section: SalesBomSection): number {
        return section.rows.reduce((sum, row) => sum + this.getBomRowExtCost(row) + this.getBomRowExtLabor(row), 0)
    }

    getBomGrandTotal(): number {
        return this.bomSections.reduce((sum, section) => sum + this.getBomSectionGrandTotal(section), 0)
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
                    `${this.getBomRowExtLabor(row)}`
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
        row.lookupQuery = String(row.lookupQuery || row.partNbr || '').trim()
        globalThis.setTimeout(() => {
            if (this.activeBomLookupSectionKey === String(section.sectionKey || '') && this.activeBomLookupRow === row) {
                this.closeBomPartLookup()
            }
        }, 120)
    }

    onBomPartLookupChanged(section: SalesBomSection, row: SalesBomRow, value: string): void {
        row.lookupQuery = value
        this.activeBomLookupSectionKey = String(section.sectionKey || '')
        this.activeBomLookupRow = row
        this.positionBomPartLookup()
    }

    isBomLookupActive(section: SalesBomSection, row: SalesBomRow): boolean {
        return this.activeBomLookupSectionKey === String(section.sectionKey || '') && this.activeBomLookupRow === row
    }

    getBomPartLookupResults(section: SalesBomSection, row: SalesBomRow): VwEddyPricelist[] {
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

    selectBomPart(section: SalesBomSection, row: SalesBomRow, part: VwEddyPricelist): void {
        const category = this.getCategoryByName(String(part.Category || '').trim())
        row.partNbr = String(part.PartNumber || '').trim()
        row.lookupQuery = row.partNbr
        row.description = String(part.LongDescription || '').trim()
        row.cost = Number(part.SalesPrice || part.MSRPPrice || 0)
        row.type = category?.includeOnFloorplan ? String(category.name || part.Category || '').trim() : ''
        row.labor = this.getInstallationLaborCost(Number(category?.defaultLabor || 0))
        this.closeBomPartLookup()
        this.saveMessage = category
            ? `Loaded ${row.partNbr} from vendor parts.`
            : `Loaded ${row.partNbr}. Category ${String(part.Category || '').trim() || 'Unknown'} is not configured yet.`
    }

    selectBomDevice(section: SalesBomSection, row: SalesBomRow, device: VwDevice): void {
        const includeOnFloorplan = this.getCategoryIncludeOnFloorplan(device.categoryId, device.categoryName)
        const partNumber = String(device.partNumber || '').trim()
        row.partNbr = partNumber
        row.lookupQuery = partNumber
        row.description = String(device.name || device.shortName || '').trim()
        row.cost = Number(device.cost || 0)
        row.type = includeOnFloorplan ? String(device.categoryName || '').trim() : ''
        row.labor = this.getInstallationLaborCost(Number(device.defaultLabor || 0))
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

        const blob = this.dataUrlToBlob(version.dataUrl)
        const url = URL.createObjectURL(blob)
        const link = document.createElement('a')
        link.href = url
        link.download = version.sourceFileName || file.name
        link.click()
        URL.revokeObjectURL(url)
    }

    async onDocLibraryFileSelected(event: Event): Promise<void> {
        const input = event.target as HTMLInputElement | null
        if (!input?.files?.length) {
            return
        }

        if (this.selectedDocLibraryFolder === 'all') {
            this.docLibraryStatusMessage = 'Choose a document category before uploading.'
            input.value = ''
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
    }

    private async persistDocLibraryWorkspace(): Promise<void> {
        const key = this.getDocLibraryStorageKey()
        if (!key) {
            return
        }

        await this.projectDocLibraryStorage.saveWorkspace(key, {
            files: this.docLibraryFiles
        })
    }

    private getDocLibraryStorageKey(): string {
        return String(this.projectId || this.project?.uuid || '').trim()
    }

    private createBomRowsFromDevice(device: any, materials: VwDeviceMaterial[], vendorPartMap?: Map<string, VwEddyPricelist>): SalesBomRow[] {
        const includeOnFloorplan = this.getCategoryIncludeOnFloorplan(device.categoryId, device.categoryName)
        const typeValue = includeOnFloorplan ? String(device.categoryName || '').trim() : ''

        if (!materials.length) {
            const partNumber = String(device.partNumber || '').trim()
            return [{
                partNbr: partNumber,
                lookupQuery: partNumber,
                description: String(device.name || '').trim(),
                qty: 0,
                cost: this.getCurrentVendorPrice(partNumber, vendorPartMap, Number(device.cost || 0)),
                labor: this.getInstallationLaborCost(Number(device.defaultLabor || 0)),
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
                cost: this.getCurrentVendorPrice(partNumber, vendorPartMap, Number(material.materialCost || material.cost || device.cost || 0)),
                labor: index === 0 ? this.getInstallationLaborCost(Number(device.defaultLabor || material.materialDefaultLabor || 0)) : 0,
                type: typeValue
            }
        })
    }

    private getInstallationLaborCost(hours: number): number {
        return Number(hours || 0) * this.getInstallationLaborRate()
    }

    private getInstallationLaborRate(): number {
        const rates = Array.isArray(this.project?.worksheetData?.laborRates)
            ? this.project?.worksheetData?.laborRates
            : []
        const installationRate = rates.find((row: any) => String(row?.label || '').trim().toLowerCase() === 'installation')
        return Number(installationRate?.effectiveRate || installationRate?.payRate || 56)
    }

    private getCurrentVendorPrice(partNumber: string, vendorPartMap: Map<string, VwEddyPricelist> | undefined, fallbackCost: number): number {
        const vendorPart = vendorPartMap?.get(this.devicePartPriceSync.normalizePartNumber(partNumber))
        return vendorPart ? this.devicePartPriceSync.getVendorPartPrice(vendorPart) : Number(fallbackCost || 0)
    }

    private getCategoryIncludeOnFloorplan(categoryId: string | null | undefined, categoryName: string | null | undefined): boolean {
        return Boolean(this.getCategoryMatch(categoryId, categoryName)?.includeOnFloorplan)
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
        const folderId = this.selectedDocLibraryFolder
        if (!folderId || folderId === 'all') {
            throw new Error('Choose a document category before uploading.')
        }

        const duplicate = this.docLibraryFiles.find((item) =>
            item.folderId === folderId && item.name.toLowerCase() === file.name.toLowerCase())
        const now = new Date().toISOString()
        const dataUrl = await this.readFileAsDataUrl(file)

        if (duplicate) {
            duplicate.versions.push({
                id: this.createClientId(),
                versionNumber: duplicate.versions.length + 1,
                uploadedAt: now,
                uploadedBy: 'Current User',
                sourceFileName: file.name,
                sizeBytes: file.size,
                mimeType: file.type || 'application/octet-stream',
                lastModified: file.lastModified,
                dataUrl
            })
            duplicate.updatedAt = now
            return 'versioned'
        }

        this.docLibraryFiles = [
            {
                id: this.createClientId(),
                folderId,
                name: file.name,
                extension: this.getDocLibraryExtension(file.name),
                createdAt: now,
                updatedAt: now,
                versions: [
                    {
                        id: this.createClientId(),
                        versionNumber: 1,
                        uploadedAt: now,
                        uploadedBy: 'Current User',
                        sourceFileName: file.name,
                        sizeBytes: file.size,
                        mimeType: file.type || 'application/octet-stream',
                        lastModified: file.lastModified,
                        dataUrl
                    }
                ]
            },
            ...this.docLibraryFiles
        ]
        return 'uploaded'
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
                    cost: Number(row?.cost || 0),
                    labor: Number(row?.labor || 0),
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
                cost: Number(row.cost || 0),
                labor: Number(row.labor || 0),
                type: String(row.type || '').trim()
            }))
        }))
    }

    private getCategoryByName(categoryName: string): Category | undefined {
        return this.getCategoryMatch(undefined, categoryName)
    }

    private getCategoryMatch(categoryId?: string | null, categoryName?: string | null): Category | undefined {
        const normalizedCategoryId = String(categoryId || '').trim().toLowerCase()
        const normalizedCategoryName = String(categoryName || '').trim().toLowerCase()
        return this.categories.find((category) =>
            String(category.categoryId || '').trim().toLowerCase() === normalizedCategoryId
            || String(category.name || '').trim().toLowerCase() === normalizedCategoryName)
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
                    : firstValueFrom(this.http.get<{ rows?: VwEddyPricelist[] }>('/api/firewire/vweddypricelist')),
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
}
