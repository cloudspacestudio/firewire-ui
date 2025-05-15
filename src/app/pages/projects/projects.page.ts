import { Component, OnInit } from "@angular/core"
import { NgIf, NgFor } from "@angular/common"

import { HttpClient } from "@angular/common/http"
import { CommonModule } from "@angular/common"
import { RouterLink } from "@angular/router"

import { Utils } from "../../common/utils"
import { PageToolbar } from '../../common/components/page-toolbar';
import { AccountProjectSchema, AccountProjectAttributes } from "../../schemas/account.project.schema"

import { MatButtonModule } from "@angular/material/button"
import { MatIconModule } from "@angular/material/icon"

@Component({
    standalone: true,
    selector: 'devices-page',
    imports: [CommonModule, RouterLink, 
        MatButtonModule, MatIconModule, 
        PageToolbar],
    providers: [HttpClient],
    templateUrl: './projects.page.html'
})
export class ProjectsPage implements OnInit {

    pageWorking = true
    projects: AccountProjectSchema[] = []
    editableProjects: string[] = []
    
    constructor(private http: HttpClient) {}

    ngOnInit(): void {
        this.pageWorking = true
        this.projects = []
        this.editableProjects = []
        setTimeout(async() => {
            await Promise.all([
                this.fetchProjects(),
                this.fetchEditableProjectIds()
            ])
            this.pageWorking = false
        }, 1)
    }

    listEditableProjects() {
        if (!this.projects || this.projects.length <=0 || !this.editableProjects || this.editableProjects.length <=0) {
            return []
        }
        const output: AccountProjectSchema[] = []
        this.projects.forEach((project) => {
            if (this.editableProjects.indexOf(project.id)>=0) {
                output.push(project)
            }
        })
        return output
    }

    fetchProjects(): Promise<AccountProjectSchema[]> {
        return new Promise(async(resolve, reject) => {
            try {
                this.http.get('/api/fieldwire/account/projects').subscribe({
                    next: (s: any) => {
                        if (s && s.rows) {
                            this.projects = [...s.rows]
                            return resolve(this.projects)
                        }
                    },
                    error: (err: Error) => {
                        console.dir(err)
                        return reject(err)
                    }
                })
            } catch (err2) {
                return reject(err2)
            }
        })
    }

    fetchEditableProjectIds(): Promise<string[]> {
        return new Promise(async(resolve, reject) => {
            try {
                this.http.get('/api/fieldwire/account/editableprojectids').subscribe({
                    next: (s: any) => {
                        if (s && s.rows) {
                            this.editableProjects = [...s.rows]
                            return resolve(this.editableProjects)
                        }
                    },
                    error: (err: Error) => {
                        console.dir(err)
                        return reject(err)
                    }
                })
            } catch (err2) {
                return reject(err2)
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

}