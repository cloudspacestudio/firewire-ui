import { Component, OnInit, AfterViewInit, ViewChild } from "@angular/core"
import { FormsModule } from "@angular/forms"
import { HttpClient } from "@angular/common/http"
import { CommonModule } from "@angular/common"
import { RouterLink } from "@angular/router"

import { PageToolbar } from "../../common/components/page-toolbar"
import { NavToolbar } from "../../common/components/nav-toolbar"
import { FirewireProjectType, FirewireProjectUpsert } from "../../schemas/firewire-project.schema"
import { ProjectListItemSchema } from "../../schemas/project-list-item.schema"

import { MatButtonModule } from "@angular/material/button"
import { MatIconModule } from "@angular/material/icon"
import { MatPaginator, MatPaginatorModule, PageEvent } from "@angular/material/paginator"
import { MatSort, MatSortModule, Sort, SortDirection } from "@angular/material/sort"
import { MatTableDataSource, MatTableModule } from "@angular/material/table"
import { MatInputModule } from "@angular/material/input"
import { MatFormFieldModule } from "@angular/material/form-field"

@Component({
    standalone: true,
    selector: 'awaiting-project-nbr-page',
    imports: [
        CommonModule,
        FormsModule,
        RouterLink,
        MatButtonModule,
        MatIconModule,
        MatPaginatorModule,
        MatSortModule,
        MatTableModule,
        MatInputModule,
        MatFormFieldModule,
        PageToolbar,
        NavToolbar
    ],
    providers: [HttpClient],
    templateUrl: './awaiting-project-nbr.page.html',
    styleUrls: ['./projects.page.scss']
})
export class AwaitingProjectNbrPage implements OnInit, AfterViewInit {
    displayedColumns: string[] = ['projectTypeIcon', 'name', 'projectNbr', 'projectStatus', 'address', 'bidDueDate', 'actions']
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

    pageWorking = true
    saveWorking = false
    projects: ProjectListItemSchema[] = []
    navItems = NavToolbar.ProjectNavItems
    errText?: string
    statusText = ''
    editingProjectId: string | null = null
    pendingProjectNbr = ''
    originalProjectNbr = ''
    textFilter = ''
    currentSortActive = 'name'
    currentSortDirection: SortDirection = 'asc'
    pageSize = 25

    datasource: MatTableDataSource<ProjectListItemSchema> = new MatTableDataSource(this.projects)

    constructor(private http: HttpClient) {}

    ngOnInit(): void {
        this.textFilter = this.readStoredFilter()
        const storedSort = this.readStoredSort()
        this.currentSortActive = storedSort.active
        this.currentSortDirection = storedSort.direction
        this.pageSize = this.readStoredPageSize()
        this.loadProjects()
    }

    ngAfterViewInit(): void {
        this.datasource.paginator = this.paginator || null
        this.datasource.sort = this.sort || null
        this.applyStoredSortState()
        this.applyStoredPageSizeState()
    }

    loadProjects() {
        this.projects = []
        this.pageWorking = true
        this.errText = undefined

        this.http.get('/api/firewire/projects').subscribe({
            next: (response: any) => {
                const rows = Array.isArray(response?.rows) ? response.rows as ProjectListItemSchema[] : []
                this.projects = rows.filter((row) => !!row.firewireProjectId && !String(row.projectNbr || '').trim())
                this.datasource = new MatTableDataSource(this.projects)
                this.datasource.paginator = this.paginator || null
                this.datasource.sort = this.sort || null
                this.applyStoredSortState()
                this.applyStoredPageSizeState()
                this.applyStoredFilterState()
                this.pageWorking = false
            },
            error: (err: Error) => {
                this.errText = err.message
                console.error(err)
                this.pageWorking = false
            }
        })
    }

    applyFilter(event: Event) {
        this.textFilter = (event.target as HTMLInputElement).value || ''
        this.datasource.filter = this.textFilter.trim().toLowerCase()
        this.storeFilter()

        if (this.datasource.paginator) {
            this.datasource.paginator.firstPage()
        }
    }

    onSortChange(sort: Sort) {
        this.currentSortActive = sort.active || 'name'
        this.currentSortDirection = sort.direction || 'asc'
        this.storeSort()
    }

    onPageChange(event: PageEvent) {
        this.pageSize = Number(event.pageSize || 25)
        this.storePageSize()
    }

    getNoDataRowText(filterValue: string) {
        if (this.pageWorking) {
            return 'Loading, please wait...'
        }
        if (this.errText) {
            return this.errText
        }
        if (!filterValue) {
            return 'No Firewire projects are waiting on a project number.'
        }
        return `No data matching the filter "${filterValue}"`
    }

    toLocalDateString(input: Date | string) {
        const parsed = new Date(input)
        if (Number.isNaN(parsed.getTime())) {
            return ''
        }
        return new Intl.DateTimeFormat(undefined, {
            dateStyle: 'short'
        }).format(parsed)
    }

    getProjectLink(row: ProjectListItemSchema): string[] {
        return row.firewireProjectId ? ['/projects', 'firewire', row.firewireProjectId, 'project-details'] : ['/projects']
    }

