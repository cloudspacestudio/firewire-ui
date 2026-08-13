import { HttpClient } from '@angular/common/http'
import { Component, OnInit, ViewChild, ChangeDetectionStrategy } from '@angular/core'
import { FormsModule } from '@angular/forms'
import { RouterLink } from '@angular/router'

import { MatButtonModule } from '@angular/material/button'
import { MatFormFieldModule } from '@angular/material/form-field'
import { MatIconModule } from '@angular/material/icon'
import { MatInputModule } from '@angular/material/input'
import { MatPaginator, MatPaginatorModule, PageEvent } from '@angular/material/paginator'
import { MatSort, MatSortModule, Sort, SortDirection } from '@angular/material/sort'
import { MatTableDataSource, MatTableModule } from '@angular/material/table'

import { PageToolbar } from '../../common/components/page-toolbar'
import { ProjectListItemSchema } from '../../schemas/project-list-item.schema'

@Component({
    standalone: true,
    selector: 'install-page',
    imports: [
        FormsModule,
        RouterLink,
        MatButtonModule,
        MatFormFieldModule,
        MatIconModule,
        MatInputModule,
        MatPaginatorModule,
        MatSortModule,
        MatTableModule,
        PageToolbar
    ],
    providers: [HttpClient],
    templateUrl: './install.page.html',
    changeDetection: ChangeDetectionStrategy.Eager,
    styleUrls: ['./install.page.scss']
})
export class InstallPage implements OnInit {
    readonly installStages = ['Design', 'Install']
    displayedColumns: string[] = ['projectTypeIcon', 'name', 'projectNbr', 'projectStatus', 'address', 'bidDueDate', 'actions']
    pageWorking = true
    errText = ''
    textFilter = ''
    currentSortActive = 'name'
    currentSortDirection: SortDirection = 'asc'
    pageSize = 25
    projects: ProjectListItemSchema[] = []
    datasource = new MatTableDataSource<ProjectListItemSchema>([])
    private paginator?: MatPaginator
    private sort?: MatSort

    @ViewChild(MatPaginator)
    set paginatorRef(value: MatPaginator | undefined) {
        this.paginator = value
        this.datasource.paginator = value || null
        this.applyStoredPageSizeState()
    }

    @ViewChild(MatSort)
    set sortRef(value: MatSort | undefined) {
        this.sort = value
        this.datasource.sort = value || null
        this.applyStoredSortState()
    }

    constructor(private http: HttpClient) {}

    ngOnInit(): void {
        this.textFilter = this.readStoredFilter()
        const storedSort = this.readStoredSort()
        this.currentSortActive = storedSort.active
        this.currentSortDirection = storedSort.direction
        this.pageSize = this.readStoredPageSize()
        this.configureFilterPredicate()
        this.loadProjects()
    }

    loadProjects(): void {
        this.pageWorking = true
        this.errText = ''
        this.projects = []
        this.datasource.data = []

        this.http.get('/api/firewire/projects').subscribe({
            next: (response: any) => {
                const rows = Array.isArray(response?.rows) ? response.rows as ProjectListItemSchema[] : []
                this.projects = rows.filter((row) => !!row.firewireProjectId && this.isInstallStageProject(row))
                this.datasource.data = this.projects
                this.applyStoredSortState()
                this.applyStoredPageSizeState()
                this.applyStoredFilterState()
                this.pageWorking = false
            },
            error: (err: any) => {
                this.errText = err?.error?.message || err?.message || 'Unable to load install projects.'
                this.pageWorking = false
            }
        })
    }

    applyFilter(event: Event): void {
        this.textFilter = (event.target as HTMLInputElement).value || ''
        this.datasource.filter = this.textFilter.trim().toLowerCase()
        this.storeFilter()
        if (this.datasource.paginator) {
            this.datasource.paginator.firstPage()
        }
    }

    onSortChange(sort: Sort): void {
        this.currentSortActive = sort.active || 'name'
        this.currentSortDirection = sort.direction || 'asc'
        this.storeSort()
    }

    onPageChange(event: PageEvent): void {
        this.pageSize = Number(event.pageSize || 25)
        this.storePageSize()
    }

    getNoDataRowText(filterValue: string): string {
        if (this.pageWorking) {
            return 'Loading install projects...'
        }
        if (this.errText) {
            return this.errText
        }
        if (!filterValue) {
            return 'No projects are currently in Design or Install.'
        }
        return `No install projects matching "${filterValue}"`
    }

