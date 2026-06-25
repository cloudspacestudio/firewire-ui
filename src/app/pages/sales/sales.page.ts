import { CommonModule } from '@angular/common'
import { HttpClient } from '@angular/common/http'
import { Component, ViewChild, inject } from '@angular/core'
import { FormsModule } from '@angular/forms'
import { Router, RouterLink } from '@angular/router'

import { MatButtonModule } from '@angular/material/button'
import { MatDialog } from '@angular/material/dialog'
import { MatFormFieldModule } from '@angular/material/form-field'
import { MatIconModule } from '@angular/material/icon'
import { MatInputModule } from '@angular/material/input'
import { MatPaginator, MatPaginatorModule, PageEvent } from '@angular/material/paginator'
import { MatSelectModule } from '@angular/material/select'
import { MatSort, MatSortModule, Sort, SortDirection } from '@angular/material/sort'
import { MatTableDataSource, MatTableModule } from '@angular/material/table'

import { AuthService } from '../../auth/auth.service'
import { PageToolbar } from '../../common/components/page-toolbar'
import { ViewPreferencesService } from '../../common/services/view-preferences.service'
import { FirewireProjectUpsert } from '../../schemas/firewire-project.schema'
import { ProjectListItemSchema } from '../../schemas/project-list-item.schema'
import { createEmptyProjectSettingsCatalog, ProjectSettingsCatalogSchema } from '../../schemas/project-settings.schema'
import { CreateFirewireProjectDialog } from '../projects/create-firewire-project.dialog'
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
    errText?: string
    createStatusText = ''
    textFilter = ''
    selectedProjectStatuses: string[] = []
    currentSortActive = 'name'
    currentSortDirection: SortDirection = 'asc'
    pageSize = 25
    projects: ProjectListItemSchema[] = []
    datasource: MatTableDataSource<ProjectListItemSchema> = new MatTableDataSource<ProjectListItemSchema>([])
    projectSettings: ProjectSettingsCatalogSchema = createEmptyProjectSettingsCatalog()

    constructor(
        private http: HttpClient,
        private projectSettingsApi: ProjectSettingsApi,
        private dialog: MatDialog,
        private router: Router,
        private viewPreferences: ViewPreferencesService
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

    createProject(): void {
        this.createStatusText = ''
        this.releaseFocusedElementBeforeDialog()
        const profile = this.auth.getUserProfile()
        const dialogRef = this.dialog.open(CreateFirewireProjectDialog, {
            width: 'min(980px, calc(100vw - 48px))',
            maxWidth: 'min(980px, calc(100vw - 48px))',
            panelClass: 'fw-create-firewire-project-dialog-pane',
            data: {
                fieldwireProject: {
                    name: '',
                    projectNbr: '',
                    address: ''
                },
                projectSettings: this.projectSettings,
                suggestedProjectStatus: this.salesProjectStatus,
                suggestedSalesman: profile?.name || ''
            }
        })

        dialogRef.afterClosed().subscribe((payload?: FirewireProjectUpsert) => {
            if (!payload) {
                return
            }

            this.saveWorking = true
            this.createStatusText = 'Creating sales project...'
            this.http.post('/api/firewire/projects', {
                ...payload,
                projectStatus: this.salesProjectStatus
            }).subscribe({
                next: (response: any) => {
                    this.saveWorking = false
                    this.createStatusText = 'Sales project created.'
                    const firewireProjectId = response?.data?.uuid
                    if (firewireProjectId) {
                        this.router.navigate(['/sales', firewireProjectId])
                        return
                    }
                    this.loadProjects()
                },
                error: (err: any) => {
                    this.saveWorking = false
                    this.createStatusText = err?.error?.message || err?.message || 'Unable to create sales project.'
                }
            })
        })
    }

    private releaseFocusedElementBeforeDialog(): void {
        const active = document.activeElement
        if (active instanceof HTMLElement) {
            active.blur()
        }
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
        this.viewPreferences.writeJson(this.salesStatusFilterStorageKey, this.selectedProjectStatuses)
    }

    private readStoredProjectStatusFilter(): string[] {
        return this.viewPreferences.readJson<string[]>(this.salesStatusFilterStorageKey, [], (value) => {
            return Array.isArray(value) ? value.filter((item): item is string => typeof item === 'string') : []
        })
    }

    private storeSalesSort(): void {
        this.viewPreferences.writeSort(this.salesSortStorageKey, {
            active: this.currentSortActive,
            direction: this.currentSortDirection
        })
    }

    private readStoredSalesSort(): { active: string, direction: SortDirection } {
        const stored = this.viewPreferences.readSort(this.salesSortStorageKey, { active: 'name', direction: 'asc' })
        return {
            active: stored.active,
            direction: stored.direction === 'desc' || stored.direction === 'asc' ? stored.direction : 'asc'
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
        this.viewPreferences.writeText(this.salesTextFilterStorageKey, this.textFilter)
    }

    private readStoredTextFilter(): string {
        return this.viewPreferences.readText(this.salesTextFilterStorageKey)
    }

    private storePageSize(): void {
        this.viewPreferences.writeNumber(this.salesPageSizeStorageKey, this.pageSize)
    }

    private readStoredPageSize(): number {
        return this.viewPreferences.readNumber(this.salesPageSizeStorageKey, 25, [5, 10, 25, 100])
    }
}
