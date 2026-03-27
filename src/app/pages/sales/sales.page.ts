import { CommonModule } from '@angular/common'
import { HttpClient } from '@angular/common/http'
import { Component, ViewChild, inject } from '@angular/core'
import { FormsModule } from '@angular/forms'
import { RouterLink } from '@angular/router'

import { MatButtonModule } from '@angular/material/button'
import { MatFormFieldModule } from '@angular/material/form-field'
import { MatIconModule } from '@angular/material/icon'
import { MatInputModule } from '@angular/material/input'
import { MatPaginator, MatPaginatorModule, PageEvent } from '@angular/material/paginator'
import { MatSelectModule } from '@angular/material/select'
import { MatSort, MatSortModule, Sort, SortDirection } from '@angular/material/sort'
import { MatTableDataSource, MatTableModule } from '@angular/material/table'

import { AuthService } from '../../auth/auth.service'
import { PageToolbar } from '../../common/components/page-toolbar'
import { FIREWIRE_PROJECT_TYPE_OPTIONS, FirewireProjectUpsert } from '../../schemas/firewire-project.schema'
import { ProjectListItemSchema } from '../../schemas/project-list-item.schema'
import { ProjectSettingsCatalogSchema } from '../../schemas/project-settings.schema'
import { ProjectSettingsApi } from '../projects/project-settings.api'

@Component({
    standalone: true,
    selector: 'sales-page',
    imports: [
        CommonModule,
        FormsModule,
        RouterLink,
        MatButtonModule,
        MatFormFieldModule,
        MatIconModule,
        MatInputModule,
        MatPaginatorModule,
        MatSelectModule,
        MatSortModule,
        MatTableModule,
        PageToolbar
    ],
    providers: [HttpClient],
    templateUrl: './sales.page.html',
    styleUrls: ['./sales.page.scss']
})
export class SalesPage {
    displayedColumns: string[] = ['projectTypeIcon', 'name', 'projectNbr', 'projectStatus', 'address', 'bidDueDate', 'actions']
    readonly projectTypeOptions = FIREWIRE_PROJECT_TYPE_OPTIONS
    readonly salesProjectStatus = 'Estimation'
    private readonly salesStatusFilterStorageKey = 'firewire.sales.statusFilter'
    private readonly salesSortStorageKey = 'firewire.sales.sort'
    private readonly salesTextFilterStorageKey = 'firewire.sales.textFilter'
    private readonly salesPageSizeStorageKey = 'firewire.sales.pageSize'
    private readonly auth = inject(AuthService)

    @ViewChild(MatPaginator)
    set paginatorRef(value: MatPaginator | undefined) {
        this.paginator = value
        this.datasource.paginator = value || null
        if (value) {
            value.pageSize = this.pageSize
        }
    }

    @ViewChild(MatSort)
    set sortRef(value: MatSort | undefined) {
        this.sort = value
        this.datasource.sort = value || null
        this.applyStoredSortState()
    }

    private paginator?: MatPaginator
    private sort?: MatSort

    pageWorking = true
    saveWorking = false
    createPanelOpen = false
    errText?: string
    createStatusText = ''
    textFilter = ''
    selectedProjectStatuses: string[] = []
    currentSortActive = 'name'
    currentSortDirection: SortDirection = 'asc'
    pageSize = 10
    projects: ProjectListItemSchema[] = []
    datasource: MatTableDataSource<ProjectListItemSchema> = new MatTableDataSource<ProjectListItemSchema>([])
    createModel: FirewireProjectUpsert = this.createDefaultProject()
    projectSettings: ProjectSettingsCatalogSchema = {
        jobType: [],
        scopeType: [],
        projectScope: [],
        difficulty: [],
        projectStatus: []
    }

    constructor(
        private http: HttpClient,
        private projectSettingsApi: ProjectSettingsApi
    ) {}

    ngOnInit(): void {
        this.textFilter = this.readStoredTextFilter()
        this.selectedProjectStatuses = this.readStoredProjectStatusFilter().filter((status) => status === this.salesProjectStatus)
        this.pageSize = this.readStoredPageSize()
        const storedSort = this.readStoredSalesSort()
        this.currentSortActive = storedSort.active
        this.currentSortDirection = storedSort.direction
        this.configureFilterPredicate()
        this.loadProjectSettings()
        this.loadProjects()
    }

    ngAfterViewInit(): void {
        this.datasource.paginator = this.paginator || null
        this.datasource.sort = this.sort || null
        this.applyStoredSortState()
        if (this.paginator) {
            this.paginator.pageSize = this.pageSize
        }
    }

