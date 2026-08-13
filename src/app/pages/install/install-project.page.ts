import { HttpClient } from '@angular/common/http'
import { Component, OnInit, ChangeDetectionStrategy } from '@angular/core'
import { ActivatedRoute, RouterLink } from '@angular/router'
import { firstValueFrom } from 'rxjs'

import { MatButtonModule } from '@angular/material/button'
import { MatIconModule } from '@angular/material/icon'
import { MatTableModule } from '@angular/material/table'

import { PageToolbar } from '../../common/components/page-toolbar'
import { FirewireProjectSchema } from '../../schemas/firewire-project.schema'

interface DetailItem {
    label: string
    value: string
}

interface FieldwireTaskStatusChangeRow {
    fieldwireProjectId: string
    taskId: string
    taskName: string
    sequenceNumber: number | null
    priority: number | null
    statusId: string
    statusName: string
    statusColor: string
    statusKind: string
    statusChangedAt: string
    taskCreatedAt: string
    taskUpdatedAt: string
    dueAt: string
    startAt: string
    endAt: string
    fixedAt: string
    verifiedAt: string
    ownerUserId: number | null
    floorplanId: string
    locationId: string
    teamId: string
    taskTypeId: string
    isLocal: boolean
}

@Component({
    standalone: true,
    selector: 'install-project-page',
    imports: [
        RouterLink,
        MatButtonModule,
        MatIconModule,
        MatTableModule,
        PageToolbar
    ],
    providers: [HttpClient],
    templateUrl: './install-project.page.html',
    changeDetection: ChangeDetectionStrategy.Eager,
    styleUrls: ['./install-project.page.scss']
})
export class InstallProjectPage implements OnInit {
    statusChangeColumns: string[] = ['statusChangedAt', 'statusName', 'taskName', 'sequenceNumber', 'priority', 'taskUpdatedAt']
    pageWorking = true
    errText = ''
    project: FirewireProjectSchema | null = null
    statusChangesWorking = false
    statusChangesError = ''
    statusChanges: FieldwireTaskStatusChangeRow[] = []
    statusChangesWindowLabel = 'Recent activity window'
    statusChangesStatusCount = 0

    constructor(
        private readonly http: HttpClient,
        private readonly route: ActivatedRoute
    ) {}

    ngOnInit(): void {
        const projectId = this.route.snapshot.paramMap.get('projectId')
        if (!projectId) {
            this.errText = 'Project id is required.'
            this.pageWorking = false
            return
        }

        void this.loadProject(projectId)
    }

    async loadProject(projectId: string): Promise<void> {
        this.pageWorking = true
        this.errText = ''
        this.project = null

        try {
            const response = await firstValueFrom(this.http.get<{ data?: FirewireProjectSchema }>(`/api/firewire/projects/firewire/${encodeURIComponent(projectId)}`))
            this.project = response?.data || null
            if (!this.project) {
                this.errText = 'Project not found.'
            } else if (this.project.fieldwireId) {
                void this.loadRecentStatusChanges(this.project.fieldwireId)
            }
        } catch (err: any) {
            this.errText = err?.error?.message || err?.message || 'Unable to load project details.'
        } finally {
            this.pageWorking = false
        }
    }

    async loadRecentStatusChanges(fieldwireProjectId: string): Promise<void> {
        this.statusChangesWorking = true
        this.statusChangesError = ''
        this.statusChanges = []

        try {
            const response = await firstValueFrom(this.http.get<{ rows?: FieldwireTaskStatusChangeRow[], data?: { startDate?: string, endDate?: string, statusCount?: number } }>(`/api/fieldwire/projects/${encodeURIComponent(fieldwireProjectId)}/task-status-changes`))
            this.statusChanges = Array.isArray(response?.rows) ? response.rows : []
            this.statusChangesWindowLabel = this.formatStatusChangeWindow(response?.data?.startDate, response?.data?.endDate)
            this.statusChangesStatusCount = Number(response?.data?.statusCount || 0)
        } catch (err: any) {
            this.statusChangesError = err?.error?.message || err?.message || 'Unable to load recent Fieldwire status changes.'
        } finally {
            this.statusChangesWorking = false
        }
    }

