import { Component, OnInit, AfterViewInit, ViewChild } from "@angular/core"
import { NgIf, NgFor } from "@angular/common"
import { FormsModule } from "@angular/forms"

import { HttpClient } from "@angular/common/http"
import { CommonModule } from "@angular/common"
import { RouterLink } from "@angular/router"

import { Utils } from "../../common/utils"
import { PageToolbar } from '../../common/components/page-toolbar';
import { NavToolbar } from "../../common/components/nav-toolbar"
import { FirewireProjectUpsert } from "../../schemas/firewire-project.schema"
import { ProjectSettingsCatalogSchema } from "../../schemas/project-settings.schema"
import { ProjectListItemSchema } from "../../schemas/project-list-item.schema"
import { ProjectSettingsApi } from "./project-settings.api"

import { MatButtonModule } from "@angular/material/button"
import { MatIconModule } from "@angular/material/icon"
import {MatPaginator, MatPaginatorModule} from '@angular/material/paginator';
import {MatSort, MatSortModule} from '@angular/material/sort';
import {MatTableDataSource, MatTableModule} from '@angular/material/table';
import {MatInputModule} from '@angular/material/input';
import {MatFormFieldModule} from '@angular/material/form-field';
import { MatSelectModule } from "@angular/material/select";

@Component({
    standalone: true,
    selector: 'projects-page',
    imports: [CommonModule, FormsModule, RouterLink,
        MatButtonModule, MatIconModule, 
        MatPaginatorModule, MatSortModule,
        MatTableModule, MatInputModule,
        MatFormFieldModule, MatSelectModule,
        PageToolbar, NavToolbar],
    providers: [HttpClient],
    templateUrl: './projects.page.html',
    styleUrls: ['./projects.page.scss']
})
export class ProjectsPage implements OnInit, AfterViewInit {
    displayedColumns: string[] = ['name', 'projectNbr', 'address', 'bidDueDate', 'actions'];

    private paginator?: MatPaginator;
    private sort?: MatSort;

    @ViewChild(MatPaginator)
    set paginatorRef(value: MatPaginator | undefined) {
        this.paginator = value;
        this.datasource.paginator = value || null;
    }

    @ViewChild(MatSort)
    set sortRef(value: MatSort | undefined) {
        this.sort = value;
        this.datasource.sort = value || null;
    }

    pageWorking = true
    saveWorking = false
    createPanelOpen = false
    projects: ProjectListItemSchema[] = []
    navItems = NavToolbar.ProjectNavItems
    errText?: string
    createStatusText = ''
    projectSettings: ProjectSettingsCatalogSchema = {
        jobType: [],
        scopeType: [],
        projectScope: [],
        difficulty: [],
        projectStatus: []
    }

    datasource: MatTableDataSource<ProjectListItemSchema> = new MatTableDataSource(this.projects);
    createModel: FirewireProjectUpsert = this.createDefaultProject()

    constructor(private http: HttpClient, private projectSettingsApi: ProjectSettingsApi) {}

    ngOnInit(): void {
        this.loadProjectSettings()
        this.loadProjects()
    }

    ngAfterViewInit(): void {
        this.datasource.paginator = this.paginator||null;
        this.datasource.sort = this.sort||null;
    }

    loadProjects() {
        this.projects = []
        this.pageWorking = true
        this.errText = undefined

        this.http.get('/api/firewire/projects').subscribe({
            next: (s: any) => {
                if (s && s.rows) {
                    this.projects = [...s.rows].filter((row: ProjectListItemSchema) => !!row.firewireProjectId)
                    this.datasource = new MatTableDataSource(this.projects)
                    this.datasource.paginator = this.paginator || null
                    this.datasource.sort = this.sort || null
                    this.pageWorking = false
                    return
                } else {
                    this.projects = []
                    this.pageWorking = false
                }
            },
            error: (err: Error) => {
                this.errText = err.message
                console.dir(err)
                this.pageWorking = false
            }
        })
    }

    applyFilter(event: Event) {
        const filterValue = (event.target as HTMLInputElement).value;
        this.datasource.filter = filterValue.trim().toLowerCase();

        if (this.datasource.paginator) {
            this.datasource.paginator.firstPage();
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

    toLocalDateTimeString(input: Date|string) {
        return Utils.toLocalString(input)
    }

    toLocalDateString(input: Date|string) {
        const parsed = new Date(input)
        if (Number.isNaN(parsed.getTime())) {
            return ''
        }
        return new Intl.DateTimeFormat(undefined, {
            dateStyle: 'short'
        }).format(parsed)
    }

    toggleCreatePanel() {
        this.createPanelOpen = !this.createPanelOpen
        this.createStatusText = ''
        if (!this.createPanelOpen) {
            this.createModel = this.createDefaultProject()
        }
    }

    createProject() {
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

    getActiveSettings(listKey: keyof ProjectSettingsCatalogSchema) {
        return (this.projectSettings[listKey] || []).filter((item) => item.isActive)
    }

    getProjectLink(row: ProjectListItemSchema): string[] {
        return row.firewireProjectId ? ['/projects', 'firewire', row.firewireProjectId, 'project-details'] : ['/projects']
    }

    private createDefaultProject(): FirewireProjectUpsert {
        const defaultBidDate = new Date()
        defaultBidDate.setDate(defaultBidDate.getDate() + 30)

        return {
            fieldwireId: null,
            name: '',
            projectNbr: '',
            address: '',
            bidDueDate: defaultBidDate.toISOString().slice(0, 10),
            projectStatus: 'Estimation',
            salesman: '',
            jobType: '',
            scopeType: '',
            projectScope: '',
            difficulty: '',
            totalSqFt: 0
        }
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