    getFieldwireProjectUrl(row: ProjectListItemSchema): string | null {
        const fieldwireProjectId = row.fieldwireProjectId || row.fieldwireId
        return fieldwireProjectId ? `https://app.fieldwire.com/projects/${fieldwireProjectId}` : null
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

    private applyStoredFilterState() {
        this.datasource.filter = this.textFilter.trim().toLowerCase()
    }

    private applyStoredSortState() {
        if (!this.sort) {
            return
        }
        this.sort.active = this.currentSortActive
        this.sort.direction = this.currentSortDirection
    }

    private applyStoredPageSizeState() {
        if (this.paginator) {
            this.paginator.pageSize = this.pageSize
        }
    }

    private storeFilter() {
        if (typeof localStorage === 'undefined') {
            return
        }
        try {
            localStorage.setItem('firewire.awaiting-project-nbr.filter', this.textFilter)
        } catch {}
    }

    private readStoredFilter(): string {
        if (typeof localStorage === 'undefined') {
            return ''
        }
        try {
            return localStorage.getItem('firewire.awaiting-project-nbr.filter') || ''
        } catch {
            return ''
        }
    }

    private storeSort() {
        if (typeof localStorage === 'undefined') {
            return
        }
        try {
            localStorage.setItem('firewire.awaiting-project-nbr.sort', JSON.stringify({
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
            const parsed = JSON.parse(localStorage.getItem('firewire.awaiting-project-nbr.sort') || '{}') as { active?: unknown, direction?: unknown }
            const active = typeof parsed.active === 'string' && parsed.active.trim() ? parsed.active.trim() : 'name'
            const direction = parsed.direction === 'asc' || parsed.direction === 'desc' ? parsed.direction : 'asc'
            return { active, direction }
        } catch {
            return { active: 'name', direction: 'asc' }
        }
    }

    private storePageSize() {
        if (typeof localStorage === 'undefined') {
            return
        }
        try {
            localStorage.setItem('firewire.awaiting-project-nbr.pageSize', String(this.pageSize))
        } catch {}
    }

    private readStoredPageSize(): number {
        if (typeof localStorage === 'undefined') {
            return 25
        }
        try {
            const raw = Number(localStorage.getItem('firewire.awaiting-project-nbr.pageSize') || '25')
            return [5, 10, 25, 100].includes(raw) ? raw : 25
        } catch {
            return 25
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

    beginProjectNbrEdit(row: ProjectListItemSchema) {
        const projectId = row.firewireProjectId
        if (!projectId || this.saveWorking) {
            return
        }
        if (this.editingProjectId && this.editingProjectId !== projectId) {
            return
        }

        if (this.editingProjectId === projectId) {
            return
        }

        this.editingProjectId = projectId
        this.originalProjectNbr = String(row.projectNbr || '')
        this.pendingProjectNbr = this.originalProjectNbr
        this.statusText = ''
    }

    onProjectNbrInput(row: ProjectListItemSchema, value: string) {
        this.beginProjectNbrEdit(row)
        if (this.editingProjectId !== row.firewireProjectId) {
            return
        }
        this.pendingProjectNbr = value
    }

    isRowEditing(row: ProjectListItemSchema): boolean {
        return !!row.firewireProjectId && this.editingProjectId === row.firewireProjectId
    }

    isRowEditLocked(row: ProjectListItemSchema): boolean {
        return this.saveWorking || (!!this.editingProjectId && this.editingProjectId !== row.firewireProjectId)
    }

    showProjectNbrActions(row: ProjectListItemSchema): boolean {
        if (!this.isRowEditing(row)) {
            return false
        }
        return this.pendingProjectNbr !== this.originalProjectNbr || this.pendingProjectNbr.trim().length > 0
    }

    canSaveProjectNbr(row: ProjectListItemSchema): boolean {
        return this.isRowEditing(row)
            && this.pendingProjectNbr.trim().length > 0
            && this.pendingProjectNbr.trim() !== this.originalProjectNbr.trim()
            && !this.saveWorking
    }

    cancelProjectNbrEdit() {
        if (this.saveWorking) {
            return
        }

        this.editingProjectId = null
        this.pendingProjectNbr = ''
        this.originalProjectNbr = ''
        this.statusText = ''
    }

    saveProjectNbr(row: ProjectListItemSchema) {
        if (!row.firewireProjectId || !this.canSaveProjectNbr(row)) {
            return
        }

        const payload: FirewireProjectUpsert = {
            fieldwireId: row.fieldwireId,
            name: row.name || '',
            projectNbr: this.pendingProjectNbr.trim(),
            address: row.address || '',
            bidDueDate: row.bidDueDate || '',
            projectStatus: row.projectStatus || 'Estimation',
            projectType: (row.projectType || 'Fire Alarm') as FirewireProjectType,
            salesman: row.salesman || '',
            jobType: row.jobType || '',
            scopeType: row.scopeType || '',
            projectScope: row.projectScope || '',
            difficulty: row.difficulty || '',
            totalSqFt: row.totalSqFt || 0
        }

        this.saveWorking = true
        this.statusText = `Saving project number for ${row.name}...`

        this.http.patch(`/api/firewire/projects/firewire/${row.firewireProjectId}`, payload).subscribe({
            next: () => {
                this.saveWorking = false
                this.cancelProjectNbrEdit()
                this.statusText = 'Project number saved.'
                this.loadProjects()
            },
            error: (err: any) => {
                this.saveWorking = false
                this.statusText = err?.error?.message || err?.message || 'Unable to save project number.'
            }
        })
    }
}