    loadProjects(): void {
        this.pageWorking = true
        this.errText = undefined
        this.projects = []

        this.http.get('/api/firewire/projects').subscribe({
            next: (response: any) => {
                const rows = Array.isArray(response?.rows) ? response.rows as ProjectListItemSchema[] : []
                this.projects = rows.filter((row) => !!row.firewireProjectId && this.isSalesProject(row))
                this.datasource = new MatTableDataSource(this.projects)
                this.configureFilterPredicate()
                this.datasource.paginator = this.paginator || null
                this.datasource.sort = this.sort || null
                this.applyStoredSortState()
                this.applyCombinedFilter()
                this.pageWorking = false
            },
            error: (err: any) => {
                this.errText = err?.message || 'Unable to load projects.'
                this.pageWorking = false
            }
        })
    }

    applyFilter(event: Event): void {
        this.textFilter = (event.target as HTMLInputElement).value || ''
        this.storeTextFilter()
        this.applyCombinedFilter()
    }

    onProjectStatusFilterChange(): void {
        this.storeProjectStatusFilter()
        this.applyCombinedFilter()
    }

    clearProjectStatusFilter(): void {
        this.selectedProjectStatuses = []
        this.storeProjectStatusFilter()
        this.applyCombinedFilter()
    }

    onSortChange(sort: Sort): void {
        this.currentSortActive = sort.active || 'name'
        this.currentSortDirection = sort.direction || 'asc'
        this.storeSalesSort()
    }

    onPageChange(event: PageEvent): void {
        this.pageSize = event.pageSize
        this.storePageSize()
    }

    toggleCreatePanel(): void {
        this.createPanelOpen = !this.createPanelOpen
        this.createStatusText = ''
        if (!this.createPanelOpen) {
            this.createModel = this.createDefaultProject()
        } else {
            this.createModel.projectStatus = this.salesProjectStatus
        }
    }

    createProject(): void {
        this.saveWorking = true
        this.createStatusText = 'Saving project...'

        this.http.post('/api/firewire/projects', this.createModel).subscribe({
            next: () => {
                this.saveWorking = false
                this.createStatusText = 'Project saved.'
                this.createPanelOpen = false
                this.createModel = this.createDefaultProject()
                this.loadProjects()
            },
            error: (err: any) => {
                this.saveWorking = false
                this.createStatusText = err?.error?.message || err?.message || 'Unable to save project.'
            }
        })
    }

    getNoDataRowText(): string {
        if (this.pageWorking) {
            return 'Loading, please wait...'
        }
        if (this.errText) {
            return this.errText
        }
        if (!this.textFilter.trim() && this.selectedProjectStatuses.length <= 0) {
            return 'No sales projects found.'
        }
        return 'No sales projects match the current filters.'
    }

    toLocalDateString(input: Date | string): string {
        const parsed = new Date(input)
        if (Number.isNaN(parsed.getTime())) {
            return ''
        }
        return new Intl.DateTimeFormat(undefined, { dateStyle: 'short' }).format(parsed)
    }

    getActiveSettings(listKey: keyof ProjectSettingsCatalogSchema) {
        return (this.projectSettings[listKey] || []).filter((item) => item.isActive)
    }

    getProjectStatusFilterOptions(): string[] {
        return this.getActiveSettings('projectStatus')
            .map((item) => item.label)
            .filter((status) => status === this.salesProjectStatus)
    }

    getProjectTypeIcon(projectType: ProjectListItemSchema['projectType']): string {
        switch (projectType) {
            case 'Sprinkler':
                return 'water_drop'
            case 'Security':
                return 'shield'
            case 'Fire Alarm':
            default:
                return 'local_fire_department'
        }
    }

    getProjectTypeIconClass(projectType: ProjectListItemSchema['projectType']): string {
        switch (projectType) {
            case 'Sprinkler':
                return 'project-type-icon project-type-icon--sprinkler'
            case 'Security':
                return 'project-type-icon project-type-icon--security'
            case 'Fire Alarm':
            default:
                return 'project-type-icon project-type-icon--fire-alarm'
        }
    }

    getSalesProjectLink(row: ProjectListItemSchema): string[] {
        return row.firewireProjectId ? ['/sales', row.firewireProjectId] : ['/sales']
    }

    getFineTuneLink(row: ProjectListItemSchema): string[] {
        return row.firewireProjectId ? ['/projects', 'firewire', row.firewireProjectId, 'project-details'] : ['/projects']
    }

    private isSalesProject(row: ProjectListItemSchema): boolean {
        return String(row.projectStatus || '').trim() === this.salesProjectStatus
    }

    private createDefaultProject(): FirewireProjectUpsert {
        const defaultBidDate = new Date()
        defaultBidDate.setDate(defaultBidDate.getDate() + 30)
        const profile = this.auth.getUserProfile()

        return {
            fieldwireId: null,
            name: '',
            projectNbr: '',
            address: '',
            bidDueDate: defaultBidDate.toISOString().slice(0, 10),
            projectStatus: this.salesProjectStatus,
            projectType: 'Fire Alarm',
            salesman: profile?.name || '',
            jobType: '',
            scopeType: '',
            projectScope: '',
            difficulty: '',
            totalSqFt: 0
        }
    }

