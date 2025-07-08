import { Component, inject, OnChanges, Input, AfterViewInit } from "@angular/core"
import { DomSanitizer, SafeStyle } from '@angular/platform-browser'
import { NgIf, NgFor } from "@angular/common"
import { FormBuilder, FormGroup } from '@angular/forms'
import { FormsModule, ReactiveFormsModule } from '@angular/forms'

import { HttpClient } from "@angular/common/http"
import { CommonModule } from "@angular/common"
import { RouterLink } from "@angular/router"

import {
  MatDialogModule,
  MatDialog,
  MAT_DIALOG_DATA
} from '@angular/material/dialog';
import { MatButtonModule } from "@angular/material/button"
import { MatIconModule } from "@angular/material/icon"
import { MatInputModule } from "@angular/material/input"
import { MatFormFieldModule } from "@angular/material/form-field"
import { MatSelectModule } from "@angular/material/select"
import {MatCheckboxModule} from '@angular/material/checkbox'
import {MatDatepickerModule} from '@angular/material/datepicker'

import { Utils } from "../../common/utils"
import { PageToolbar } from '../../common/components/page-toolbar';
import { TabularComponent } from "../../common/components/tabular.component"
import { ReducedResponse, Reducer } from "../../common/reducer"
import { AccountProjectSchema, AccountProjectAttributes } from "../../schemas/account.project.schema"

@Component({
    standalone: true,
    selector: 'dailyreport-page',
    imports: [CommonModule, RouterLink, 
        MatButtonModule, MatIconModule, 
        MatInputModule, MatFormFieldModule,
        MatSelectModule, MatCheckboxModule,
        MatDialogModule,MatDatepickerModule,
        PageToolbar, FormsModule, 
        ReactiveFormsModule],
    providers: [HttpClient],
    templateUrl: './dailyreport.page.html'
})
export class DailyReportPage implements OnChanges, AfterViewInit {
    @Input() projectId?: string
    dialog = inject(MatDialog)

    form: FormGroup
    pageWorking = true
    project?: AccountProjectSchema
    templates: any[] = [
        {id: '1', name: 'Daily Report'}
    ]
    forms: any[] = []

    statuses: any[] = []
    taskIds: any[] = []
    tasks: any[] = []
    records: StatusRecord[] = []


    reducer: Reducer = new Reducer()
    //data?: any

    constructor(private fb: FormBuilder, private http: HttpClient, private sanitizer: DomSanitizer) {
        this.form = this.fb.group({
            picker: [''],
            templateId: ['']
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

    ngAfterViewInit(): void {
        this.form.setValue({
            'picker': new Date(),
            'templateId': '1'
        })
    }

    getStatuses(): Promise<any> {
        return new Promise(async(resolve, reject) => {
            try {
                this.http.get(`/api/fieldwire/projects/${this.projectId}/statuses`).subscribe({
                    next: async(s: any) => {
                        console.dir(s)
                        return resolve(s)
                    },
                    error: (err: Error) => {
                        console.dir(err)
                        return reject(err)
                    }
                })
            } catch (err) {
                console.dir(err)
                return reject(err)
            }
        })
    }

    getTaskListForStatus (statusId: string): Promise<string[]> {
        return new Promise(async(resolve, reject) => {
            try {
                
                const startDate = this.form.get('picker')?.value
                if (!startDate) {
                    return
                }
                const range = Utils.getDateDayTimeRange(startDate)
                console.dir(range)

                this.tasks = []
                this.http.post(`/api/fieldwire/projects/${this.projectId}/taskfilterbystatus`, {
                    statusId,
                    startDate: range.start,
                    endDate: range.end
                }).subscribe({
                    next: async(s: any) => {
                        console.dir(s)
                        if (s && Array.isArray(s)) {
                            this.taskIds = [...s]
                            return resolve(this.taskIds)
                        }
                        return resolve([])
                    },
                    error: (err: Error) => {
                        console.dir(err)
                        return reject(err)
                    }
                })
            } catch (err1) {
                console.error(err1)
                return reject(err1)
            }
        })
    }

    getTaskDetail(taskId: string): Promise<any> {
        return new Promise(async(resolve, reject) => {
            try {
                this.http.get(`/api/fieldwire/projects/${this.projectId}/tasks/${taskId}`).subscribe({
                    next: async(s: any) => {
                        console.dir(s)
                        return resolve(s)
                    },
                    error: (err: Error) => {
                        console.dir(err)
                        return reject(err)
                    }
                })
            } catch (err1) {
                return reject(err1)
            }
        })
    }

    async onSubmit() {
        this.tasks = []
        this.records = []

        const statuses = await this.getStatuses()
        console.dir(statuses)
        for(let x = 0; x < statuses.rows.length; x++) {
            const statusRecord = statuses.rows[x]

            console.log(`Here`)
            console.log(`Getting list of task ids for status ${statusRecord.name}`)
            const statusId = statusRecord.id // 'a22a3579-0928-4bde-81db-12659351bc72' // Completed
            const ids = await this.getTaskListForStatus(statusId)
            for(let i = 0; i < ids.length; i++) {
                const id = ids[i]
                const taskDetail = await this.getTaskDetail(id)
                this.tasks.push(taskDetail)
                this.records.push({
                    statusId: statusRecord.id,
                    statusName: statusRecord.name,
                    taskId: taskDetail.id,
                    taskName: taskDetail.name
                })
            }
        }
    }

    onFileChange(event: any) {
    }

    onSelectChange(event: any) {
    }

    getSafeFloorplanImageUrl() {
        return this.sanitizer.bypassSecurityTrustStyle('url(' + 'abc' + ')')
    }

    jsonify(input: any) {
        return JSON.stringify(input, null, 2)
    }

}

export interface StatusRecord {
    statusId: string
    statusName: string
    taskId: string
    taskName: string
}