import { Component, ElementRef, HostListener, Input, OnChanges, OnDestroy, SimpleChanges, ViewChild, inject } from "@angular/core"
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
import { MatDividerModule } from "@angular/material/divider"
import { MatMenuModule } from "@angular/material/menu"
import { MatSelectModule } from "@angular/material/select"

import { Utils } from "../../common/utils"
import { AccountProjectAttributes, AccountProjectSchema } from "../../schemas/account.project.schema"
import { AccountProjectStatSchema } from "../../schemas/account.projectstat.schema"
import { FIREWIRE_PROJECT_TYPE_OPTIONS, FirewireProjectSchema, FirewireProjectUpsert } from "../../schemas/firewire-project.schema"
import { createEmptyProjectSettingsCatalog, ProjectSettingsCatalogSchema } from "../../schemas/project-settings.schema"
import { ProjectListItemSchema, ProjectSource } from "../../schemas/project-list-item.schema"
import { PageToolbar } from '../../common/components/page-toolbar'
import { FirewireBomWorksheetComponent } from "../../common/components/firewire-bom-worksheet.component"
import { FirewireDocLibraryExplorerComponent } from "../../common/components/firewire-doc-library-explorer.component"
import { FirewireFloorplansComponent } from "../../common/components/firewire-floorplans.component"
import { FirewireTakeoffMatrixComponent } from "../../common/components/firewire-takeoff-matrix.component"
import { FieldwireImportComponent, FieldwireImportDialogData } from "../../common/components/fieldwire-import.component"
import { AzureMapsService } from "../../common/services/azure-maps.service"
import {
    ProjectDocLibraryDirectoryRecord,
    ProjectDocLibraryFileRecord,
    ProjectDocLibraryFileVersionRecord,
    ProjectFloorplanDesignAnnotation,
    ProjectFloorplanDesignState,
    ProjectDocLibraryStorageService
} from "../../common/services/project-doc-library-storage.service"
import { PdfThumbnailService } from "../../common/services/pdf-thumbnail.service"
import { UserPreferencesService } from "../../common/services/user-preferences.service"
import { DevicePartPriceSyncService } from "../../common/services/device-part-price-sync.service"
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
import { VwPart } from "../../schemas/vwpart.schema"
import { VwDevice } from "../../schemas/vwdevice.schema"
import { VwDeviceMaterial } from "../../schemas/vwdevicematerial.schema"
import { DeviceSetDetail, DeviceSetSummary } from "../../schemas/device-set.schema"
import { FloorplanDesignerDialog, FloorplanDesignerDialogResult, FloorplanSymbolBalanceDialog, FloorplanSymbolBalanceDialogData } from "../design/floorplan-designer.dialog"
import { FloorplanDesignerSymbolOption } from "../design/floorplan-designer.component"

interface ProjectBomRowPart {
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

interface ProjectBomRow {
    id: string
    partNbr: string
    description: string
    qty: number
    cost: number
    labor: number
    includeOnFloorplan: boolean
    type: string
    lookupQuery?: string
    bomRowParts?: ProjectBomRowPart[]
}

interface ProjectBomSection {
    title: string
    rows: ProjectBomRow[]
    sectionKey?: string
    vendorIds?: string[]
    vendorNames?: string[]
}

type ProjectBomSortKey = 'partNbr' | 'description' | 'qty' | 'cost' | 'extCost' | 'labor' | 'extLabor' | 'includeOnFloorplan' | 'type'

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
    rowLabels?: Record<string, string>
    values: Record<string, Record<string, TakeoffValue>>
}

interface TakeoffColumnDefinition {
    key: string
    label: string
    sourceQty?: number
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
    storageKey?: string
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
    takeoffMatrices?: TakeoffMatrix[]
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
        FirewireBomWorksheetComponent,
        FirewireDocLibraryExplorerComponent, FirewireFloorplansComponent,
        FirewireTakeoffMatrixComponent,
        MatButtonModule, MatFormFieldModule,
        MatInputModule, MatSelectModule, MatButtonToggleModule, MatDatepickerModule,
        MatChipsModule, MatIconModule, MatCardModule, MatMenuModule, MatDividerModule],
    providers: [HttpClient],
    templateUrl: './project.page.html',
    styleUrls: ['./project.page.scss']
})
export class ProjectPage implements OnChanges, OnDestroy {
    private readonly defaultLaborHourlyRate = 56
    private readonly defaultLaborCost = this.defaultLaborHourlyRate * 2
    private readonly floorplansFolderId = 'floorplans'
    private dialog = inject(MatDialog)
    private router = inject(Router)
    private route = inject(ActivatedRoute)
    private readonly azureMapsService = inject(AzureMapsService)
    private readonly projectDocLibraryStorage = inject(ProjectDocLibraryStorageService)
    private readonly pdfThumbnailService = inject(PdfThumbnailService)
    private readonly userPreferences = inject(UserPreferencesService)
    private readonly devicePartPriceSync = inject(DevicePartPriceSyncService)
    private readonly recentProjectsStorageKey = 'firewire.recentProjects'
    private readonly recentProjectsLimit = 6
    private readonly favoriteProjectsStorageKey = 'firewire.favoriteProjects'
    private readonly summaryViewModeStorageKey = 'firewire.summaryViewMode'
    private readonly lockedProjectStatuses = ['Design', 'Install', 'Service', 'Closed']
    private readonly projectIdentityVisibleStatuses = ['Booking', 'Design', 'Install', 'Service', 'Closed']
    readonly projectTypeOptions = FIREWIRE_PROJECT_TYPE_OPTIONS

