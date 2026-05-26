import { Component, OnInit, ViewChild } from "@angular/core"
import { CommonModule } from "@angular/common"
import { HttpClient } from "@angular/common/http"
import { RouterLink } from "@angular/router"

import { MatButtonModule } from "@angular/material/button"
import { MatIconModule } from "@angular/material/icon"
import { MatPaginator, MatPaginatorModule, PageEvent } from "@angular/material/paginator"
import { MatSort, MatSortModule, Sort, SortDirection } from "@angular/material/sort"
import { MatTableDataSource, MatTableModule } from "@angular/material/table"
import { MatInputModule } from "@angular/material/input"
import { MatFormFieldModule } from "@angular/material/form-field"

import { PageToolbar } from "../../common/components/page-toolbar"
import { NavToolbar } from "../../common/components/nav-toolbar"
import { ProjectListItemSchema } from "../../schemas/project-list-item.schema"

@Component({
    standalone: true,
    selector: 'design-page',
    imports: [
        CommonModule,
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
    templateUrl: './design.page.html',
    styleUrls: ['./design.page.scss']
})
export class DesignPage implements OnInit {
    displayedColumns: string[] = ['name', 'projectNbr', 'projectStatus', 'address', 'bidDueDate', 'actions']
    pageWorking = true
    errText = ''
    projects: ProjectListItemSchema[] = []
    navItems = NavToolbar.DesignNavItems
    textFilter = ''
    currentSortActive = 'name'
    currentSortDirection: SortDirection = 'asc'
    pageSize = 25
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

    loadProjects() {
        this.pageWorking = true
        this.errText = ''
        this.projects = []
        this.datasource.data = []

        this.http.get('/api/firewire/projects').subscribe({
            next: (s: any) => {
                const rows = Array.isArray(s?.rows) ? s.rows as ProjectListItemSchema[] : []
                this.projects = rows.filter((row) => !!row.firewireProjectId)
                this.datasource.data = this.projects
                this.applyStoredSortState()
                this.applyStoredPageSizeState()
                this.applyStoredFilterState()
                this.pageWorking = false
            },
            error: (err: any) => {
                this.errText = err?.error?.message || err?.message || 'Unable to load projects.'
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
            return 'Loading design projects...'
        }
        if (this.errText) {
            return this.errText
        }
        if (!filterValue) {
            return 'No Firewire projects available for design.'
        }
        return `No Firewire projects matching "${filterValue}"`
    }

    toLocalDateString(input: Date | string | null | undefined) {
        if (!input) {
            return ''
        }

        const parsed = new Date(input)
        if (Number.isNaN(parsed.getTime())) {
            return ''
        }

        return new Intl.DateTimeFormat(undefined, {
            dateStyle: 'short'
        }).format(parsed)
    }

    getProjectDetailsLink(row: ProjectListItemSchema): string[] {
        return row.firewireProjectId ? ['/projects', 'firewire', row.firewireProjectId, 'project-details'] : ['/projects']
    }

    getDesignWorkspaceLink(row: ProjectListItemSchema): string[] {
        return row.firewireProjectId ? ['/design', row.firewireProjectId] : ['/design']
    }

    getFieldwireProjectUrl(row: ProjectListItemSchema): string | null {
        const fieldwireProjectId = row.fieldwireProjectId || row.fieldwireId
        return fieldwireProjectId ? `https://app.fieldwire.com/projects/${fieldwireProjectId}` : null
    }

    private configureFilterPredicate() {
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
                row.jobType,
                row.scopeType,
                row.projectScope,
                row.difficulty
            ].filter((value) => value !== null && typeof value !== 'undefined').join(' ').toLowerCase()

            return haystack.includes(filter)
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
            localStorage.setItem('firewire.design-projects.filter', this.textFilter)
        } catch {}
    }

    private readStoredFilter(): string {
        if (typeof localStorage === 'undefined') {
            return ''
        }
        try {
            return localStorage.getItem('firewire.design-projects.filter') || ''
        } catch {
            return ''
        }
    }

    private storeSort() {
        if (typeof localStorage === 'undefined') {
            return
        }
        try {
            localStorage.setItem('firewire.design-projects.sort', JSON.stringify({
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
            const parsed = JSON.parse(localStorage.getItem('firewire.design-projects.sort') || '{}') as { active?: unknown, direction?: unknown }
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
            localStorage.setItem('firewire.design-projects.pageSize', String(this.pageSize))
        } catch {}
    }

    private readStoredPageSize(): number {
        if (typeof localStorage === 'undefined') {
            return 25
        }
        try {
            const raw = Number(localStorage.getItem('firewire.design-projects.pageSize') || '25')
            return [5, 10, 25, 100].includes(raw) ? raw : 25
        } catch {
            return 25
        }
    }
}
