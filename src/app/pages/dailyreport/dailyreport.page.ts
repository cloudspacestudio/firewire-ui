import { Component, inject, OnChanges, Input, AfterViewInit } from "@angular/core"
import { DomSanitizer, SafeStyle, SafeHtml } from '@angular/platform-browser'
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
import { MatListModule } from "@angular/material/list"
import {MatCheckboxModule} from '@angular/material/checkbox'
import {MatDatepickerModule} from '@angular/material/datepicker'

import { Utils } from "../../common/utils"
import { PageToolbar } from '../../common/components/page-toolbar';
import { AccountProjectSchema } from "../../schemas/account.project.schema"
import { FormTemplate } from "../../schemas/form.template"
import { FormTemplateStatus } from "../../schemas/form.templatestatus"
import { FieldwireForm } from "../../schemas/fieldwire.form"
import { CreateFormSchema } from "../../schemas/createform.schema"
import { DailyReportSchema } from "../../schemas/dailyreport.schema"
import { TaskRelationSchema } from "../../schemas/taskrelation.schema"
import { TaskRelatedSchema } from "../../schemas/taskrelated.schema"
import { TaskDetailSchema } from "../../schemas/taskdetail.schema"
import { ProjectFloorplanSchema } from "../../schemas/projectfloorplan.schema"
import { AccountProjectUserSchema } from "../../schemas/accountproject.user.schema"

