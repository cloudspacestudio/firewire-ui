import { Component, OnInit, ViewChild } from "@angular/core"
import { CommonModule } from "@angular/common"
import { HttpClient } from "@angular/common/http"
import { RouterLink } from "@angular/router"

import { MatButtonModule } from "@angular/material/button"
import { MatIconModule } from "@angular/material/icon"
import { MatPaginator, MatPaginatorModule } from "@angular/material/paginator"
import { MatSort, MatSortModule } from "@angular/material/sort"
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
    datasource = new MatTableDataSource<ProjectListItemSchema>([])

    @ViewChild(MatPaginator)
    set paginatorRef(value: MatPaginator | undefined) {
        this.datasource.paginator = value || null
    }

    @ViewChild(MatSort)
    set sortRef(value: MatSort | undefined) {
        this.datasource.sort = value || null
    }

    constructor(private http: HttpClient) {}

    ngOnInit(): void {
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
                this.pageWorking = false
            },
            error: (err: any) => {
                this.errText = err?.error?.message || err?.message || 'Unable to load projects.'
                this.pageWorking = false
            }
        })
    }

    applyFilter(event: Event) {
        const value = (event.target as HTMLInputElement).value || ''
        this.datasource.filter = value.trim().toLowerCase()
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
}
