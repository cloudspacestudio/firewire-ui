import { Component, OnInit } from "@angular/core"
import { CommonModule } from "@angular/common"
import { FormsModule } from "@angular/forms"
import { HttpClient } from "@angular/common/http"
import { RouterLink } from "@angular/router"
import { MatButtonModule } from "@angular/material/button"
import { MatCheckboxModule } from "@angular/material/checkbox"
import { MatFormFieldModule } from "@angular/material/form-field"
import { MatIconModule } from "@angular/material/icon"
import { MatInputModule } from "@angular/material/input"
import { PageToolbar } from "../../common/components/page-toolbar"
import { NavToolbar } from "../../common/components/nav-toolbar"
import {
    ProjectSettingItemSchema,
    ProjectSettingsCatalogSchema,
    ProjectSettingsListKey,
    ProjectSettingUpsert
} from "../../schemas/project-settings.schema"

interface ListMeta {
    key: ProjectSettingsListKey
    title: string
    subtitle: string
}

@Component({
    standalone: true,
    selector: 'projects-admin-page',
    imports: [
        CommonModule,
        FormsModule,
        RouterLink,
        MatButtonModule,
        MatCheckboxModule,
        MatFormFieldModule,
        MatIconModule,
        MatInputModule,
        PageToolbar,
        NavToolbar
    ],
    providers: [HttpClient],
    templateUrl: './projects-admin.page.html',
    styleUrls: ['./projects-admin.page.scss']
})
export class ProjectsAdminPage implements OnInit {
    navItems = NavToolbar.ProjectNavItems
    pageWorking = true
    statusText = ''
    catalog: ProjectSettingsCatalogSchema = {
        jobType: [],
        scopeType: [],
        projectScope: [],
        difficulty: [],
        projectStatus: []
    }
    createModels: Record<ProjectSettingsListKey, ProjectSettingUpsert> = {
        jobType: this.createEmptyModel('jobType'),
        scopeType: this.createEmptyModel('scopeType'),
        projectScope: this.createEmptyModel('projectScope'),
        difficulty: this.createEmptyModel('difficulty'),
        projectStatus: this.createEmptyModel('projectStatus')
    }
    saveBusy: Record<string, boolean> = {}
    activeListKey: ProjectSettingsListKey = 'jobType'
    lists: ListMeta[] = [
        { key: 'jobType', title: 'JOB TYPES', subtitle: 'Building and occupancy categories for Firewire projects.' },
        { key: 'scopeType', title: 'SCOPE TYPES', subtitle: 'How the job fits into an existing or new install.' },
        { key: 'projectScope', title: 'PROJECT SCOPE', subtitle: 'Commercial packaging modes for the project effort.' },
        { key: 'projectStatus', title: 'PROJECT STATUS', subtitle: 'Lifecycle stage options for Firewire projects.' },
        { key: 'difficulty', title: 'DIFFICULTY', subtitle: 'Estimating difficulty bands and their guidance text.' }
    ]

    constructor(private http: HttpClient) {}

    ngOnInit(): void {
        this.loadCatalog()
    }

    getItems(listKey: ProjectSettingsListKey): ProjectSettingItemSchema[] {
        return this.catalog[listKey] || []
    }

    get activeList(): ListMeta {
        return this.lists.find((list) => list.key === this.activeListKey) || this.lists[0]
    }

    setActiveList(listKey: ProjectSettingsListKey) {
        this.activeListKey = listKey
    }

    createItem(listKey: ProjectSettingsListKey) {
        const model = this.createModels[listKey]
        if (!model.label.trim()) {
            this.statusText = 'Label is required.'
            return
        }

        this.saveBusy[`create-${listKey}`] = true
        this.statusText = `Saving ${this.getListTitle(listKey)} item...`

        this.http.post('/api/firewire/project-settings/items', model).subscribe({
            next: () => {
                this.saveBusy[`create-${listKey}`] = false
                this.createModels[listKey] = this.createEmptyModel(listKey)
                this.statusText = `${this.getListTitle(listKey)} item saved.`
                this.loadCatalog()
            },
            error: (err: any) => {
                this.saveBusy[`create-${listKey}`] = false
                this.statusText = err?.error?.message || err?.message || 'Unable to save item.'
            }
        })
    }

    saveItem(item: ProjectSettingItemSchema) {
        this.saveBusy[item.uuid] = true
        this.statusText = `Updating ${item.label}...`

        this.http.patch(`/api/firewire/project-settings/items/${item.uuid}`, {
            listKey: item.listKey,
            label: item.label,
            description: item.description,
            sortOrder: item.sortOrder,
            isActive: item.isActive
        }).subscribe({
            next: () => {
                this.saveBusy[item.uuid] = false
                this.statusText = `${item.label} updated.`
                this.loadCatalog()
            },
            error: (err: any) => {
                this.saveBusy[item.uuid] = false
                this.statusText = err?.error?.message || err?.message || 'Unable to update item.'
            }
        })
    }

    deleteItem(item: ProjectSettingItemSchema) {
        this.saveBusy[`delete-${item.uuid}`] = true
        this.statusText = `Deleting ${item.label}...`

        this.http.delete(`/api/firewire/project-settings/items/${item.uuid}`).subscribe({
            next: () => {
                this.saveBusy[`delete-${item.uuid}`] = false
                this.statusText = `${item.label} deleted.`
                this.loadCatalog()
            },
            error: (err: any) => {
                this.saveBusy[`delete-${item.uuid}`] = false
                this.statusText = err?.error?.message || err?.message || 'Unable to delete item.'
            }
        })
    }

    trackByUuid(index: number, item: ProjectSettingItemSchema) {
        return item.uuid
    }

    private loadCatalog() {
        this.pageWorking = true
        this.http.get<{ data?: ProjectSettingsCatalogSchema }>('/api/firewire/project-settings').subscribe({
            next: (response) => {
                this.catalog = response?.data || {
                    jobType: [],
                    scopeType: [],
                    projectScope: [],
                    difficulty: [],
                    projectStatus: []
                }
                this.createModels = {
                    jobType: this.createEmptyModel('jobType'),
                    scopeType: this.createEmptyModel('scopeType'),
                    projectScope: this.createEmptyModel('projectScope'),
                    difficulty: this.createEmptyModel('difficulty'),
                    projectStatus: this.createEmptyModel('projectStatus')
                }
                this.pageWorking = false
            },
            error: (err: any) => {
                this.statusText = err?.error?.message || err?.message || 'Unable to load project settings.'
                this.pageWorking = false
            }
        })
    }

    private createEmptyModel(listKey: ProjectSettingsListKey): ProjectSettingUpsert {
        return {
            listKey,
            label: '',
            description: '',
            sortOrder: this.getItems(listKey).length * 10 + 10,
            isActive: true
        }
    }

    private getListTitle(listKey: ProjectSettingsListKey): string {
        return this.lists.find((list) => list.key === listKey)?.title || listKey
    }
}
