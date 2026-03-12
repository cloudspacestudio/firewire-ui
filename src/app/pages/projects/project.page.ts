import { Component, Input, OnChanges, SimpleChanges, inject } from "@angular/core"
import { NgFor, NgIf } from '@angular/common'
import { Router, RouterLink } from "@angular/router"
import { CommonModule } from "@angular/common"
import { HttpClient } from "@angular/common/http"
import { FormsModule } from "@angular/forms"
import { map, Observable } from "rxjs"

import { MatButtonModule } from "@angular/material/button"
import { MatButtonToggleModule } from "@angular/material/button-toggle"
import { MatCardModule } from "@angular/material/card"
import { MatChipsModule } from "@angular/material/chips"
import { MatDialog } from "@angular/material/dialog"
import { MatFormFieldModule } from "@angular/material/form-field"
import { MatIconModule } from "@angular/material/icon"
import { MatInputModule } from "@angular/material/input"
import { MatDatepickerModule } from "@angular/material/datepicker"
import { MatSelectModule } from "@angular/material/select"

import { Utils } from "../../common/utils"
import { AccountProjectAttributes, AccountProjectSchema } from "../../schemas/account.project.schema"
import { AccountProjectStatSchema } from "../../schemas/account.projectstat.schema"
import { FirewireProjectSchema, FirewireProjectUpsert } from "../../schemas/firewire-project.schema"
import { ProjectSettingsCatalogSchema } from "../../schemas/project-settings.schema"
import { ProjectSource } from "../../schemas/project-list-item.schema"
import { PageToolbar } from '../../common/components/page-toolbar'
import { ConfirmFirewireNavigationDialog } from "./confirm-firewire-navigation.dialog"
import { ProjectSettingsApi } from "./project-settings.api"
import { ReducedResponse, Reducer } from "../../common/reducer"

interface ProjectBomRow {
    partNbr: string
    description: string
    qty: number
    cost: number
    labor: number
    type: string
}

interface ProjectBomSection {
    title: string
    rows: ProjectBomRow[]
}

type ProjectBomSortKey = 'partNbr' | 'description' | 'qty' | 'cost' | 'extCost' | 'labor' | 'extLabor' | 'type'

interface LaborRateRow {
    label: string
    payRate: number
    effectiveRate: number
}

interface InstallationOvertimeForm {
    installRateMarkup: number
    percentTotalInstallHours: number
    overtimeRate: number
    overtimeEffectiveRate: number
    supervisionFactorPercent: number
    mobilizationFactorPercent: number
}

type TakeoffValue = number | null

interface TakeoffMatrix {
    title: string
    rows: string[]
    values: Record<string, Record<string, TakeoffValue>>
}

interface DocLibraryFolder {
    id: string
    label: string
    itemCount: number
    badge?: string
}

interface DocLibraryFile {
    id: string
    folderId: string
    name: string
    extension: string
    category: string
    sizeBytes: number
    modifiedAt: string
    modifiedBy: string
    checkedOutTo?: string
    status: 'Synced' | 'Needs Review' | 'Draft'
}

@Component({
    standalone: true,
    selector: 'project-page',
    imports: [NgFor, NgIf, CommonModule, FormsModule,
        RouterLink, PageToolbar,
        MatButtonModule, MatFormFieldModule,
        MatInputModule, MatSelectModule, MatButtonToggleModule, MatDatepickerModule,
        MatChipsModule, MatIconModule, MatCardModule],
    providers: [HttpClient],
    templateUrl: './project.page.html',
    styleUrls: ['./project.page.scss']
})
export class ProjectPage implements OnChanges {
    private dialog = inject(MatDialog)
    private router = inject(Router)

    @Input() projectId?: string
    @Input() projectSource: ProjectSource = 'fieldwire'
    @Input() workspaceTab?: string

    pageWorking = true
    project?: AccountProjectSchema
    firewireProject?: FirewireProjectSchema
    fieldwireProjectId: string | null = null
    fieldwireProjects: AccountProjectSchema[] = []
    firewireForm: FirewireProjectUpsert = this.createEmptyFirewireForm()
    firewireBidDueDate: Date | null = null
    initialFirewireFormState = ''
    firewireSaveWorking = false
    firewireSaveMessage = ''
    projectSettings: ProjectSettingsCatalogSchema = {
        jobType: [],
        scopeType: [],
        projectScope: [],
        difficulty: [],
        projectStatus: []
    }

    stats?: ReducedResponse
    folders?: ReducedResponse
    floorplans?: ReducedResponse
    sheets?: ReducedResponse
    statuses?: ReducedResponse
    locations?: ReducedResponse
    teams?: ReducedResponse
    tasks?: ReducedResponse
    attachments?: ReducedResponse
    taskAttributes?: ReducedResponse
    taskCheckItems?: ReducedResponse
    taskTypeAttributes?: ReducedResponse

    reducer: Reducer = new Reducer()

