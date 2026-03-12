import { Component, OnInit, AfterViewInit, ViewChild } from "@angular/core"
import { CommonModule } from "@angular/common"
import { FormsModule } from "@angular/forms"
import { HttpClient } from "@angular/common/http"
import { Router, RouterLink } from "@angular/router"
import { MatDialog, MatDialogModule } from "@angular/material/dialog"
import { MatButtonModule } from "@angular/material/button"
import { MatFormFieldModule } from "@angular/material/form-field"
import { MatIconModule } from "@angular/material/icon"
import { MatInputModule } from "@angular/material/input"
import { MatPaginator, MatPaginatorModule } from "@angular/material/paginator"
import { MatSort, MatSortModule } from "@angular/material/sort"
import { MatTableDataSource, MatTableModule } from "@angular/material/table"
import { PageToolbar } from "../../common/components/page-toolbar"
import { NavToolbar } from "../../common/components/nav-toolbar"
import { Utils } from "../../common/utils"
import { FirewireProjectUpsert } from "../../schemas/firewire-project.schema"
import { ProjectSettingsCatalogSchema } from "../../schemas/project-settings.schema"
import { ProjectListItemSchema } from "../../schemas/project-list-item.schema"
import { CreateFirewireProjectDialog } from "./create-firewire-project.dialog"
import { ProjectSettingsApi } from "./project-settings.api"

@Component({
    standalone: true,
    selector: 'fieldwire-projects-page',
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
        MatDialogModule,
        PageToolbar,
        NavToolbar
    ],
    providers: [HttpClient],
    templateUrl: './fieldwire-projects.page.html',
    styleUrls: ['./projects.page.scss']
})
export class FieldwireProjectsPage implements OnInit, AfterViewInit {
    displayedColumns: string[] = ['name', 'projectNbr', 'address', 'actions']

    private paginator?: MatPaginator
    private sort?: MatSort

    @ViewChild(MatPaginator)
    set paginatorRef(value: MatPaginator | undefined) {
        this.paginator = value
        this.datasource.paginator = value || null
    }

    @ViewChild(MatSort)
    set sortRef(value: MatSort | undefined) {
        this.sort = value
        this.datasource.sort = value || null
    }

    pageWorking = true
    projects: ProjectListItemSchema[] = []
    navItems = NavToolbar.ProjectNavItems
    errText?: string
    createStatusText = ''
    fieldwireCreateSaving: Record<string, boolean> = {}
    projectSettings: ProjectSettingsCatalogSchema = {
        jobType: [],
        scopeType: [],
        projectScope: [],
        difficulty: [],
        projectStatus: []
    }

    datasource: MatTableDataSource<ProjectListItemSchema> = new MatTableDataSource(this.projects)

    constructor(
        private http: HttpClient,
        private dialog: MatDialog,
        private projectSettingsApi: ProjectSettingsApi,
        private router: Router
    ) {}

    ngOnInit(): void {
        this.loadProjectSettings()
        this.loadProjects()
    }

    ngAfterViewInit(): void {
        this.datasource.paginator = this.paginator || null
        this.datasource.sort = this.sort || null
    }

    loadProjects() {
        this.projects = []
        this.pageWorking = true
        this.errText = undefined

        this.http.get('/api/firewire/projects').subscribe({
            next: (s: any) => {
                if (s?.rows) {
                    this.projects = [...s.rows].filter((row: ProjectListItemSchema) => row.projectSource === 'fieldwire')
                    this.datasource = new MatTableDataSource(this.projects)
                    this.datasource.paginator = this.paginator || null
                    this.datasource.sort = this.sort || null
                }
                this.pageWorking = false
            },
            error: (err: Error) => {
                this.errText = err.message
                console.dir(err)
                this.pageWorking = false
            }
        })
    }

    applyFilter(event: Event) {
        const filterValue = (event.target as HTMLInputElement).value
        this.datasource.filter = filterValue.trim().toLowerCase()

        if (this.datasource.paginator) {
            this.datasource.paginator.firstPage()
        }
    }

    getNoDataRowText(filterValue: string) {
        if (this.pageWorking) {
            return "Loading, please wait..."
        }
        if (this.errText) {
            return this.errText
        }
        if (!filterValue) {
            return "No Data Found"
        }
        return `No data matching the filter "${filterValue}"`
    }

    createFirewireFromFieldwire(row: ProjectListItemSchema) {
        const fieldwireProjectId = row.fieldwireProjectId
        if (!fieldwireProjectId) {
            return
        }

        const dialogRef = this.dialog.open(CreateFirewireProjectDialog, {
            width: '860px',
            maxWidth: '95vw',
            data: {
                fieldwireProject: row,
                projectSettings: this.projectSettings
            }
        })

        dialogRef.afterClosed().subscribe((payload?: FirewireProjectUpsert) => {
            if (!payload) {
                return
            }

            this.fieldwireCreateSaving[fieldwireProjectId] = true
            this.createStatusText = 'Creating Firewire project from Fieldwire project...'

            this.http.post('/api/firewire/projects', payload).subscribe({
                next: (response: any) => {
                    this.fieldwireCreateSaving[fieldwireProjectId] = false
                    this.createStatusText = 'Firewire project created.'
                    const firewireProjectId = response?.data?.uuid
                    if (firewireProjectId) {
                        this.router.navigate(['/projects', 'firewire', firewireProjectId, 'project-details'])
                        return
                    }
                    this.loadProjects()
                },
                error: (err: any) => {
                    this.fieldwireCreateSaving[fieldwireProjectId] = false
                    this.createStatusText = err?.error?.message || err?.message || 'Unable to create Firewire project from Fieldwire row.'
                }
            })
        })
    }

    toLocalDateTimeString(input: Date | string) {
        return Utils.toLocalString(input)
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
}
