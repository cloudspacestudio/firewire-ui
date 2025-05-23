import { Component, OnChanges, Input } from "@angular/core"
import { NgIf, NgFor } from '@angular/common'
import { RouterLink } from "@angular/router"

import { HttpClient } from "@angular/common/http"
import { CommonModule } from "@angular/common"

import { MatButtonModule } from "@angular/material/button"
import { MatButtonToggleModule } from "@angular/material/button-toggle"
import { MatSelectModule } from "@angular/material/select"
import { MatFormFieldModule } from "@angular/material/form-field"
import { MatChipsModule } from "@angular/material/chips"
import { MatIconModule } from "@angular/material/icon"

import { Utils } from "../../common/utils"
import { AccountProjectSchema, AccountProjectAttributes } from "../../schemas/account.project.schema"
import { AccountProjectStatSchema } from "../../schemas/account.projectstat.schema"
import { PageToolbar } from '../../common/components/page-toolbar';
import { ProjectFolder } from "../../schemas/project.folder.schema"

import { TabularComponent } from "../../common/components/tabular.component"
import { ReducedResponse, Reducer } from "../../common/reducer"

@Component({
    standalone: true,
    selector: 'project-page',
    imports: [NgFor, CommonModule, 
        RouterLink, PageToolbar, 
        MatButtonModule, MatFormFieldModule, 
        MatSelectModule, MatButtonToggleModule,
        TabularComponent, MatChipsModule, MatIconModule],
    providers: [HttpClient],
    templateUrl: './project.page.html'
})
export class ProjectPage implements OnChanges {
    @Input() projectId?: string

    pageWorking = true
    project?: AccountProjectSchema

    stats?: ReducedResponse
    folders?: ReducedResponse
    floorplans?: ReducedResponse
    sheets?: ReducedResponse
    statuses?: ReducedResponse
    locations?: ReducedResponse
    teams?: ReducedResponse
    tasks?: ReducedResponse
    attachments?: ReducedResponse
    taskAttributes?: ReducedResponse
    taskCheckItems?: ReducedResponse
    taskTypeAttributes?: ReducedResponse
    
    reducer: Reducer = new Reducer()

    tab: string = 'STATS'
    tabs = [
        'OVERVIEW', 'STATS', 'FOLDERS', 'FLOORPLANS', 'SHEETS', 
        'STATUSES', 'LOCATIONS', 'TEAMS', 'TASKS', 'ATTACHMENTS',
        'TASK TYPE ATTRIBUTES',
        'TASK ATTRIBUTES', 'TASK CHECK ITEMS'
    ]
    layout: string = 'Tabular'
    layouts = ['Tabular', 'Raw']
    selectedFloorplanId: string = ''
    selectedTeamId: string = ''
    selectedTemplate = 'Default'

    constructor(private http: HttpClient) {}