    tab: string = 'STATS'
    tabs: string[] = []
    readonly fieldwireTabs = [
        'OVERVIEW', 'STATS', 'FOLDERS', 'FLOORPLANS', 'SHEETS',
        'STATUSES', 'LOCATIONS', 'TEAMS', 'TASKS', 'ATTACHMENTS',
        'TASK TYPE ATTRIBUTES',
        'TASK ATTRIBUTES', 'TASK CHECK ITEMS'
    ]
    readonly firewireTabs = ['OVERVIEW']
    layout: string = 'Tabular'
    layouts = ['Tabular', 'Raw']
    readonly baseFirewireWorkspaceTabs = [
        'PROJECT DETAILS',
        'WORKING HEIGHTS',
        'LABOR RATES',
        'TAKE OFF',
        'BOM',
        'EXPENSES',
        'SUMMARY',
        'DOC LIBRARY',
        'SYSTEM'
    ]
    activeFirewireWorkspaceTab = 'PROJECT DETAILS'
    wageScaleJob = false
    wageScaleEffectiveRate = 0
    laborRates: LaborRateRow[] = [
        { label: 'Project Management', payRate: 42, effectiveRate: 84 },
        { label: 'CAD Design', payRate: 40, effectiveRate: 80 },
        { label: 'Technical Labor', payRate: 28, effectiveRate: 56 },
        { label: 'Administration', payRate: 20, effectiveRate: 40 },
        { label: 'Supervision', payRate: 42, effectiveRate: 84 },
        { label: 'Installation', payRate: 28, effectiveRate: 56 }
    ]
    installationOvertime: InstallationOvertimeForm = {
        installRateMarkup: 0,
        percentTotalInstallHours: 0,
        overtimeRate: 28,
        overtimeEffectiveRate: 0,
        supervisionFactorPercent: 5,
        mobilizationFactorPercent: 5
    }
    readonly docLibraryFolders: DocLibraryFolder[] = [
        { id: 'all', label: 'All Documents', itemCount: 14, badge: 'LIVE' },
        { id: 'estimates', label: 'Estimating', itemCount: 5 },
        { id: 'submittals', label: 'Submittals', itemCount: 3 },
        { id: 'drawings', label: 'Drawings', itemCount: 2 },
        { id: 'contracts', label: 'Contracts', itemCount: 2 },
        { id: 'photos', label: 'Site Photos', itemCount: 2 }
    ]
    selectedDocLibraryFolder = 'all'
    readonly docLibraryFiles: DocLibraryFile[] = [
        { id: 'doc-001', folderId: 'estimates', name: 'Fire Alarm Narrative v3', extension: 'DOCX', category: 'Scope Narrative', sizeBytes: 184320, modifiedAt: '2026-03-10T15:42:00Z', modifiedBy: 'Steven Sederburg', status: 'Needs Review' },
        { id: 'doc-002', folderId: 'estimates', name: 'Equipment Count Worksheet', extension: 'XLSX', category: 'Estimate Workbook', sizeBytes: 426188, modifiedAt: '2026-03-12T13:18:00Z', modifiedBy: 'Steven Sederburg', status: 'Synced' },
        { id: 'doc-003', folderId: 'estimates', name: 'Bid Scope Clarifications', extension: 'PDF', category: 'Clarifications', sizeBytes: 98214, modifiedAt: '2026-03-08T18:04:00Z', modifiedBy: 'Alicia West', status: 'Draft' },
        { id: 'doc-004', folderId: 'estimates', name: 'Sequence of Operations', extension: 'DOCX', category: 'Operations', sizeBytes: 241222, modifiedAt: '2026-03-07T11:26:00Z', modifiedBy: 'Alicia West', status: 'Synced' },
        { id: 'doc-005', folderId: 'estimates', name: 'RFI Tracker', extension: 'XLSX', category: 'Coordination', sizeBytes: 128744, modifiedAt: '2026-03-05T21:12:00Z', modifiedBy: 'Jeremy Cole', status: 'Needs Review' },
        { id: 'doc-006', folderId: 'submittals', name: 'Device Cut Sheet Package', extension: 'PDF', category: 'Submittal Package', sizeBytes: 1384210, modifiedAt: '2026-03-11T16:55:00Z', modifiedBy: 'Jeremy Cole', status: 'Synced' },
        { id: 'doc-007', folderId: 'submittals', name: 'Battery Calculation', extension: 'XLSX', category: 'Engineering', sizeBytes: 84121, modifiedAt: '2026-03-09T14:10:00Z', modifiedBy: 'Mina Patel', status: 'Draft' },
        { id: 'doc-008', folderId: 'submittals', name: 'Voltage Drop Review', extension: 'PDF', category: 'Engineering', sizeBytes: 224911, modifiedAt: '2026-03-06T09:38:00Z', modifiedBy: 'Mina Patel', status: 'Synced' },
        { id: 'doc-009', folderId: 'drawings', name: 'Floor Plan Markups', extension: 'PDF', category: 'Drawings', sizeBytes: 2629014, modifiedAt: '2026-03-12T08:02:00Z', modifiedBy: 'Alicia West', checkedOutTo: 'Field Team', status: 'Needs Review' },
        { id: 'doc-010', folderId: 'drawings', name: 'Riser Diagram Draft', extension: 'DWG', category: 'Drawings', sizeBytes: 5341200, modifiedAt: '2026-03-04T19:48:00Z', modifiedBy: 'Mina Patel', status: 'Draft' },
        { id: 'doc-011', folderId: 'contracts', name: 'Proposal Letter', extension: 'PDF', category: 'Commercial', sizeBytes: 145229, modifiedAt: '2026-03-03T17:44:00Z', modifiedBy: 'Steven Sederburg', status: 'Synced' },
        { id: 'doc-012', folderId: 'contracts', name: 'Owner Contract Review', extension: 'DOCX', category: 'Commercial', sizeBytes: 110411, modifiedAt: '2026-03-02T20:19:00Z', modifiedBy: 'Steven Sederburg', status: 'Needs Review' },
        { id: 'doc-013', folderId: 'photos', name: 'Site Walk Photos', extension: 'ZIP', category: 'Field Capture', sizeBytes: 8421994, modifiedAt: '2026-03-01T23:13:00Z', modifiedBy: 'Field Ops', status: 'Synced' },
        { id: 'doc-014', folderId: 'photos', name: 'Equipment Room Reference', extension: 'JPG', category: 'Reference Photo', sizeBytes: 742188, modifiedAt: '2026-02-28T22:07:00Z', modifiedBy: 'Field Ops', status: 'Synced' }
    ]
    readonly takeoffColumns = [
        'FACP',
        'Annunciator',
        'Smoke Det',
        'MR101/C Relay',
        'Duct Det',
        'AHU Shut Down Relay',
        'Remote Test Switch (Key)',
        'Heat Det',
        'Pull Station',
        'CT1',
        'CT2',
        'CR',
        'CC1',
        'Horn/Strobe - Ceiling',
        'Strobe - Ceiling',
        'WP Horn/Strobe - Wall',
        'Horn',
        'BPS',
        'Elevator Relays',
        'Shunt (CC1 + MR101)',
        'Sprinkler Bell',
        'BPS'
    ]
    takeoffMatrices: TakeoffMatrix[] = [
        this.createTakeoffMatrix('Matrix 1', [
            'A-101',
            'A-102',
            'A-103',
            'A-104',
            'M-201',
            'M-202',
            'M-203',
            'M-204',
            'M-205',
            'Nothing in Garage'
        ]),
        this.createTakeoffMatrix('Matrix 2', [
            'Level 1',
            'Level 2',
            'Level 3',
            'Roof'
        ])
    ]
    bomSections: ProjectBomSection[] = [
        {
            title: 'EST EQUIPMENT',
            rows: [
                { partNbr: 'HS-24MCW', description: 'Horn Strobe Wall Mount', qty: 24, cost: 86.5, labor: 42, type: 'Notification' },
                { partNbr: 'SD505-APS', description: 'Addressable Smoke Detector', qty: 48, cost: 32.75, labor: 18, type: 'Initiating' },
                { partNbr: 'MS-7CAF', description: 'Manual Pull Station', qty: 12, cost: 41.2, labor: 22, type: 'Initiating' },
                { partNbr: 'N16X', description: 'Fire Alarm Control Panel', qty: 1, cost: 2895, labor: 520, type: 'Head End' }
            ]
        },
        {
            title: 'Special Items not EST',
            rows: [
                { partNbr: 'RPS-1000', description: 'Remote Power Supply', qty: 3, cost: 418.95, labor: 110, type: 'Power' },
                { partNbr: 'CELL-COMM', description: 'Cellular Communicator', qty: 1, cost: 612.4, labor: 135, type: 'Communications' }
            ]
        },
        {
            title: 'Special Items Cooper Notification',
            rows: [
                { partNbr: 'COOP-STROBE', description: 'Cooper High Candela Strobe', qty: 16, cost: 97.25, labor: 46, type: 'Notification' },
                { partNbr: 'COOP-HORN', description: 'Cooper Low Frequency Horn', qty: 10, cost: 88.75, labor: 44, type: 'Notification' }
            ]
        }
    ]
    bomFilter = ''
    bomSortKey: ProjectBomSortKey = 'partNbr'
    bomSortDirection: 'asc' | 'desc' = 'asc'
    selectedFloorplanId: string = ''
    selectedTeamId: string = ''
    selectedTemplate = 'Default'
    projectDocumentUploadBusy = false
    projectDocumentUploadMessage = ''