    private loadProjectSettings(): void {
        this.projectSettingsApi.getCatalog().subscribe({
            next: (catalog) => {
                this.projectSettings = catalog
            },
            error: (err) => {
                console.error(err)
            }
        })
    }

    private configureFilterPredicate(): void {
        this.datasource.filterPredicate = (row: ProjectListItemSchema, filter: string) => {
            const parsed = this.parseFilterValue(filter)
            const haystack = [
                row.name,
                row.projectNbr,
                row.projectStatus,
                row.address,
                row.salesman,
                row.jobType,
                row.scopeType,
                row.projectScope,
                row.difficulty
            ]
                .filter((value): value is string => typeof value === 'string')
                .join(' ')
                .toLowerCase()

            const matchesText = !parsed.text || haystack.includes(parsed.text)
            const matchesStatus = parsed.statuses.length <= 0 || parsed.statuses.includes((row.projectStatus || '').toLowerCase())
            return matchesText && matchesStatus
        }
    }

    private applyCombinedFilter(): void {
        this.datasource.filter = JSON.stringify({
            text: this.textFilter.trim().toLowerCase(),
            statuses: this.selectedProjectStatuses.map((status) => status.toLowerCase()).sort()
        })

        if (this.datasource.paginator) {
            this.datasource.paginator.firstPage()
        }
    }

    private parseFilterValue(filter: string): { text: string, statuses: string[] } {
        if (!filter) {
            return { text: '', statuses: [] }
        }

        try {
            const parsed = JSON.parse(filter)
            return {
                text: typeof parsed?.text === 'string' ? parsed.text : '',
                statuses: Array.isArray(parsed?.statuses) ? parsed.statuses.filter((value: unknown): value is string => typeof value === 'string') : []
            }
        } catch {
            return { text: filter.trim().toLowerCase(), statuses: [] }
        }
    }

    private storeProjectStatusFilter(): void {
        if (typeof localStorage === 'undefined') {
            return
        }
        try {
            localStorage.setItem(this.salesStatusFilterStorageKey, JSON.stringify(this.selectedProjectStatuses))
        } catch {
            return
        }
    }

    private readStoredProjectStatusFilter(): string[] {
        if (typeof localStorage === 'undefined') {
            return []
        }

        try {
            const value = JSON.parse(localStorage.getItem(this.salesStatusFilterStorageKey) || '[]')
            return Array.isArray(value) ? value.filter((item): item is string => typeof item === 'string') : []
        } catch {
            return []
        }
    }

    private storeSalesSort(): void {
        if (typeof localStorage === 'undefined') {
            return
        }
        try {
            localStorage.setItem(this.salesSortStorageKey, JSON.stringify({
                active: this.currentSortActive,
                direction: this.currentSortDirection
            }))
        } catch {
            return
        }
    }

    private readStoredSalesSort(): { active: string, direction: SortDirection } {
        if (typeof localStorage === 'undefined') {
            return { active: 'name', direction: 'asc' }
        }

        try {
            const parsed = JSON.parse(localStorage.getItem(this.salesSortStorageKey) || '{}') as { active?: unknown, direction?: unknown }
            const active = typeof parsed.active === 'string' && parsed.active.trim() ? parsed.active : 'name'
            const direction = parsed.direction === 'desc' || parsed.direction === 'asc' ? parsed.direction : 'asc'
            return { active, direction }
        } catch {
            return { active: 'name', direction: 'asc' }
        }
    }

    private applyStoredSortState(): void {
        if (!this.sort) {
            return
        }

        this.sort.active = this.currentSortActive
        this.sort.direction = this.currentSortDirection
    }

    private storeTextFilter(): void {
        if (typeof localStorage === 'undefined') {
            return
        }
        try {
            localStorage.setItem(this.salesTextFilterStorageKey, this.textFilter)
        } catch {
            return
        }
    }

    private readStoredTextFilter(): string {
        if (typeof localStorage === 'undefined') {
            return ''
        }
        try {
            return localStorage.getItem(this.salesTextFilterStorageKey) || ''
        } catch {
            return ''
        }
    }

    private storePageSize(): void {
        if (typeof localStorage === 'undefined') {
            return
        }
        try {
            localStorage.setItem(this.salesPageSizeStorageKey, String(this.pageSize))
        } catch {
            return
        }
    }

    private readStoredPageSize(): number {
        if (typeof localStorage === 'undefined') {
            return 10
        }
        try {
            const value = Number(localStorage.getItem(this.salesPageSizeStorageKey) || '10')
            return Number.isFinite(value) && value > 0 ? value : 10
        } catch {
            return 10
        }
    }
}
