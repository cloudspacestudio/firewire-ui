import { Component, OnChanges, Input } from "@angular/core"
import { NgIf, NgFor } from '@angular/common'

import { HttpClient } from "@angular/common/http"
import { CommonModule } from "@angular/common"

import { MatButtonModule } from "@angular/material/button"
import { MatButtonToggleModule } from "@angular/material/button-toggle"
import { MatSelectModule } from "@angular/material/select"
import { MatFormFieldModule } from "@angular/material/form-field"

import { Utils } from "../common/utils"
import { AccountProjectSchema, AccountProjectAttributes } from "../schemas/account.project.schema"
import { AccountProjectStatSchema } from "../schemas/account.projectstat.schema"
import { PageToolbar } from '../common/components/page-toolbar';
import { ProjectFolder } from "../schemas/project.folder.schema"

import { TabularComponent } from "../common/components/tabular.component"

@Component({
    standalone: true,
    selector: 'project-page',
    imports: [NgFor, CommonModule, PageToolbar, 
        MatButtonModule, MatFormFieldModule, 
        MatSelectModule, MatButtonToggleModule,
        TabularComponent],
    providers: [HttpClient],
    templateUrl: './project.page.html'
})
export class ProjectPage implements OnChanges {
    @Input() projectId?: string

    pageWorking = true
    project?: AccountProjectSchema
    stats?: AccountProjectStatSchema
    folders?: ProjectFolder[] = []
    floorplans?: any[] = []
    sheets?: any[] = []
    statuses?: any[] = []
    locations?: any[] = []
    teams?: any[] = []
    tasks?: any[] = []
    attachments?: any[] = []
    taskAttributes?: any[] = []
    taskCheckItems?: any[] = []

    tab: string = 'OVERVIEW'
    tabs = [
        'OVERVIEW', 'STATS', 'FOLDERS', 'FLOORPLANS', 'SHEETS', 
        'STATUSES', 'LOCATIONS', 'TEAMS', 'TASKS', 'ATTACHMENTS',
        'TASK ATTRIBUTES', 'TASK CHECK ITEMS'
    ]
    layout: string = 'Tabular'
    layouts = ['Tabular', 'Raw']

    constructor(private http: HttpClient) {}

    ngOnChanges(): void {
        this.pageWorking = true
        this.project = undefined

        if (!this.projectId) {
            console.error(`Invalid Project Id`)
            return
        }

        this.http.get(`/api/fieldwire/projects/${this.projectId}`).subscribe({
            next: (s: any) => {
                if (s && s.data) {
                    this.project = Object.assign({}, s.data)
                    this.pageWorking = false
                    return
                }
                this.pageWorking = false
            },
            error: (err: Error) => {
                console.dir(err)
                this.pageWorking = false
            }
        })
    }

    setTab(event:any) {
        //console.dir(event)
        // if (tab === this.tab) {
        //    return
        //}
        //this.tab = tab
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

    toLocalDateTimeString(input: Date|string) {
        return Utils.toLocalString(input)
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

    private _loadStats() {
        this.http.get('/api/fieldwire/account/projectstats').subscribe({
            next: (s: any) => {
                if (s && s.rows) {
                    this.stats = s.rows.find((t: AccountProjectStatSchema) => t.project_id===this.projectId)
                    return
                }
            },
            error: (err: Error) => {
                console.dir(err)
            }
        })
    }

    private _loadFolders() {
        this.http.get(`/api/fieldwire/projects/${this.projectId}/folders`).subscribe({
            next: (s: any) => {
                if (s && s.rows) {
                    this.folders = [...s.rows]
                    return
                }
            },
            error: (err: Error) => {
                console.dir(err)
            }
        })
    }

    private _loadFloorplans() {
        this.http.get(`/api/fieldwire/projects/${this.projectId}/floorplans`).subscribe({
            next: (s: any) => {
                if (s && s.rows) {
                    this.floorplans = [...s.rows]
                    return
                }
            },
            error: (err: Error) => {
                console.dir(err)
            }
        })
    }

    private _loadSheets() {
        this.http.get(`/api/fieldwire/projects/${this.projectId}/sheets`).subscribe({
            next: (s: any) => {
                if (s && s.rows) {
                    this.sheets = [...s.rows]
                    return
                }
            },
            error: (err: Error) => {
                console.dir(err)
            }
        })
    }

    private _loadStatuses() {
        this.http.get(`/api/fieldwire/projects/${this.projectId}/statuses`).subscribe({
            next: (s: any) => {
                if (s && s.rows) {
                    this.statuses = [...s.rows]
                    return
                }
            },
            error: (err: Error) => {
                console.dir(err)
            }
        })
    }

    private _loadLocations() {
        this.http.get(`/api/fieldwire/projects/${this.projectId}/locations`).subscribe({
            next: (s: any) => {
                if (s && s.rows) {
                    this.locations = [...s.rows]
                    return
                }
            },
            error: (err: Error) => {
                console.dir(err)
            }
        })
    }

    private _loadTeams() {
        this.http.get(`/api/fieldwire/projects/${this.projectId}/teams`).subscribe({
            next: (s: any) => {
                if (s && s.rows) {
                    this.teams = [...s.rows]
                    return
                }
            },
            error: (err: Error) => {
                console.dir(err)
            }
        })
    }

    private _loadTasks() {
        this.http.get(`/api/fieldwire/projects/${this.projectId}/tasks`).subscribe({
            next: (s: any) => {
                if (s && s.rows) {
                    this.tasks = [...s.rows]
                    return
                }
            },
            error: (err: Error) => {
                console.dir(err)
            }
        })
    }

    private _loadTaskAttributes() {
        this.http.get(`/api/fieldwire/projects/${this.projectId}/taskattributes`).subscribe({
            next: (s: any) => {
                if (s && s.rows) {
                    this.taskAttributes = [...s.rows]
                    return
                }
            },
            error: (err: Error) => {
                console.dir(err)
            }
        })
    }

    private _loadTaskCheckItems() {
        this.http.get(`/api/fieldwire/projects/${this.projectId}/taskcheckitems`).subscribe({
            next: (s: any) => {
                if (s && s.rows) {
                    this.taskCheckItems = [...s.rows]
                    return
                }
            },
            error: (err: Error) => {
                console.dir(err)
            }
        })
    }

    private _loadAttachments() {
        this.http.get(`/api/fieldwire/projects/${this.projectId}/attachments`).subscribe({
            next: (s: any) => {
                if (s && s.rows) {
                    this.attachments = [...s.rows]
                    return
                }
            },
            error: (err: Error) => {
                console.dir(err)
            }
        })
    }

}