    constructor(private http: HttpClient, private projectSettingsApi: ProjectSettingsApi) {}

    ngOnChanges(changes: SimpleChanges): void {
        if (!changes['projectId'] && !changes['projectSource'] && changes['workspaceTab']) {
            this.applyWorkspaceTabFromRoute()
            this.ensureValidWorkspaceTabRoute()
            return
        }

        this.resetPageState()
        this.applyWorkspaceTabFromRoute()
        this.loadProjectSettings()
        this.loadFieldwireProjects()

        if (!this.projectId) {
            console.error(`Invalid Project Id`)
            this.pageWorking = false
            return
        }

        if (this.shouldLoadFirewireProject()) {
            this.loadFirewireProject()
            return
        }

        this.loadFieldwireProject()
    }

    isFirewireProject(): boolean {
        return !!this.firewireProject
    }

    shouldLoadFirewireProject(): boolean {
        return this.projectSource === 'firewire'
    }

    hasFieldwireProject(): boolean {
        return !!this.project && !!this.fieldwireProjectId
    }

    getPageTitle(): string {
        return this.firewireProject?.name || this.project?.name || 'Project'
    }

    getFirewireWorkspaceTabs(): string[] {
        if (!this.hasFieldwireProject()) {
            return [...this.baseFirewireWorkspaceTabs]
        }
        const tabs = [...this.baseFirewireWorkspaceTabs]
        const systemIndex = tabs.indexOf('SYSTEM')
        tabs.splice(systemIndex, 0, 'FIELDWIRE VIEW')
        return tabs
    }

    getFirewireDetailRoute(): string[] {
        if (this.firewireProject?.uuid) {
            return ['/projects', 'firewire', this.firewireProject.uuid, this.getActiveWorkspaceTabSlug()]
        }
        if (this.project?.id) {
            return ['/projects', 'fieldwire', this.project.id, this.getActiveWorkspaceTabSlug()]
        }
        return ['/projects']
    }

    getSelectedFieldwireProjectName(): string {
        if (!this.firewireForm.fieldwireId) {
            return 'Not linked'
        }
        const selected = this.fieldwireProjects.find((project) => String(project.id) === this.firewireForm.fieldwireId)
        return selected?.name || this.firewireForm.fieldwireId
    }

    get isFirewireFormDirty(): boolean {
        if (!this.firewireProject) {
            return false
        }
        return this.initialFirewireFormState !== this.serializeFirewireForm(this.firewireForm)
    }

    getDocLibraryProjectKey(): string {
        return this.firewireProject?.projectNbr?.trim() || this.firewireForm.projectNbr?.trim() || 'UNASSIGNED'
    }

    getDocLibraryVisibleFiles(): DocLibraryFile[] {
        if (this.selectedDocLibraryFolder === 'all') {
            return this.docLibraryFiles
        }
        return this.docLibraryFiles.filter((file) => file.folderId === this.selectedDocLibraryFolder)
    }

    getSelectedDocLibraryFolderLabel(): string {
        return this.docLibraryFolders.find((folder) => folder.id === this.selectedDocLibraryFolder)?.label || 'All Documents'
    }

    getDocLibraryStatusCount(status: DocLibraryFile['status']): number {
        return this.getDocLibraryVisibleFiles().filter((file) => file.status === status).length
    }

    getDocLibraryTotalBytes(): number {
        return this.getDocLibraryVisibleFiles().reduce((sum, file) => sum + file.sizeBytes, 0)
    }