    toLocalDateString(input: Date | string | null | undefined): string {
        if (!input) {
            return ''
        }

        const parsed = new Date(input)
        if (Number.isNaN(parsed.getTime())) {
            return ''
        }

        return new Intl.DateTimeFormat(undefined, { dateStyle: 'short' }).format(parsed)
    }

    getInstallProjectLink(row: ProjectListItemSchema): string[] {
        return row.firewireProjectId ? ['/install', row.firewireProjectId] : ['/install']
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
                return 'install-type-icon install-type-icon--sprinkler'
            case 'Security':
                return 'install-type-icon install-type-icon--security'
            case 'Fire Alarm':
            default:
                return 'install-type-icon install-type-icon--fire-alarm'
        }
    }

    getStatusClass(row: ProjectListItemSchema): string {
        return String(row.projectStatus || '').trim() === 'Install'
            ? 'install-status install-status--install'
            : 'install-status install-status--design'
    }

    getFieldwireProjectUrl(row: ProjectListItemSchema): string | null {
        const fieldwireProjectId = row.fieldwireProjectId || row.fieldwireId
        return fieldwireProjectId ? `https://app.fieldwire.com/projects/${fieldwireProjectId}` : null
    }

    private isInstallStageProject(row: ProjectListItemSchema): boolean {
        const status = String(row.projectStatus || '').trim()
        return this.installStages.includes(status)
    }

    private configureFilterPredicate(): void {
        this.datasource.filterPredicate = (row, rawFilter) => {
            const filter = rawFilter.trim().toLowerCase()
            if (!filter) {
                return true
            }

            const haystack = [
                row.name,
                row.projectNbr,
                row.projectStatus,
                row.address,
                row.projectType,
                row.salesman,
                row.jobType,
                row.scopeType,
                row.projectScope,
                row.difficulty
            ].filter((value) => value !== null && typeof value !== 'undefined').join(' ').toLowerCase()

            return haystack.includes(filter)
        }
    }

    private applyStoredFilterState(): void {
        this.datasource.filter = this.textFilter.trim().toLowerCase()
    }

    private applyStoredSortState(): void {
        if (!this.sort) {
            return
        }
        this.sort.active = this.currentSortActive
        this.sort.direction = this.currentSortDirection
    }

    private applyStoredPageSizeState(): void {
        if (this.paginator) {
            this.paginator.pageSize = this.pageSize
        }
    }

    private storeFilter(): void {
        if (typeof localStorage === 'undefined') {
            return
        }
        try {
            localStorage.setItem('firewire.install-projects.filter', this.textFilter)
        } catch {}
    }

    private readStoredFilter(): string {
        if (typeof localStorage === 'undefined') {
            return ''
        }
        try {
            return localStorage.getItem('firewire.install-projects.filter') || ''
        } catch {
            return ''
        }
    }

    private storeSort(): void {
        if (typeof localStorage === 'undefined') {
            return
        }
        try {
            localStorage.setItem('firewire.install-projects.sort', JSON.stringify({
                active: this.currentSortActive,
                direction: this.currentSortDirection
            }))
        } catch {}
    }

    private readStoredSort(): { active: string, direction: SortDirection } {
        if (typeof localStorage === 'undefined') {
            return { active: 'name', direction: 'asc' }
        }
        try {
            const parsed = JSON.parse(localStorage.getItem('firewire.install-projects.sort') || '{}') as { active?: unknown, direction?: unknown }
            const active = typeof parsed.active === 'string' && parsed.active.trim() ? parsed.active.trim() : 'name'
            const direction = parsed.direction === 'asc' || parsed.direction === 'desc' ? parsed.direction : 'asc'
            return { active, direction }
        } catch {
            return { active: 'name', direction: 'asc' }
        }
    }

    private storePageSize(): void {
        if (typeof localStorage === 'undefined') {
            return
        }
        try {
            localStorage.setItem('firewire.install-projects.pageSize', String(this.pageSize))
        } catch {}
    }

    private readStoredPageSize(): number {
        if (typeof localStorage === 'undefined') {
            return 25
        }
        try {
            const raw = Number(localStorage.getItem('firewire.install-projects.pageSize') || '25')
            return [5, 10, 25, 100].includes(raw) ? raw : 25
        } catch {
            return 25
        }
    }
}