    ngOnChanges(): void {
        this.pageWorking = true
        this.project = undefined

        if (!this.projectId) {
            console.error(`Invalid Project Id`)
            return
        }

        this.http.get(`/api/fieldwire/projects/${this.projectId}`).subscribe({
            next: async(s: any) => {
                if (s && s.data) {
                    this.project = Object.assign({}, s.data)
                    await this._loadStats()
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
            case 'TASK TYPE ATTRIBUTES':
                return this._loadTaskTypeAttributes()
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

    // importTasks() {
    //     if(!this.project) {
    //         return
    //     }
    //     // ssederburg@firetrol.net 1684559
    //     // lritchie@firetrol.net 1689801
    //     // sritchie@firetrol.net 1368168

    //     // Block Setup Not Started Status: d2a28d08-27b4-45e0-943d-f007075df4f1
    //     // Block Setup Team Speaker/Strobe Wall Mount 9219b7f1-85a3-42be-8df0-f460334c04e1

    //     this.actionsLoaded = false
    //     this.http.post(`/api/fieldwire/projects/${this.project.id}/tasks/import`, {
    //         project_id: this.project.id,
    //         owner_user_id: 1684559,
    //         floorplan_id: this.selectedFloorplanId,
    //         is_local: true,
    //         pos_x: 0,
    //         pos_y: 0,
    //         priority: 2,
    //         status_id: 'd2a28d08-27b4-45e0-943d-f007075df4f1'
    //     }).subscribe({
    //         next: (s) => {
    //             console.log(`Save Complete`)
    //             this.actionsLoaded = true
    //         },
    //         error: (err) => {
    //             console.error(err)
    //             this.actionsLoaded = true
    //         }
    //     })
    // }

    // createSingleTask() {
    //     if(!this.project) {
    //         return
    //     }
    //     // ssederburg@firetrol.net 1684559
    //     // lritchie@firetrol.net 1689801
    //     // sritchie@firetrol.net 1368168

    //     // Block Setup Not Started Status: d2a28d08-27b4-45e0-943d-f007075df4f1
    //     // Block Setup Team Speaker/Strobe Wall Mount 9219b7f1-85a3-42be-8df0-f460334c04e1

    //     this.actionsLoaded = false
    //     const currentTeam = this.teams?.full.find(s => s.id===this.selectedTeamId)
    //     if (!currentTeam) {
    //         return
    //     }
    //     this.http.post(`/api/fieldwire/projects/${this.project.id}/tasks`, {
    //         project_id: this.project.id,
    //         owner_user_id: 1684559,
    //         floorplan_id: this.selectedFloorplanId,
    //         team_id: this.selectedTeamId,
    //         is_local: true,
    //         name: `Install: ${currentTeam.name}`,
    //         pos_x: 0,
    //         pos_y: 0,
    //         priority: 2,
    //         status_id: 'd2a28d08-27b4-45e0-943d-f007075df4f1' 
    //     }).subscribe({
    //         next: (s) => {
    //             console.log(`Save Complete`)
    //             this.actionsLoaded = true
    //         },
    //         error: (err) => {
    //             console.error(err)
    //             this.actionsLoaded = true
    //         }
    //     })
    // }

    jsonify(input: any) {
        return JSON.stringify(input, null, 1)
    }

    private _loadStats() {
        this.http.get('/api/fieldwire/account/projectstats').subscribe({
            next: (s: any) => {
                if (s && s.rows) {
                    this.stats = this.reducer.reduce(this.tab, [s.rows.find((t: AccountProjectStatSchema) => t.project_id===this.projectId)])
                    return
                }
            },
            error: (err: Error) => {
                console.dir(err)
            }
        })
    }

    private _loadFolders() {
        return new Promise((resolve, reject) => {
            try {
                this.http.get(`/api/fieldwire/projects/${this.projectId}/folders`).subscribe({
                    next: (s: any) => {
                        if (s && s.rows) {
                            this.folders = this.reducer.reduce(this.tab, s.rows)
                            return resolve(this.folders)
                        }
                    },
                    error: (err: Error) => {
                        console.dir(err)
                        throw(err)
                    }
                })        
            } catch (err) {
                return reject(err)
            }
        })
    }

    private _loadFloorplans() {
        return new Promise((resolve, reject) => {
            try {
                this.http.get(`/api/fieldwire/projects/${this.projectId}/floorplans`).subscribe({
                    next: (s: any) => {
                        if (s && s.rows) {
                            this.floorplans = this.reducer.reduce(this.tab, s.rows)
                            return resolve(this.floorplans)
                        }
                    },
                    error: (err: Error) => {
                        console.dir(err)
                        throw err
                    }
                })
            } catch (err) {
                return reject(err)
            }
        })
    }

    private _loadSheets() {
        this.http.get(`/api/fieldwire/projects/${this.projectId}/sheets`).subscribe({
            next: (s: any) => {
                if (s && s.rows) {
                    this.sheets = this.reducer.reduce(this.tab, s.rows)
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
                    this.statuses = this.reducer.reduce(this.tab, s.rows)
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
                    this.locations = this.reducer.reduce(this.tab, s.rows)
                    return
                }
            },
            error: (err: Error) => {
                console.dir(err)
            }
        })
    }

    private _loadTeams() {
        return new Promise(async(resolve, reject) => {
            try {
                this.http.get(`/api/fieldwire/projects/${this.projectId}/teams`).subscribe({
                    next: (s: any) => {
                        if (s && s.rows) {
                            this.teams = this.reducer.reduce(this.tab, s.rows)
                            return resolve(this.teams)
                        }
                    },
                    error: (err: Error) => {
                        throw err
                    }
                })
            } catch (err) {
                console.dir(err)
                return reject(err)
            }
        })
    }

    private _loadTasks() {
        this.http.get(`/api/fieldwire/projects/${this.projectId}/tasks`).subscribe({
            next: (s: any) => {
                if (s && s.rows) {
                    this.tasks = this.reducer.reduce(this.tab, s.rows)
                    return
                }
            },
            error: (err: Error) => {
                console.dir(err)
            }
        })
    }

    private _loadTaskTypeAttributes() {
        this.http.get(`/api/fieldwire/projects/${this.projectId}/tasktypeattributes`).subscribe({
            next: (s: any) => {
                if (s && s.rows) {
                    this.taskTypeAttributes = this.reducer.reduce(this.tab, s.rows)
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
                    this.taskAttributes = this.reducer.reduce(this.tab, s.rows)
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
                    this.taskCheckItems = this.reducer.reduce(this.tab, s.rows)
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
                    this.attachments = this.reducer.reduce(this.tab, s.rows)
                    return
                }
            },
            error: (err: Error) => {
                console.dir(err)
            }
        })
    }

}