    selectDocLibraryFolder(folderId: string) {
        this.selectedDocLibraryFolder = folderId
    }

    setTab(event:any) {
        if (!this.hasFieldwireProject()) {
            return
        }
        switch(this.tab) {
            case 'STATS':
                return this._loadStats()
            case 'FOLDERS':
                return this._loadFolders()
            case 'FLOORPLANS':
                return this._loadFloorplans()
            case 'SHEETS':
                return this._loadSheets()
            case 'STATUSES':
                return this._loadStatuses()
            case 'LOCATIONS':
                return this._loadLocations()
            case 'TEAMS':
                return this._loadTeams()
            case 'TASKS':
                return this._loadTasks()
            case 'TASK TYPE ATTRIBUTES':
                return this._loadTaskTypeAttributes()
            case 'TASK ATTRIBUTES':
                return this._loadTaskAttributes()
            case 'ATTACHMENTS':
                return this._loadAttachments()
            case 'TASK CHECK ITEMS':
                return this._loadTaskCheckItems()
            default:
                return
        }
    }

    setLayout(input: string) {
        if (this.layouts.indexOf(input)<0 || input===this.layout) {
            return
        }
        this.layout = input
    }

    setFirewireWorkspaceTab(tabName: string) {
        if (this.getFirewireWorkspaceTabs().indexOf(tabName) < 0) {
            return
        }
        this.activeFirewireWorkspaceTab = tabName
        this.navigateToWorkspaceTab(tabName)
    }

    toLocalDateTimeString(input: Date|string) {
        return Utils.toLocalString(input)
    }

    formatDocLibraryBytes(input: number): string {
        if (input >= 1024 * 1024 * 1024) {
            return `${(input / (1024 * 1024 * 1024)).toFixed(2)} GB`
        }
        if (input >= 1024 * 1024) {
            return `${(input / (1024 * 1024)).toFixed(2)} MB`
        }
        if (input >= 1024) {
            return `${Math.round(input / 1024)} KB`
        }
        return `${input} B`
    }

    getActiveSettings(listKey: keyof ProjectSettingsCatalogSchema) {
        return (this.projectSettings[listKey] || []).filter((item) => item.isActive)
    }

    toDateInputValue(input: string | null | undefined) {
        if (!input) {
            return ''
        }
        const parsed = new Date(input)
        if (Number.isNaN(parsed.getTime())) {
            return ''
        }
        return parsed.toISOString().slice(0, 10)
    }

    onBidDueDateChange(value: Date | null) {
        this.firewireBidDueDate = value
        this.firewireForm.bidDueDate = this.formatDateOnlyValue(value)
    }

    getProjectAttrs(input: AccountProjectSchema) {
        if (!input || !input.project_attributes || input.project_attributes.length <= 0) {
            return ''
        }
        const output = input.project_attributes.map((attr: AccountProjectAttributes) => {
            return attr.name
        })
        return output.join(', ')
    }

    getGoogleMapLink(line: string) {
        return Utils.getGoogleMapLink(line)
    }

    jsonify(input: any) {
        return JSON.stringify(input, null, 1)
    }

    asCardRows(input: any): any[] {
        if (Array.isArray(input)) {
            return input
        }
        if (input === null || typeof input === 'undefined') {
            return []
        }
        return [input]
    }

    getCardEntries(row: any): Array<{ key: string; value: any }> {
        if (!row || typeof row !== 'object') {
            return []
        }
        return Object.keys(row)
            .filter((key) => !this.isGuidValue(row[key]))
            .map((key) => {
                return {
                    key,
                    value: row[key]
                }
            })
    }

    formatCardKey(key: string): string {
        if (typeof key !== 'string') {
            return ''
        }
        return key.replace(/_/g, ' ')
    }

    isThumbUrlField(key: string): boolean {
        if (typeof key !== 'string') {
            return false
        }
        return key.trim().toUpperCase() === 'THUMB_URL'
    }

    getCardTitle(row: any, index: number): string {
        if (row && typeof row === 'object') {
            if (typeof row.name === 'string' && row.name.trim().length > 0) {
                return row.name
            }
            if (typeof row.id === 'string' && row.id.trim().length > 0) {
                return `Item ${index + 1}: ${row.id}`
            }
            if (typeof row.uuid === 'string' && row.uuid.trim().length > 0) {
                return `Item ${index + 1}: ${row.uuid}`
            }
        }
        return `Item ${index + 1}`
    }

    formatCardValue(value: any): string {
        if (value === null || typeof value === 'undefined') {
            return ''
        }
        const parsedDate = this.tryParseDate(value)
        if (parsedDate) {
            return new Intl.DateTimeFormat(undefined, {
                dateStyle: 'short',
                timeStyle: 'short'
            }).format(parsedDate)
        }
        if (typeof value === 'string') {
            return value
        }
        if (typeof value === 'number' || typeof value === 'boolean') {
            return `${value}`
        }
        if (value instanceof Date) {
            return this.toLocalDateTimeString(value)
        }
        try {
            return JSON.stringify(value)
        } catch {
            return `${value}`
        }
    }

    getBomRowExtCost(row: ProjectBomRow): number {
        return Number(row.qty || 0) * Number(row.cost || 0)
    }

    getBomRowExtLabor(row: ProjectBomRow): number {
        return Number(row.qty || 0) * Number(row.labor || 0)
    }

    getBomSectionGrandTotal(section: ProjectBomSection): number {
        return section.rows.reduce((sum, row) => sum + this.getBomRowExtCost(row) + this.getBomRowExtLabor(row), 0)
    }

    getBomGrandTotal(): number {
        return this.bomSections.reduce((sum, section) => sum + this.getBomSectionGrandTotal(section), 0)
    }

