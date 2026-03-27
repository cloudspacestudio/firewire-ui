import { Component, ElementRef, Input, OnChanges, OnDestroy, SimpleChanges, ViewChild, inject } from "@angular/core"
import { NgFor, NgIf } from '@angular/common'
import { ActivatedRoute, Router, RouterLink } from "@angular/router"
import { CommonModule } from "@angular/common"
import { HttpClient } from "@angular/common/http"
import { FormsModule } from "@angular/forms"
import { Subscription, catchError, firstValueFrom, map, Observable, of, switchMap } from "rxjs"

import { MatButtonModule } from "@angular/material/button"
import { MatButtonToggleModule } from "@angular/material/button-toggle"
import { MatCardModule } from "@angular/material/card"
import { MatChipsModule } from "@angular/material/chips"
import { MAT_DIALOG_DATA, MatDialog, MatDialogActions, MatDialogClose, MatDialogContent, MatDialogRef, MatDialogTitle } from "@angular/material/dialog"
import { MatFormFieldModule } from "@angular/material/form-field"
import { MatIconModule } from "@angular/material/icon"
import { MatInputModule } from "@angular/material/input"
import { MatDatepickerModule } from "@angular/material/datepicker"
import { MatMenuModule } from "@angular/material/menu"
import { MatSelectModule } from "@angular/material/select"

import { Utils } from "../../common/utils"
import { AccountProjectAttributes, AccountProjectSchema } from "../../schemas/account.project.schema"
import { AccountProjectStatSchema } from "../../schemas/account.projectstat.schema"
import { FIREWIRE_PROJECT_TYPE_OPTIONS, FirewireProjectSchema, FirewireProjectUpsert } from "../../schemas/firewire-project.schema"
import { ProjectSettingsCatalogSchema } from "../../schemas/project-settings.schema"
import { ProjectListItemSchema, ProjectSource } from "../../schemas/project-list-item.schema"
import { PageToolbar } from '../../common/components/page-toolbar'
import { AzureMapsService } from "../../common/services/azure-maps.service"
import {
    ProjectDocLibraryFileRecord,
    ProjectDocLibraryFileVersionRecord,
    ProjectDocLibraryFolderDefinition,
    ProjectDocLibraryStorageService
} from "../../common/services/project-doc-library-storage.service"
import { UserPreferencesService } from "../../common/services/user-preferences.service"
import { BookingFaceSheetDialog } from "./booking-face-sheet.dialog"
import { ConfirmFirewireNavigationDialog } from "./confirm-firewire-navigation.dialog"
import { ContractSetupDialog } from "./contract-setup.dialog"
import { EstimateFaceSheetDialog } from "./estimate-face-sheet.dialog"
import { JobCostSheetDialog } from "./job-cost-sheet.dialog"
import { QuoteSheetDialog } from "./quote-sheet.dialog"
import { ScheduleOfValuesDialog } from "./schedule-of-values.dialog"
import {
    ProjectTemplateDialog,
    ProjectTemplateDialogItem,
    SaveProjectTemplateDialogResult
} from "./project-template.dialog"
import { ProjectSettingsApi } from "./project-settings.api"
import { ReducedResponse, Reducer } from "../../common/reducer"
import { ProjectMapPreferences } from "../../schemas/user-preferences.schema"
import { Category } from "../../schemas/category.schema"
import { VwEddyPricelist } from "../../schemas/vwEddyPricelist"

interface ProjectBomRow {
    partNbr: string
    description: string
    qty: number
    cost: number
    labor: number
    type: string
    lookupQuery?: string
}

interface ProjectBomSection {
    title: string
    rows: ProjectBomRow[]
    sectionKey?: string
    vendorIds?: string[]
    vendorNames?: string[]
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

interface WorkingHeightBand {
    label: string
    percent: number
    factor: number
}

type TakeoffValue = number | null

interface TakeoffMatrix {
    title: string
    rows: string[]
    values: Record<string, Record<string, TakeoffValue>>
}

type WireCategory = 'SLC' | 'Notification' | 'Audio' | '24V' | 'Style 6 or 7'

interface WireTypeOption {
    label: string
    cost: number
}

interface WireSelection {
    category: WireCategory
    label: string
}

interface WireRunNode {
    id: string
    label: string
    category: WireCategory
    qty: number
    feet: number
    zone: string
}

interface FiretrolProvideRow {
    item: string
    included: boolean
    estQty: number
    price: number
    labor: number
}

interface ProjectCustomerInfo {
    billingName: string
    billingAddress: string
    billingEmail: string
    billingPhone: string
    contractOrPoNumber: string
}

interface WireTakeoffSpecs {
    floors: number
    distanceBetweenFloors: number
    distanceFacpToRiser: number
    conduit: boolean
    plenum: boolean
    plenumSpace: number
    ceilingHeight: number
    finishFloor: number
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
    sourceFileName: string
    versionCount: number
}

interface ProjectDocLibraryOverwriteDialogData {
    fileName: string
    nextVersionNumber: number
}

interface ProjectDocLibraryVersionsDialogData {
    fileName: string
    versions: ProjectDocLibraryFileVersionRecord[]
    onDownload: (versionId: string) => void
}

interface ProjectDocLibraryCategoryDialogData {
    title: string
    confirmLabel: string
    selectedFolderId: string
    folders: Array<{ id: string, label: string }>
}

interface ProjectDocLibraryDeleteDialogData {
    fileName: string
}

type ProjectExpenseSectionMode = 'cost-qty' | 'rate-type-qty' | 'markup'

interface ProjectExpenseRow {
    item: string
    cost?: number
    rate?: number
    markupPercent?: number
    rateType?: string
    qty?: number
    isToggle?: boolean
    toggleLabel?: string
    toggleValue?: boolean
}

interface ProjectExpenseSection {
    title: string
    mode: ProjectExpenseSectionMode
    rows: ProjectExpenseRow[]
}

interface ServiceSupportLaborRow {
    description: string
    hours: number
    quantity: number
}

interface ServiceSupportExpenseRow {
    item: string
    cost: number
    qty: number
}

interface RecentProjectLink {
    id: string
    name: string
    projectNbr: string
    route: string
    lastViewedAt: string
}

interface SystemWeatherForecastDay {
    date: string | null
    dayLabel: string
    phrase: string
    iconCode: number | null
    minTemp: number | null
    maxTemp: number | null
    precipitationProbability: number | null
}

interface FirewireProjectWorksheetState {
    customerInfo: ProjectCustomerInfo
    baseManHourEstimate: number
    workingHeightBands: WorkingHeightBand[]
    workingHeightFactorMultiplier: number
    accessiblePercent: number
    inaccessiblePercent: number
    ceilingFloorFactorMultiplier: number
    newConstructionPercent: number
    retrofitPercent: number
    workRetrofitFactorMultiplier: number
    buildingLevels: number
    takeoffDrawingDate: string | null
    wageScaleJob: boolean
    wageScaleEffectiveRate: number
    laborRates: LaborRateRow[]
    installationOvertime: InstallationOvertimeForm
    takeoffMatrices: TakeoffMatrix[]
    wireTakeoffSpecs: WireTakeoffSpecs
    wireWiringStyles: Record<WireCategory, 'Class A' | 'Class B'>
    wireSelections: WireSelection[]
    wireRunNodes: WireRunNode[]
    firetrolProvideRows: FiretrolProvideRow[]
    bomSections: ProjectBomSection[]
    expenseSections: ProjectExpenseSection[]
    ssPmRate: number
    ssPmFixedAmount: number
    ssPmLaborRows: ServiceSupportLaborRow[]
    ssPmExpenseRows: ServiceSupportExpenseRow[]
    ssCadRate: number
    ssCadFixedAmount: number
    ssCadLaborRows: ServiceSupportLaborRow[]
    ssCadExpenseRows: ServiceSupportExpenseRow[]
    ssTechRate: number
    ssTechFixedAmount: number
    ssTechLaborRows: ServiceSupportLaborRow[]
    ssTechExpenseRows: ServiceSupportExpenseRow[]
    summaryUseInstallationMaterialTax: boolean
    summaryInstallationMaterialTaxRate: number
    summaryUseEquipmentMaterialTax: boolean
    summaryEquipmentMaterialTaxRate: number
    summaryRiskProficiencyPercent: number
    summaryMarginPercent: number
    summaryUseMaterialTax?: boolean
    summaryMaterialTaxRate?: number
}

interface ProjectTemplateRecord {
    templateId: string
    name: string
    visibility: 'Private' | 'Public'
    ownerUserId: string
    firewireForm: Partial<FirewireProjectUpsert>
    worksheetData: FirewireProjectWorksheetState
    createdAt: string
    updatedAt: string
}

declare const atlas: any

@Component({
    standalone: true,
    selector: 'project-page',
    imports: [NgFor, NgIf, CommonModule, FormsModule,
        RouterLink, PageToolbar,
        MatButtonModule, MatFormFieldModule,
        MatInputModule, MatSelectModule, MatButtonToggleModule, MatDatepickerModule,
        MatChipsModule, MatIconModule, MatCardModule, MatMenuModule],
    providers: [HttpClient],
    templateUrl: './project.page.html',
    styleUrls: ['./project.page.scss']
})
export class ProjectPage implements OnChanges, OnDestroy {
    private dialog = inject(MatDialog)
    private router = inject(Router)
    private route = inject(ActivatedRoute)
    private readonly azureMapsService = inject(AzureMapsService)
    private readonly projectDocLibraryStorage = inject(ProjectDocLibraryStorageService)
    private readonly userPreferences = inject(UserPreferencesService)
    private readonly recentProjectsStorageKey = 'firewire.recentProjects'
    private readonly recentProjectsLimit = 6
    private readonly favoriteProjectsStorageKey = 'firewire.favoriteProjects'
    private readonly summaryViewModeStorageKey = 'firewire.summaryViewMode'
    private readonly lockedProjectStatuses = ['Design', 'Install', 'Service', 'Closed']
    private readonly projectIdentityVisibleStatuses = ['Booking', 'Design', 'Install', 'Service', 'Closed']
    readonly projectTypeOptions = FIREWIRE_PROJECT_TYPE_OPTIONS
    private readonly systemMapDefaultPreferences: ProjectMapPreferences = {
        version: 1,
        style: 'night',
        dimension: '2d',
        showRoadDetails: true,
        showBuildingFootprints: true,
        autoFitPins: true
    }

    @Input() projectId?: string
    @Input() projectSource: ProjectSource = 'fieldwire'
    @Input() workspaceTab?: string

    @ViewChild('systemMapHost')
    set systemMapHostRef(value: ElementRef<HTMLDivElement> | undefined) {
        if (!value && this.systemMap) {
            this.resetSystemMap()
        }
        this.systemMapHost = value
        if (value && this.activeFirewireWorkspaceTab === 'PROJECT DETAILS') {
            this.queueSystemMapRender()
        }
    }
    systemMapHost?: ElementRef<HTMLDivElement>

