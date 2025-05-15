import { Component, OnChanges, Input } from "@angular/core"
import { DomSanitizer, SafeStyle } from '@angular/platform-browser'
import { NgIf, NgFor } from "@angular/common"
import { FormBuilder, FormGroup } from '@angular/forms'
import { FormsModule, ReactiveFormsModule } from '@angular/forms'

import { HttpClient } from "@angular/common/http"
import { CommonModule } from "@angular/common"
import { RouterLink } from "@angular/router"

import { MatButtonModule } from "@angular/material/button"
import { MatIconModule } from "@angular/material/icon"
import { MatInputModule } from "@angular/material/input"
import { MatFormFieldModule } from "@angular/material/form-field"
import { MatSelectModule } from "@angular/material/select"
import {MatCheckboxModule} from '@angular/material/checkbox'

import { Utils } from "../../common/utils"
import { PageToolbar } from '../../common/components/page-toolbar';
import { TabularComponent } from "../../common/components/tabular.component"
import { ReducedResponse, Reducer } from "../../common/reducer"
import { AccountProjectSchema, AccountProjectAttributes } from "../../schemas/account.project.schema"

@Component({
    standalone: true,
    selector: 'devices-page',
    imports: [CommonModule, RouterLink, 
        MatButtonModule, MatIconModule, 
        MatInputModule, MatFormFieldModule,
        MatSelectModule, MatCheckboxModule,
        PageToolbar, FormsModule, 
        ReactiveFormsModule, TabularComponent],
    providers: [HttpClient],
    templateUrl: './imports.page.html'
})
export class ImportsPage implements OnChanges {
    @Input() projectId?: string
    actionsLoaded = false
    floorplanImageLoaded: string | null = null

    form: FormGroup
    pageWorking = true
    project?: AccountProjectSchema
    
    folders?: ReducedResponse
    floorplans?: ReducedResponse
    floorplanTaskCount = 0
    templates?: string[] = ['Default']

    reducer: Reducer = new Reducer()
    preview?: any

    constructor(private fb: FormBuilder, private http: HttpClient, private sanitizer: DomSanitizer) {
        this.form = this.fb.group({
            file: [null],
            templateId: [''],
            floorplanId: [''],
            locationId: [''],
            preview: [true]
        })
    }

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
                    this.pageWorking = false
                    await this._loadActions()
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

    onFileChange(event: any) {
        if (event.target.files.length > 0) {
            this.form.patchValue({
                file: event.target.files[0]
            });
        }
    }

    onSelectChange(event: any) {
        this.floorplanImageLoaded = null
        if (!event) {
            return
        }
        const test = this.floorplans?.full.find(s => s.id===event)
        if (test && test.sheets && test.sheets.length > 0) {
            this.floorplanImageLoaded = test.sheets[0].file_url
            setTimeout(async() => {
                await this.verifyFloorplanTasks(test.id)
            }, 1)
        }
    }

    onSubmit() {
        const formData = new FormData();
        formData.append('file', this.form.get('file')?.value);
        formData.append('templateId', this.form.get('templateId')?.value);
        formData.append('floorplanId', this.form.get('floorplanId')?.value);
        formData.append('locationId', this.form.get('locationId')?.value);
        formData.append('preview', this.form.get('preview')?.value ? 'true' : 'false');

        this.http.post(`/api/fieldwire/projects/${this.project?.id}/tasks/import`, formData).subscribe({
            next: (res) => {
                console.dir(res)
                this.preview = res
            },
            error: (err) => console.error(err)
        })
    }

    getSafeFloorplanImageUrl() {
        return this.sanitizer.bypassSecurityTrustStyle('url(' + this.floorplanImageLoaded + ')')
    }

    verifyFloorplanTasks(floorplanId: string) {
        // '/api/fieldwire/projects/:projectId/floorplans/:floorplanId/tasks'
        this.floorplanTaskCount = 0
        return new Promise((resolve, reject) => {
            try {
                this.http.get(`/api/fieldwire/projects/${this.projectId}/floorplans/${floorplanId}/tasks`).subscribe({
                    next: (s: any) => {
                        if (s && s.rows) {
                            this.floorplanTaskCount = s.rows.length
                            return resolve(this.floorplanTaskCount)
                        }
                    },
                    error: (err: Error) => {
                        this.floorplanTaskCount = 0
                        console.dir(err)
                        throw err
                    }
                })
            } catch (err) {
                return reject(err)
            }
        })

    }

    private _loadActions() {
        return new Promise(async(resolve, reject) => {
            this.actionsLoaded = false
            try {
                const resultFloorplans = await this._loadFloorplans()
                if (resultFloorplans && this.floorplans && this.floorplans.full && this.floorplans.full.length > 0) {
                    //this.selectedFloorplanId = this.floorplans.full[0].id
                    //this.form.setValue({floorplanId: this.floorplans.full[0].id})
                } else {
                    console.log(`No floorplans found`)
                }
                this.actionsLoaded = true
                return resolve(true)
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
                            this.floorplans = this.reducer.reduce('FLOORPLANS', s.rows)
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

}