    getFilteredBomRows(section: ProjectBomSection): ProjectBomRow[] {
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

    setBomSort(sortKey: ProjectBomSortKey) {
        if (this.bomSortKey === sortKey) {
            this.bomSortDirection = this.bomSortDirection === 'asc' ? 'desc' : 'asc'
            return
        }
        this.bomSortKey = sortKey
        this.bomSortDirection = 'asc'
    }

    isBomSortActive(sortKey: ProjectBomSortKey): boolean {
        return this.bomSortKey === sortKey
    }

    exportBomCsv() {
        const headers = ['PART NBR', 'DESCRIPTION', 'QTY', 'COST', 'EXT COST', 'LABOR', 'EXT LABOR', 'TYPE']
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
                        this.toCsvCell(row.cost.toFixed(2)),
                        this.toCsvCell(this.getBomRowExtCost(row).toFixed(2)),
                        this.toCsvCell(row.labor.toFixed(2)),
                        this.toCsvCell(this.getBomRowExtLabor(row).toFixed(2)),
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
        anchor.download = `${(this.firewireProject?.name || 'project-bom').replace(/[^a-z0-9]+/gi, '-').toLowerCase()}.csv`
        anchor.click()
        URL.revokeObjectURL(url)
    }

    onWageScaleJobChange(value: boolean) {
        this.wageScaleJob = value
        if (!value) {
            this.wageScaleEffectiveRate = 0
        }
    }

    syncInstallationOvertimeRate() {
        const installationRate = this.laborRates.find((row) => row.label === 'Installation')
        this.installationOvertime.overtimeRate = installationRate?.payRate || 0
    }

    getTakeoffCellValue(matrix: TakeoffMatrix, rowKey: string, columnKey: string): string {
        const value = matrix.values[rowKey]?.[columnKey]
        return value === null || typeof value === 'undefined' ? '' : `${value}`
    }

    setTakeoffCellValue(matrix: TakeoffMatrix, rowKey: string, columnKey: string, rawValue: string | number | null) {
        const normalizedValue =
            rawValue === null || typeof rawValue === 'undefined'
                ? ''
                : typeof rawValue === 'number'
                    ? `${rawValue}`
                    : `${rawValue}`

        const trimmed = normalizedValue.trim()
        const nextValue = !trimmed
            ? null
            : Number.isNaN(Number(trimmed))
                ? matrix.values[rowKey]?.[columnKey] ?? null
                : Math.max(0, Math.min(99, Math.trunc(Number(trimmed))))

        if (!matrix.values[rowKey]) {
            matrix.values[rowKey] = {}
        }
        matrix.values[rowKey][columnKey] = nextValue
    }

    getTakeoffRowTotal(matrix: TakeoffMatrix, rowKey: string): number {
        return this.takeoffColumns.reduce((sum, columnKey) => {
            return sum + Number(matrix.values[rowKey]?.[columnKey] || 0)
        }, 0)
    }

    getTakeoffColumnTotal(matrix: TakeoffMatrix, columnKey: string): number {
        return matrix.rows.reduce((sum, rowKey) => {
            return sum + Number(matrix.values[rowKey]?.[columnKey] || 0)
        }, 0)
    }

    getTakeoffMatrixTotal(matrix: TakeoffMatrix): number {
        return matrix.rows.reduce((sum, rowKey) => sum + this.getTakeoffRowTotal(matrix, rowKey), 0)
    }

    getTakeoffCombinedColumnTotal(columnKey: string): number {
        return this.takeoffMatrices.reduce((sum, matrix) => sum + this.getTakeoffColumnTotal(matrix, columnKey), 0)
    }

    getTakeoffGrandTotal(): number {
        return this.takeoffMatrices.reduce((sum, matrix) => sum + this.getTakeoffMatrixTotal(matrix), 0)
    }

    onTakeoffCellKeydown(event: KeyboardEvent) {
        const key = event.key
        if (!['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(key)) {
            return
        }

        const currentInput = event.currentTarget as HTMLInputElement | null
        const currentCell = currentInput?.closest('td')
        const currentRow = currentCell?.parentElement as HTMLTableRowElement | null
        const tableBody = currentRow?.parentElement as HTMLTableSectionElement | null
        if (!currentInput || !currentCell || !currentRow || !tableBody) {
            return
        }

        event.preventDefault()

        const currentCellIndex = currentCell.cellIndex
        let target: HTMLInputElement | null = null

        if (key === 'ArrowLeft' || key === 'ArrowRight') {
            let sibling =
                key === 'ArrowLeft'
                    ? currentCell.previousElementSibling as HTMLTableCellElement | null
                    : currentCell.nextElementSibling as HTMLTableCellElement | null

            while (sibling && !target) {
                target = sibling.querySelector('input')
                sibling =
                    key === 'ArrowLeft'
                        ? sibling.previousElementSibling as HTMLTableCellElement | null
                        : sibling.nextElementSibling as HTMLTableCellElement | null
            }
        } else {
            const currentRowIndex = currentRow.sectionRowIndex
            const nextRowIndex = key === 'ArrowUp' ? currentRowIndex - 1 : currentRowIndex + 1
            const nextRow = tableBody.rows.item(nextRowIndex)
            const nextCell = nextRow?.cells.item(currentCellIndex) as HTMLTableCellElement | null
            target = nextCell?.querySelector('input') ?? null
        }

        target?.focus()
        target?.select()
    }


    isUrl(value: any): boolean {
        return typeof value === 'string' && /^https?:\/\//i.test(value)
    }

    openInNewTab(url: string, event?: Event) {
        event?.stopPropagation()
        window.open(url, '_blank', 'noopener,noreferrer')
    }

    saveFirewireProject() {
        if (!this.projectId || !this.firewireProject) {
            return
        }

        this.firewireSaveWorking = true
        this.firewireSaveMessage = 'Saving project...'

        this.http.patch(`/api/firewire/projects/firewire/${this.projectId}`, this.firewireForm).subscribe({
            next: (response: any) => {
                if (response?.data) {
                    this.applyFirewireProject(response.data)
                }
                this.firewireSaveWorking = false
                this.firewireSaveMessage = 'Project saved.'
            },
            error: (err: any) => {
                this.firewireSaveWorking = false
                this.firewireSaveMessage = err?.error?.message || err?.message || 'Project save failed.'
                console.error(err)
            }
        })
    }

    resetFirewireForm() {
        if (!this.firewireProject) {
            return
        }
        this.applyFirewireProject(this.firewireProject)
        this.firewireSaveMessage = ''
    }

    onUploadProjectDocumentsClick(fileInput: HTMLInputElement) {
        this.projectDocumentUploadMessage = ''
        fileInput.click()
    }

    canDeactivate(): boolean | Observable<boolean> {
        if (!this.isFirewireFormDirty) {
            return true
        }

        return this.dialog.open(ConfirmFirewireNavigationDialog, {
            width: '420px',
            maxWidth: '92vw',
            data: {
                title: 'Leave Project Detail?',
                message: 'You have unsaved Firewire project changes. Leave this page without saving?'
            }
        }).afterClosed().pipe(
            map((result) => !!result)
        )
    }

    onProjectDocumentFileSelected(event: Event) {
        const input = event.target as HTMLInputElement | null
        const fieldwireProjectId = this.getFieldwireProjectId()
        if (!input || !input.files || input.files.length <= 0 || !fieldwireProjectId) {
            return
        }

        const file = input.files[0]
        const formData = new FormData()
        formData.append('file', file, file.name)
        formData.append('fileName', file.name)
        formData.append('metadata', JSON.stringify({
            projectId: fieldwireProjectId,
            projectName: this.project?.name || ''
        }))

        this.projectDocumentUploadBusy = true
        this.projectDocumentUploadMessage = 'Uploading document...'

        this.http.post(`/api/fieldwire/projects/${fieldwireProjectId}/projectdocuments/upload`, formData).subscribe({
            next: () => {
                this.projectDocumentUploadBusy = false
                this.projectDocumentUploadMessage = 'Document uploaded successfully.'
                input.value = ''
            },
            error: (err: any) => {
                this.projectDocumentUploadBusy = false
                this.projectDocumentUploadMessage = err?.error?.message || 'Document upload failed.'
                input.value = ''
                console.error(err)
            }
        })
    }

    private resetPageState() {
        this.pageWorking = true
        this.project = undefined
        this.firewireProject = undefined
        this.fieldwireProjectId = null
        this.fieldwireProjects = []
        this.firewireForm = this.createEmptyFirewireForm()
        this.firewireBidDueDate = null
        this.initialFirewireFormState = this.serializeFirewireForm(this.firewireForm)
        this.firewireSaveWorking = false
        this.firewireSaveMessage = ''
        this.projectDocumentUploadBusy = false
        this.projectDocumentUploadMessage = ''
        this.tabs = [...this.fieldwireTabs]
        this.tab = 'STATS'
        this.activeFirewireWorkspaceTab = 'PROJECT DETAILS'
    }

    private loadProjectSettings() {
        this.projectSettingsApi.getCatalog().subscribe({
            next: (catalog) => {
                this.projectSettings = catalog
            },
            error: (err) => {
                console.error(err)
            }
        })
    }

    private loadFieldwireProjects() {
        this.http.get('/api/fieldwire/account/projects').subscribe({
            next: (response: any) => {
                this.fieldwireProjects = response?.rows || []
            },
            error: (err) => {
                console.error(err)
            }
        })
    }

    private loadFieldwireProject() {
        const fieldwireProjectId = this.getFieldwireProjectId()
        if (!fieldwireProjectId) {
            this.pageWorking = false
            return
        }

        this.fieldwireProjectId = fieldwireProjectId
        this.http.get(`/api/fieldwire/projects/${fieldwireProjectId}`).subscribe({
            next: async(s: any) => {
                if (s && s.data) {
                    this.project = Object.assign({}, s.data)
                    await this._loadStats()
                }
                this.ensureValidWorkspaceTabRoute()
                this.pageWorking = false
            },
            error: (err: Error) => {
                console.dir(err)
                this.pageWorking = false
            }
        })
    }

    private loadFirewireProject() {
        this.http.get(`/api/firewire/projects/firewire/${this.projectId}`).subscribe({
            next: (response: any) => {
                if (response?.data) {
                    this.applyFirewireProject(response.data)
                    if (response.data.fieldwireId) {
                        this.fieldwireProjectId = response.data.fieldwireId
                        this.loadLinkedFieldwireProject(response.data.fieldwireId)
                        return
                    }
                }
                this.ensureValidWorkspaceTabRoute()
                this.pageWorking = false
            },
            error: (err: any) => {
                this.firewireSaveMessage = err?.error?.message || err?.message || 'Unable to load project.'
                this.pageWorking = false
                console.error(err)
            }
        })
    }

    private applyFirewireProject(project: FirewireProjectSchema) {
        this.firewireProject = { ...project }
        this.firewireForm = {
            fieldwireId: project.fieldwireId,
            name: project.name,
            projectNbr: project.projectNbr,
            address: project.address,
            bidDueDate: this.toDateInputValue(project.bidDueDate),
            projectStatus: project.projectStatus,
            salesman: project.salesman,
            jobType: project.jobType,
            scopeType: project.scopeType,
            projectScope: project.projectScope,
            difficulty: project.difficulty,
            totalSqFt: project.totalSqFt
        }
        this.firewireBidDueDate = this.parseDateOnlyValue(this.firewireForm.bidDueDate)
        this.initialFirewireFormState = this.serializeFirewireForm(this.firewireForm)
    }

    private loadLinkedFieldwireProject(fieldwireProjectId: string) {
        this.http.get(`/api/fieldwire/projects/${fieldwireProjectId}`).subscribe({
            next: async(s: any) => {
                if (s && s.data) {
                    this.project = Object.assign({}, s.data)
                    await this._loadStats()
                }
                this.ensureValidWorkspaceTabRoute()
                this.pageWorking = false
            },
            error: (err: Error) => {
                console.dir(err)
                this.pageWorking = false
            }
        })
    }

    private getFieldwireProjectId(): string | null {
        if (this.fieldwireProjectId) {
            return this.fieldwireProjectId
        }
        if (this.projectSource === 'fieldwire' && this.projectId) {
            return this.projectId
        }
        return this.firewireProject?.fieldwireId || null
    }

    private applyWorkspaceTabFromRoute() {
        const resolvedTab = this.resolveWorkspaceTabSlug(this.workspaceTab)
        this.activeFirewireWorkspaceTab = resolvedTab || 'PROJECT DETAILS'
    }

    private ensureValidWorkspaceTabRoute() {
        if (!this.shouldLoadFirewireProject()) {
            return
        }

        const availableTabs = this.getFirewireWorkspaceTabs()
        if (availableTabs.indexOf(this.activeFirewireWorkspaceTab) >= 0) {
            if (this.workspaceTab !== this.getActiveWorkspaceTabSlug()) {
                this.navigateToWorkspaceTab(this.activeFirewireWorkspaceTab, true)
            }
            return
        }

        this.activeFirewireWorkspaceTab = 'PROJECT DETAILS'
        this.navigateToWorkspaceTab(this.activeFirewireWorkspaceTab, true)
    }

    private navigateToWorkspaceTab(tabName: string, replaceUrl = false) {
        if (!this.projectId || !this.shouldLoadFirewireProject()) {
            return
        }

        const targetSlug = this.toWorkspaceTabSlug(tabName)
        if (this.workspaceTab === targetSlug) {
            return
        }

        this.router.navigate(['/projects', this.projectSource, this.projectId, targetSlug], { replaceUrl })
    }

    private resolveWorkspaceTabSlug(slug: string | undefined): string | null {
        if (!slug) {
            return null
        }

        const normalizedSlug = slug.trim().toLowerCase()
        const allTabs = [...this.baseFirewireWorkspaceTabs, 'FIELDWIRE VIEW']
        return allTabs.find((tabName) => this.toWorkspaceTabSlug(tabName) === normalizedSlug) || null
    }

    private getActiveWorkspaceTabSlug(): string {
        return this.toWorkspaceTabSlug(this.activeFirewireWorkspaceTab || 'PROJECT DETAILS')
    }

    private toWorkspaceTabSlug(tabName: string): string {
        return tabName.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '')
    }

    private createEmptyFirewireForm(): FirewireProjectUpsert {
        return {
            name: '',
            projectNbr: '',
            address: '',
            bidDueDate: '',
            projectStatus: 'Estimation',
            salesman: '',
            jobType: '',
            scopeType: '',
            projectScope: '',
            difficulty: '',
            totalSqFt: 0
        }
    }

    private serializeFirewireForm(form: FirewireProjectUpsert): string {
        return JSON.stringify({
            fieldwireId: form.fieldwireId || null,
            name: form.name || '',
            projectNbr: form.projectNbr || '',
            address: form.address || '',
            bidDueDate: form.bidDueDate || '',
            projectStatus: form.projectStatus || 'Estimation',
            salesman: form.salesman || '',
            jobType: form.jobType || '',
            scopeType: form.scopeType || '',
            projectScope: form.projectScope || '',
            difficulty: form.difficulty || '',
            totalSqFt: Number(form.totalSqFt || 0)
        })
    }

    private parseDateOnlyValue(value: string | null | undefined): Date | null {
        if (!value) {
            return null
        }
        const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value.trim())
        if (!match) {
            return null
        }
        const year = Number(match[1])
        const monthIndex = Number(match[2]) - 1
        const day = Number(match[3])
        const parsed = new Date(year, monthIndex, day)
        return Number.isNaN(parsed.getTime()) ? null : parsed
    }