    pageWorking = true
    project?: AccountProjectSchema
    firewireProject?: FirewireProjectSchema
    fieldwireProjectId: string | null = null
    fieldwireProjects: AccountProjectSchema[] = []
    linkedFieldwireProjectIds = new Set<string>()
    firewireForm: FirewireProjectUpsert = this.createEmptyFirewireForm()
    firewireBidDueDate: Date | null = null
    initialFirewireFormState = ''
    initialWorksheetState = ''
    firewireSaveWorking = false
    firewireSaveMessage = ''
    systemWeatherForecast: SystemWeatherForecastDay[] = []
    systemWeatherLoading = false
    systemWeatherStatus = ''
    systemMapError = ''
    private systemMapReady = false
    private systemMap?: any
    private systemMapMarker?: any
    private systemMapPopup?: any
    private systemMapPreferences: ProjectMapPreferences = { ...this.systemMapDefaultPreferences }
    private systemPreferencesSubscription?: Subscription
    private systemMapRenderHandle?: ReturnType<typeof setTimeout>
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
        'CUSTOMER INFO',
        'INSTALL LABOR',
        'LABOR RATES',
        'TAKE OFF',
        'BOM',
        'WIRE TAKE OFF',
        'SS PM',
        'SS CAD',
        'SS TECH',
        'EXPENSES',
        'SUMMARY',
        'DOC LIBRARY',
        'SYSTEM'
    ]
    activeFirewireWorkspaceTab = 'PROJECT DETAILS'
    customerInfo: ProjectCustomerInfo = {
        billingName: '',
        billingAddress: '',
        billingEmail: '',
        billingPhone: '',
        contractOrPoNumber: ''
    }
    baseManHourEstimate = 0
    workingHeightBands: WorkingHeightBand[] = [
        { label: '0 - 10', percent: 100, factor: 0 },
        { label: '11 - 20', percent: 0, factor: 0 },
        { label: '21 - 25', percent: 0, factor: 0 },
        { label: '26 - 30', percent: 0, factor: 0 },
        { label: '31 - 35', percent: 0, factor: 0.3 },
        { label: '36 - 40', percent: 0, factor: 0.5 },
        { label: 'Over', percent: 0, factor: 1 }
    ]
    workingHeightFactorMultiplier = 1
    accessiblePercent = 100
    inaccessiblePercent = 0
    ceilingFloorFactorMultiplier = 1
    newConstructionPercent = 85
    retrofitPercent = 15
    workRetrofitFactorMultiplier = 1
    buildingLevels = 1
    takeoffDrawingDate: Date | null = new Date()
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
    private readonly docLibraryFolderDefinitions: ProjectDocLibraryFolderDefinition[] = this.projectDocLibraryStorage.getFolderDefinitions()
    selectedDocLibraryFolder = 'all'
    docLibraryFiles: ProjectDocLibraryFileRecord[] = []
    docLibraryStatusMessage = ''
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
    readonly wireCategories: WireCategory[] = ['SLC', 'Notification', 'Audio', '24V', 'Style 6 or 7']
    readonly wireDiagramZones = [
        'top-left',
        'top-mid-left',
        'top-mid',
        'top-right',
        'mid-top-1',
        'mid-top-2',
        'mid-top-3',
        'mid-top-4',
        'left-center',
        'center-left',
        'center-right',
        'bottom-mid-left',
        'bottom-mid-right',
        'bottom-right'
    ]
    wireTakeoffSpecs = {
        floors: 1,
        distanceBetweenFloors: 15,
        distanceFacpToRiser: 22,
        conduit: false,
        plenum: true,
        plenumSpace: 2,
        ceilingHeight: 10,
        finishFloor: 0
    }
    wireWiringStyles: Record<WireCategory, 'Class A' | 'Class B'> = {
        'SLC': 'Class B',
        'Notification': 'Class B',
        'Audio': 'Class B',
        '24V': 'Class B',
        'Style 6 or 7': 'Class B'
    }
    readonly wireTypeOptions: WireTypeOption[] = [
        { label: '12/2 Solid Twisted FPLP', cost: 370 },
        { label: '12/2 Solid Twisted Shielded FPLP', cost: 490 },
        { label: '12/2 Solid Twisted FPLR', cost: 350 },
        { label: '12/2 Solid Twisted Shielded FPLR', cost: 410 },
        { label: '14/2 Solid Twisted FPLP', cost: 311 },
        { label: '14/2 Solid Twisted Shielded FPLP', cost: 240 },
        { label: '14/2 Solid Twisted FPLR', cost: 207 },
        { label: '14/2 Solid Twisted Shielded FPLR', cost: 247 },
        { label: '16/2 Solid Twisted FPLP', cost: 217 },
        { label: '16/2 Solid Twisted Shielded FPLP', cost: 170 },
        { label: '16/2 Solid Twisted FPLR', cost: 144 },
        { label: '16/2 Solid Twisted Shielded FPLR', cost: 166 },
        { label: '18/2 Solid Twisted FPLP', cost: 128 },
        { label: '18/2 Solid Twisted Shielded FPLP', cost: 147 },
        { label: '18/2 Solid Twisted FPLR', cost: 96 },
        { label: '18/2 Solid Twisted Shielded FPLR', cost: 114 },
        { label: '12/2 CIC', cost: 0 },
        { label: '14/2 CIC', cost: 0 },
        { label: '16/2 CIC', cost: 0 },
        { label: '18/2 CIC', cost: 0 }
    ]
    wireSelections: WireSelection[] = [
        { category: 'SLC', label: '18/2 Solid Twisted FPLP' },
        { category: 'Notification', label: '14/2 Solid Twisted FPLP' },
        { category: 'Audio', label: '16/2 Solid Twisted FPLP' },
        { category: '24V', label: '14/2 Solid Twisted FPLP' },
        { category: 'Style 6 or 7', label: '18/2 CIC' }
    ]
    wireRunNodes: WireRunNode[] = [
        { id: 'smoke-heat', label: 'Smoke / Heat 4-Wire', category: 'SLC', qty: 0, feet: 75, zone: 'top-left' },
        { id: 'remote-test', label: 'Remote Test', category: 'SLC', qty: 0, feet: 65, zone: 'top-mid-left' },
        { id: 'speaker-top', label: 'Speaker', category: 'Audio', qty: 0, feet: 65, zone: 'top-mid' },
        { id: 'duct-smoke-above', label: 'Duct Smk Above', category: 'SLC', qty: 0, feet: 65, zone: 'top-right' },
        { id: 'horn-top', label: 'Horn', category: 'Notification', qty: 0, feet: 65, zone: 'mid-top-1' },
        { id: 'strobe-top', label: 'Strobe', category: 'Notification', qty: 0, feet: 65, zone: 'mid-top-2' },
        { id: 'horn-strobe-top', label: 'Horn Strobe', category: 'Notification', qty: 0, feet: 65, zone: 'mid-top-3' },
        { id: 'speaker-strobe-top', label: 'Speaker Strobe', category: 'Audio', qty: 0, feet: 65, zone: 'mid-top-4' },
        { id: 'door-holder', label: 'Door Holder', category: '24V', qty: 0, feet: 100, zone: 'left-center' },
        { id: 'udact', label: 'UDACT', category: 'Style 6 or 7', qty: 0, feet: 0, zone: 'center-left' },
        { id: 'annunciator', label: 'ANN', category: 'Notification', qty: 0, feet: 100, zone: 'center-right' },
        { id: 'pull-monitor', label: 'Pull / Monitor Module', category: 'SLC', qty: 0, feet: 60, zone: 'bottom-mid-left' },
        { id: 'control-module', label: 'Control Module', category: 'SLC', qty: 0, feet: 75, zone: 'bottom-mid-right' },
        { id: 'duct-smoke-below', label: 'Duct Smk Below', category: 'SLC', qty: 0, feet: 0, zone: 'bottom-right' }
    ]
    firetrolProvideRows: FiretrolProvideRow[] = [
        { item: 'BackBoxes', included: true, estQty: 0, price: 15, labor: 0 },
        { item: 'J-Hooks', included: false, estQty: 1, price: 1.5, labor: 0 },
        { item: 'Straps/Misc', included: false, estQty: 1, price: 50, labor: 0 }
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
    categories: Category[] = []
    vendorPartRows: VwEddyPricelist[] = []
    vendorPartLookupLoaded = false
    vendorPartLookupWorking = false
    activeBomLookupSectionKey = ''
    activeBomLookupRow: ProjectBomRow | null = null
    expenseSections: ProjectExpenseSection[] = [
        {
            title: 'Permit & Fees',
            mode: 'cost-qty',
            rows: [
                { item: 'plan review and reg hrs insp 1-10', cost: 323, qty: 0 },
                { item: 'plan review and reg hrs insp 11-25', cost: 446, qty: 0 },
                { item: 'plan review and reg hrs insp 26-100', cost: 570, qty: 0 },
                { item: 'plan review 101-200', cost: 693, qty: 0 },
                { item: 'plan review 200 +see fee schedule', cost: 0, qty: 0 },
                { item: 'GFD', cost: 150, qty: 0 },
                { item: 'after hours 2 hour inspection', cost: 337, qty: 0 },
                { item: 'AHJ', cost: 0, qty: 0 },
                { item: 'Live Oak', cost: 0, qty: 0 },
                { item: 'Fast Track Required (X)', cost: 0, qty: 0, isToggle: true, toggleLabel: '--', toggleValue: false }
            ]
        },
        {
            title: 'Rental Equipment',
            mode: 'rate-type-qty',
            rows: [
                { item: 'Lift Truck', rate: 0, rateType: '', qty: 0 },
                { item: 'Tools', rate: 0, rateType: '', qty: 0 },
                { item: 'Forklift', rate: 0, rateType: '', qty: 0 },
                { item: 'Backhoe', rate: 0, rateType: '', qty: 0 },
                { item: 'Extended Reach', rate: 0, rateType: '', qty: 0 },
                { item: 'Low Scissor Lift', rate: 0, rateType: '', qty: 0 },
                { item: 'Medium Reach Lift', rate: 600, rateType: '', qty: 0 },
                { item: 'High Reach Lift', rate: 1000, rateType: '', qty: 0 }
            ]
        },
        {
            title: 'Travel',
            mode: 'rate-type-qty',
            rows: [
                { item: 'Air Travel', rate: 0, rateType: '', qty: 0 },
                { item: 'Car Rental', rate: 0, rateType: '', qty: 0 },
                { item: 'Hotel', rate: 200, rateType: '', qty: 0 },
                { item: 'Meals', rate: 0, rateType: '', qty: 0 },
                { item: 'Incidentals', rate: 0, rateType: '', qty: 0 },
                { item: 'Per Diem (Per Night)', rate: 50, rateType: '', qty: 0 },
                { item: '', rate: 0, rateType: '', qty: 0 },
                { item: 'PARKING', rate: 30, rateType: '', qty: 0 },
                { item: '', rate: 0, rateType: '', qty: 0 }
            ]
        },
        {
            title: 'Freight',
            mode: 'cost-qty',
            rows: [
                { item: 'UPS Next Day', cost: 0, qty: 0 },
                { item: 'UPS Second Day', cost: 0, qty: 0 },
                { item: 'Fed Ex Next Day', cost: 0, qty: 0 },
                { item: 'Fed Ex Second Day', cost: 0, qty: 0 },
                { item: 'Ground Transit', cost: 0, qty: 0 },
                { item: 'Misc Frieght', cost: 0, qty: 0 },
                { item: 'Estimated on Materials (4%)', cost: 0, qty: 1 }
            ]
        },
        {
            title: 'Subcontracts',
            mode: 'cost-qty',
            rows: [
                { item: 'Engineering', cost: 1000, qty: 0 },
                { item: 'Electrical', cost: 0, qty: 0 },
                { item: 'EST Factory Training', cost: 2000, qty: 0 },
                { item: 'Fiber', cost: 4100, qty: 0 },
                { item: '', cost: 0, qty: 0 },
                { item: '', cost: 0, qty: 0 },
                { item: '', cost: 0, qty: 0 },
                { item: '', cost: 0, qty: 0 },
                { item: '', cost: 0, qty: 0 }
            ]
        },
        {
            title: 'Special Markup Items',
            mode: 'markup',
            rows: Array.from({ length: 9 }, () => ({ item: '', rate: 0, markupPercent: 0, rateType: '', qty: 0 }))
        }
    ]
    ssPmRate = 84
    ssPmFixedAmount = 0
    ssPmLaborRows: ServiceSupportLaborRow[] = [
        { description: 'Coordinate Design Activities', hours: 0, quantity: 0 },
        { description: 'Order Write', hours: 0, quantity: 0 },
        { description: 'Prebib Review', hours: 0, quantity: 0 },
        { description: 'Sales Hand-Off Review', hours: 0, quantity: 0 },
        { description: 'Project Planning', hours: 0, quantity: 0 },
        { description: 'Project Re-Estimate', hours: 0, quantity: 0 },
        { description: 'Project Schedule', hours: 0, quantity: 0 },
        { description: 'Project Meetings', hours: 8, quantity: 0 },
        { description: 'Project Tracking', hours: 0, quantity: 0 },
        { description: 'Eng & Technical Coordination', hours: 0, quantity: 0 },
        { description: "Project RFI's, COR's, CO's, Ect", hours: 0, quantity: 0 },
        { description: 'Travel Labor', hours: 0, quantity: 0 },
        { description: 'Time Entry', hours: 0, quantity: 0 },
        { description: 'Phased Job', hours: 0, quantity: 0 },
        { description: 'City AHJ Test', hours: 0, quantity: 0 },
        { description: 'Govt Test', hours: 0, quantity: 0 },
        { description: '', hours: 0, quantity: 0 },
        { description: '', hours: 0, quantity: 0 },
        { description: '', hours: 0, quantity: 0 },
        { description: '', hours: 0, quantity: 0 }
    ]
    ssPmExpenseRows: ServiceSupportExpenseRow[] = [
        { item: 'Telephone', cost: 0, qty: 0 },
        { item: 'Management Software', cost: 0, qty: 0 },
        { item: 'Scheduling Software', cost: 0, qty: 0 },
        { item: 'Computer', cost: 0, qty: 0 },
        { item: 'Printer', cost: 0, qty: 0 },
        { item: 'Rent (Office Trailer)', cost: 0, qty: 0 },
        { item: 'Utilities', cost: 0, qty: 0 },
        { item: 'Cell Phone', cost: 0, qty: 0 },
        { item: 'Consumables', cost: 0, qty: 0 }
    ]
    ssCadRate = 80
    ssCadFixedAmount = 0
    ssCadLaborRows: ServiceSupportLaborRow[] = [
        { description: 'Product Application', hours: 8, quantity: 0 },
        { description: 'Project Scope Letter', hours: 0, quantity: 0 },
        { description: 'Voltage Drop Calculation', hours: 0, quantity: 0 },
        { description: 'Battery Calculation', hours: 0, quantity: 0 },
        { description: 'AHJ Review', hours: 0, quantity: 0 },
        { description: 'Project Close-Out Documents', hours: 0, quantity: 0 },
        { description: 'Travel Labor', hours: 0, quantity: 0 },
        { description: 'Phased Job', hours: 0, quantity: 0 },
        { description: '', hours: 0, quantity: 0 },
        { description: '', hours: 0, quantity: 0 },
        { description: '', hours: 0, quantity: 0 },
        { description: '', hours: 0, quantity: 0 },
        { description: '', hours: 0, quantity: 0 },
        { description: '', hours: 0, quantity: 0 },
        { description: '', hours: 0, quantity: 0 },
        { description: '', hours: 0, quantity: 0 },
        { description: '', hours: 0, quantity: 0 },
        { description: '', hours: 0, quantity: 0 },
        { description: '', hours: 0, quantity: 0 },
        { description: '', hours: 0, quantity: 0 }
    ]
    ssCadExpenseRows: ServiceSupportExpenseRow[] = [
        { item: 'CAD Software', cost: 0, qty: 0 },
        { item: 'Plotter', cost: 0, qty: 0 },
        { item: 'Quotifier Design', cost: 0, qty: 0 },
        { item: 'AutoCAD', cost: 0, qty: 0 },
        { item: 'Reproductions', cost: 0, qty: 0 },
        { item: 'Consumables', cost: 0, qty: 0 },
        { item: '', cost: 0, qty: 0 },
        { item: '', cost: 0, qty: 0 },
        { item: '', cost: 0, qty: 0 }
    ]
    ssTechRate = 56
    ssTechFixedAmount = 0
    ssTechLaborRows: ServiceSupportLaborRow[] = [
        { description: 'Label Addresses', hours: 0, quantity: 0 },
        { description: 'Software Generation', hours: 0, quantity: 0 },
        { description: 'System Testing', hours: 8, quantity: 0 },
        { description: 'Extra System Testing', hours: 4, quantity: 0 },
        { description: 'Programming', hours: 8, quantity: 0 },
        { description: 'Additional Custom Programming', hours: 0, quantity: 0 },
        { description: 'Connect Others Equipment', hours: 0, quantity: 0 },
        { description: 'Interface with Existing System', hours: 0, quantity: 0 },
        { description: 'Terminate Panels', hours: 0, quantity: 0 },
        { description: 'Terminate Devices', hours: 0, quantity: 0 },
        { description: 'Travel Labor', hours: 0, quantity: 0 },
        { description: 'Panel Change Out', hours: 0, quantity: 0 },
        { description: 'Panel Add-On', hours: 0, quantity: 0 },
        { description: 'Phased Job', hours: 0, quantity: 0 },
        { description: 'City AHJ Test', hours: 0, quantity: 0 },
        { description: 'Govt Test', hours: 0, quantity: 0 },
        { description: 'Additional Tech Hours', hours: 0, quantity: 0 },
        { description: '', hours: 0, quantity: 0 },
        { description: '', hours: 0, quantity: 0 },
        { description: '', hours: 0, quantity: 0 }
    ]
    ssTechExpenseRows: ServiceSupportExpenseRow[] = [
        { item: 'Consumables', cost: 0, qty: 0 },
        { item: '', cost: 0, qty: 0 },
        { item: '', cost: 0, qty: 0 },
        { item: '', cost: 0, qty: 0 },
        { item: '', cost: 0, qty: 0 },
        { item: '', cost: 0, qty: 0 },
        { item: '', cost: 0, qty: 0 },
        { item: '', cost: 0, qty: 0 },
        { item: '', cost: 0, qty: 0 }
    ]
    summaryViewMode: 'Grid' | 'Chart' = 'Chart'
    summaryUseInstallationMaterialTax = false
    summaryInstallationMaterialTaxRate = 8.25
    summaryUseEquipmentMaterialTax = false
    summaryEquipmentMaterialTaxRate = 8.25
    summaryRiskProficiencyPercent = 0
    summaryMarginPercent = 35
    private readonly worksheetDefaults = this.buildWorksheetStateSnapshot()
    selectedFloorplanId: string = ''
    selectedTeamId: string = ''
    selectedTemplate = 'Default'
    selectedTemplateId = ''
    projectTemplates: ProjectTemplateRecord[] = []
    projectDocumentUploadBusy = false
    projectUploadErrorToast = ''
    private projectUploadErrorToastTimer?: ReturnType<typeof setTimeout>

    constructor(private http: HttpClient, private projectSettingsApi: ProjectSettingsApi) {
        this.systemPreferencesSubscription = this.userPreferences.preferences$.subscribe((preferences) => {
            this.systemMapPreferences = { ...(preferences.projectMap || this.systemMapDefaultPreferences) }
            this.applySystemMapPreferences()
        })
        void this.userPreferences.load()
    }

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
        this.loadProjectTemplates()

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

    ngOnDestroy(): void {
        if (this.systemMapRenderHandle) {
            clearTimeout(this.systemMapRenderHandle)
        }
        this.systemPreferencesSubscription?.unsubscribe()
        this.resetSystemMap()
    }

    isFirewireProject(): boolean {
        return !!this.firewireProject
    }

    shouldLoadFirewireProject(): boolean {
        return this.projectSource === 'firewire'
    }

    hasSystemLocationInsights(): boolean {
        return this.getSystemProjectCoordinates() !== null
    }

    getSystemWeatherForecast(): SystemWeatherForecastDay[] {
        return this.systemWeatherForecast
    }

    formatSystemTemp(value: number | null): string {
        return typeof value === 'number' && Number.isFinite(value) ? `${Math.round(value)}°` : '--'
    }

    formatSystemWeatherMonth(date: string | null): string {
        if (!date) {
            return '--'
        }

        const parsedDate = new Date(date)
        if (Number.isNaN(parsedDate.getTime())) {
            return '--'
        }

        return new Intl.DateTimeFormat(undefined, {
            month: 'short'
        }).format(parsedDate).toUpperCase()
    }

    formatSystemWeatherDayNumber(date: string | null): string {
        if (!date) {
            return '--'
        }

        const parsedDate = new Date(date)
        if (Number.isNaN(parsedDate.getTime())) {
            return '--'
        }

        return new Intl.DateTimeFormat(undefined, {
            day: 'numeric'
        }).format(parsedDate)
    }

    isSystemWeatherToday(date: string | null): boolean {
        if (!date) {
            return false
        }

        const parsedDate = new Date(date)
        if (Number.isNaN(parsedDate.getTime())) {
            return false
        }

        const now = new Date()
        return parsedDate.getFullYear() === now.getFullYear()
            && parsedDate.getMonth() === now.getMonth()
            && parsedDate.getDate() === now.getDate()
    }

    getSystemWeatherIcon(day: SystemWeatherForecastDay): string {
        const phrase = (day.phrase || '').trim().toLowerCase()
        if (phrase.includes('mostly sunny') || phrase.includes('partly sunny') || phrase.includes('hazy sunshine')) {
            return 'wb_sunny'
        }
        if (phrase.includes('hot')) {
            return 'thermostat'
        }
        if (phrase.includes('cold') || phrase.includes('frigid')) {
            return 'device_thermostat'
        }
        if (phrase.includes('thunder') || phrase.includes('storm')) {
            return 'thunderstorm'
        }
        if (phrase.includes('snow') || phrase.includes('ice') || phrase.includes('sleet') || phrase.includes('flurr')) {
            return 'ac_unit'
        }
        if (phrase.includes('freezing')) {
            return 'severe_cold'
        }
        if (phrase.includes('rain') || phrase.includes('shower') || phrase.includes('drizzle')) {
            return 'rainy'
        }
        if (phrase.includes('fog') || phrase.includes('mist') || phrase.includes('haze') || phrase.includes('smoke')) {
            return 'foggy'
        }
        if (phrase.includes('wind')) {
            return 'air'
        }
        if (phrase.includes('dreary') || phrase.includes('overcast')) {
            return 'filter_drama'
        }
        if (phrase.includes('cloud')) {
            return 'cloud'
        }
        if (phrase.includes('partly') || phrase.includes('mostly') || phrase.includes('intermittent')) {
            return 'partly_cloudy_day'
        }
        if (phrase.includes('clear') || phrase.includes('sun') || phrase.includes('moonlight')) {
            return 'wb_sunny'
        }
        return 'wb_sunny'
    }

    hasFieldwireProject(): boolean {
        return !!this.project && !!this.fieldwireProjectId
    }

    getPageTitle(): string {
        return this.firewireProject?.name || this.project?.name || 'Project'
    }

    getProjectStatusLabel(): string {
        return this.firewireForm.projectStatus || this.firewireProject?.projectStatus || ''
    }

    isProposalProject(): boolean {
        return this.getProjectStatusLabel() === 'Proposal'
    }

    isBiddingProject(): boolean {
        return this.getProjectStatusLabel() === 'Estimation'
    }

    isBookingProject(): boolean {
        return this.getProjectStatusLabel() === 'Booking'
    }

    shouldShowExecutionNav(): boolean {
        const status = this.getProjectStatusLabel()
        return status === 'Install' || status === 'Service'
    }

    shouldShowChangeOrdersNav(): boolean {
        const status = this.getProjectStatusLabel()
        return status === 'Install' || status === 'Service' || status === 'Closed'
    }

    isProjectStatusLocked(): boolean {
        return this.lockedProjectStatuses.includes(this.getProjectStatusLabel())
    }

    shouldShowProjectIdentityFields(): boolean {
        return this.projectIdentityVisibleStatuses.includes(this.getProjectStatusLabel())
    }

    isProjectTypeLocked(): boolean {
        return this.isFirewireProjectLocked() || (this.firewireProject?.projectStatus || 'Estimation') !== 'Estimation'
    }

    isProjectManuallyLocked(): boolean {
        return !!this.firewireProject?.isManualLocked
    }

    isFirewireProjectLocked(): boolean {
        return this.isProjectStatusLocked() || this.isProjectManuallyLocked()
    }

    getProjectLockChipLabel(): string {
        if (this.isProjectStatusLocked()) {
            return `${this.getProjectStatusLabel()} locked`
        }
        return this.firewireProject?.manualLockedBy
            ? `Locked by ${this.firewireProject.manualLockedBy}`
            : 'Manually locked'
    }

    isProjectFavorite(): boolean {
        if (typeof localStorage === 'undefined' || !this.projectId) {
            return false
        }

        try {
            const ids = JSON.parse(localStorage.getItem(this.favoriteProjectsStorageKey) || '[]') as string[]
            return Array.isArray(ids) && ids.includes(this.projectId)
        } catch {
            return false
        }
    }

    isWorkspaceEditable(tabName: string = this.activeFirewireWorkspaceTab): boolean {
        if (!this.isFirewireProjectLocked()) {
            return true
        }
        return tabName === 'DOC LIBRARY' || tabName === 'FIELDWIRE VIEW'
    }

    isActiveFirewireWorkspaceLocked(): boolean {
        return !this.isWorkspaceEditable(this.activeFirewireWorkspaceTab)
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

    getBackRoute(): string {
        return this.route.snapshot.queryParamMap.get('returnTo') || '/projects'
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

    getAvailableFieldwireProjects(): AccountProjectSchema[] {
        return this.fieldwireProjects.filter((project) => !this.isFieldwireProjectOptionUnavailable(String(project.id)))
    }

    isFieldwireProjectOptionUnavailable(fieldwireProjectId: string | null | undefined): boolean {
        const normalizedId = fieldwireProjectId ? String(fieldwireProjectId) : ''
        if (!normalizedId) {
            return false
        }

        const currentLinkedId = this.firewireProject?.fieldwireId ? String(this.firewireProject.fieldwireId) : ''
        if (normalizedId === currentLinkedId) {
            return false
        }

        return this.linkedFieldwireProjectIds.has(normalizedId)
    }

    getFieldwireProjectOptionLabel(option: AccountProjectSchema): string {
        return `${option.name} (${option.code})`
    }

    getLinkedFieldwireProjectUrl(): string | null {
        const fieldwireProjectId = this.getFieldwireProjectId()
        return fieldwireProjectId ? `https://app.fieldwire.com/projects/${fieldwireProjectId}` : null
    }

    get isFirewireFormDirty(): boolean {
        if (!this.firewireProject) {
            return false
        }
        return this.initialFirewireFormState !== this.serializeFirewireForm(this.firewireForm)
    }

    get isWorksheetDirty(): boolean {
        if (!this.firewireProject) {
            return false
        }
        return this.initialWorksheetState !== this.serializeWorksheetState(this.buildWorksheetStateSnapshot())
    }

    get isProjectDirty(): boolean {
        return this.isFirewireFormDirty || this.isWorksheetDirty
    }

    get docLibraryFolders(): DocLibraryFolder[] {
        const allCount = this.docLibraryFiles.length
        return [
            { id: 'all', label: 'All Documents', itemCount: allCount, badge: allCount > 0 ? 'LIVE' : undefined },
            ...this.docLibraryFolderDefinitions.map((folder) => ({
                id: folder.id,
                label: folder.label,
                itemCount: this.docLibraryFiles.filter((file) => file.folderId === folder.id).length
            }))
        ]
    }

    getDocLibraryProjectKey(): string {
        return this.firewireProject?.projectNbr?.trim() || this.firewireForm.projectNbr?.trim() || 'UNASSIGNED'
    }

    getDocLibraryStorageKey(): string {
        return this.getDocLibraryStorageKeys()[0] || 'UNASSIGNED'
    }

    getDocLibraryStorageKeys(): string[] {
        const candidates = [
            this.projectId,
            this.project?.id,
            this.firewireProject?.uuid,
            this.getDocLibraryProjectKey()
        ]

        const seen = new Set<string>()
        return candidates
            .map((value) => String(value || '').trim())
            .filter((value) => {
                if (!value || seen.has(value)) {
                    return false
                }
                seen.add(value)
                return true
            })
    }

    getDocLibraryVisibleFiles(): DocLibraryFile[] {
        return this.getDocLibraryVisibleRecords().map((file) => {
            const latestVersion = this.getLatestDocLibraryVersion(file)
            return {
                id: file.id,
                folderId: file.folderId,
                name: file.name,
                extension: file.extension.toUpperCase(),
                category: this.getDocLibraryFolderLabel(file.folderId),
                sizeBytes: latestVersion?.sizeBytes || 0,
                modifiedAt: latestVersion?.uploadedAt || file.updatedAt,
                modifiedBy: latestVersion?.uploadedBy || 'Current User',
                sourceFileName: latestVersion?.sourceFileName || file.name,
                versionCount: file.versions?.length || 0
            }
        })
    }

    getSelectedDocLibraryFolderLabel(): string {
        return this.docLibraryFolders.find((folder) => folder.id === this.selectedDocLibraryFolder)?.label || 'All Documents'
    }

    getDocLibraryVersionCount(): number {
        return this.getDocLibraryVisibleRecords().reduce((sum, file) => sum + (file.versions?.length || 0), 0)
    }

    getWorkingHeightPercentTotal(): number {
        return this.workingHeightBands.reduce((sum, band) => sum + Number(band.percent || 0), 0)
    }

    getWorkingHeightWeightedFactor(): number {
        return this.workingHeightBands.reduce((sum, band) => sum + (Number(band.percent || 0) / 100) * band.factor, 0)
    }

    getWorkingHeightAdditionalHours(): number {
        return this.baseManHourEstimate * this.getWorkingHeightWeightedFactor() * Number(this.workingHeightFactorMultiplier || 0)
    }

    getCeilingFloorPercentTotal(): number {
        return Number(this.accessiblePercent || 0) + Number(this.inaccessiblePercent || 0)
    }

    getCeilingFloorWeightedFactor(): number {
        return (Number(this.inaccessiblePercent || 0) / 100) * 0.2
    }

    getCeilingFloorAdditionalHours(): number {
        return this.baseManHourEstimate * this.getCeilingFloorWeightedFactor() * Number(this.ceilingFloorFactorMultiplier || 0)
    }

    getWorkRetrofitPercentTotal(): number {
        return Number(this.newConstructionPercent || 0) + Number(this.retrofitPercent || 0)
    }

    onScopeTypeChanged(scopeType: string) {
        if (this.isFirewireProjectLocked()) {
            return
        }
        this.firewireForm.scopeType = scopeType
        this.applyWorkRetrofitDefaults(scopeType)
    }

    getWorkRetrofitWeightedFactor(): number {
        return (Number(this.retrofitPercent || 0) / 100) * 0.2
    }

    getWorkRetrofitAdditionalHours(): number {
        return this.baseManHourEstimate * this.getWorkRetrofitWeightedFactor() * Number(this.workRetrofitFactorMultiplier || 0)
    }

    getBuildingHeightNetFactor(): number {
        return this.buildingLevels <= 2 ? 1 : 1 + ((Number(this.buildingLevels || 0) - 2) * 0.1)
    }

    getBuildingHeightAdditionalHours(): number {
        return this.baseManHourEstimate * Math.max(this.getBuildingHeightNetFactor() - 1, 0)
    }

    getTotalAdditionalHours(): number {
        return this.getWorkingHeightAdditionalHours()
            + this.getCeilingFloorAdditionalHours()
            + this.getWorkRetrofitAdditionalHours()
            + this.getBuildingHeightAdditionalHours()
    }

    getTotalNetFactor(): number {
        return this.baseManHourEstimate > 0
            ? 1 + (this.getTotalAdditionalHours() / this.baseManHourEstimate)
            : 1
    }

    getAdjustedEstimatedManHours(): number {
        return this.baseManHourEstimate + this.getTotalAdditionalHours()
    }

    toPercentFactor(input: number): string {
        return `${(Number(input || 0) * 100).toFixed(0)}%`
    }

    getDocLibraryTotalBytes(): number {
        return this.getDocLibraryVisibleFiles().reduce((sum, file) => sum + file.sizeBytes, 0)
    }

    selectDocLibraryFolder(folderId: string) {
        this.selectedDocLibraryFolder = folderId
        this.docLibraryStatusMessage = ''
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
        if (tabName === 'PROJECT DETAILS') {
            this.queueSystemMapRender()
        }
        this.navigateToWorkspaceTab(tabName)
    }

    toLocalDateTimeString(input: Date|string) {
        return Utils.toLocalString(input)
    }

    formatDateForDisplay(input: Date | string | null | undefined): string {
        if (!input) {
            return ''
        }

        const value = input instanceof Date ? input : new Date(input)
        if (Number.isNaN(value.getTime())) {
            return ''
        }

        return value.toLocaleDateString()
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

    getThumbOpenUrl(row: any, fallbackUrl: string): string {
        if (this.tab === 'SHEETS' && row && typeof row === 'object') {
            const fileUrl = this.getSheetFileUrl(row)
            if (this.isUrl(fileUrl)) {
                return fileUrl
            }
        }
        return fallbackUrl
    }

    private getSheetFileUrl(row: any): string {
        if (this.isUrl(row?.file_url)) {
            return row.file_url
        }

        const rowId = row?.id
        if (!rowId || !Array.isArray(this.sheets?.full)) {
            return ''
        }

        const fullSheet = this.sheets.full.find((item) => item?.id === rowId)
        if (this.isUrl(fullSheet?.file_url)) {
            return fullSheet.file_url
        }

        return ''
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

    getBomBaseManHourEstimate(): number {
        return this.bomSections.reduce((sum, section) => {
            return sum + section.rows.reduce((rowSum, row) => rowSum + this.getBomRowExtLabor(row), 0)
        }, 0)
    }

    getBomDeviceCount(): number {
        return this.bomSections.reduce((sum, section) => {
            return sum + section.rows.reduce((rowSum, row) => rowSum + Number(row.qty || 0), 0)
        }, 0)
    }

    getBomLaborVariance(): number {
        return Number(this.baseManHourEstimate || 0) - this.getBomBaseManHourEstimate()
    }

    getBomLaborVarianceLabel(): string {
        const variance = this.getBomLaborVariance()
        if (Math.abs(variance) < 0.005) {
            return 'Aligned'
        }
        return variance > 0 ? 'Over BOM' : 'Under BOM'
    }

    getBomLaborVarianceTone(): 'muted' | 'notice' | 'warn' {
        const base = Math.abs(this.getBomBaseManHourEstimate())
        const variance = Math.abs(this.getBomLaborVariance())
        if (variance < 0.005) {
            return 'muted'
        }
        const ratio = base > 0 ? variance / base : variance > 0 ? 1 : 0
        if (ratio >= 0.25 || variance >= 16) {
            return 'warn'
        }
        if (ratio >= 0.1 || variance >= 6) {
            return 'notice'
        }
        return 'muted'
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

    addBomSection() {
        const nextNumber = this.bomSections.length + 1
        this.bomSections = [
            ...this.bomSections,
            {
                title: `NEW SECTION ${nextNumber}`,
                rows: [this.createEmptyBomRow()]
            }
        ]
    }

    addBomRow(section: ProjectBomSection) {
        section.rows = [...section.rows, this.createEmptyBomRow()]
        this.bomSections = [...this.bomSections]
    }

    async onBomPartLookupFocus(section: ProjectBomSection, row: ProjectBomRow): Promise<void> {
        this.activeBomLookupSectionKey = String(section.sectionKey || '')
        this.activeBomLookupRow = row
        await this.ensureBomLookupDataLoaded()
    }

    onBomPartLookupBlur(section: ProjectBomSection, row: ProjectBomRow): void {
        row.lookupQuery = String(row.lookupQuery || row.partNbr || '').trim()
        globalThis.setTimeout(() => {
            if (this.getBomPartLookupResults(section, row).length === 1) {
                return
            }
            if (this.activeBomLookupSectionKey === String(section.sectionKey || '')) {
                this.activeBomLookupSectionKey = ''
                this.activeBomLookupRow = null
            }
        }, 120)
    }

    onBomPartLookupChanged(section: ProjectBomSection, row: ProjectBomRow, value: string): void {
        row.lookupQuery = value
        this.activeBomLookupSectionKey = String(section.sectionKey || '')
        this.activeBomLookupRow = row
    }

    isBomLookupActive(section: ProjectBomSection, row: ProjectBomRow): boolean {
        return this.activeBomLookupSectionKey === String(section.sectionKey || '') && this.activeBomLookupRow === row
    }

    getBomPartLookupResults(section: ProjectBomSection, row: ProjectBomRow): VwEddyPricelist[] {
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

    selectBomPart(section: ProjectBomSection, row: ProjectBomRow, part: VwEddyPricelist): void {
        const category = this.getBomCategoryByName(String(part.Category || '').trim())
        row.partNbr = String(part.PartNumber || '').trim()
        row.lookupQuery = row.partNbr
        row.description = String(part.LongDescription || '').trim()
        row.cost = Number(part.SalesPrice || part.MSRPPrice || 0)
        row.type = category?.includeOnFloorplan ? String(category.name || part.Category || '').trim() : ''
        row.labor = Number(category?.defaultLabor || 0)
        this.activeBomLookupSectionKey = ''
        this.activeBomLookupRow = null
    }

    getExpenseRateLabel(section: ProjectExpenseSection): string {
        return section.mode === 'cost-qty' ? 'Cost' : 'Rate'
    }

    getExpenseExtendedLabel(section: ProjectExpenseSection): string {
        return section.mode === 'cost-qty' ? 'Extended' : 'Extended Cost'
    }

    getExpenseBaseValue(row: ProjectExpenseRow, section: ProjectExpenseSection): number {
        if (section.mode === 'cost-qty') {
            return Number(row.cost || 0)
        }
        return Number(row.rate || 0)
    }

    getExpenseRowExtended(row: ProjectExpenseRow, section: ProjectExpenseSection): number {
        const qty = Number(row.qty || 0)
        const baseValue = this.getExpenseBaseValue(row, section)

        if (section.mode === 'markup') {
            const markupFactor = 1 + (Number(row.markupPercent || 0) / 100)
            return qty * baseValue * markupFactor
        }

        if (row.isToggle) {
            return row.toggleValue ? baseValue : 0
        }

        return qty * baseValue
    }

    getExpenseSectionTotal(section: ProjectExpenseSection): number {
        return section.rows.reduce((sum, row) => sum + this.getExpenseRowExtended(row, section), 0)
    }

    getExpenseGrandTotal(): number {
        return this.expenseSections.reduce((sum, section) => sum + this.getExpenseSectionTotal(section), 0)
    }

    getSsPmLaborExtendedHours(row: ServiceSupportLaborRow): number {
        return Number(row.hours || 0) * Number(row.quantity || 0)
    }

    getSsPmLaborTotalHours(): number {
        return this.ssPmLaborRows.reduce((sum, row) => sum + this.getSsPmLaborExtendedHours(row), 0)
    }

    getSsPmLaborTotalCost(): number {
        return this.getSsPmLaborTotalHours() * Number(this.ssPmRate || 0)
    }

    getSsPmExpenseExtended(row: ServiceSupportExpenseRow): number {
        return Number(row.cost || 0) * Number(row.qty || 0)
    }

    getSsPmExpenseTotal(): number {
        return this.ssPmExpenseRows.reduce((sum, row) => sum + this.getSsPmExpenseExtended(row), 0)
    }

    getSsPmGrandTotal(): number {
        return this.getSsPmLaborTotalCost() + this.getSsPmExpenseTotal() + Number(this.ssPmFixedAmount || 0)
    }

    getSsCadLaborExtendedHours(row: ServiceSupportLaborRow): number {
        return Number(row.hours || 0) * Number(row.quantity || 0)
    }

    getSsCadLaborTotalHours(): number {
        return this.ssCadLaborRows.reduce((sum, row) => sum + this.getSsCadLaborExtendedHours(row), 0)
    }

    getSsCadLaborTotalCost(): number {
        return this.getSsCadLaborTotalHours() * Number(this.ssCadRate || 0)
    }

    getSsCadExpenseExtended(row: ServiceSupportExpenseRow): number {
        return Number(row.cost || 0) * Number(row.qty || 0)
    }

    getSsCadExpenseTotal(): number {
        return this.ssCadExpenseRows.reduce((sum, row) => sum + this.getSsCadExpenseExtended(row), 0)
    }

    getSsCadGrandTotal(): number {
        return this.getSsCadLaborTotalCost() + this.getSsCadExpenseTotal() + Number(this.ssCadFixedAmount || 0)
    }

    getSsTechLaborExtendedHours(row: ServiceSupportLaborRow): number {
        return Number(row.hours || 0) * Number(row.quantity || 0)
    }

    getSsTechLaborTotalHours(): number {
        return this.ssTechLaborRows.reduce((sum, row) => sum + this.getSsTechLaborExtendedHours(row), 0)
    }

    getSsTechLaborTotalCost(): number {
        return this.getSsTechLaborTotalHours() * Number(this.ssTechRate || 0)
    }

    getSsTechExpenseExtended(row: ServiceSupportExpenseRow): number {
        return Number(row.cost || 0) * Number(row.qty || 0)
    }

    getSsTechExpenseTotal(): number {
        return this.ssTechExpenseRows.reduce((sum, row) => sum + this.getSsTechExpenseExtended(row), 0)
    }

    getSsTechGrandTotal(): number {
        return this.getSsTechLaborTotalCost() + this.getSsTechExpenseTotal() + Number(this.ssTechFixedAmount || 0)
    }

    getWireSelection(category: WireCategory): WireSelection {
        return this.wireSelections.find((row) => row.category === category) || { category, label: '' }
    }

    updateWireSelection(category: WireCategory, label: string) {
        const selection = this.wireSelections.find((row) => row.category === category)
        if (!selection) {
            this.wireSelections.push({ category, label })
            return
        }
        selection.label = label
    }

    getWireOptionCost(label: string): number {
        return this.wireTypeOptions.find((row) => row.label === label)?.cost || 0
    }

    getWireCategoryPrice(category: WireCategory): number {
        return this.getWireOptionCost(this.getWireSelection(category).label)
    }

    getWireCategoryMeasuredFeet(category: WireCategory): number {
        return this.wireRunNodes
            .filter((row) => row.category === category)
            .reduce((sum, row) => sum + Number(row.feet || 0), 0)
    }

    getWireCategoryAdjustedFeet(category: WireCategory): number {
        return this.wireRunNodes
            .filter((row) => row.category === category)
            .reduce((sum, row) => sum + (Number(row.qty || 0) * Number(row.feet || 0)), 0)
    }

    getWireCategoryMaterialCost(category: WireCategory): number {
        const adjustedFeet = this.getWireCategoryAdjustedFeet(category)
        const unitPrice = this.getWireCategoryPrice(category)
        if (adjustedFeet <= 0 || unitPrice <= 0) {
            return 0
        }
        return Math.ceil(adjustedFeet / 1000) * unitPrice
    }

    getWireFiretrolExtended(row: FiretrolProvideRow): number {
        if (!row.included) {
            return 0
        }
        return Number(row.estQty || 0) * Number(row.price || 0)
    }

    getWireFiretrolLaborTotal(): number {
        return this.firetrolProvideRows.reduce((sum, row) => sum + Number(row.labor || 0), 0)
    }

    getWireFiretrolMaterialTotal(): number {
        return this.firetrolProvideRows.reduce((sum, row) => sum + this.getWireFiretrolExtended(row), 0)
    }

    getWireInstallationMaterialTotal(): number {
        return this.wireCategories.reduce((sum, category) => sum + this.getWireCategoryMaterialCost(category), 0) + this.getWireFiretrolMaterialTotal()
    }

    getWireInstallationLaborTotal(): number {
        return this.getWireFiretrolLaborTotal()
    }

    getWireRunNodesForZone(zone: string): WireRunNode[] {
        return this.wireRunNodes.filter((row) => row.zone === zone)
    }

    getWireRunNodeDisplayLabel(node: WireRunNode): string {
        if (node.label === 'Smoke / Heat 4-Wire') {
            return 'Smoke / Heat'
        }
        return node.label
    }

    getProjectSupportHours(): number {
        return this.getSsPmLaborTotalHours() + this.getSsCadLaborTotalHours() + this.getSsTechLaborTotalHours()
    }

    getProjectSupportCost(): number {
        return this.getSsPmGrandTotal() + this.getSsCadGrandTotal() + this.getSsTechGrandTotal()
    }

    getInstallationRateRow(label: string): LaborRateRow | undefined {
        return this.laborRates.find((row) => row.label === label)
    }

    getInstallationLaborBaseHours(): number {
        return this.getAdjustedEstimatedManHours()
    }

    getInstallationLaborOvertimeHours(): number {
        return this.getInstallationLaborBaseHours() * (Number(this.installationOvertime.percentTotalInstallHours || 0) / 100)
    }

    getInstallationPipeWireCost(): number {
        const installationRate = this.getInstallationRateRow('Installation')
        const regularCost = this.getInstallationLaborBaseHours() * Number(installationRate?.effectiveRate || installationRate?.payRate || 0)
        const overtimeRate = Number(this.installationOvertime.overtimeEffectiveRate || this.installationOvertime.overtimeRate || 0)
        return regularCost + (this.getInstallationLaborOvertimeHours() * overtimeRate)
    }

    getSupervisionHours(): number {
        return this.getInstallationLaborBaseHours() * (Number(this.installationOvertime.supervisionFactorPercent || 0) / 100)
    }

    getSupervisionCost(): number {
        const supervisionRate = this.getInstallationRateRow('Supervision')
        return this.getSupervisionHours() * Number(supervisionRate?.effectiveRate || supervisionRate?.payRate || 0)
    }

    getMobilizationHours(): number {
        return this.getInstallationLaborBaseHours() * (Number(this.installationOvertime.mobilizationFactorPercent || 0) / 100)
    }

    getMobilizationCost(): number {
        const installationRate = this.getInstallationRateRow('Installation')
        return this.getMobilizationHours() * Number(installationRate?.effectiveRate || installationRate?.payRate || 0)
    }

    getInstallationLaborTotalHours(): number {
        return this.getInstallationLaborBaseHours() + this.getInstallationLaborOvertimeHours() + this.getSupervisionHours() + this.getMobilizationHours()
    }

    getInstallationLaborTotalCost(): number {
        return this.getInstallationPipeWireCost() + this.getSupervisionCost() + this.getMobilizationCost()
    }

    getInstallationMaterialTotal(): number {
        return this.bomSections.reduce((sum, section) => sum + section.rows.reduce((rowSum, row) => rowSum + this.getBomRowExtCost(row), 0), 0)
    }

    getEquipmentMaterialTotal(): number {
        return 0
    }

    getExpenseSectionTotalByTitle(title: string): number {
        const section = this.expenseSections.find((row) => row.title.toLowerCase() === title.toLowerCase())
        return section ? this.getExpenseSectionTotal(section) : 0
    }

    getPermitAndFeesTotal(): number {
        return this.getExpenseSectionTotalByTitle('Permit & Fees')
    }

    getRentalEquipmentTotal(): number {
        return this.getExpenseSectionTotalByTitle('Rental Equipment')
    }

    getInstallationHourlyRate(): number {
        const installationRate = this.laborRates.find((row) => row.label === 'Installation')
        return Number(installationRate?.effectiveRate || installationRate?.payRate || 0)
    }

    getGeneralExpenseTotal(): number {
        return this.expenseSections
            .filter((section) => !['Subcontracts', 'Special Markup Items'].includes(section.title))
            .reduce((sum, section) => sum + this.getExpenseSectionTotal(section), 0)
    }

    getSubcontractTotal(): number {
        return this.getExpenseSectionTotalByTitle('Subcontracts')
    }

    getSpecialMarkupTotal(): number {
        return this.getExpenseSectionTotalByTitle('Special Markup Items')
    }

    getTotalJobCost(): number {
        return this.getProjectSupportCost()
            + this.getInstallationLaborTotalCost()
            + this.getInstallationMaterialTotal()
            + this.getEquipmentMaterialTotal()
            + this.getGeneralExpenseTotal()
            + this.getSubcontractTotal()
            + this.getSpecialMarkupTotal()
    }

    getSummaryCategoryPercent(cost: number): number {
        const total = this.getTotalJobCost()
        return total > 0 ? (cost / total) * 100 : 0
    }

    getSummaryCostBreakdown() {
        return [
            { label: 'Project Support', cost: this.getProjectSupportCost(), tone: 'support' },
            { label: 'Installation Labor', cost: this.getInstallationLaborTotalCost(), tone: 'labor' },
            { label: 'Installation Material', cost: this.getInstallationMaterialTotal(), tone: 'material' },
            { label: 'Equipment', cost: this.getEquipmentMaterialTotal(), tone: 'equipment' },
            { label: 'Expenses', cost: this.getGeneralExpenseTotal(), tone: 'expenses' },
            { label: 'Subcontracts', cost: this.getSubcontractTotal(), tone: 'subcontracts' },
            { label: 'Special Markup', cost: this.getSpecialMarkupTotal(), tone: 'markup' }
        ].map((item) => ({
            ...item,
            percent: this.getSummaryCategoryPercent(item.cost)
        }))
    }

    getSummaryPrimaryMetrics() {
        return [
            { label: 'Device Count', value: `${this.getSummaryDeviceCount()}` },
            { label: 'Square Feet', value: Number(this.firewireForm.totalSqFt || 0).toLocaleString() },
            { label: 'Project Support', value: `${this.getProjectSupportHours().toFixed(2)} hrs` },
            { label: 'Field Labor', value: `${this.getInstallationLaborTotalHours().toFixed(2)} hrs` }
        ]
    }

    getSummaryScopeLabel(): string {
        return this.isTurnkeyScope() ? 'Turnkey' : 'Smarts & Parts'
    }

    getSummaryQuotedPreTax(): number {
        return this.isTurnkeyScope() ? this.getTurnkeyQuotedPrice() : this.getSmartsAndPartsQuotedPrice()
    }

    getSummaryQuotedWithTax(): number {
        return this.isTurnkeyScope() ? this.getTurnkeyQuotedPriceWithTax() : this.getSmartsAndPartsQuotedPriceWithTax()
    }

    getSummaryCostWithRiskDisplay(): number {
        return this.isTurnkeyScope() ? this.getTurnkeyCostWithRisk() : this.getSmartsAndPartsCostWithRisk()
    }

    getSummaryWaterfallMax(): number {
        return Math.max(
            this.getSummaryCostWithRiskDisplay(),
            this.getSummaryQuotedPreTax(),
            this.getSummaryQuotedWithTax(),
            1
        )
    }

    getSummaryBarWidth(value: number): number {
        return Math.max((value / this.getSummaryWaterfallMax()) * 100, 4)
    }

    isTurnkeyScope(): boolean {
        return (this.firewireForm.projectScope || '').toLowerCase().includes('turnkey')
    }

    getTurnkeyMaterialCost(): number {
        return this.isTurnkeyScope() ? this.getInstallationMaterialTotal() + this.getEquipmentMaterialTotal() : 0
    }

    getTurnkeyLaborCost(): number {
        return this.isTurnkeyScope() ? this.getProjectSupportCost() + this.getInstallationLaborTotalCost() : 0
    }

    getSmartsAndPartsMaterialCost(): number {
        return this.isTurnkeyScope() ? 0 : this.getInstallationMaterialTotal() + this.getEquipmentMaterialTotal()
    }

    getSmartsAndPartsLaborCost(): number {
        return this.isTurnkeyScope() ? 0 : this.getProjectSupportCost() + this.getInstallationLaborTotalCost()
    }

    getSummaryRiskMultiplier(): number {
        return 1 + (Number(this.summaryRiskProficiencyPercent || 0) / 100)
    }

    getTurnkeyCostWithRisk(): number {
        return (this.getTurnkeyMaterialCost() + this.getTurnkeyLaborCost()) * this.getSummaryRiskMultiplier()
    }

    getSmartsAndPartsCostWithRisk(): number {
        return (this.getSmartsAndPartsMaterialCost() + this.getSmartsAndPartsLaborCost()) * this.getSummaryRiskMultiplier()
    }

    getDefaultSummaryMarginPercent(): number {
        return this.isTurnkeyScope() ? 35 : 20
    }

    getTurnkeyMarginPercent(): number {
        return Number(this.summaryMarginPercent || 0)
    }

    getSmartsAndPartsMarginPercent(): number {
        return Number(this.summaryMarginPercent || 0)
    }

    getTurnkeyMarginAmount(): number {
        return this.getTurnkeyCostWithRisk() * (this.getTurnkeyMarginPercent() / 100)
    }

    getSmartsAndPartsMarginAmount(): number {
        return this.getSmartsAndPartsCostWithRisk() * (this.getSmartsAndPartsMarginPercent() / 100)
    }

    getTurnkeyQuotedPrice(): number {
        return this.getTurnkeyCostWithRisk() + this.getTurnkeyMarginAmount()
    }

    getSmartsAndPartsQuotedPrice(): number {
        return this.getSmartsAndPartsCostWithRisk() + this.getSmartsAndPartsMarginAmount()
    }

    getInstallationMaterialTaxAmount(): number {
        return this.summaryUseInstallationMaterialTax
            ? this.getInstallationMaterialTotal() * (Number(this.summaryInstallationMaterialTaxRate || 0) / 100)
            : 0
    }

    getEquipmentMaterialTaxAmount(): number {
        return this.summaryUseEquipmentMaterialTax
            ? this.getEquipmentMaterialTotal() * (Number(this.summaryEquipmentMaterialTaxRate || 0) / 100)
            : 0
    }

    getSummaryMaterialTaxAmount(): number {
        return this.getInstallationMaterialTaxAmount() + this.getEquipmentMaterialTaxAmount()
    }

    getSummaryEffectiveMaterialTaxRate(): number {
        const totalMaterial = this.getInstallationMaterialTotal() + this.getEquipmentMaterialTotal()
        return totalMaterial > 0 ? (this.getSummaryMaterialTaxAmount() / totalMaterial) * 100 : 0
    }

    getTurnkeyQuotedPriceWithTax(): number {
        return this.getTurnkeyQuotedPrice() + this.getSummaryMaterialTaxAmount()
    }

    getSmartsAndPartsQuotedPriceWithTax(): number {
        return this.getSmartsAndPartsQuotedPrice() + this.getSummaryMaterialTaxAmount()
    }

    getSummaryDeviceCount(): number {
        return this.getBomDeviceCount()
    }

    getSummaryEngineeringHours(): number {
        return this.getSsCadLaborTotalHours()
    }

    getSummaryEngineeringDollars(): number {
        return this.getSsCadGrandTotal()
    }

    getSummaryFieldHours(): number {
        return this.getInstallationLaborTotalHours()
    }

    getSummaryFieldDollars(): number {
        return this.getInstallationLaborTotalCost()
    }

    getSummaryMetricPerDevice(value: number): number {
        const count = this.getSummaryDeviceCount()
        return count > 0 ? value / count : 0
    }

    getSummaryMetricPerSqFt(value: number): number {
        const sqft = Number(this.firewireForm.totalSqFt || 0)
        return sqft > 0 ? value / sqft : 0
    }

    onWageScaleJobChange(value: boolean) {
        if (this.isFirewireProjectLocked()) {
            return
        }
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
        if (!this.projectId || !this.firewireProject || this.isFirewireProjectLocked()) {
            return
        }

        this.saveFirewireProjectRequest().subscribe()
    }

    generateProposal() {
        if (!this.projectId || !this.firewireProject || this.isFirewireProjectLocked() || !this.isBiddingProject()) {
            return
        }

        const previousStatus = this.firewireForm.projectStatus
        this.firewireForm.projectStatus = 'Proposal'
        this.firewireSaveMessage = 'Generating proposal...'

        this.saveFirewireProjectRequest().subscribe((saved) => {
            if (!saved) {
                this.firewireForm.projectStatus = previousStatus
                return
            }
            this.firewireSaveMessage = 'Project moved to Proposal.'
        })
    }

    private saveFirewireProjectRequest(options?: { silent?: boolean }): Observable<boolean> {
        if (!this.projectId || !this.firewireProject || this.isFirewireProjectLocked()) {
            return of(false)
        }

        const silent = !!options?.silent
        this.firewireSaveWorking = true
        if (!silent) {
            this.firewireSaveMessage = 'Saving project...'
        }

        return this.http.patch(`/api/firewire/projects/firewire/${this.projectId}`, {
            ...this.firewireForm,
            worksheetData: this.buildWorksheetStateSnapshot()
        }).pipe(
            map((response: any) => {
                if (response?.data) {
                    this.applyFirewireProject(response.data)
                    this.applyWorksheetState(response.data.worksheetData)
                    this.captureInitialProjectState()
                }
                this.firewireSaveWorking = false
                this.firewireSaveMessage = silent ? '' : 'Project saved.'
                return true
            }),
            catchError((err: any) => {
                this.firewireSaveWorking = false
                this.firewireSaveMessage = silent ? '' : (err?.error?.message || err?.message || 'Project save failed.')
                console.error(err)
                return of(false)
            })
        )
    }

    onSummaryViewModeChange(value: 'Grid' | 'Chart') {
        const nextValue = value === 'Grid' ? 'Grid' : 'Chart'
        if (this.summaryViewMode === nextValue) {
            return
        }

        this.summaryViewMode = nextValue
        this.storeSummaryViewMode(nextValue)
    }

    toggleProjectFavorite() {
        if (typeof localStorage === 'undefined' || !this.projectId) {
            return
        }

        try {
            const ids = JSON.parse(localStorage.getItem(this.favoriteProjectsStorageKey) || '[]') as string[]
            const nextIds = Array.isArray(ids) ? [...ids] : []
            const index = nextIds.indexOf(this.projectId)
            if (index >= 0) {
                nextIds.splice(index, 1)
                this.firewireSaveMessage = 'Removed from favorites.'
            } else {
                nextIds.unshift(this.projectId)
                this.firewireSaveMessage = 'Marked as favorite.'
            }
            localStorage.setItem(this.favoriteProjectsStorageKey, JSON.stringify(nextIds))
        } catch (err) {
            console.error(err)
        }
    }

    saveProjectAsTemplate() {
        if (!this.firewireProject) {
            return
        }

        const suggestedName = this.selectedTemplate || this.firewireForm.projectNbr || this.firewireForm.name || 'Template'
        this.dialog.open(ProjectTemplateDialog, {
            width: '420px',
            maxWidth: '78vw',
            data: {
                mode: 'save',
                templates: this.getProjectTemplateDialogItems(),
                selectedTemplateId: this.getSelectedTemplateId(),
                suggestedName,
                suggestedVisibility: 'Private'
            }
        }).afterClosed().subscribe((result?: SaveProjectTemplateDialogResult | null) => {
            if (!result || !result.name) {
                return
            }

            const payload = {
                templateId: result.templateId || null,
                name: result.name,
                visibility: result.visibility,
                firewireForm: {
                    projectType: this.firewireForm.projectType,
                    jobType: this.firewireForm.jobType,
                    scopeType: this.firewireForm.scopeType,
                    projectScope: this.firewireForm.projectScope,
                    difficulty: this.firewireForm.difficulty
                },
                worksheetData: this.buildWorksheetStateSnapshot()
            }

            this.http.post<{ data: ProjectTemplateRecord }>('/api/firewire/project-templates', payload).subscribe({
                next: (response) => {
                    const saved = response?.data
                    if (!saved) {
                        return
                    }
                    this.selectedTemplate = saved.name
                    this.selectedTemplateId = saved.templateId
                    this.upsertProjectTemplate(saved)
                    this.firewireSaveMessage = `Template "${saved.name}" saved as ${saved.visibility.toLowerCase()}.`
                },
                error: (err) => {
                    console.error(err)
                    this.firewireSaveMessage = this.resolveErrorMessage(err, 'Unable to save template.')
                }
            })
        })
    }

    loadProjectFromTemplate() {
        if (this.isFirewireProjectLocked()) {
            this.firewireSaveMessage = 'Templates cannot be loaded while this project is locked.'
            return
        }

        const templateList = this.projectTemplates
        if (templateList.length <= 0) {
            this.firewireSaveMessage = 'No saved templates.'
            return
        }

        this.dialog.open(ProjectTemplateDialog, {
            width: '420px',
            maxWidth: '78vw',
            data: {
                mode: 'load',
                templates: this.getProjectTemplateDialogItems(),
                selectedTemplateId: this.getSelectedTemplateId() || templateList[0].templateId
            }
        }).afterClosed().subscribe((selectedTemplateId?: string | null) => {
            const template = this.projectTemplates.find((item) => item.templateId === selectedTemplateId)
            if (!template) {
                return
            }

            this.selectedTemplate = template.name
            this.selectedTemplateId = template.templateId
            const templateForm = this.getSanitizedTemplateFirewireForm(template.firewireForm)
            if (this.isProjectTypeLocked()) {
                templateForm.projectType = this.firewireForm.projectType || 'Fire Alarm'
            }
            this.firewireForm = {
                ...this.firewireForm,
                ...templateForm
            }
            this.applyWorksheetState(template.worksheetData)
            this.firewireSaveMessage = `Template "${template.name}" loaded.`
        })
    }

    openJobCostSheet() {
        const defaultFileName = this.buildSummarySheetFileName('Job Cost Project Set Up Sheet')
        this.dialog.open(JobCostSheetDialog, {
            width: '980px',
            maxWidth: '980px',
            minWidth: '0',
            panelClass: 'job-cost-sheet-dialog-pane',
            data: {
                defaultFileName,
                createSheet: (fileName: string, html: string) => this.saveGeneratedEstimatingSheet(fileName, html),
                firetrolJobNumber: this.firewireForm.projectNbr || '',
                projectName: this.firewireForm.name || this.firewireProject?.name || '',
                projectAddress: this.firewireForm.address || '',
                salesperson: this.firewireForm.salesman || '',
                startDate: this.formatDateForDisplay(this.firewireBidDueDate),
                completionDate: '',
                contractAmount: this.getSummaryQuotedWithTax(),
                estDeviceCount: this.getSummaryDeviceCount(),
                estSqFootage: Number(this.firewireForm.totalSqFt || 0),
                jobType: this.firewireForm.jobType || '',
                projectScope: this.firewireForm.projectScope || '',
                scopeOfWork: this.firewireForm.projectScope || ''
            }
        })
    }

    openEstimateFaceSheet() {
        const defaultFileName = this.buildSummarySheetFileName('Estimate Face Sheet')
        this.dialog.open(EstimateFaceSheetDialog, {
            width: '980px',
            maxWidth: '980px',
            minWidth: '0',
            panelClass: 'job-cost-sheet-dialog-pane',
            data: {
                defaultFileName,
                createSheet: (fileName: string, html: string) => this.saveGeneratedEstimatingSheet(fileName, html),
                date: this.formatDateForDisplay(new Date()),
                firetrolJobNumber: this.firewireForm.projectNbr || '',
                projectName: this.firewireForm.name || this.firewireProject?.name || '',
                estimator: this.firewireForm.salesman || '',
                projectAddress: this.firewireForm.address || '',
                contractor: '',
                billingAddress: '',
                descriptionOfWork: this.firewireForm.projectScope || '',
                materialBuyout: this.getInstallationMaterialTotal(),
                rentalTotal: this.getRentalEquipmentTotal(),
                fieldLaborHours: this.getInstallationLaborTotalHours(),
                fieldLaborRate: this.getInstallationLaborTotalHours() > 0
                    ? this.getInstallationLaborTotalCost() / this.getInstallationLaborTotalHours()
                    : this.getInstallationHourlyRate(),
                fieldLaborBaseCost: this.getInstallationLaborTotalCost(),
                fieldLaborCost: this.getInstallationLaborTotalCost(),
                permitsTotal: this.getPermitAndFeesTotal(),
                subcontractTotal: this.getSubcontractTotal(),
                otherTotal: this.getSpecialMarkupTotal(),
                contractCost: this.getTotalJobCost(),
                contractGainPercent: this.getSummaryQuotedPreTax() > 0
                    ? ((this.getSummaryQuotedPreTax() - this.getTotalJobCost()) / this.getSummaryQuotedPreTax()) * 100
                    : 0,
                contractGainAmount: this.getSummaryQuotedPreTax() - this.getTotalJobCost(),
                contractTotalWithoutTax: this.getSummaryQuotedPreTax(),
                totalHeads: this.getSummaryDeviceCount(),
                squareFootage: Number(this.firewireForm.totalSqFt || 0),
                insideHoursPerHead: this.getSummaryMetricPerDevice(this.getSummaryFieldHours()),
                dollarsPerHead: this.getSummaryMetricPerDevice(this.getSummaryQuotedPreTax()),
                dollarsPerSquareFoot: this.getSummaryMetricPerSqFt(this.getSummaryQuotedPreTax())
            }
        })
    }

    openQuoteSheet() {
        const projectAddress = this.firewireForm.address || ''
        const parsedAddress = this.parseProjectAddress(projectAddress)
        const cityStateZip = [parsedAddress.city, parsedAddress.state, parsedAddress.zip].filter((value) => value).join(', ').replace(', ,', ',')
        const defaultFileName = this.buildSummarySheetFileName('Quote Sheet')
        const quoteScopeLines = [
            this.firewireForm.projectScope ? `${this.firewireForm.projectScope} scope prepared for ${this.firewireForm.name || 'this project'}.` : '',
            this.firewireForm.scopeType ? `${this.firewireForm.scopeType} execution is included per current estimate assumptions.` : '',
            this.firewireForm.jobType ? `Job type classified as ${this.firewireForm.jobType}.` : '',
            this.firewireForm.difficulty ? `Difficulty profile: ${this.firewireForm.difficulty}.` : ''
        ].filter((value) => value).join('\n')

        this.dialog.open(QuoteSheetDialog, {
            width: '980px',
            maxWidth: '980px',
            minWidth: '0',
            panelClass: 'job-cost-sheet-dialog-pane',
            data: {
                defaultFileName,
                createSheet: (fileName: string, html: string) => this.saveGeneratedEstimatingSheet(fileName, html),
                projectName: this.firewireForm.name || this.firewireProject?.name || '',
                projectAddress: parsedAddress.street || projectAddress,
                projectCityStateZip: cityStateZip,
                phone: '',
                fax: '',
                customer: 'Bidding Contractor',
                department: 'Estimating Department',
                scopeOfWork: quoteScopeLines || this.firewireForm.projectScope || '',
                specifications: '',
                addenda: '',
                plans: '',
                deviations: 'Backboxes and conduit to be provided by others unless specifically noted.\nPermit exclusions and other planning assumptions remain as listed in the estimate.',
                proposalNarrative: 'Firetrol will perform a turnkey installation of the afore mentioned equipment including cable. Electrician is to provide all raceway, accessible j-boxes must be installed per NEC, and all exclusions apply. Price is valid for sixty days. Excludes any applicable taxes unless otherwise noted.',
                lineItems: [
                    {
                        id: '1',
                        description: `${this.getSummaryScopeLabel()} quotation for ${this.firewireForm.name || 'project'}`,
                        qty: 1,
                        amount: this.getSummaryQuotedPreTax()
                    },
                    {
                        id: '2',
                        description: 'Sales tax if applicable',
                        qty: 1,
                        amount: this.getSummaryMaterialTaxAmount()
                    }
                ],
                subtotal: this.getSummaryQuotedPreTax(),
                taxRatePercent: this.getSummaryEffectiveMaterialTaxRate(),
                salesTaxAmount: this.getSummaryMaterialTaxAmount(),
                shippingHandling: 0,
                total: this.getSummaryQuotedWithTax(),
                signatureName: 'Your Name Here',
                signatureDate: this.formatDateForDisplay(new Date()),
                termsAndConditions: `TERMS AND CONDITIONS

REPORTS
The inspection and/or test shall be completed on the Contractors then current Report form, which shall be given to the Owner, with a copy to the authority having jurisdiction. The Report and recommendations by the Contractor are only advisory in nature and are intended to assist Owner in reducing the possibility of loss to property by indicating obvious defects or impairments noted to the system and equipment inspected and/or tested which require prompt consideration. They are not intended to imply that all other defects, hazards, or aspects of the system and equipment are under control at the time of inspection. Final responsibility for the condition and operation of the sprinkler system and/or fire alarm and detection system equipment lies with the Owner.

FIRE ALARM AND DETECTION SYSTEMS
In the event that the subscriber elects to have the fire alarm and detection system tested, it is understood that a random sampling of detection devices will be tested during each visit so that the entire system will have been tested at the end of each contract year. Prior to any tests, all persons who would automatically receive an alarm shall be notified, so that an unnecessary response shall not take place. Schematics and/or wiring diagrams must be provided by the contract Owner.

EMERGENCY SERVICE
Emergency service requested by the Owner will be furnished at extra charge.

ADDITIONAL EQUIPMENT
In the event additional equipment is installed after the date of this contract, the annual inspection charge shall be increased in accordance with contractors prevailing rates as of the first inspection of such additional equipment.

WORK NOT INCLUDED
The inspection and testing provided under this agreement does not include any maintenance, repairs, alterations, replacement of parts or any field adjustments whatsoever. Should any such work be requested by Owner there will be as an increased amount added to this agreement. The contractor shall furnish the Owner with an estimated price before any additional work is performed.

ACCEPTANCE OF TERMS
No changes or modifications are to be made without the express written consent of an executive officer of the Company. Contractor is not bound by any provisions printed or otherwise at variance with this agreement that may appear on any acknowledgment or other form used by Owner, such provisions being hereby expressly rejected.

ENTRY
Contractor may enter Owners premises at all reasonable times to perform the inspections required by this contract.

WATER SUPPLY
Contractor shall not be liable or responsible for the adequacy or condition of the existing water supply.

RELATED AND OTHER SYSTEMS
It is the owners/occupants sole responsibility to fully identify and disclose any system or equipment that may be connected, related, interfaced or otherwise affected by the inspections and testing of the systems the owner or occupant requests Service Contractor to inspect or test. Further, the owner/occupant will have experience personnel on hand to disconnect, protect or other wise guard and any related, unrelated, connected or interfaced systems that may be affected as a result of the inspections and testing performed by the Service Contractor.

ASSIGNMENT
This contract shall constitute a personal agreement between Contractor and Owner and shall be assignable by either party only with the written consent of the other.

LIMITATION OF LIABILITY
The Service Contractor makes NO WARRANTIES, EXPRIISS, OR IMPLIED, INCLUDING, WITHOUT LIMITATION, WARRANTIES OF PERFORMANCE OR WARRANTIES OF FITNESS FOR A PARTICULAR PURPOSE. No promise not contained herein or affirmation of fact made by any employee, agent or representative of the Service Contractor shall constitute a warranty by the Service Provider or give rise to any liability or obligation.

Contractors liability to Owner for personal injury, death, or property damage arising from performance under this contract shall be limited to the contract price. Owner shall hold Contractor harmless from any and all third party claims for personal injury, death or property damage, arising from Owners failure to maintain these systems or keep them in operative condition, whether based upon contract, warranty, tort, strict liability or otherwise. In no event shall the Service Contractor be liable for any special, indirect, incidental, consequential or liquidated, penal or any economic loss damages of any character, including but not limited to loss of use of the Owners property, lost profits or lost production, whether claimed by the Owner or by any third party, irrespective of whether claims or actions for such damage are based upon contract, warranty, negligence, tort, strict liability or otherwise.

11111 Landmark 35 Drive San Antonio, Texas 78233  www.firetrol.net
FIRE PROTECTION AND LIFE SAFETY SPECIALISTS`
            }
        })
    }

    openContractSetupSheet() {
        const defaultFileName = this.buildSummarySheetFileName('Contract Set Up')
        this.dialog.open(ContractSetupDialog, {
            width: '1080px',
            maxWidth: '1080px',
            minWidth: '0',
            panelClass: 'job-cost-sheet-dialog-pane',
            data: {
                defaultFileName,
                createSheet: (fileName: string, html: string) => this.saveGeneratedEstimatingSheet(fileName, html),
                firetrolJobNumber: this.firewireForm.projectNbr || '',
                projectName: this.firewireForm.name || this.firewireProject?.name || '',
                projectAddress: this.firewireForm.address || '',
                projectType: this.firewireForm.projectType || this.firewireProject?.projectType || 'Fire Alarm',
                jobType: this.firewireForm.jobType || '',
                scopeType: this.firewireForm.scopeType || '',
                scopeOfWork: this.firewireForm.projectScope || '',
                salesperson: this.firewireForm.salesman || '',
                date: this.formatDateForDisplay(new Date()),
                startDate: '',
                completionDate: '',
                contractPoNumber: '',
                contractAmount: this.getSummaryQuotedWithTax(),
                estDeviceCount: this.getSummaryDeviceCount(),
                estSqFootage: Number(this.firewireForm.totalSqFt || 0),
                taxable: this.getSummaryMaterialTaxAmount() > 0
            }
        })
    }

    openBookingFaceSheet() {
        const parsedAddress = this.parseProjectAddress(this.firewireForm.address || '')
        const defaultFileName = this.buildSummarySheetFileName('Booking Face Sheet')
        this.dialog.open(BookingFaceSheetDialog, {
            width: '1120px',
            maxWidth: '1120px',
            minWidth: '0',
            panelClass: 'job-cost-sheet-dialog-pane',
            data: {
                defaultFileName,
                createSheet: (fileName: string, html: string) => this.saveGeneratedEstimatingSheet(fileName, html),
                date: this.formatDateForDisplay(new Date()),
                firetrolJobNumber: this.firewireForm.projectNbr || '',
                projectName: this.firewireForm.name || this.firewireProject?.name || '',
                estimator: this.firewireForm.salesman || '',
                projectStreet: parsedAddress.street || this.firewireForm.address || '',
                projectCity: parsedAddress.city,
                projectState: parsedAddress.state,
                projectZip: parsedAddress.zip,
                contractor: '',
                phone: '',
                fax: '',
                billingStreet: parsedAddress.street || this.firewireForm.address || '',
                billingCity: parsedAddress.city,
                billingState: parsedAddress.state,
                billingZip: parsedAddress.zip,
                descriptionOfWork: this.firewireForm.projectScope || '',
                materialsBuyout: this.getInstallationMaterialTotal(),
                materialOther: this.getEquipmentMaterialTotal(),
                rentalInside: this.getRentalEquipmentTotal(),
                fieldLaborHours: this.getInstallationLaborTotalHours(),
                fieldLaborRate: this.getInstallationLaborTotalHours() > 0
                    ? this.getInstallationLaborTotalCost() / this.getInstallationLaborTotalHours()
                    : this.getInstallationHourlyRate(),
                fieldLaborCost: this.getInstallationLaborTotalCost(),
                permitsTotal: this.getPermitAndFeesTotal(),
                subcontractTotal: this.getSubcontractTotal(),
                otherTotal: this.getSpecialMarkupTotal(),
                contractCost: this.getTotalJobCost(),
                contractGainPercent: this.getSummaryQuotedPreTax() > 0
                    ? ((this.getSummaryQuotedPreTax() - this.getTotalJobCost()) / this.getSummaryQuotedPreTax()) * 100
                    : 0,
                contractGainAmount: this.getSummaryQuotedPreTax() - this.getTotalJobCost(),
                contractTotal: this.getSummaryQuotedWithTax(),
                totalHeads: this.getSummaryDeviceCount(),
                squareFootage: Number(this.firewireForm.totalSqFt || 0),
                insideHoursPerHead: this.getSummaryMetricPerDevice(this.getSummaryFieldHours()),
                dollarsPerHead: this.getSummaryMetricPerDevice(this.getSummaryQuotedPreTax()),
                dollarsPerSquareFoot: this.getSummaryMetricPerSqFt(this.getSummaryQuotedPreTax())
            }
        })
    }

    openScheduleOfValuesSheet() {
        const defaultFileName = this.buildSummarySheetFileName('Schedule Of Values')
        this.dialog.open(ScheduleOfValuesDialog, {
            width: '1160px',
            maxWidth: '1160px',
            minWidth: '0',
            panelClass: 'job-cost-sheet-dialog-pane',
            data: {
                defaultFileName,
                createSheet: (fileName: string, html: string) => this.saveGeneratedEstimatingSheet(fileName, html),
                applicationNumber: '',
                applicationDate: this.formatDateForDisplay(new Date()),
                periodTo: '',
                firetrolContractNo: this.firewireForm.projectNbr || '0',
                projectName: this.firewireForm.name || this.firewireProject?.name || '',
                rows: [
                    {
                        itemNo: '01',
                        description: 'Material',
                        scheduledValue: this.getInstallationMaterialTotal() + this.getEquipmentMaterialTotal(),
                        previousApplication: 0,
                        thisPeriod: 0,
                        materialsPresentlyStored: 0,
                        percentGc: 0
                    },
                    {
                        itemNo: '02',
                        description: 'Labor',
                        scheduledValue: this.getInstallationLaborTotalCost(),
                        previousApplication: 0,
                        thisPeriod: 0,
                        materialsPresentlyStored: 0,
                        percentGc: 0
                    }
                ]
            }
        })
    }

    private parseProjectAddress(value: string | null | undefined): { street: string, city: string, state: string, zip: string } {
        const input = String(value || '').trim()
        if (!input) {
            return { street: '', city: '', state: '', zip: '' }
        }

        const normalized = input.replace(/\r?\n/g, ', ').replace(/\s+/g, ' ').trim()
        const match = /^(.*?)(?:,\s*|\s+)([A-Za-z .'-]+?)(?:,\s*|\s+)([A-Z]{2})\s+(\d{5}(?:-\d{4})?)$/i.exec(normalized)
        if (!match) {
            return { street: input, city: '', state: '', zip: '' }
        }

        return {
            street: match[1].trim(),
            city: match[2].trim(),
            state: match[3].toUpperCase(),
            zip: match[4].trim()
        }
    }

    private createEmptyBomRow(): ProjectBomRow {
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

    private getBomCategoryByName(categoryName: string): Category | undefined {
        const normalized = String(categoryName || '').trim().toLowerCase()
        return this.categories.find((category) => String(category.name || '').trim().toLowerCase() === normalized)
    }

    private normalizeBomSections(input: any): ProjectBomSection[] {
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

    private buildBomSectionSnapshot(): ProjectBomSection[] {
        return (this.bomSections || []).map((section) => ({
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

    private async ensureBomLookupDataLoaded(): Promise<void> {
        if (this.vendorPartLookupWorking) {
            return
        }

        const requests: Promise<unknown>[] = []

        if (!this.vendorPartLookupLoaded) {
            this.vendorPartLookupWorking = true
            requests.push(firstValueFrom(this.http.get<{ rows?: VwEddyPricelist[] }>('/api/firewire/vweddypricelist'))
                .then((response) => {
                    this.vendorPartRows = Array.isArray(response?.rows) ? response.rows : []
                    this.vendorPartLookupLoaded = true
                })
                .finally(() => {
                    this.vendorPartLookupWorking = false
                }))
        }

        if (this.categories.length <= 0) {
            requests.push(firstValueFrom(this.http.get<{ rows?: Category[] }>('/api/firewire/categories'))
                .then((response) => {
                    this.categories = Array.isArray(response?.rows) ? response.rows : []
                }))
        }

        if (requests.length > 0) {
            await Promise.all(requests)
        }
    }

    toggleProjectManualLock() {
        if (this.isProjectStatusLocked() || !this.projectId || !this.firewireProject) {
            return
        }

        const isLocked = !this.isProjectManuallyLocked()
        this.http.patch<{ data: FirewireProjectSchema }>(`/api/firewire/projects/firewire/${this.projectId}/lock`, {
            isLocked
        }).subscribe({
            next: (response) => {
                if (response?.data) {
                    this.firewireProject = response.data
                    this.firewireSaveMessage = isLocked ? 'Project manually locked.' : 'Manual lock removed.'
                }
            },
            error: (err) => {
                console.error(err)
                this.firewireSaveMessage = this.resolveErrorMessage(err, 'Unable to update project lock.')
            }
        })
    }

    resetFirewireForm() {
        if (!this.firewireProject || this.isFirewireProjectLocked()) {
            return
        }
        this.applyFirewireProject(this.firewireProject)
        this.applyWorksheetState(this.firewireProject.worksheetData)
        this.captureInitialProjectState()
        this.firewireSaveMessage = ''
    }

    onUploadProjectDocumentsClick(fileInput: HTMLInputElement) {
        this.clearProjectUploadErrorToast()
        void this.chooseDocLibraryFolderForUpload(fileInput)
    }

    canDeactivate(): boolean | Observable<boolean> {
        if (!this.isProjectDirty) {
            return true
        }

        return this.dialog.open(ConfirmFirewireNavigationDialog, {
            width: '360px',
            maxWidth: '88vw',
            panelClass: 'fw-compact-dialog-pane',
            data: {
                title: 'Leave Project Detail?',
                message: 'You have unsaved Firewire project changes.',
                canSave: !this.isFirewireProjectLocked()
            }
        }).afterClosed().pipe(
            map((result) => result || 'stay'),
            switchMap((result) => {
                if (result === 'leave') {
                    return of(true)
                }
                if (result === 'save') {
                    return this.saveFirewireProjectRequest()
                }
                return of(false)
            })
        )
    }

    async onProjectDocumentFileSelected(event: Event) {
        const input = event.target as HTMLInputElement | null
        if (!input || !input.files || input.files.length <= 0) {
            return
        }

        this.projectDocumentUploadBusy = true
        this.clearProjectUploadErrorToast()

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

            if (uploadedCount > 0 || versionedCount > 0) {
                const summaryParts = []
                if (uploadedCount > 0) {
                    summaryParts.push(`${uploadedCount} new`)
                }
                if (versionedCount > 0) {
                    summaryParts.push(`${versionedCount} updated`)
                }
                this.docLibraryStatusMessage = `Document library updated: ${summaryParts.join(', ')} file${uploadedCount + versionedCount === 1 ? '' : 's'}.`
            }
        } catch (err: any) {
            this.showProjectUploadErrorToast(err?.message || 'Document upload failed.')
            console.error('Project document upload failed.', err)
        } finally {
            this.projectDocumentUploadBusy = false
            input.value = ''
        }
    }

    async downloadDocLibraryFile(fileId: string, versionId?: string): Promise<void> {
        const file = this.docLibraryFiles.find((item) => item.id === fileId)
        if (!file) {
            return
        }

        const version = versionId
            ? file.versions.find((item) => item.id === versionId)
            : this.getLatestDocLibraryVersion(file)
        if (!version) {
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

    async openDocLibraryVersions(fileId: string): Promise<void> {
        const file = this.docLibraryFiles.find((item) => item.id === fileId)
        if (!file) {
            return
        }

        await firstValueFrom(this.dialog.open(ProjectDocLibraryVersionsDialog, {
            width: '720px',
            maxWidth: '94vw',
            panelClass: 'fw-medium-dialog-pane',
            data: {
                fileName: file.name,
                versions: [...file.versions].sort((a, b) => b.versionNumber - a.versionNumber),
                onDownload: (versionId: string) => {
                    void this.downloadDocLibraryFile(file.id, versionId)
                }
            } as ProjectDocLibraryVersionsDialogData
        }).afterClosed())
    }

    async moveDocLibraryFile(fileId: string): Promise<void> {
        const file = this.docLibraryFiles.find((item) => item.id === fileId)
        if (!file) {
            return
        }

        const targetFolderId = await this.openDocLibraryCategoryDialog('Move To Category', 'Move File', file.folderId)
        if (!targetFolderId || targetFolderId === file.folderId) {
            return
        }

        file.folderId = targetFolderId
        file.updatedAt = new Date().toISOString()
        await this.persistDocLibraryWorkspace()
        this.docLibraryStatusMessage = `Moved ${file.name} to ${this.getDocLibraryFolderLabel(targetFolderId)}.`
    }

    async deleteDocLibraryFile(fileId: string): Promise<void> {
        const file = this.docLibraryFiles.find((item) => item.id === fileId)
        if (!file) {
            return
        }

        const confirmed = await firstValueFrom(this.dialog.open(ProjectDocLibraryDeleteDialog, {
            width: '420px',
            maxWidth: '92vw',
            panelClass: 'fw-compact-dialog-pane',
            data: {
                fileName: file.name
            } as ProjectDocLibraryDeleteDialogData
        }).afterClosed())

        if (!confirmed) {
            return
        }

        this.docLibraryFiles = this.docLibraryFiles.filter((item) => item.id !== fileId)
        await this.persistDocLibraryWorkspace()
        this.docLibraryStatusMessage = `Deleted ${file.name}.`
    }

    async saveGeneratedEstimatingSheet(fileName: string, html: string): Promise<void> {
        const normalizedFileName = this.ensureHtmlFileName(fileName)
        const now = new Date().toISOString()
        const dataUrl = this.textToDataUrl(html, 'text/html')
        const duplicate = this.docLibraryFiles.find((item) =>
            item.folderId === 'estimating'
            && item.name.toLowerCase() === normalizedFileName.toLowerCase())

        if (duplicate) {
            duplicate.versions.push({
                id: this.createClientId(),
                versionNumber: duplicate.versions.length + 1,
                uploadedAt: now,
                uploadedBy: 'Current User',
                sourceFileName: normalizedFileName,
                sizeBytes: new Blob([html], { type: 'text/html' }).size,
                mimeType: 'text/html',
                lastModified: Date.now(),
                dataUrl
            })
            duplicate.updatedAt = now
        } else {
            this.docLibraryFiles.push({
                id: this.createClientId(),
                folderId: 'estimating',
                name: normalizedFileName,
                extension: 'html',
                createdAt: now,
                updatedAt: now,
                versions: [
                    {
                        id: this.createClientId(),
                        versionNumber: 1,
                        uploadedAt: now,
                        uploadedBy: 'Current User',
                        sourceFileName: normalizedFileName,
                        sizeBytes: new Blob([html], { type: 'text/html' }).size,
                        mimeType: 'text/html',
                        lastModified: Date.now(),
                        dataUrl
                    }
                ]
            })
        }

        await this.persistDocLibraryWorkspace()
        this.docLibraryStatusMessage = `Saved ${normalizedFileName} to Estimating.`
    }

    private getDocLibraryVisibleRecords(): ProjectDocLibraryFileRecord[] {
        if (this.selectedDocLibraryFolder === 'all') {
            return this.docLibraryFiles
        }
        return this.docLibraryFiles.filter((file) => file.folderId === this.selectedDocLibraryFolder)
    }

    private getDocLibraryFolderLabel(folderId: string): string {
        return this.docLibraryFolderDefinitions.find((folder) => folder.id === folderId)?.label || 'Unfiled'
    }

    private async chooseDocLibraryFolderForUpload(fileInput: HTMLInputElement): Promise<void> {
        if (this.selectedDocLibraryFolder !== 'all') {
            fileInput.click()
            return
        }

        const selectedFolderId = await this.openDocLibraryCategoryDialog('Upload Documents', 'Choose Category', 'estimating')
        if (!selectedFolderId) {
            return
        }

        this.selectedDocLibraryFolder = selectedFolderId
        fileInput.click()
    }

    private async openDocLibraryCategoryDialog(title: string, confirmLabel: string, selectedFolderId: string): Promise<string | undefined> {
        return firstValueFrom(this.dialog.open(ProjectDocLibraryCategoryDialog, {
            width: '420px',
            maxWidth: '92vw',
            panelClass: 'fw-compact-dialog-pane',
            data: {
                title,
                confirmLabel,
                selectedFolderId,
                folders: this.docLibraryFolderDefinitions.map((folder) => ({ id: folder.id, label: folder.label }))
            } as ProjectDocLibraryCategoryDialogData
        }).afterClosed())
    }

    private getLatestDocLibraryVersion(file: ProjectDocLibraryFileRecord): ProjectDocLibraryFileVersionRecord | undefined {
        if (!file.versions || file.versions.length <= 0) {
            return undefined
        }
        return file.versions[file.versions.length - 1]
    }

    private async uploadDocLibraryFile(file: File): Promise<'uploaded' | 'versioned' | 'skipped'> {
        if (this.selectedDocLibraryFolder === 'all') {
            throw new Error('Select a document library section before uploading.')
        }

        const duplicate = this.docLibraryFiles.find((item) =>
            item.folderId === this.selectedDocLibraryFolder
            && item.name.toLowerCase() === file.name.toLowerCase())
        const dataUrl = await this.readFileAsDataUrl(file)
        const now = new Date().toISOString()

        if (duplicate) {
            const dialogRef = this.dialog.open(ProjectDocLibraryOverwriteDialog, {
                panelClass: 'fw-medium-dialog-pane',
                data: {
                    fileName: duplicate.name,
                    nextVersionNumber: duplicate.versions.length + 1
                } as ProjectDocLibraryOverwriteDialogData
            })
            const shouldOverwrite = await firstValueFrom(dialogRef.afterClosed())
            if (!shouldOverwrite) {
                return 'skipped'
            }

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

        this.docLibraryFiles.push({
            id: this.createClientId(),
            folderId: this.selectedDocLibraryFolder,
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
        })
        return 'uploaded'
    }

    private async persistDocLibraryWorkspace(): Promise<void> {
        await this.projectDocLibraryStorage.saveWorkspace(this.getDocLibraryStorageKey(), {
            files: this.docLibraryFiles
        })
    }

    private async loadDocLibraryWorkspace(): Promise<void> {
        const storageKey = this.getDocLibraryStorageKey()
        this.docLibraryFiles = []
        this.docLibraryStatusMessage = ''

        const workspaces = await Promise.all(this.getDocLibraryStorageKeys().map((key) => this.projectDocLibraryStorage.loadWorkspace(key)))
        if (storageKey !== this.getDocLibraryStorageKey()) {
            return
        }
        this.docLibraryFiles = this.mergeDocLibraryFiles(workspaces.flatMap((workspace) => workspace.files || []))
    }

    private mergeDocLibraryFiles(files: ProjectDocLibraryFileRecord[]): ProjectDocLibraryFileRecord[] {
        const byKey = new Map<string, ProjectDocLibraryFileRecord>()

        for (const file of files) {
            const fileKey = `${String(file.folderId || '').toLowerCase()}::${String(file.name || '').toLowerCase()}`
            const existing = byKey.get(fileKey)
            if (!existing) {
                byKey.set(fileKey, {
                    ...file,
                    versions: [...(file.versions || [])]
                })
                continue
            }

            const mergedVersions = [...(existing.versions || []), ...(file.versions || [])]
            const seenVersionIds = new Set<string>()
            existing.versions = mergedVersions.filter((version) => {
                const versionKey = String(version?.id || `${version?.uploadedAt || ''}:${version?.sourceFileName || ''}:${version?.versionNumber || ''}`)
                if (seenVersionIds.has(versionKey)) {
                    return false
                }
                seenVersionIds.add(versionKey)
                return true
            }).sort((left, right) => Number(left?.versionNumber || 0) - Number(right?.versionNumber || 0))

            existing.createdAt = String(existing.createdAt || '') <= String(file.createdAt || '') ? existing.createdAt : file.createdAt
            existing.updatedAt = String(existing.updatedAt || '') >= String(file.updatedAt || '') ? existing.updatedAt : file.updatedAt
        }

        return [...byKey.values()].sort((left, right) => String(right.updatedAt || right.createdAt || '').localeCompare(String(left.updatedAt || left.createdAt || '')))
    }

    private getDocLibraryExtension(fileName: string): string {
        const dotIndex = fileName.lastIndexOf('.')
        if (dotIndex <= 0 || dotIndex === fileName.length - 1) {
            return ''
        }
        return fileName.slice(dotIndex + 1).toLowerCase()
    }

    private ensureHtmlFileName(fileName: string): string {
        const trimmed = (fileName || '').trim() || 'generated-sheet.html'
        return trimmed.toLowerCase().endsWith('.html') ? trimmed : `${trimmed}.html`
    }

    private buildSummarySheetFileName(sheetLabel: string): string {
        const projectKey = (this.firewireForm.projectNbr || this.firewireProject?.projectNbr || this.firewireForm.name || this.firewireProject?.name || 'Project').trim()
        const normalizedLabel = sheetLabel.trim() || 'Sheet'
        return `${projectKey} - ${normalizedLabel}.html`
    }

    private textToDataUrl(content: string, mimeType: string): string {
        const utf8 = encodeURIComponent(content).replace(/%([0-9A-F]{2})/g, (_, hex: string) =>
            String.fromCharCode(parseInt(hex, 16)))
        return `data:${mimeType};base64,${btoa(utf8)}`
    }

    private readFileAsDataUrl(file: File): Promise<string> {
        return new Promise((resolve, reject) => {
            const reader = new FileReader()
            reader.onload = () => resolve(String(reader.result || ''))
            reader.onerror = () => reject(reader.error)
            reader.readAsDataURL(file)
        })
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

    private createClientId(): string {
        if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
            return crypto.randomUUID()
        }
        return `${Date.now()}-${Math.random().toString(16).slice(2)}`
    }

    private resetPageState() {
        this.pageWorking = true
        this.project = undefined
        this.firewireProject = undefined
        this.fieldwireProjectId = null
        this.fieldwireProjects = []
        this.projectTemplates = []
        this.selectedTemplateId = ''
        this.firewireForm = this.createEmptyFirewireForm()
        this.firewireBidDueDate = null
        this.initialFirewireFormState = this.serializeFirewireForm(this.firewireForm)
        this.resetWorksheetState()
        this.initialWorksheetState = this.serializeWorksheetState(this.buildWorksheetStateSnapshot())
        this.firewireSaveWorking = false
        this.firewireSaveMessage = ''
        this.projectDocumentUploadBusy = false
        this.docLibraryFiles = []
        this.docLibraryStatusMessage = ''
        this.selectedDocLibraryFolder = 'all'
        this.clearProjectUploadErrorToast()
        this.systemWeatherForecast = []
        this.systemWeatherLoading = false
        this.systemWeatherStatus = ''
        this.systemMapError = ''
        this.resetSystemMap()
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

        this.http.get('/api/firewire/projects').subscribe({
            next: (response: any) => {
                const rows = Array.isArray(response?.rows) ? response.rows as ProjectListItemSchema[] : []
                this.linkedFieldwireProjectIds = new Set(
                    rows
                        .filter((row) => !!row.firewireProjectId)
                        .map((row) => row.fieldwireProjectId || row.fieldwireId)
                        .filter((value): value is string => !!value)
                        .map((value) => String(value))
                )
            },
            error: (err) => {
                console.error(err)
                this.linkedFieldwireProjectIds = new Set<string>()
            }
        })
    }

    private loadProjectTemplates() {
        this.http.get<{ rows: ProjectTemplateRecord[] }>('/api/firewire/project-templates').subscribe({
            next: (response) => {
                this.projectTemplates = Array.isArray(response?.rows) ? response.rows : []
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
                    this.applyWorksheetState(response.data.worksheetData)
                    this.captureInitialProjectState()
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
            worksheetData: project.worksheetData,
            name: project.name,
            projectNbr: project.projectNbr,
            address: project.address,
            bidDueDate: this.toDateInputValue(project.bidDueDate),
            projectStatus: project.projectStatus,
            projectType: project.projectType,
            salesman: project.salesman,
            jobType: project.jobType,
            scopeType: project.scopeType,
            projectScope: project.projectScope,
            difficulty: project.difficulty,
            totalSqFt: project.totalSqFt
        }
        this.firewireBidDueDate = this.parseDateOnlyValue(this.firewireForm.bidDueDate)
        this.applyWorkRetrofitDefaults(project.scopeType)
        this.summaryViewMode = this.readStoredSummaryViewMode()
        this.storeRecentProject(project)
        this.loadSystemLocationInsights()
        void this.loadDocLibraryWorkspace()
    }

    private loadSystemLocationInsights() {
        const coordinates = this.getSystemProjectCoordinates()
        if (!coordinates) {
            this.systemWeatherForecast = []
            this.systemWeatherStatus = ''
            this.systemWeatherLoading = false
            this.systemMapError = ''
            this.resetSystemMap()
            return
        }

        this.systemWeatherLoading = true
        this.systemWeatherStatus = ''
        this.http.get<{ data?: { forecast?: SystemWeatherForecastDay[], status?: string } }>(
            `/api/firewire/projects/weather-forecast?latitude=${encodeURIComponent(String(coordinates[1]))}&longitude=${encodeURIComponent(String(coordinates[0]))}`
        ).subscribe({
            next: (response) => {
                this.systemWeatherForecast = Array.isArray(response?.data?.forecast) ? response!.data!.forecast : []
                this.systemWeatherStatus = typeof response?.data?.status === 'string' ? response.data.status : 'ok'
                this.systemWeatherLoading = false
            },
            error: (err: any) => {
                console.error('Unable to load system weather forecast.', err)
                this.systemWeatherForecast = []
                this.systemWeatherStatus = 'error'
                this.systemWeatherLoading = false
            }
        })

        this.queueSystemMapRender()
    }

    private getSystemProjectCoordinates(): [number, number] | null {
        const rawLatitude = this.firewireProject?.latitude as number | string | null | undefined
        const rawLongitude = this.firewireProject?.longitude as number | string | null | undefined
        if (rawLatitude === null || typeof rawLatitude === 'undefined' || rawLatitude === '') {
            return null
        }
        if (rawLongitude === null || typeof rawLongitude === 'undefined' || rawLongitude === '') {
            return null
        }

        const latitude = typeof rawLatitude === 'number' ? rawLatitude : Number(rawLatitude)
        const longitude = typeof rawLongitude === 'number' ? rawLongitude : Number(rawLongitude)
        if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) {
            return null
        }

        return [longitude, latitude]
    }

    private queueSystemMapRender() {
        if (this.systemMapRenderHandle) {
            clearTimeout(this.systemMapRenderHandle)
        }
        this.systemMapRenderHandle = setTimeout(() => {
            this.systemMapRenderHandle = undefined
            void this.ensureSystemMapReady()
        }, 180)
    }

    private async ensureSystemMapReady() {
        if (this.activeFirewireWorkspaceTab !== 'PROJECT DETAILS' || !this.systemMapHost?.nativeElement) {
            return
        }

        const coordinates = this.getSystemProjectCoordinates()
        if (!coordinates) {
            return
        }

        const subscriptionKey = await this.azureMapsService.getSubscriptionKey()
        if (!subscriptionKey) {
            this.systemMapError = 'Azure Maps is not configured on the server for authenticated map access.'
            return
        }

        try {
            await this.azureMapsService.loadSdk()
            this.systemMapError = ''

            if (!this.systemMap) {
                this.systemMap = new atlas.Map(this.systemMapHost.nativeElement, {
                    authOptions: {
                        authType: 'subscriptionKey',
                        subscriptionKey
                    },
                    center: coordinates,
                    zoom: 11,
                    style: this.systemMapPreferences.style,
                    language: 'en-US'
                })

                this.systemMap.events.add('ready', () => {
                    this.systemMapReady = true
                    this.systemMap.controls.add([
                        new atlas.control.ZoomControl(),
                        new atlas.control.CompassControl()
                    ], {
                        position: 'top-right'
                    })
                    this.systemMapPopup = new atlas.Popup({
                        closeButton: false,
                        pixelOffset: [0, -24]
                    })
                    this.systemMap.events.add('click', () => this.systemMapPopup?.close?.())
                    this.applySystemMapPreferences()
                    this.scheduleInitialSystemMapRender()
                })
                return
            }

            if (this.systemMapReady) {
                this.applySystemMapPreferences()
                this.renderSystemMap()
            }
        } catch (err) {
            console.error(err)
            this.systemMapError = 'Unable to load Azure Maps.'
        }
    }

    private scheduleInitialSystemMapRender() {
        setTimeout(() => {
            this.systemMap?.resize?.()
            this.renderSystemMap()
        }, 260)
    }

    private renderSystemMap() {
        if (!this.systemMap || !this.systemMapReady) {
            return
        }

        const coordinates = this.getSystemProjectCoordinates()
        if (!coordinates) {
            this.resetSystemMap()
            return
        }

        this.systemMap.resize?.()
        if (this.systemMapMarker) {
            this.systemMap.markers.remove(this.systemMapMarker)
            this.systemMapMarker = undefined
        }

        const markerElement = document.createElement('button')
        markerElement.type = 'button'
        markerElement.className = `project-map-marker project-map-marker--${this.getProjectStatusTone(this.firewireProject?.projectStatus || null)}`
        markerElement.setAttribute('aria-label', this.firewireProject?.name || 'Project')
        markerElement.innerHTML = '<span class="project-map-marker__core"></span><span class="project-map-marker__pulse"></span>'
        markerElement.addEventListener('click', (event) => {
            event.stopPropagation()
            this.openSystemMapPopup()
        })

        this.systemMapMarker = new atlas.HtmlMarker({
            htmlContent: markerElement,
            position: coordinates,
            anchor: 'bottom'
        })
        this.systemMap.markers.add(this.systemMapMarker)
        this.systemMap.setCamera({
            ...this.getSystemMapCameraMode(),
            center: coordinates,
            zoom: this.systemMapPreferences.dimension === '3d' ? 12 : 11,
            type: 'ease',
            duration: 600
        })
        this.openSystemMapPopup()
    }

    private openSystemMapPopup() {
        const coordinates = this.getSystemProjectCoordinates()
        if (!this.systemMapPopup || !coordinates || !this.firewireProject) {
            return
        }

        this.systemMapPopup.setOptions({
            position: coordinates,
            content: `
                <div class="project-map-popup">
                    <div class="project-map-popup__eyebrow">${this.escapeHtml(this.firewireProject.projectStatus || 'Status Pending')}</div>
                    <div class="project-map-popup__title">${this.escapeHtml(this.firewireProject.name || 'Project')}</div>
                    <div class="project-map-popup__meta">${this.escapeHtml(this.firewireProject.projectType || 'Firewire')}</div>
                    <div class="project-map-popup__meta">${this.escapeHtml(this.firewireProject.address || '')}</div>
                    ${this.firewireProject.projectNbr ? `<div class="project-map-popup__meta"># ${this.escapeHtml(this.firewireProject.projectNbr)}</div>` : ''}
                </div>
            `
        })
        this.systemMapPopup.open(this.systemMap)
    }

    private applySystemMapPreferences() {
        if (!this.systemMap || !this.systemMapReady) {
            return
        }

        this.systemMap.setStyle({
            style: this.systemMapPreferences.style,
            styleOverrides: {
                roadDetails: {
                    visible: this.systemMapPreferences.showRoadDetails
                },
                buildingFootprint: {
                    visible: this.systemMapPreferences.showBuildingFootprints
                }
            }
        })
    }

    private getSystemMapCameraMode(): { pitch: number, bearing: number } {
        return this.systemMapPreferences.dimension === '3d'
            ? { pitch: 58, bearing: -18 }
            : { pitch: 0, bearing: 0 }
    }

    private getProjectStatusTone(status: string | null): string {
        switch ((status || '').trim()) {
            case 'Estimation':
                return 'cyan'
            case 'Proposal':
                return 'amber'
            case 'Booking':
                return 'lime'
            case 'Design':
                return 'violet'
            case 'Install':
                return 'orange'
            case 'Service':
                return 'teal'
            case 'Closed':
                return 'slate'
            default:
                return 'cyan'
        }
    }

    private escapeHtml(value: string): string {
        return value
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#39;')
    }

    private resetSystemMap() {
        if (this.systemMapPopup?.close) {
            this.systemMapPopup.close()
        }
        if (this.systemMap?.dispose) {
            this.systemMap.dispose()
        }
        this.systemMapMarker = undefined
        this.systemMapPopup = undefined
        this.systemMap = undefined
        this.systemMapReady = false
    }

    private loadLinkedFieldwireProject(fieldwireProjectId: string) {
        this.http.get(`/api/fieldwire/projects/${fieldwireProjectId}`).subscribe({
            next: async(s: any) => {
                if (s && s.data) {
                    this.project = Object.assign({}, s.data)
                    await this._loadStats()
                    await this.loadDocLibraryWorkspace()
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

    clearProjectUploadErrorToast() {
        this.projectUploadErrorToast = ''
        if (this.projectUploadErrorToastTimer) {
            clearTimeout(this.projectUploadErrorToastTimer)
            this.projectUploadErrorToastTimer = undefined
        }
    }

    private showProjectUploadErrorToast(message: string) {
        this.projectUploadErrorToast = message
        if (this.projectUploadErrorToastTimer) {
            clearTimeout(this.projectUploadErrorToastTimer)
        }
        this.projectUploadErrorToastTimer = setTimeout(() => {
            this.projectUploadErrorToast = ''
            this.projectUploadErrorToastTimer = undefined
        }, 6000)
    }

    private storeRecentProject(project: FirewireProjectSchema) {
        if (typeof localStorage === 'undefined' || !project?.uuid) {
            return
        }

        const nextEntry: RecentProjectLink = {
            id: project.uuid,
            name: project.name || 'Untitled Project',
            projectNbr: project.projectNbr || '',
            route: `/projects/firewire/${project.uuid}/project-details`,
            lastViewedAt: new Date().toISOString()
        }

        try {
            const existing = JSON.parse(localStorage.getItem(this.recentProjectsStorageKey) || '[]') as RecentProjectLink[]
            const output = [nextEntry, ...existing.filter((entry) => entry.id !== nextEntry.id)].slice(0, this.recentProjectsLimit)
            localStorage.setItem(this.recentProjectsStorageKey, JSON.stringify(output))
        } catch {
            localStorage.setItem(this.recentProjectsStorageKey, JSON.stringify([nextEntry]))
        }
    }

    private createEmptyFirewireForm(): FirewireProjectUpsert {
        return {
            name: '',
            projectNbr: '',
            address: '',
            bidDueDate: '',
            projectStatus: 'Estimation',
            projectType: 'Fire Alarm',
            salesman: '',
            jobType: '',
            scopeType: '',
            projectScope: '',
            difficulty: '',
            totalSqFt: 0
        }
    }

    private applyWorkRetrofitDefaults(scopeType: string | null | undefined) {
        const normalizedScopeType = `${scopeType || ''}`.trim().toLowerCase()
        if (normalizedScopeType === 'retro-fit') {
            this.newConstructionPercent = 0
            this.retrofitPercent = 100
            return
        }

        this.newConstructionPercent = 100
        this.retrofitPercent = 0
    }

    private buildWorksheetStateSnapshot(): FirewireProjectWorksheetState {
        return this.cloneJson({
            customerInfo: this.customerInfo,
            baseManHourEstimate: Number(this.baseManHourEstimate || 0),
            workingHeightBands: this.workingHeightBands,
            workingHeightFactorMultiplier: Number(this.workingHeightFactorMultiplier || 0),
            accessiblePercent: Number(this.accessiblePercent || 0),
            inaccessiblePercent: Number(this.inaccessiblePercent || 0),
            ceilingFloorFactorMultiplier: Number(this.ceilingFloorFactorMultiplier || 0),
            newConstructionPercent: Number(this.newConstructionPercent || 0),
            retrofitPercent: Number(this.retrofitPercent || 0),
            workRetrofitFactorMultiplier: Number(this.workRetrofitFactorMultiplier || 0),
            buildingLevels: Number(this.buildingLevels || 0),
            takeoffDrawingDate: this.formatDateOnlyValue(this.takeoffDrawingDate),
            wageScaleJob: !!this.wageScaleJob,
            wageScaleEffectiveRate: Number(this.wageScaleEffectiveRate || 0),
            laborRates: this.laborRates,
            installationOvertime: this.installationOvertime,
            takeoffMatrices: this.takeoffMatrices,
            wireTakeoffSpecs: this.wireTakeoffSpecs,
            wireWiringStyles: this.wireWiringStyles,
            wireSelections: this.wireSelections,
            wireRunNodes: this.wireRunNodes,
            firetrolProvideRows: this.firetrolProvideRows,
            bomSections: this.buildBomSectionSnapshot(),
            expenseSections: this.expenseSections,
            ssPmRate: Number(this.ssPmRate || 0),
            ssPmFixedAmount: Number(this.ssPmFixedAmount || 0),
            ssPmLaborRows: this.ssPmLaborRows,
            ssPmExpenseRows: this.ssPmExpenseRows,
            ssCadRate: Number(this.ssCadRate || 0),
            ssCadFixedAmount: Number(this.ssCadFixedAmount || 0),
            ssCadLaborRows: this.ssCadLaborRows,
            ssCadExpenseRows: this.ssCadExpenseRows,
            ssTechRate: Number(this.ssTechRate || 0),
            ssTechFixedAmount: Number(this.ssTechFixedAmount || 0),
            ssTechLaborRows: this.ssTechLaborRows,
            ssTechExpenseRows: this.ssTechExpenseRows,
            summaryUseInstallationMaterialTax: !!this.summaryUseInstallationMaterialTax,
            summaryInstallationMaterialTaxRate: Number(this.summaryInstallationMaterialTaxRate || 0),
            summaryUseEquipmentMaterialTax: !!this.summaryUseEquipmentMaterialTax,
            summaryEquipmentMaterialTaxRate: Number(this.summaryEquipmentMaterialTaxRate || 0),
            summaryRiskProficiencyPercent: Number(this.summaryRiskProficiencyPercent || 0),
            summaryMarginPercent: Number(this.summaryMarginPercent || 0)
        })
    }

    private applyWorksheetState(input: any) {
        const hasWorksheet = !!input
        const worksheet = input ? this.cloneJson(input) as Partial<FirewireProjectWorksheetState> : this.cloneJson(this.worksheetDefaults)

        this.customerInfo = this.cloneJson(worksheet.customerInfo || this.worksheetDefaults.customerInfo)
        this.baseManHourEstimate = Number(worksheet.baseManHourEstimate ?? this.worksheetDefaults.baseManHourEstimate)
        this.workingHeightBands = this.cloneJson(worksheet.workingHeightBands || this.worksheetDefaults.workingHeightBands)
        this.workingHeightFactorMultiplier = Number(worksheet.workingHeightFactorMultiplier ?? this.worksheetDefaults.workingHeightFactorMultiplier)
        this.accessiblePercent = Number(worksheet.accessiblePercent ?? this.worksheetDefaults.accessiblePercent)
        this.inaccessiblePercent = Number(worksheet.inaccessiblePercent ?? this.worksheetDefaults.inaccessiblePercent)
        this.ceilingFloorFactorMultiplier = Number(worksheet.ceilingFloorFactorMultiplier ?? this.worksheetDefaults.ceilingFloorFactorMultiplier)
        this.newConstructionPercent = Number(worksheet.newConstructionPercent ?? this.worksheetDefaults.newConstructionPercent)
        this.retrofitPercent = Number(worksheet.retrofitPercent ?? this.worksheetDefaults.retrofitPercent)
        this.workRetrofitFactorMultiplier = Number(worksheet.workRetrofitFactorMultiplier ?? this.worksheetDefaults.workRetrofitFactorMultiplier)
        this.buildingLevels = Math.max(1, Number(worksheet.buildingLevels ?? this.worksheetDefaults.buildingLevels))
        this.takeoffDrawingDate = this.parseDateOnlyValue(worksheet.takeoffDrawingDate || this.worksheetDefaults.takeoffDrawingDate || '')
        this.wageScaleJob = !!worksheet.wageScaleJob
        this.wageScaleEffectiveRate = Number(worksheet.wageScaleEffectiveRate ?? this.worksheetDefaults.wageScaleEffectiveRate)
        this.laborRates = this.cloneJson(worksheet.laborRates || this.worksheetDefaults.laborRates)
        this.installationOvertime = this.cloneJson(worksheet.installationOvertime || this.worksheetDefaults.installationOvertime)
        this.takeoffMatrices = this.cloneJson(worksheet.takeoffMatrices || this.worksheetDefaults.takeoffMatrices)
        this.wireTakeoffSpecs = this.cloneJson(worksheet.wireTakeoffSpecs || this.worksheetDefaults.wireTakeoffSpecs)
        this.wireWiringStyles = this.cloneJson(worksheet.wireWiringStyles || this.worksheetDefaults.wireWiringStyles)
        this.wireSelections = this.cloneJson(worksheet.wireSelections || this.worksheetDefaults.wireSelections)
        this.wireRunNodes = this.cloneJson(worksheet.wireRunNodes || this.worksheetDefaults.wireRunNodes)
        this.firetrolProvideRows = this.cloneJson(worksheet.firetrolProvideRows || this.worksheetDefaults.firetrolProvideRows)
        this.bomSections = this.normalizeBomSections(worksheet.bomSections || this.worksheetDefaults.bomSections)
        this.expenseSections = this.normalizeExpenseSections(this.cloneJson(worksheet.expenseSections || this.worksheetDefaults.expenseSections))
        this.ssPmRate = Number(worksheet.ssPmRate ?? this.worksheetDefaults.ssPmRate)
        this.ssPmFixedAmount = Number(worksheet.ssPmFixedAmount ?? this.worksheetDefaults.ssPmFixedAmount)
        this.ssPmLaborRows = this.cloneJson(worksheet.ssPmLaborRows || this.worksheetDefaults.ssPmLaborRows)
        this.ssPmExpenseRows = this.cloneJson(worksheet.ssPmExpenseRows || this.worksheetDefaults.ssPmExpenseRows)
        this.ssCadRate = Number(worksheet.ssCadRate ?? this.worksheetDefaults.ssCadRate)
        this.ssCadFixedAmount = Number(worksheet.ssCadFixedAmount ?? this.worksheetDefaults.ssCadFixedAmount)
        this.ssCadLaborRows = this.cloneJson(worksheet.ssCadLaborRows || this.worksheetDefaults.ssCadLaborRows)
        this.ssCadExpenseRows = this.cloneJson(worksheet.ssCadExpenseRows || this.worksheetDefaults.ssCadExpenseRows)
        this.ssTechRate = Number(worksheet.ssTechRate ?? this.worksheetDefaults.ssTechRate)
        this.ssTechFixedAmount = Number(worksheet.ssTechFixedAmount ?? this.worksheetDefaults.ssTechFixedAmount)
        this.ssTechLaborRows = this.cloneJson(worksheet.ssTechLaborRows || this.worksheetDefaults.ssTechLaborRows)
        this.ssTechExpenseRows = this.cloneJson(worksheet.ssTechExpenseRows || this.worksheetDefaults.ssTechExpenseRows)
        this.summaryUseInstallationMaterialTax = Boolean(
            worksheet.summaryUseInstallationMaterialTax
            ?? worksheet.summaryUseMaterialTax
            ?? this.worksheetDefaults.summaryUseInstallationMaterialTax
        )
        this.summaryInstallationMaterialTaxRate = Number(
            worksheet.summaryInstallationMaterialTaxRate
            ?? worksheet.summaryMaterialTaxRate
            ?? this.worksheetDefaults.summaryInstallationMaterialTaxRate
        )
        this.summaryUseEquipmentMaterialTax = Boolean(
            worksheet.summaryUseEquipmentMaterialTax
            ?? worksheet.summaryUseMaterialTax
            ?? this.worksheetDefaults.summaryUseEquipmentMaterialTax
        )
        this.summaryEquipmentMaterialTaxRate = Number(
            worksheet.summaryEquipmentMaterialTaxRate
            ?? worksheet.summaryMaterialTaxRate
            ?? this.worksheetDefaults.summaryEquipmentMaterialTaxRate
        )
        this.summaryRiskProficiencyPercent = Number(worksheet.summaryRiskProficiencyPercent ?? this.worksheetDefaults.summaryRiskProficiencyPercent)
        this.summaryMarginPercent = Number(worksheet.summaryMarginPercent ?? this.getDefaultSummaryMarginPercent())

        if (!hasWorksheet) {
            this.applyWorkRetrofitDefaults(this.firewireForm.scopeType)
            this.summaryMarginPercent = this.getDefaultSummaryMarginPercent()
        }
    }

    private resetWorksheetState() {
        this.applyWorksheetState(null)
    }

    private normalizeExpenseSections(sections: ProjectExpenseSection[]): ProjectExpenseSection[] {
        return sections.map((section) => ({
            ...section,
            rows: section.rows.map((row) => ({
                ...row,
                item: row.item === 'Forklist'
                    ? 'Forklift'
                    : row.item === 'Low Sissor Lift'
                        ? 'Low Scissor Lift'
                        : row.item
            }))
        }))
    }

    private getProjectTemplateDialogItems(): ProjectTemplateDialogItem[] {
        return this.projectTemplates.map((template) => ({
            templateId: template.templateId,
            name: template.name,
            visibility: template.visibility,
            updatedAt: template.updatedAt
        }))
    }

    private getSelectedTemplateId(): string {
        if (this.selectedTemplateId && this.projectTemplates.some((template) => template.templateId === this.selectedTemplateId)) {
            return this.selectedTemplateId
        }
        return this.projectTemplates.find((template) => template.name === this.selectedTemplate)?.templateId || ''
    }

    private upsertProjectTemplate(template: ProjectTemplateRecord) {
        template = {
            ...template,
            firewireForm: this.getSanitizedTemplateFirewireForm(template.firewireForm)
        }
        const existingIndex = this.projectTemplates.findIndex((item) => item.templateId === template.templateId)
        if (existingIndex >= 0) {
            this.projectTemplates.splice(existingIndex, 1, template)
        } else {
            this.projectTemplates = [...this.projectTemplates, template]
        }

        this.projectTemplates = [...this.projectTemplates].sort((left, right) => {
            if (left.visibility !== right.visibility) {
                return left.visibility.localeCompare(right.visibility)
            }
            return left.name.localeCompare(right.name)
        })
    }

    private resolveErrorMessage(err: any, fallback: string): string {
        return err?.error?.message || err?.message || fallback
    }

    private getSanitizedTemplateFirewireForm(form?: Partial<FirewireProjectUpsert> | null): Partial<FirewireProjectUpsert> {
        if (!form || typeof form !== 'object') {
            return {}
        }

        return {
            projectType: form.projectType || 'Fire Alarm',
            jobType: form.jobType || '',
            scopeType: form.scopeType || '',
            projectScope: form.projectScope || '',
            difficulty: form.difficulty || ''
        }
    }

    private captureInitialProjectState() {
        this.initialFirewireFormState = this.serializeFirewireForm(this.firewireForm)
        this.initialWorksheetState = this.serializeWorksheetState(this.buildWorksheetStateSnapshot())
    }

    private serializeFirewireForm(form: FirewireProjectUpsert): string {
        return JSON.stringify({
            fieldwireId: form.fieldwireId || null,
            name: form.name || '',
            projectNbr: form.projectNbr || '',
            address: form.address || '',
            bidDueDate: form.bidDueDate || '',
            projectStatus: form.projectStatus || 'Estimation',
            projectType: form.projectType || 'Fire Alarm',
            salesman: form.salesman || '',
            jobType: form.jobType || '',
            scopeType: form.scopeType || '',
            projectScope: form.projectScope || '',
            difficulty: form.difficulty || '',
            totalSqFt: Number(form.totalSqFt || 0)
        })
    }

    private serializeWorksheetState(state: FirewireProjectWorksheetState): string {
        return JSON.stringify({
            ...state
        })
    }

    private storeSummaryViewMode(mode: 'Grid' | 'Chart') {
        if (typeof localStorage === 'undefined' || !this.projectId) {
            return
        }

        try {
            const current = JSON.parse(localStorage.getItem(this.summaryViewModeStorageKey) || '{}') as Record<string, 'Grid' | 'Chart'>
            current[this.projectId] = mode
            localStorage.setItem(this.summaryViewModeStorageKey, JSON.stringify(current))
        } catch {}
    }

    private readStoredSummaryViewMode(): 'Grid' | 'Chart' {
        if (typeof localStorage === 'undefined' || !this.projectId) {
            return 'Chart'
        }

        try {
            const current = JSON.parse(localStorage.getItem(this.summaryViewModeStorageKey) || '{}') as Record<string, 'Grid' | 'Chart'>
            const value = current[this.projectId]
            return value === 'Grid' || value === 'Chart' ? value : 'Chart'
        } catch {
            return 'Chart'
        }
    }

    private cloneJson<T>(value: T): T {
        return JSON.parse(JSON.stringify(value))
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

@Component({
    standalone: true,
    selector: 'project-doc-library-overwrite-dialog',
    imports: [
        MatButtonModule,
        MatDialogTitle,
        MatDialogContent,
        MatDialogActions,
        MatDialogClose
    ],
    template: `
        <h2 mat-dialog-title>File Already Exists</h2>
        <mat-dialog-content>
            <p><strong>{{data.fileName}}</strong> already exists in this project folder.</p>
            <p>If you continue, the upload will be saved as version {{data.nextVersionNumber}}.</p>
        </mat-dialog-content>
        <mat-dialog-actions align="end">
            <button mat-button mat-dialog-close type="button">Cancel</button>
            <button mat-flat-button type="button" (click)="overwrite()">Overwrite + New Version</button>
        </mat-dialog-actions>
    `
})
export class ProjectDocLibraryOverwriteDialog {
    readonly data = inject<ProjectDocLibraryOverwriteDialogData>(MAT_DIALOG_DATA)
    private readonly dialogRef = inject(MatDialogRef<ProjectDocLibraryOverwriteDialog>)

    overwrite(): void {
        this.dialogRef.close(true)
    }
}

@Component({
    standalone: true,
    selector: 'project-doc-library-versions-dialog',
    imports: [
        CommonModule,
        NgFor,
        MatButtonModule,
        MatDialogTitle,
        MatDialogContent,
        MatDialogActions,
        MatDialogClose,
        MatIconModule
    ],
    template: `
        <h2 mat-dialog-title>{{data.fileName}}</h2>
        <mat-dialog-content class="project-doc-library-versions-dialog">
            <div class="project-doc-library-versions-dialog__eyebrow">Stored Versions</div>
            <div *ngFor="let version of data.versions" class="project-doc-library-versions-dialog__row">
                <div>
                    <div class="project-doc-library-versions-dialog__version">Version {{version.versionNumber}}</div>
                    <div class="project-doc-library-versions-dialog__meta">
                        {{version.sourceFileName}} · {{version.uploadedBy}} · {{version.uploadedAt | date:'short'}}
                    </div>
                </div>
                <button mat-stroked-button type="button" (click)="download(version.id)">
                    <mat-icon fontIcon="download"></mat-icon>
                    Download
                </button>
            </div>
        </mat-dialog-content>
        <mat-dialog-actions align="end">
            <button mat-button mat-dialog-close type="button">Close</button>
        </mat-dialog-actions>
    `
})
export class ProjectDocLibraryVersionsDialog {
    readonly data = inject<ProjectDocLibraryVersionsDialogData>(MAT_DIALOG_DATA)

    download(versionId: string): void {
        this.data.onDownload(versionId)
    }
}

@Component({
    standalone: true,
    selector: 'project-doc-library-category-dialog',
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
            <div class="project-doc-library-category-dialog__hint">Choose the document category for this action.</div>
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
export class ProjectDocLibraryCategoryDialog {
    readonly data = inject<ProjectDocLibraryCategoryDialogData>(MAT_DIALOG_DATA)
    private readonly dialogRef = inject(MatDialogRef<ProjectDocLibraryCategoryDialog>)
    selectedFolderId = this.data.selectedFolderId

    confirmSelection(): void {
        this.dialogRef.close(this.selectedFolderId)
    }
}

@Component({
    standalone: true,
    selector: 'project-doc-library-delete-dialog',
    imports: [CommonModule, MatButtonModule, MatDialogActions, MatDialogClose, MatDialogContent, MatDialogTitle],
    template: `
        <h2 mat-dialog-title>Delete Document</h2>
        <mat-dialog-content>
            Delete <strong>{{data.fileName}}</strong> from the project library?
        </mat-dialog-content>
        <mat-dialog-actions align="end">
            <button mat-button mat-dialog-close type="button">Cancel</button>
            <button mat-flat-button color="warn" type="button" (click)="confirm()">Delete</button>
        </mat-dialog-actions>
    `
})
export class ProjectDocLibraryDeleteDialog {
    readonly data = inject<ProjectDocLibraryDeleteDialogData>(MAT_DIALOG_DATA)
    private readonly dialogRef = inject(MatDialogRef<ProjectDocLibraryDeleteDialog>)

    confirm(): void {
        this.dialogRef.close(true)
    }
}
