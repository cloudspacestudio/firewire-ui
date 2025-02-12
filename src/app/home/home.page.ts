import { Component, OnInit } from "@angular/core"

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
    imports: [CommonModule, PageToolbar, RouterLink],
    providers: [HttpClient],
    templateUrl: './home.page.html'
})
export class HomePage implements OnInit {

    pageWorking = true
    projects: AccountProjectSchema[] = []
    stats: AccountProjectStatSchema[] = []

    constructor(private http: HttpClient) {}

    ngOnInit(): void {
        this.pageWorking = true
        this.projects = []

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