    private formatDateOnlyValue(value: Date | null | undefined): string {
        if (!value || Number.isNaN(value.getTime())) {
            return ''
        }
        const year = value.getFullYear()
        const month = `${value.getMonth() + 1}`.padStart(2, '0')
        const day = `${value.getDate()}`.padStart(2, '0')
        return `${year}-${month}-${day}`
    }

    private toCsvCell(value: string): string {
        const escaped = value.replace(/"/g, '""')
        return `"${escaped}"`
    }

    private createTakeoffMatrix(title: string, rows: string[]): TakeoffMatrix {
        const values: Record<string, Record<string, TakeoffValue>> = {}
        for (const row of rows) {
            values[row] = {}
            for (const column of this.takeoffColumns) {
                values[row][column] = null
            }
        }
        return { title, rows, values }
    }

    private isGuidValue(value: any): boolean {
        if (typeof value !== 'string') {
            return false
        }
        return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value.trim())
    }

    private tryParseDate(value: any): Date | null {
        if (value instanceof Date && !Number.isNaN(value.getTime())) {
            return value
        }
        if (typeof value !== 'string') {
            return null
        }
        const trimmed = value.trim()
        if (!trimmed) {
            return null
        }
        const isoLikeDate = /^\d{4}-\d{2}-\d{2}(?:[T\s]\d{2}:\d{2}(?::\d{2}(?:\.\d{1,3})?)?(?:Z|[+-]\d{2}:\d{2})?)?$/.test(trimmed)
        if (!isoLikeDate) {
            return null
        }
        const parsed = new Date(trimmed)
        return Number.isNaN(parsed.getTime()) ? null : parsed
    }