    getProjectTitle(): string {
        return this.project?.name?.trim() || 'Install Project'
    }

    getStatusClass(): string {
        return String(this.project?.projectStatus || '').trim() === 'Install'
            ? 'install-project-status install-project-status--install'
            : 'install-project-status install-project-status--design'
    }

    getProjectDetails(): DetailItem[] {
        const project = this.project
        if (!project) {
            return []
        }

        return [
            { label: 'Project Number', value: project.projectNbr || 'Unavailable' },
            { label: 'Stage', value: project.projectStatus || 'Unavailable' },
            { label: 'Project Type', value: project.projectType || 'Unavailable' },
            { label: 'Address', value: project.address || 'Unavailable' },
            { label: 'Bid Due', value: this.toLocalDateString(project.bidDueDate) || 'Unavailable' },
            { label: 'Salesman', value: project.salesman || 'Unavailable' },
            { label: 'Job Type', value: project.jobType || 'Unavailable' },
            { label: 'Scope Type', value: project.scopeType || 'Unavailable' },
            { label: 'Project Scope', value: project.projectScope || 'Unavailable' },
            { label: 'Difficulty', value: project.difficulty || 'Unavailable' },
            { label: 'Total Sq Ft', value: this.formatSqFt(project.totalSqFt) },
            { label: 'Fieldwire Id', value: project.fieldwireId || 'Not linked' },
            { label: 'Created', value: this.toLocalDateTimeString(project.createdAt) || 'Unavailable' },
            { label: 'Created By', value: project.createdBy || 'Unavailable' },
            { label: 'Updated', value: this.toLocalDateTimeString(project.updatedAt) || 'Unavailable' },
            { label: 'Updated By', value: project.updatedBy || 'Unavailable' }
        ]
    }

    getFieldwireProjectUrl(): string | null {
        const fieldwireProjectId = this.project?.fieldwireId
        return fieldwireProjectId ? `https://app.fieldwire.com/projects/${fieldwireProjectId}` : null
    }

    getStatusChangeSummary(): string {
        if (!this.project?.fieldwireId) {
            return 'No linked Fieldwire project is available for status-change tracking.'
        }
        if (this.statusChangesWorking) {
            return 'Checking Fieldwire for task status changes...'
        }
        if (this.statusChangesError) {
            return this.statusChangesError
        }
        if (this.statusChanges.length <= 0) {
            return `No Fieldwire tasks matched the recent activity window across ${this.statusChangesStatusCount} project status${this.statusChangesStatusCount === 1 ? '' : 'es'}.`
        }
        return `${this.statusChanges.length} Fieldwire task status change${this.statusChanges.length === 1 ? '' : 's'} found.`
    }

    getEstimateWorkspaceLink(): string[] {
        return this.project?.uuid ? ['/projects', 'firewire', this.project.uuid, 'project-details'] : ['/projects']
    }

    toLocalDateString(input: Date | string | null | undefined): string {
        if (!input) {
            return ''
        }
        const parsed = new Date(input)
        if (Number.isNaN(parsed.getTime())) {
            return ''
        }
        return new Intl.DateTimeFormat(undefined, { dateStyle: 'short' }).format(parsed)
    }

    toLocalDateTimeString(input: Date | string | null | undefined): string {
        if (!input) {
            return ''
        }
        const parsed = new Date(input)
        if (Number.isNaN(parsed.getTime())) {
            return ''
        }
        return new Intl.DateTimeFormat(undefined, {
            dateStyle: 'short',
            timeStyle: 'short'
        }).format(parsed)
    }

    formatSqFt(value: number | null | undefined): string {
        const numericValue = Number(value || 0)
        if (!Number.isFinite(numericValue) || numericValue <= 0) {
            return 'Unavailable'
        }
        return new Intl.NumberFormat(undefined, {
            maximumFractionDigits: 0
        }).format(numericValue)
    }

    private formatStatusChangeWindow(startDate: string | null | undefined, endDate: string | null | undefined): string {
        const startText = this.toLocalDateTimeString(startDate || '')
        const endText = this.toLocalDateTimeString(endDate || '')
        return startText && endText ? `${startText} - ${endText}` : 'Recent activity window'
    }
}