    get bomWorksheetHost(): ProjectPage {
        return this
    }
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
    projectRecordMissing = false
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
    deleteProjectConfirmationShown = false
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
    projectSettings: ProjectSettingsCatalogSchema = createEmptyProjectSettingsCatalog()

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
        'FLOORPLANS',
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
    selectedDocLibraryFolder = 'all'
    docLibraryFiles: ProjectDocLibraryFileRecord[] = []
    docLibraryDirectories: ProjectDocLibraryDirectoryRecord[] = []
    docLibraryStatusMessage = ''
    floorplanStatusMessage = ''
    floorplanUploadBusy = false
    floorplanSavingFileIds: string[] = []
    takeoffMatrices: TakeoffMatrix[] = [
        this.createTakeoffMatrix('Matrix 1', [])
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
    bomSections: ProjectBomSection[] = []
    bomFilter = ''
    bomSortKey: ProjectBomSortKey = 'partNbr'
    bomSortDirection: 'asc' | 'desc' = 'asc'
    selectedDeviceSetId = ''
    deviceSets: DeviceSetSummary[] = []
    deviceRows: VwDevice[] = []
    deviceLookupLoaded = false
    vendorPartRows: VwPart[] = []
    vendorPartLookupLoaded = false
    vendorPartLookupWorking = false
    activeBomLookupSectionKey = ''
    activeBomLookupRow: ProjectBomRow | null = null
    bomLookupMenuStyle: Record<string, string> = {}
    private takeoffColumnDefinitionCache: TakeoffColumnDefinition[] = []
    private activeBomLookupInput: HTMLInputElement | null = null
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
        this.loadDeviceSets()

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

    hasDocLibraryWorkspace(): boolean {
        return this.getDocLibraryStorageKey() !== 'UNASSIGNED'
    }

    getPageTitle(): string {
        return this.firewireProject?.name || this.project?.name || 'Project'
    }

    getProjectStatusLabel(): string {
        return this.firewireForm.projectStatus || this.firewireProject?.projectStatus || ''
    }

    getPersistedProjectStatusLabel(): string {
        return this.firewireProject?.projectStatus || ''
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

    isInstallProject(): boolean {
        return this.getPersistedProjectStatusLabel() === 'Install'
    }

    isDesignProject(): boolean {
        return this.getPersistedProjectStatusLabel() === 'Design'
    }

    shouldShowExecutionNav(): boolean {
        const status = this.getProjectStatusLabel()
        return status === 'Install' || status === 'Service'
    }

    openFieldwireImportDialog(): void {
        if (!this.firewireProject) {
            return
        }
        this.dialog.open(FieldwireImportComponent, {
            width: '1040px',
            maxWidth: '94vw',
            panelClass: 'fw-fieldwire-import-dialog-pane',
            data: {
                projectId: this.firewireProject.uuid,
                projectName: this.firewireProject.name,
                fieldwireProjectId: this.fieldwireProjectId || null
            } as FieldwireImportDialogData
        })
    }

    shouldShowChangeOrdersNav(): boolean {
        const status = this.getProjectStatusLabel()
        return status === 'Install' || status === 'Service' || status === 'Closed'
    }

    isProjectStatusLocked(): boolean {
        return this.lockedProjectStatuses.includes(this.getPersistedProjectStatusLabel())
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

    canEditProjectStatus(): boolean {
        if (this.isProjectManuallyLocked()) {
            return false
        }
        return !this.isProjectStatusLocked() || this.isDesignProject()
    }

    canEditProjectNbr(): boolean {
        if (this.isProjectManuallyLocked() && !this.canBackfillLockedProjectNbr()) {
            return false
        }
        return !this.isProjectStatusLocked() || this.isDesignProject() || this.canBackfillLockedProjectNbr()
    }

    canSaveProjectDetails(): boolean {
        return !this.isFirewireProjectLocked() || this.isLockedProjectIdentityDirty()
    }

    private isLockedProjectIdentityDirty(): boolean {
        if (!this.firewireProject || !this.isFirewireFormDirty) {
            return false
        }
        const projectNbrChanged = String(this.firewireForm.projectNbr || '') !== String(this.firewireProject.projectNbr || '')
        const projectStatusChanged = String(this.firewireForm.projectStatus || '') !== String(this.firewireProject.projectStatus || '')
        return (projectNbrChanged && this.canEditProjectNbr()) || (projectStatusChanged && this.canEditProjectStatus())
    }

    private canBackfillLockedProjectNbr(): boolean {
        if (!this.firewireProject || !this.isFirewireProjectLocked()) {
            return false
        }
        const persistedStatus = this.getPersistedProjectStatusLabel()
        return (persistedStatus === 'Design' || persistedStatus === 'Install')
            && !String(this.firewireProject.projectNbr || '').trim()
    }

    getProjectLockChipLabel(): string {
        if (this.isProjectStatusLocked()) {
            return `${this.getPersistedProjectStatusLabel()} locked`
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
        const visibleFiles = this.getDocLibraryFilesOnly()
        const allCount = visibleFiles.length
        return [
            { id: 'all', label: 'Project Files', itemCount: allCount, badge: allCount > 0 ? 'LIVE' : undefined },
            ...this.docLibraryDirectories.map((folder) => ({
                id: folder.id,
                label: folder.name,
                itemCount: visibleFiles.filter((file) => file.folderId === folder.id).length
            }))
        ]
    }

    getDocLibraryProjectKey(): string {
        return this.firewireProject?.projectNbr?.trim()
            || this.firewireForm.projectNbr?.trim()
            || this.firewireProject?.uuid?.trim()
            || (this.projectSource === 'firewire' ? String(this.projectId || '').trim() : '')
            || this.project?.id?.trim()
            || 'UNASSIGNED'
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
                storageKey: file.storageKey,
                name: file.name,
                extension: file.extension.toUpperCase(),
                category: this.getDocLibraryFolderLabel(file.folderId),
                sizeBytes: latestVersion?.sizeBytes || 0,
                modifiedAt: latestVersion?.uploadedAt || file.updatedAt,
                modifiedBy: latestVersion?.uploadedBy || 'Current User',
                sourceFileName: file.sourceFileName || latestVersion?.sourceFileName || file.name,
                versionCount: file.versions?.length || 0
            }
        })
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

    getFloorplanVersionContent(file: ProjectDocLibraryFileRecord): string {
        const version = this.getLatestDocLibraryVersion(file)
        return version?.dataUrl || version?.contentUrl || ''
    }

    getFloorplanPreviewContent(file: ProjectDocLibraryFileRecord): string {
        const version = this.getLatestDocLibraryVersion(file)
        return version?.thumbnailDataUrl || version?.dataUrl || ''
    }

    getFloorplanTotalBytes(): number {
        return this.getFloorplanFiles().reduce((sum, file) => sum + Number(this.getLatestDocLibraryVersion(file)?.sizeBytes || 0), 0)
    }

    canEditDocLibraryMarkup(file: DocLibraryFile): boolean {
        const source = this.docLibraryFiles.find((item) => item.id === file.id)
        const latestVersion = source ? this.getLatestDocLibraryVersion(source) : undefined
        return source ? this.projectDocLibraryStorage.isDrawing(source)
            && String(latestVersion?.mimeType || '').toLowerCase().startsWith('image/')
            && !!(latestVersion?.dataUrl || latestVersion?.contentUrl) : false
    }

    getDocLibraryMarkupQueryParams(file: DocLibraryFile): Record<string, string> {
        return {
            projectKey: file.storageKey || this.getDocLibraryStorageKey(),
            bomProjectKey: this.firewireProject?.uuid || (this.projectSource === 'firewire' ? String(this.projectId || '') : ''),
            fileId: file.id,
            returnTo: this.router.url || `/projects/${this.projectSource}/${this.projectId}/doc-library`
        }
    }

    readonly getDocLibraryRecordMarkupQueryParams = (file: ProjectDocLibraryFileRecord): Record<string, string> => {
        return {
            projectKey: file.storageKey || this.getDocLibraryStorageKey(),
            bomProjectKey: this.firewireProject?.uuid || (this.projectSource === 'firewire' ? String(this.projectId || '') : ''),
            fileId: file.id,
            returnTo: this.router.url || `/projects/${this.projectSource}/${this.projectId}/doc-library`
        }
    }

    readonly getFloorplanPreview = (file: ProjectDocLibraryFileRecord): string => {
        return this.getFloorplanPreviewContent(file)
    }

    getSelectedDocLibraryFolderLabel(): string {
        return this.docLibraryFolders.find((folder) => folder.id === this.selectedDocLibraryFolder)?.label || 'Project Files'
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
        return Number(row.qty || 0) * this.roundBomMoney(row.cost)
    }

    getBomRowExtLabor(row: ProjectBomRow): number {
        return Number(row.qty || 0) * this.roundBomMoney(row.labor)
    }

    normalizeBomMoneyField(row: ProjectBomRow, field: 'cost' | 'labor'): void {
        row[field] = this.roundBomMoney(row[field])
    }

    syncBomLaborToInstallLaborEstimate(): void {
        this.baseManHourEstimate = this.getBomBaseManHourEstimate()
    }

    getBomBaseManHourEstimate(): number {
        const laborCost = this.bomSections.reduce((sum, section) => {
            return sum + section.rows.reduce((rowSum, row) => rowSum + this.getBomRowExtLabor(row), 0)
        }, 0)
        const installRate = this.getInstallationHourlyRate() || this.defaultLaborHourlyRate
        return installRate > 0 ? Math.ceil(laborCost / installRate) : 0
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
        this.refreshTakeoffColumnDefinitions()
    }

    removeBomSection(sectionIndex: number): void {
        this.bomSections = this.bomSections.filter((_, idx) => idx !== sectionIndex)
        this.refreshTakeoffColumnDefinitions()
        this.syncBomLaborToInstallLaborEstimate()
    }

    addBomRow(section: ProjectBomSection) {
        section.rows = [...section.rows, this.createEmptyBomRow()]
        this.bomSections = [...this.bomSections]
        this.refreshTakeoffColumnDefinitions()
    }

    async addSelectedDeviceSetToBom(): Promise<void> {
        const deviceSetId = String(this.selectedDeviceSetId || '').trim()
        if (!deviceSetId) {
            this.firewireSaveMessage = 'Choose a device set first.'
            return
        }

        this.firewireSaveWorking = true
        this.firewireSaveMessage = 'Refreshing device set prices and loading BOM...'

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

            const nextSection: ProjectBomSection = {
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
            this.refreshTakeoffColumnDefinitions()
            this.syncBomLaborToInstallLaborEstimate()
            this.firewireSaveMessage = `Added ${detail.name} to BOM.`
        } catch (err: any) {
            this.firewireSaveMessage = err?.error?.message || err?.message || 'Unable to add device set to BOM.'
        } finally {
            this.firewireSaveWorking = false
        }
    }

    removeBomRow(section: ProjectBomSection, row: ProjectBomRow) {
        if (this.isActiveFirewireWorkspaceLocked()) {
            return
        }

        section.rows = (section.rows || []).filter((item) => item !== row)
        this.bomSections = [...this.bomSections]
        this.refreshTakeoffColumnDefinitions()
        this.syncBomLaborToInstallLaborEstimate()
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

    @HostListener('document:keydown.escape')
    onDocumentEscape(): void {
        this.cancelDeleteFirewireProject()
    }

    async onBomPartLookupFocus(section: ProjectBomSection, row: ProjectBomRow, event?: FocusEvent): Promise<void> {
        this.activeBomLookupSectionKey = String(section.sectionKey || '')
        this.activeBomLookupRow = row
        this.activeBomLookupInput = event?.target instanceof HTMLInputElement ? event.target : this.activeBomLookupInput
        this.positionBomPartLookup()
        await this.ensureBomLookupDataLoaded()
        this.positionBomPartLookup()
    }

    onBomPartLookupBlur(section: ProjectBomSection, row: ProjectBomRow): void {
        const value = String(row.lookupQuery || row.partNbr || '').trim()
        row.lookupQuery = value
        row.partNbr = value
        globalThis.setTimeout(() => {
            if (this.activeBomLookupSectionKey === String(section.sectionKey || '') && this.activeBomLookupRow === row) {
                this.closeBomPartLookup()
            }
        }, 120)
    }

    onBomPartLookupChanged(section: ProjectBomSection, row: ProjectBomRow, value: string): void {
        row.lookupQuery = value
        row.partNbr = value
        this.activeBomLookupSectionKey = String(section.sectionKey || '')
        this.activeBomLookupRow = row
        this.positionBomPartLookup()
    }

    isBomLookupActive(section: ProjectBomSection, row: ProjectBomRow): boolean {
        return this.activeBomLookupSectionKey === String(section.sectionKey || '') && this.activeBomLookupRow === row
    }

    getBomPartLookupResults(section: ProjectBomSection, row: ProjectBomRow): VwPart[] {
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

    getBomDeviceLookupResults(section: ProjectBomSection, row: ProjectBomRow): VwDevice[] {
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

    hasBomLookupResults(section: ProjectBomSection, row: ProjectBomRow): boolean {
        return this.getBomDeviceLookupResults(section, row).length > 0 || this.getBomPartLookupResults(section, row).length > 0
    }

    selectBomPart(section: ProjectBomSection, row: ProjectBomRow, part: VwPart): void {
        const categoryName = String(part.Category || '').trim()
        row.partNbr = String(part.PartNumber || '').trim()
        row.lookupQuery = row.partNbr
        row.description = String(part.LongDescription || '').trim()
        row.cost = this.roundBomMoney(part.SalesPrice || part.MSRPPrice || 0)
        row.type = categoryName
        row.includeOnFloorplan = false
        row.labor = this.roundBomMoney(this.getDefaultLaborCost(null))
        row.bomRowParts = this.createBomRowPartsFromVendorPart(part)
        this.refreshTakeoffColumnDefinitions()
        this.syncBomLaborToInstallLaborEstimate()
        this.closeBomPartLookup()
    }

    async selectBomDevice(section: ProjectBomSection, row: ProjectBomRow, device: VwDevice): Promise<void> {
        const partNumber = String(device.partNumber || '').trim()
        let materials: VwDeviceMaterial[] = []
        try {
            materials = await firstValueFrom(this.http.get<VwDeviceMaterial[]>(`/api/firewire/vwdevicematerials/${device.deviceId}`))
        } catch {
            materials = []
        }
        row.partNbr = partNumber
        row.lookupQuery = partNumber
        row.description = String(device.name || device.shortName || '').trim()
        row.cost = this.roundBomMoney(device.cost || 0)
        row.type = String(device.categoryName || '').trim()
        row.includeOnFloorplan = !!device.includeOnFloorplan
        row.labor = this.roundBomMoney(this.getDefaultLaborCost(device.defaultLabor))
        row.bomRowParts = this.createBomRowPartsFromDeviceMaterials(device, materials)
        this.refreshTakeoffColumnDefinitions()
        this.syncBomLaborToInstallLaborEstimate()
        this.closeBomPartLookup()
    }

    private createBomRowsFromDevice(device: any, materials: VwDeviceMaterial[], vendorPartMap?: Map<string, VwPart>): ProjectBomRow[] {
        const typeValue = String(device?.categoryName || '').trim()
        const includeOnFloorplan = !!device?.includeOnFloorplan
        const partNumber = String(device.partNumber || '').trim()
        const bomRowParts = this.createBomRowPartsFromDeviceMaterials(device, materials)
        const snapshotCost = bomRowParts.length > 0
            ? bomRowParts.reduce((sum, part) => sum + (Number(part.cost || 0) * Math.max(1, Number(part.quantityPerDevice || 1))), 0)
            : Number(device.cost || 0)

        return [{
            id: this.createClientId(),
            partNbr: partNumber,
            lookupQuery: partNumber,
            description: String(device.name || '').trim(),
            qty: 0,
            cost: this.roundBomMoney(this.getCurrentVendorPrice(partNumber, vendorPartMap, snapshotCost)),
            labor: this.roundBomMoney(this.getDefaultLaborCost(device.defaultLabor)),
            includeOnFloorplan,
            type: typeValue,
            bomRowParts
        }]
    }

    private createBomRowPartsFromVendorPart(part: VwPart): ProjectBomRowPart[] {
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

    private createBomRowPartsFromDeviceMaterials(device: any, materials: VwDeviceMaterial[]): ProjectBomRowPart[] {
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
        return Number(installationRate?.effectiveRate || installationRate?.payRate || this.defaultLaborHourlyRate)
    }

    getInstallationLaborCost(hours: number): number {
        return Number(hours || 0) * this.getInstallationHourlyRate()
    }

    getDefaultLaborCost(value: unknown): number {
        const baselineLaborCost = value === null || typeof value === 'undefined' || value === ''
            ? this.defaultLaborCost
            : Number(value)
        const normalizedBaseline = Number.isFinite(baselineLaborCost) ? baselineLaborCost : this.defaultLaborCost
        return (normalizedBaseline / this.defaultLaborHourlyRate) * this.getInstallationHourlyRate()
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

    getPrimaryTakeoffMatrix(): TakeoffMatrix {
        this.syncTakeoffMatrixShape()
        return this.takeoffMatrices[0]
    }

    getTakeoffRowTotal(matrix: TakeoffMatrix, rowKey: string): number {
        return this.getTakeoffColumnDefinitions().reduce((sum, column) => {
            return sum + this.getTakeoffNumericCellValue(matrix, rowKey, column.key)
        }, 0)
    }

    getTakeoffColumnTotal(matrix: TakeoffMatrix, columnKey: string): number {
        return matrix.rows.reduce((sum, rowKey) => {
            return sum + this.getTakeoffNumericCellValue(matrix, rowKey, columnKey)
        }, 0)
    }

    getTakeoffMatrixTotal(matrix: TakeoffMatrix): number {
        return matrix.rows.reduce((sum, rowKey) => sum + this.getTakeoffRowTotal(matrix, rowKey), 0)
    }

    getTakeoffGrandTotal(): number {
        return this.getTakeoffMatrixTotal(this.getPrimaryTakeoffMatrix())
    }

    getTakeoffColumnDefinitions(): TakeoffColumnDefinition[] {
        if (this.takeoffColumnDefinitionCache.length <= 0) {
            this.refreshTakeoffColumnDefinitions()
        }

        return this.takeoffColumnDefinitionCache
    }

    refreshTakeoffColumnDefinitions(): void {
        this.takeoffColumnDefinitionCache = this.getBomTakeoffColumnDefinitions()
        this.syncTakeoffMatrixShape()
    }

    private getBomTakeoffColumnDefinitions(): TakeoffColumnDefinition[] {
        const byCategory = new Map<string, TakeoffColumnDefinition>()
        for (const section of this.bomSections) {
            for (const row of section.rows || []) {
                const label = String(row.type || '').trim()
                const qty = Math.max(0, Math.trunc(Number(row.qty || 0)))
                if (!label || qty <= 0) {
                    continue
                }
                const key = `category-${this.normalizeTakeoffColumnKey(label)}`
                const existing = byCategory.get(key)
                if (existing) {
                    existing.sourceQty = Number(existing.sourceQty || 0) + qty
                } else {
                    byCategory.set(key, { key, label, sourceQty: qty })
                }
            }
        }
        return [...byCategory.values()]
    }

    private getTakeoffNumericCellValue(matrix: TakeoffMatrix, rowKey: string, columnKey: string): number {
        return Number(matrix.values[rowKey]?.[columnKey] || 0)
    }

    private syncTakeoffMatrixShape(): void {
        const columns = this.takeoffColumnDefinitionCache.length > 0 ? this.takeoffColumnDefinitionCache : this.getBomTakeoffColumnDefinitions()
        const matrix = this.takeoffMatrices[0] || this.createTakeoffMatrix('Matrix 1', [])
        matrix.title = 'Matrix 1'

        const rowEntries = this.getTakeoffFloorplanRowEntries()
        const rows = rowEntries.map((entry) => entry.rowKey)
        const rowLabels: Record<string, string> = {}
        const placementCounts = this.getFloorplanCategoryPlacementCounts()
        const hasSymbolPlacements = placementCounts.size > 0
        const nextValues: Record<string, Record<string, TakeoffValue>> = {}
        rowEntries.forEach((entry, rowIndex) => {
            rowLabels[entry.rowKey] = entry.rowLabel
            nextValues[entry.rowKey] = {}
            const rowCounts = placementCounts.get(entry.file.id)
            for (const column of columns) {
                nextValues[entry.rowKey][column.key] = hasSymbolPlacements
                    ? (rowCounts?.get(column.key) || 0)
                    : rowIndex === 0 && typeof column.sourceQty === 'number'
                        ? column.sourceQty
                        : null
            }
        })

        matrix.rows = rows
        matrix.rowLabels = rowLabels
        matrix.values = nextValues
        this.takeoffMatrices = [matrix]
        this.takeoffColumnDefinitionCache = columns
    }

    private getTakeoffFloorplanRows(): string[] {
        return this.getTakeoffFloorplanRowEntries().map((entry) => entry.rowLabel)
    }

    private getTakeoffFloorplanRowEntries(): Array<{ file: ProjectDocLibraryFileRecord; rowKey: string; rowLabel: string }> {
        return this.getFloorplanFiles().map((file) => {
            return {
                file,
                rowKey: file.id,
                rowLabel: this.getFloorplanTakeoffLabel(file)
            }
        })
    }

    private getFloorplanTakeoffLabel(file: ProjectDocLibraryFileRecord): string {
        return String(file.name || '').trim()
            || this.projectDocLibraryStorage.getDisplayNameFromSourceFileName(this.projectDocLibraryStorage.getSourceFileName(file))
    }

    private getFloorplanCategoryPlacementCounts(): Map<string, Map<string, number>> {
        const counts = new Map<string, Map<string, number>>()
        for (const file of this.getFloorplanFiles()) {
            const annotations = file.floorplanDesign?.annotations || []
            for (const annotation of annotations) {
                if (annotation.kind !== 'symbol' || !annotation.categoryKey) {
                    continue
                }
                const rowCounts = counts.get(file.id) || new Map<string, number>()
                rowCounts.set(annotation.categoryKey, (rowCounts.get(annotation.categoryKey) || 0) + 1)
                counts.set(file.id, rowCounts)
            }
        }
        return counts
    }

    private normalizeTakeoffColumnKey(value: string): string {
        return String(value || '').trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '') || 'item'
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

                const categoryKey = `category-${this.normalizeTakeoffColumnKey(categoryName)}`
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
                    bomRowId: row.id,
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
        this.refreshTakeoffColumnDefinitions()
        this.syncBomLaborToInstallLaborEstimate()
    }

    private getFloorplanSymbolIdForBomRow(row: ProjectBomRow): string {
        if (!String(row.id || '').trim()) {
            row.id = this.createClientId()
        }
        return `bom-row-${row.id}`
    }

    private getFloorplanSymbolCategoryName(row: ProjectBomRow): string {
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
                    categoryName: symbol.categoryName,
                    partNumber: symbol.partNumber,
                    deviceName: symbol.deviceName,
                    materialCost: symbol.materialCost,
                    laborHours: symbol.laborHours,
                    customAttributes: symbol.customAttributes ? [...symbol.customAttributes] : undefined,
                    symbol: symbol.code,
                    label: symbol.label,
                    color: symbol.color
                }
                for (const [key, value] of Object.entries(updates) as [keyof ProjectFloorplanDesignAnnotation, any][]) {
                    if (key === 'customAttributes') {
                        if (JSON.stringify(annotation.customAttributes || []) !== JSON.stringify(value || [])) {
                            annotation.customAttributes = value
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
        if (!this.projectId || !this.firewireProject || !this.canSaveProjectDetails()) {
            return
        }
        this.syncFloorplanQuantitiesToBom()
        const symbolBalanceErrors = this.getFloorplanSymbolBalanceErrors()
        if (symbolBalanceErrors.length > 0) {
            this.showFloorplanSymbolBalanceErrors(symbolBalanceErrors)
            this.firewireSaveMessage = 'Project save blocked by floorplan symbol counts.'
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
        this.syncFloorplanQuantitiesToBom()
        const symbolBalanceErrors = this.getFloorplanSymbolBalanceErrors()
        if (symbolBalanceErrors.length > 0) {
            this.firewireForm.projectStatus = previousStatus
            this.firewireSaveMessage = 'Proposal blocked by floorplan symbol counts.'
            this.showFloorplanSymbolBalanceErrors(symbolBalanceErrors)
            return
        }

        this.saveFirewireProjectRequest().subscribe((saved) => {
            if (!saved) {
                this.firewireForm.projectStatus = previousStatus
                return
            }
            this.firewireSaveMessage = 'Project moved to Proposal.'
        })
    }

    private saveFirewireProjectRequest(options?: { silent?: boolean }): Observable<boolean> {
        if (!this.projectId || !this.firewireProject || !this.canSaveProjectDetails()) {
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

    async confirmDeleteFirewireProject(): Promise<void> {
        if (!this.projectId || !this.firewireProject || this.firewireSaveWorking) {
            return
        }

        this.deleteProjectConfirmationShown = true
    }

    cancelDeleteFirewireProject(): void {
        if (this.firewireSaveWorking) {
            return
        }
        this.deleteProjectConfirmationShown = false
    }

    deleteFirewireProject(): void {
        if (!this.projectId || !this.firewireProject || this.firewireSaveWorking) {
            return
        }
        this.firewireSaveWorking = true
        this.firewireSaveMessage = 'Deleting project...'
        this.http.delete(`/api/firewire/projects/firewire/${this.projectId}`).subscribe({
            next: () => {
                this.removeDeletedProjectFromLocalLists()
                this.firewireProject = undefined
                this.firewireSaveWorking = false
                this.deleteProjectConfirmationShown = false
                this.firewireSaveMessage = ''
                void this.router.navigateByUrl(this.getBackRoute())
            },
            error: (err: any) => {
                this.firewireSaveWorking = false
                this.deleteProjectConfirmationShown = false
                this.firewireSaveMessage = err?.error?.message || err?.message || 'Unable to delete project.'
            }
        })
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
            id: this.createClientId(),
            partNbr: '',
            lookupQuery: '',
            description: '',
            qty: 0,
            cost: 0,
            labor: 0,
            includeOnFloorplan: false,
            type: '',
            bomRowParts: []
        }
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
                    id: String(row?.id || this.createClientId()),
                    partNbr: String(row?.partNbr || '').trim(),
                    lookupQuery: String(row?.partNbr || '').trim(),
                    description: String(row?.description || '').trim(),
                    qty: Number(row?.qty || 0),
                    cost: this.roundBomMoney(row?.cost),
                    labor: this.roundBomMoney(row?.labor),
                    includeOnFloorplan: this.normalizeBomRowFloorplanFlag(row),
                    type: String(row?.type || '').trim(),
                    bomRowParts: this.cloneBomRowParts(row?.bomRowParts)
                }))
                : [this.createEmptyBomRow()]
        }))
    }

    private buildBomSectionSnapshot(): ProjectBomSection[] {
        this.ensureBomRowIds()
        return (this.bomSections || []).map((section) => ({
            title: String(section.title || '').trim(),
            sectionKey: String(section.sectionKey || this.createClientId()),
            vendorIds: Array.isArray(section.vendorIds) ? [...section.vendorIds] : [],
            vendorNames: Array.isArray(section.vendorNames) ? [...section.vendorNames] : [],
            rows: (section.rows || []).map((row) => ({
                id: String(row.id || this.createClientId()),
                partNbr: String(row.partNbr || '').trim(),
                description: String(row.description || '').trim(),
                qty: Number(row.qty || 0),
                cost: this.roundBomMoney(row.cost),
                labor: this.roundBomMoney(row.labor),
                includeOnFloorplan: !!row.includeOnFloorplan,
                type: String(row.type || '').trim(),
                bomRowParts: this.cloneBomRowParts(row.bomRowParts)
            }))
        }))
    }

    private cloneBomRowParts(input: unknown): ProjectBomRowPart[] {
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

    private async ensureBomLookupDataLoaded(): Promise<void> {
        if (this.vendorPartLookupWorking) {
            return
        }

        const requests: Promise<unknown>[] = []

        if (!this.vendorPartLookupLoaded) {
            this.vendorPartLookupWorking = true
            requests.push(firstValueFrom(this.http.get<{ rows?: VwPart[] }>('/api/firewire/parts'))
                .then((response) => {
                    this.vendorPartRows = Array.isArray(response?.rows) ? response.rows : []
                    this.vendorPartLookupLoaded = true
                })
                .finally(() => {
                    this.vendorPartLookupWorking = false
                }))
        }

        if (!this.deviceLookupLoaded) {
            requests.push(firstValueFrom(this.http.get<{ rows?: VwDevice[] }>('/api/firewire/vwdevices'))
                .then((response) => {
                    this.deviceRows = Array.isArray(response?.rows) ? response.rows : []
                    this.deviceLookupLoaded = true
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
        if (!this.firewireProject || !this.canSaveProjectDetails()) {
            return
        }
        this.applyFirewireProject(this.firewireProject)
        this.applyWorksheetState(this.firewireProject.worksheetData)
        this.captureInitialProjectState()
        this.firewireSaveMessage = ''
    }

    onUploadProjectDocumentsClick(fileInput: HTMLInputElement) {
        this.clearProjectUploadErrorToast()
        this.docLibraryStatusMessage = ''
        fileInput.click()
    }

    onUploadProjectFloorplansClick(fileInput: HTMLInputElement) {
        this.clearProjectUploadErrorToast()
        this.floorplanStatusMessage = ''
        fileInput.click()
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
                canSave: this.canSaveProjectDetails()
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
        file.documentKind = this.projectDocLibraryStorage.getDocumentKindForFolder(targetFolderId)
        file.updatedAt = new Date().toISOString()
        await this.persistDocLibraryWorkspace()
        this.docLibraryStatusMessage = `Moved ${file.name} to ${this.getDocLibraryFolderLabel(targetFolderId)}.`
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

        const workspace = await this.projectDocLibraryStorage.deleteFile(file.storageKey || this.getDocLibraryStorageKey(), fileId)
        this.docLibraryFiles = this.mergeDocLibraryFiles(workspace.files || [])
        this.docLibraryStatusMessage = `Deleted ${file.name}.`
    }

    async deleteFloorplanFile(fileId: string): Promise<void> {
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

        const workspace = await this.projectDocLibraryStorage.deleteFile(file.storageKey || this.getDocLibraryStorageKey(), fileId)
        this.docLibraryFiles = this.mergeDocLibraryFiles(workspace.files || [])
        this.syncFloorplanQuantitiesToBom()
        this.refreshTakeoffColumnDefinitions()
        await firstValueFrom(this.saveFirewireProjectRequest({ silent: true }))
        this.floorplanStatusMessage = `Deleted ${file.name}.`
    }

    async saveGeneratedEstimatingSheet(fileName: string, html: string): Promise<void> {
        const normalizedFileName = this.ensureHtmlFileName(fileName)
        const now = new Date().toISOString()
        const targetFolderId = 'all'
        const generatedFile = new File([html], normalizedFileName, { type: 'text/html', lastModified: Date.now() })
        const duplicate = this.docLibraryFiles.find((item) =>
            item.folderId === targetFolderId
            && item.name.toLowerCase() === normalizedFileName.toLowerCase())

        if (duplicate) {
            const duplicateStorageKey = String(duplicate.storageKey || this.getDocLibraryStorageKey()).trim() || this.getDocLibraryStorageKey()
            const version = await this.projectDocLibraryStorage.uploadFileVersion(duplicateStorageKey, generatedFile, {
                fileId: duplicate.id,
                versionId: this.createClientId(),
                folderId: duplicate.folderId,
                versionNumber: duplicate.versions.length + 1,
                lastModified: generatedFile.lastModified
            })
            duplicate.storageKey = duplicateStorageKey
            duplicate.versions.push(version)
            duplicate.updatedAt = now
        } else {
            const fileId = this.createClientId()
            const version = await this.projectDocLibraryStorage.uploadFileVersion(this.getDocLibraryStorageKey(), generatedFile, {
                fileId,
                versionId: this.createClientId(),
                folderId: targetFolderId,
                versionNumber: 1,
                lastModified: generatedFile.lastModified
            })
            this.docLibraryFiles.push({
                id: fileId,
                folderId: targetFolderId,
                storageKey: this.getDocLibraryStorageKey(),
                name: normalizedFileName,
                extension: 'html',
                createdAt: now,
                updatedAt: now,
                versions: [version]
            })
        }

        await this.persistDocLibraryWorkspace()
        this.docLibraryStatusMessage = `Saved ${normalizedFileName} to Project Files.`
    }

    private getDocLibraryVisibleRecords(): ProjectDocLibraryFileRecord[] {
        if (this.selectedDocLibraryFolder === 'all') {
            return this.getDocLibraryFilesOnly()
        }
        return this.getDocLibraryFilesOnly().filter((file) => file.folderId === this.selectedDocLibraryFolder)
    }

    private getDocLibraryFolderLabel(folderId: string): string {
        if (folderId === 'all') {
            return 'Project Files'
        }
        return this.docLibraryDirectories.find((directory) => directory.id === folderId)?.name || 'Unfiled'
    }

    private async chooseDocLibraryFolderForUpload(fileInput: HTMLInputElement): Promise<void> {
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
                folders: this.docLibraryDirectories.map((folder) => ({
                    id: folder.id,
                    label: folder.name
                }))
            } as ProjectDocLibraryCategoryDialogData
        }).afterClosed())
    }

    getLatestDocLibraryVersion(file: ProjectDocLibraryFileRecord): ProjectDocLibraryFileVersionRecord | undefined {
        if (!file.versions || file.versions.length <= 0) {
            return undefined
        }
        return file.versions[file.versions.length - 1]
    }

    private async uploadDocLibraryFile(file: File): Promise<'uploaded' | 'versioned' | 'skipped'> {
        return this.uploadDocLibraryFileToFolder(file, this.selectedDocLibraryFolder || 'all', true)
    }

    private async uploadDocLibraryFileToFolder(file: File, folderId: string, confirmVersion: boolean, thumbnailDataUrl = ''): Promise<'uploaded' | 'versioned' | 'skipped'> {
        const duplicate = this.docLibraryFiles.find((item) =>
            item.folderId === folderId
            && this.projectDocLibraryStorage.hasSourceFileName(item, file.name))
        const now = new Date().toISOString()
        const projectKey = this.getDocLibraryStorageKey()

        if (duplicate) {
            const duplicateStorageKey = String(duplicate.storageKey || projectKey).trim() || projectKey
            if (confirmVersion) {
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
            }

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

        this.docLibraryFiles.push({
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
            versions: [version]
        })
        return 'uploaded'
    }

    private getDocLibraryFilesOnly(): ProjectDocLibraryFileRecord[] {
        return this.docLibraryFiles.filter((file) => file.folderId !== this.floorplansFolderId)
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

    private async persistDocLibraryWorkspace(): Promise<void> {
        await this.projectDocLibraryStorage.saveWorkspace(this.getDocLibraryStorageKey(), {
            files: this.docLibraryFiles,
            directories: this.docLibraryDirectories
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
        this.docLibraryDirectories = this.mergeDocLibraryDirectories(workspaces.flatMap((workspace) => workspace.directories || []))
        await this.ensureFloorplanPdfThumbnails()
    }

    private mergeDocLibraryDirectories(directories: ProjectDocLibraryDirectoryRecord[]): ProjectDocLibraryDirectoryRecord[] {
        const byId = new Map<string, ProjectDocLibraryDirectoryRecord>()
        for (const directory of directories) {
            if (!directory?.id || byId.has(directory.id)) {
                continue
            }
            byId.set(directory.id, { ...directory })
        }
        return [...byId.values()].sort((left, right) => String(left.name || '').localeCompare(String(right.name || '')))
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

    private mergeDocLibraryFiles(files: ProjectDocLibraryFileRecord[]): ProjectDocLibraryFileRecord[] {
        const byKey = new Map<string, ProjectDocLibraryFileRecord>()

        for (const file of files) {
            const fileKey = String(file.id || '').trim()
                || `${String(file.folderId || '').toLowerCase()}::${String(file.sourceFileName || file.versions?.[0]?.sourceFileName || file.name || '').toLowerCase()}`
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

    private blobToDataUrl(blob: Blob): Promise<string> {
        return new Promise((resolve, reject) => {
            const reader = new FileReader()
            reader.onload = () => resolve(String(reader.result || ''))
            reader.onerror = () => reject(reader.error)
            reader.readAsDataURL(blob)
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
        this.projectRecordMissing = false
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

    private loadDeviceSets(): void {
        this.http.get<{ rows?: DeviceSetSummary[] }>('/api/firewire/device-sets').subscribe({
            next: (response) => {
                this.deviceSets = Array.isArray(response?.rows)
                    ? [...response.rows].sort((left, right) => String(left.name || '').localeCompare(String(right.name || '')))
                    : []
            },
            error: (err) => {
                console.error(err)
                this.deviceSets = []
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
                    this.projectRecordMissing = false
                    this.applyFirewireProject(response.data)
                    this.applyWorksheetState(response.data.worksheetData)
                    this.captureInitialProjectState()
                    if (response.data.fieldwireId) {
                        this.fieldwireProjectId = response.data.fieldwireId
                        this.loadLinkedFieldwireProject(response.data.fieldwireId)
                        return
                    }
                } else {
                    this.projectRecordMissing = true
                }
                this.ensureValidWorkspaceTabRoute()
                this.pageWorking = false
            },
            error: (err: any) => {
                this.projectRecordMissing = Number(err?.status || 0) === 404
                this.firewireSaveMessage = this.projectRecordMissing
                    ? ''
                    : err?.error?.message || err?.message || 'Unable to load project.'
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

    private removeDeletedProjectFromLocalLists(): void {
        if (typeof localStorage === 'undefined' || !this.projectId) {
            return
        }

        try {
            const favorites = JSON.parse(localStorage.getItem(this.favoriteProjectsStorageKey) || '[]') as string[]
            if (Array.isArray(favorites)) {
                localStorage.setItem(this.favoriteProjectsStorageKey, JSON.stringify(favorites.filter((id) => id !== this.projectId)))
            }
        } catch {}

        try {
            const recent = JSON.parse(localStorage.getItem(this.recentProjectsStorageKey) || '[]') as RecentProjectLink[]
            if (Array.isArray(recent)) {
                localStorage.setItem(this.recentProjectsStorageKey, JSON.stringify(recent.filter((entry) => entry.id !== this.projectId)))
            }
        } catch {}
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
        this.takeoffMatrices = this.cloneJson(worksheet.takeoffMatrices || this.worksheetDefaults.takeoffMatrices || [this.createTakeoffMatrix('Matrix 1', [])])
        this.wireTakeoffSpecs = this.cloneJson(worksheet.wireTakeoffSpecs || this.worksheetDefaults.wireTakeoffSpecs)
        this.wireWiringStyles = this.cloneJson(worksheet.wireWiringStyles || this.worksheetDefaults.wireWiringStyles)
        this.wireSelections = this.cloneJson(worksheet.wireSelections || this.worksheetDefaults.wireSelections)
        this.wireRunNodes = this.cloneJson(worksheet.wireRunNodes || this.worksheetDefaults.wireRunNodes)
        this.firetrolProvideRows = this.cloneJson(worksheet.firetrolProvideRows || this.worksheetDefaults.firetrolProvideRows)
        this.bomSections = this.normalizeBomSections(Array.isArray(worksheet.bomSections) ? worksheet.bomSections : [])
        this.defaultBaseManHourEstimateFromBom()
        this.refreshTakeoffColumnDefinitions()
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

    async onProjectFloorplanFileSelected(event: Event) {
        const input = event.target as HTMLInputElement | null
        if (!input || !input.files || input.files.length <= 0) {
            return
        }

        this.floorplanUploadBusy = true
        this.clearProjectUploadErrorToast()
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
                await this.uploadDocLibraryFileToFolder(file, this.floorplansFolderId, false, await this.createFloorplanThumbnailIfNeeded(file))
                uploadedCount += 1
            }

            await this.persistDocLibraryWorkspace()

            const summaryParts: string[] = []
            if (uploadedCount > 0) {
                summaryParts.push(`${uploadedCount} uploaded`)
            }
            if (skippedCount > 0) {
                summaryParts.push(`${skippedCount} skipped`)
            }
            this.floorplanStatusMessage = summaryParts.length > 0
                ? `Floorplans updated: ${summaryParts.join(', ')}.`
                : 'No floorplan changes were made.'
        } catch (err: any) {
            this.floorplanStatusMessage = err?.message || 'Floorplan upload failed.'
            this.showProjectUploadErrorToast(this.floorplanStatusMessage)
            console.error('Project floorplan upload failed.', err)
        } finally {
            this.floorplanUploadBusy = false
            input.value = ''
        }
    }

    async renameFloorplanFile(file: ProjectDocLibraryFileRecord): Promise<void> {
        this.setFloorplanSaving(file.id, true)
        try {
            file.name = String(file.name || '').trim() || 'Floorplan'
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
            this.syncFloorplanQuantitiesToBom()
            this.refreshTakeoffColumnDefinitions()
            await this.persistDocLibraryWorkspace()
            await firstValueFrom(this.saveFirewireProjectRequest({ silent: true }))
            this.floorplanStatusMessage = `Saved design markup for ${file.name}.`
        } finally {
            this.setFloorplanSaving(file.id, false)
        }
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

    private defaultBaseManHourEstimateFromBom(): void {
        if (Number(this.baseManHourEstimate || 0) > 0) {
            return
        }

        const bomLaborHours = this.getBomBaseManHourEstimate()
        if (bomLaborHours > 0) {
            this.baseManHourEstimate = bomLaborHours
        }
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

    private createTakeoffMatrix(title: string, rows: string[], rowLabels: Record<string, string> = {}): TakeoffMatrix {
        const values: Record<string, Record<string, TakeoffValue>> = {}
        for (const row of rows) {
            values[row] = {}
        }
        return { title, rows, rowLabels, values }
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
        <h2 mat-dialog-title>Delete File</h2>
        <mat-dialog-content>
            Delete <strong>{{data.fileName}}</strong>? This removes it from this workspace.
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