    private _loadStats() {
        const fieldwireProjectId = this.getFieldwireProjectId()
        if (!fieldwireProjectId) {
            return
        }
        this.http.get('/api/fieldwire/account/projectstats').subscribe({
            next: (s: any) => {
                if (s && s.rows) {
                    this.stats = this.reducer.reduce(this.tab, [s.rows.find((t: AccountProjectStatSchema) => t.project_id===fieldwireProjectId)])
                    return
                }
            },
            error: (err: Error) => {
                console.dir(err)
            }
        })
    }

    private _loadFolders() {
        const fieldwireProjectId = this.getFieldwireProjectId()
        if (!fieldwireProjectId) {
            return Promise.resolve(undefined)
        }
        return new Promise((resolve, reject) => {
            try {
                this.http.get(`/api/fieldwire/projects/${fieldwireProjectId}/folders`).subscribe({
                    next: (s: any) => {
                        if (s && s.rows) {
                            this.folders = this.reducer.reduce(this.tab, s.rows)
                            return resolve(this.folders)
                        }
                    },
                    error: (err: Error) => {
                        console.dir(err)
                        throw(err)
                    }
                })
            } catch (err) {
                return reject(err)
            }
        })
    }

    private _loadFloorplans() {
        const fieldwireProjectId = this.getFieldwireProjectId()
        if (!fieldwireProjectId) {
            return Promise.resolve(undefined)
        }
        return new Promise((resolve, reject) => {
            try {
                this.http.get(`/api/fieldwire/projects/${fieldwireProjectId}/floorplans`).subscribe({
                    next: (s: any) => {
                        if (s && s.rows) {
                            this.floorplans = this.reducer.reduce(this.tab, s.rows)
                            return resolve(this.floorplans)
                        }
                    },
                    error: (err: Error) => {
                        console.dir(err)
                        throw err
                    }
                })
            } catch (err) {
                return reject(err)
            }
        })
    }