@Component({
    standalone: true,
    selector: 'dailyreport-page',
    imports: [CommonModule, RouterLink, 
        MatButtonModule, MatIconModule, 
        MatInputModule, MatFormFieldModule,
        MatSelectModule, MatCheckboxModule,
        MatDialogModule,MatDatepickerModule,
        MatListModule,
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
    templates: FormTemplate[] = []
    templateStatuses: FormTemplateStatus[] = []
    forms: any[] = []
    floorplans: ProjectFloorplanSchema[] = []
    users: AccountProjectUserSchema[] = []

    didLoad: boolean = false

    statuses: any[] = []
    taskIds: any[] = []
    tasks: any[] = []
    generatedFormId: string|null = null


    records: StatusRecord[] = []
    groupedRecords: GroupedRecord[] = []

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
                    this.generatedFormId = null
                    await Promise.all([
                        this.getProjectFormTemplates(),
                        this.getProjectFormTemplateStatuses(),
                        this.getProjectForms(),
                        this.getProjectFloorplans(),
                        this.getProjectUsers()
                    ])
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

    changeDate(e: any) {
        this.tasks = []
        this.records = []
        this.groupedRecords = []
        this.generatedFormId = null
        this.didLoad = false
    }

    getFormName() {
        const pickDateString = this.form.get('picker')?.value
        const pickDate = new Date(pickDateString)
        const pickDateISO = pickDate.toJSON()
        const datePart = pickDateISO.substring(0, pickDateISO.indexOf('T'))
        return `Daily Report: ${datePart}`
    }

    getProjectFormTemplates(): Promise<FormTemplate> {
        return new Promise(async(resolve, reject) => {
            try {
                this.http.get(`/api/fieldwire/projects/${this.projectId}/formtemplates`).subscribe({
                    next: async(s: any) => {
                        this.templates = s.rows
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
    getProjectFormTemplateStatuses(): Promise<FormTemplateStatus> {
        return new Promise(async(resolve, reject) => {
            try {
                this.http.get(`/api/fieldwire/projects/${this.projectId}/formtemplatestatuses`).subscribe({
                    next: async(s: any) => {
                        this.templateStatuses = s.rows
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
    getProjectForms(): Promise<FieldwireForm> {
        return new Promise(async(resolve, reject) => {
            try {
                this.http.get(`/api/fieldwire/projects/${this.projectId}/forms`).subscribe({
                    next: async(s: any) => {
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
    getProjectFloorplans(): Promise<ProjectFloorplanSchema[]> {
        return new Promise(async(resolve, reject) => {
            try {
                this.http.get(`/api/fieldwire/projects/${this.projectId}/floorplans`).subscribe({
                    next: async(s: any) => {
                        this.floorplans = [...s.rows]
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
    getProjectUsers(): Promise<AccountProjectUserSchema[]> {
        return new Promise(async(resolve, reject) => {
            try {
                this.http.get(`/api/fieldwire/account/projects/${this.projectId}/users`).subscribe({
                    next: async(s: any) => {
                        this.users = [...s.rows]
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
    getStatuses(): Promise<any> {
        return new Promise(async(resolve, reject) => {
            try {
                this.http.get(`/api/fieldwire/projects/${this.projectId}/statuses`).subscribe({
                    next: async(s: any) => {
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
                
                const startDateValue = this.form.get('picker')?.value
                
                if (!startDateValue) {
                    return
                }
                const startDate = new Date(startDateValue)
                const range = Utils.getDateDayTimeRange(startDate)
                
                this.tasks = []
                this.http.post(`/api/fieldwire/projects/${this.projectId}/taskfilterbystatus`, {
                    statusId,
                    startDate: range.start,
                    endDate: range.end
                }).subscribe({
                    next: async(s: any) => {
                        if (s && Array.isArray(s)) {
                            this.taskIds = [...s]
                            return resolve(this.taskIds)
                        }
                        return resolve([])
                    },
                    error: (err: Error) => {
                        console.error(err)
                        return reject(err)
                    }
                })
            } catch (err1) {
                console.error(err1)
                return reject(err1)
            }
        })
    }
    getTaskDetail(taskId: string): Promise<TaskDetailSchema> {
        return new Promise(async(resolve, reject) => {
            try {
                this.http.get(`/api/fieldwire/projects/${this.projectId}/tasks/${taskId}`).subscribe({
                    next: async(s: any) => {
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
    getTaskRelations(taskId: string): Promise<TaskRelatedSchema[]> {
        return new Promise(async(resolve, reject) => {
            try {
                this.http.get(`/api/fieldwire/projects/${this.projectId}/tasks/${taskId}/related`).subscribe({
                    next: async(s: any) => {
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
    getProjectTaskRelations(): Promise<TaskRelationSchema[]> {
        return new Promise(async(resolve, reject) => {
            try {
                this.http.get(`/api/fieldwire/projects/${this.projectId}/task_relations`).subscribe({
                    next: async(s: any) => {
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
    getProjectFormFull(): Promise<TaskRelationSchema[]> {
        return new Promise(async(resolve, reject) => {
            try {
                if (!this.generatedFormId) {
                    return
                }
                this.http.get(`/api/fieldwire/projects/${this.projectId}/forms/${this.generatedFormId}/full`).subscribe({
                    next: async(s: any) => {
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
    createFormPost(input: CreateFormSchema): Promise<FieldwireForm> {
        return new Promise(async(resolve, reject) => {
            try {
                this.http.post(`/api/fieldwire/projects/${this.projectId}/forms`, input).subscribe({
                    next: async(s: any) => {
                        return resolve(s)
                    },
                    error: (err2: Error) => {
                        console.error(err2)
                        return reject(err2)
                    }
                })
            } catch (err) {
                console.error(err)
                return reject(err)
            }
        })
    }
    loadDailyReport(): Promise<any> {
        return new Promise(async(resolve, reject) => {
            try {
                const formId = this.generatedFormId
                if (!formId) {
                    return
                }
                const input: DailyReportSchema = {
                    form_id: formId,
                    worklog: []
                }
                this.groupedRecords.forEach((record: GroupedRecord) => {
                    input.worklog.push({
                        Trade: record.statusName,
                        Quantity: record.count,
                        Hours: record.labor
                    })
                })
                this.http.post(`/api/fieldwire/projects/${this.projectId}/forms/loaddailyreport`, input).subscribe({
                    next: async(s: any) => {
                        return resolve(s)
                    },
                    error: (err2: Error) => {
                        console.error(err2)
                        return reject(err2)
                    }
                })
            } catch (err) {
                console.error(err)
                return reject(err)
            }
        })
    }
    renderLink(url: string, text: string) {
        const output = `<a href="${url}" target="_blank">${text}</a>`
        const response: SafeHtml = this.sanitizer.bypassSecurityTrustHtml(output)
        return response
    }
    getFwLinkForTask(task: TaskDetailSchema|null): SafeHtml {
        if (!task) {
            return ``
        }
        const url = `https://app.fieldwire.com/projects/${this.projectId}/tasks/${task.id}`
        return this.renderLink(url, task.name)
    }
    getFwLinkForFormById() {
        if (!this.generatedFormId) {
            return ''
        }
        return this.renderLink(`https://app.fieldwire.com/projects/${this.projectId}/forms/${this.generatedFormId}`, 'Fieldwire Form')
    }

    async createForm() {
        const template = this.templates.find(s => s.name==='Daily Report')
        const defaultStatus = this.templateStatuses.find(s => s.ordinal===1)
        const pickDateString = this.form.get('picker')?.value
        if (!template) {
            console.log(`Unable to determine default daily report template`)
            return
        }
        if (!defaultStatus) {
            console.log(`Unable to determine default template status`)
            return
        }
        if (!pickDateString) {
            console.log(`Unable to determine report date`)
            return
        }
        const pickDate = new Date(pickDateString)
        const test: CreateFormSchema = {
            name: this.getFormName(),
            checksum: template.checksum,
            form_template_id: template.id,
            form_template_form_status_id: defaultStatus.id,
            start_at: pickDate.toJSON(),
            end_at: pickDate.toJSON()
        }
        try {
            this.generatedFormId = null
            const formResponse = await this.createFormPost(test)
            // We have the form along with the id 
            // wait for form generation to complete
            this.generatedFormId = formResponse.id
            // setTimeout(async() => {
            //     const loadResponse = await this.loadDailyReport(formResponse.id)
            // }, 10000)
        } catch (err) {
            console.error(err)
        }
    }

    async load() {
        this.didLoad = false
        this.tasks = []
        this.records = []
        this.groupedRecords = []
        this.generatedFormId = null

        const statuses = await this.getStatuses()
        for(let x = 0; x < statuses.rows.length; x++) {
            const statusRecord = statuses.rows[x]
            const statusId = statusRecord.id // 'a22a3579-0928-4bde-81db-12659351bc72' // Completed
            const ids = await this.getTaskListForStatus(statusId)
            for(let i = 0; i < ids.length; i++) {
                const taskId = ids[i]
                const taskDetail = await this.getTaskDetail(taskId)
                const testTaskDetail = this.tasks.find(s => s.id===taskId)
                if (!testTaskDetail) {
                    this.tasks.push(taskDetail)
                }
                let deviceRootTask: TaskDetailSchema|null = null
                if (!taskDetail.is_local) {
                    // There are the sub task records
                    // Get Parent Record (Device Task)
                    const relatedTasks = await this.getTaskRelations(taskId)
                    deviceRootTask = await this._getRootTaskFromRelatedIds(relatedTasks)
                } else {
                    deviceRootTask = taskDetail
                }

                const userRecord = this.users.find(s => s.id===taskDetail.last_editor_user_id)
                this.records.push({
                    statusId: statusRecord.id,
                    statusName: statusRecord.name,
                    taskId: taskDetail.id,
                    taskName: taskDetail.name,
                    rootTask: deviceRootTask,
                    detailTask: taskDetail,
                    userId: taskDetail.last_editor_user_id,
                    userName: userRecord && userRecord.email ? `${userRecord.first_name} ${userRecord.last_name}`:`Unknown User`
                })
                // Task Custom Attributes

            }
        }
        // Have records loaded and tasks loaded
        for (let i = 0; i < this.records.length; i++) {
            const record = this.records[i]
            const test = this.groupedRecords.find(s => s.statusId===record.statusId)
            if (!test) {
                // Status not loaded into array yet
                this.groupedRecords.push({
                    statusId: record.statusId,
                    statusName: record.statusName,
                    count: 1,
                    labor: record.detailTask.man_power_value
                })
            } else {
                test.count = test.count + 1
                test.labor = test.labor + record.detailTask.man_power_value
            }
        }
        this.didLoad = true
    }

    onSelectChange(event: any) {}

    jsonify(input: any) {
        return JSON.stringify(input, null, 2)
    }

    getFloorplanName(record: StatusRecord): string {
        if (!record || !record.rootTask || !record.rootTask.is_local || !record.rootTask.floorplan_id) {
            return `Unknown`
        }
        const test = this.floorplans.find(s => s.id===record.rootTask?.floorplan_id)
        if (!test) {
            return `Unknown`
        }
        return test.name
    }

    private _getRootTaskFromRelatedIds(ids: TaskRelatedSchema[]): Promise<TaskDetailSchema|null> {
        return new Promise(async(resolve, reject) => {
            try {
                let output: TaskDetailSchema|null = null
                let amFinished = false
                for(let i = 0; i < ids.length && !amFinished; i++) {
                    const test = await this.getTaskDetail(ids[i].task_id)
                    if (test && test.is_local) {
                        output = test
                        amFinished = true
                    }
                }
                return resolve(output)
            } catch (err) {
                return reject(err)
            }
        })
    }

}

export interface StatusRecord {
    statusId: string
    statusName: string
    taskId: string
    taskName: string
    rootTask: TaskDetailSchema|null
    detailTask: TaskDetailSchema
    userId: number
    userName: string
}

export interface GroupedRecord {
    statusId: string
    statusName: string
    count: number
    labor: number
}