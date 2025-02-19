import { Component, OnInit } from "@angular/core"
import { NgIf, NgFor } from "@angular/common"

import { HttpClient } from "@angular/common/http"
import { CommonModule } from "@angular/common"
import { RouterLink } from "@angular/router"

import { Utils } from "../common/utils"
import { AccountProjectSchema, AccountProjectAttributes } from "../schemas/account.project.schema"
import { AccountProjectStatSchema } from "../schemas/account.projectstat.schema"
import { PageToolbar } from '../common/components/page-toolbar';

@Component({
    standalone: true,
    selector: 'home-page',
    imports: [NgIf, NgFor, CommonModule, PageToolbar, RouterLink],
    providers: [HttpClient],
    templateUrl: './home.page.html'
})
export class HomePage implements OnInit {

    pageWorking = true
    projects: AccountProjectSchema[] = []
    stats: AccountProjectStatSchema[] = []
    devices: any[] = []
    deviceKeys: string[] = []

    constructor(private http: HttpClient) {}

    ngOnInit(): void {
        this.pageWorking = true
        this.projects = []
        this.devices = []
        this.deviceKeys = []

        this.http.get('/api/fieldwire/account/projects').subscribe({
            next: (s: any) => {
                if (s && s.rows) {
                    this.projects = [...s.rows]
                    this.pageWorking = false
                    this._loadStats()
                    return
                }
                this.pageWorking = false
            },
            error: (err: Error) => {
                console.dir(err)
                this.pageWorking = false
            }
        })
        this.http.get('/api/fieldwire/devices').subscribe({
            next: (s: any) => {
                if (s && s.rows) {
                    this.devices = [...s.rows]
                    if (this.devices.length > 0) {
                        this.deviceKeys = Object.keys(this.devices[0])
                    }
                    return
                }
            },
            error: (err: Error) => {
                console.dir(err)
            }
        })
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
        if (!input) {
            return ``
        }
        return JSON.stringify(input, null, 1)
    }

    private _loadStats() {
        this.http.get('/api/fieldwire/account/projectstats').subscribe({
            next: (s: any) => {
                if (s && s.rows) {
                    this.stats = [...s.rows]
                    return
                }
            },
            error: (err: Error) => {
                console.dir(err)
            }
        })
    }

}