    private _loadSheets() {
        const fieldwireProjectId = this.getFieldwireProjectId()
        if (!fieldwireProjectId) {
            return
        }
        this.http.get(`/api/fieldwire/projects/${fieldwireProjectId}/sheets`).subscribe({
            next: (s: any) => {
                if (s && s.rows) {
                    this.sheets = this.reducer.reduce(this.tab, s.rows)
                    return
                }
            },
            error: (err: Error) => {
                console.dir(err)
            }
        })
    }

    private _loadStatuses() {
        const fieldwireProjectId = this.getFieldwireProjectId()
        if (!fieldwireProjectId) {
            return
        }
        this.http.get(`/api/fieldwire/projects/${fieldwireProjectId}/statuses`).subscribe({
            next: (s: any) => {
                if (s && s.rows) {
                    this.statuses = this.reducer.reduce(this.tab, s.rows)
                    return
                }
            },
            error: (err: Error) => {
                console.dir(err)
            }
        })
    }

    private _loadLocations() {
        const fieldwireProjectId = this.getFieldwireProjectId()
        if (!fieldwireProjectId) {
            return
        }
        this.http.get(`/api/fieldwire/projects/${fieldwireProjectId}/locations`).subscribe({
            next: (s: any) => {
                if (s && s.rows) {
                    this.locations = this.reducer.reduce(this.tab, s.rows)
                    return
                }
            },
            error: (err: Error) => {
                console.dir(err)
            }
        })
    }

    private _loadTeams() {
        const fieldwireProjectId = this.getFieldwireProjectId()
        if (!fieldwireProjectId) {
            return Promise.resolve(undefined)
        }
        return new Promise(async(resolve, reject) => {
            try {
                this.http.get(`/api/fieldwire/projects/${fieldwireProjectId}/teams`).subscribe({
                    next: (s: any) => {
                        if (s && s.rows) {
                            this.teams = this.reducer.reduce(this.tab, s.rows)
                            return resolve(this.teams)
                        }
                    },
                    error: (err: Error) => {
                        throw err
                    }
                })
            } catch (err) {
                console.dir(err)
                return reject(err)
            }
        })
    }

    private _loadTasks() {
        const fieldwireProjectId = this.getFieldwireProjectId()
        if (!fieldwireProjectId) {
            return
        }
        this.http.get(`/api/fieldwire/projects/${fieldwireProjectId}/tasks`).subscribe({
            next: (s: any) => {
                if (s && s.rows) {
                    this.tasks = this.reducer.reduce(this.tab, s.rows)
                    return
                }
            },
            error: (err: Error) => {
                console.dir(err)
            }
        })
    }

    private _loadTaskTypeAttributes() {
        const fieldwireProjectId = this.getFieldwireProjectId()
        if (!fieldwireProjectId) {
            return
        }
        this.http.get(`/api/fieldwire/projects/${fieldwireProjectId}/tasktypeattributes`).subscribe({
            next: (s: any) => {
                if (s && s.rows) {
                    this.taskTypeAttributes = this.reducer.reduce(this.tab, s.rows)
                    return
                }
            },
            error: (err: Error) => {
                console.dir(err)
            }
        })
    }

    private _loadTaskAttributes() {
        const fieldwireProjectId = this.getFieldwireProjectId()
        if (!fieldwireProjectId) {
            return
        }
        this.http.get(`/api/fieldwire/projects/${fieldwireProjectId}/taskattributes`).subscribe({
            next: (s: any) => {
                if (s && s.rows) {
                    this.taskAttributes = this.reducer.reduce(this.tab, s.rows)
                    return
                }
            },
            error: (err: Error) => {
                console.dir(err)
            }
        })
    }

    private _loadTaskCheckItems() {
        const fieldwireProjectId = this.getFieldwireProjectId()
        if (!fieldwireProjectId) {
            return
        }
        this.http.get(`/api/fieldwire/projects/${fieldwireProjectId}/taskcheckitems`).subscribe({
            next: (s: any) => {
                if (s && s.rows) {
                    this.taskCheckItems = this.reducer.reduce(this.tab, s.rows)
                    return
                }
            },
            error: (err: Error) => {
                console.dir(err)
            }
        })
    }

    private _loadAttachments() {
        const fieldwireProjectId = this.getFieldwireProjectId()
        if (!fieldwireProjectId) {
            return
        }
        this.http.get(`/api/fieldwire/projects/${fieldwireProjectId}/attachments`).subscribe({
            next: (s: any) => {
                if (s && s.rows) {
                    this.attachments = this.reducer.reduce(this.tab, s.rows)
                    return
                }
            },
            error: (err: Error) => {
                console.dir(err)
            }
        })
    }
}
