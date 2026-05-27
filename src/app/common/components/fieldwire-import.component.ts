import { CommonModule } from '@angular/common'
import { Component, OnInit, inject } from '@angular/core'
import { HttpClient } from '@angular/common/http'
import { MatButtonModule } from '@angular/material/button'
import { MAT_DIALOG_DATA, MatDialogActions, MatDialogClose, MatDialogContent, MatDialogTitle } from '@angular/material/dialog'
import { MatIconModule } from '@angular/material/icon'
import { MatProgressBarModule } from '@angular/material/progress-bar'

export interface FieldwireImportDialogData {
    projectId: string
    projectName: string
    fieldwireProjectId?: string | null
}

interface FieldwireImportPlan {
    status: 'project-exists' | 'project-missing'
    canImport: boolean
    project: {
        id: string
        name: string
        projectNbr: string
        status: string
        address: string
    }
    fieldwireProject: {
        id: string
        name: string
        code: string
        address: string
        createdAt: string | null
        updatedAt: string | null
        url: string
    } | null
    summary: {
        floorplans: number
        floorplansToCreate: number
        tasksToCreate: number
        actionsRequired: number
    }
    floorplans: FieldwireImportFloorplanPlan[]
    actionItems: FieldwireImportActionItem[]
}

interface FieldwireImportFloorplanPlan {
    firewireFileId: string
    fileName: string
    sourceFileName: string
    mimeType: string
    sizeBytes: number
    symbolCount: number
    status: 'exists' | 'required' | 'processing'
    fieldwireFloorplanId: string | null
    fieldwireFloorplanName: string
    fieldwireCreatedAt: string | null
    fieldwireUpdatedAt: string | null
    tasks: FieldwireImportTaskPlan[]
}

interface FieldwireImportTaskPlan {
    annotationId: string
    taskName: string
    xRatio: number | null
    yRatio: number | null
    categoryName: string
    partNumber: string
    deviceName: string
    status: 'exists' | 'required' | 'blocked'
    fieldwireTaskId: string | null
}

interface FieldwireImportActionItem {
    type: 'create-project' | 'create-floorplan' | 'create-task'
    status: 'required'
    label: string
    detail: string
}

interface FieldwireImportExecuteResult {
    success: boolean
    message: string
    results: Array<{
        type: string
        label: string
        status: 'success' | 'skipped' | 'pending' | 'failed'
        detail: string
    }>
}

@Component({
    standalone: true,
    selector: 'fieldwire-import',
    imports: [CommonModule, MatButtonModule, MatDialogActions, MatDialogClose, MatDialogContent, MatDialogTitle, MatIconModule, MatProgressBarModule],
    template: `
        <h2 mat-dialog-title>Fieldwire Import</h2>
        <mat-dialog-content class="fieldwire-import">
            <mat-progress-bar *ngIf="loading" mode="indeterminate"></mat-progress-bar>

            <div *ngIf="errorMessage" class="fieldwire-import__notice fieldwire-import__notice--error">
                <mat-icon fontIcon="error"></mat-icon>
                <span>{{errorMessage}}</span>
            </div>

            <div *ngIf="executeMessage" class="fieldwire-import__notice" [class.fieldwire-import__notice--error]="executeResult && !executeResult.success">
                <mat-icon [fontIcon]="executeResult?.success === false ? 'error' : 'check_circle'"></mat-icon>
                <span>{{executeMessage}}</span>
            </div>

            <ng-container *ngIf="plan">
                <section class="fieldwire-import__status" [class.is-ready]="plan.status === 'project-exists'">
                    <mat-icon [fontIcon]="plan.status === 'project-exists' ? 'cloud_done' : 'cloud_off'"></mat-icon>
                    <div>
                        <strong *ngIf="plan.status === 'project-exists'">Fieldwire project exists</strong>
                        <strong *ngIf="plan.status === 'project-missing'">No Fieldwire project exists yet</strong>
                        <span *ngIf="plan.status === 'project-exists'">
                            {{plan.fieldwireProject?.name}} <ng-container *ngIf="plan.fieldwireProject?.code">#{{plan.fieldwireProject?.code}}</ng-container>
                            <ng-container *ngIf="plan.fieldwireProject?.createdAt"> · created {{formatDate(plan.fieldwireProject?.createdAt)}}</ng-container>
                        </span>
                        <span *ngIf="plan.status === 'project-missing'">
                            Import will begin by creating {{plan.project.name}} in Fieldwire.
                        </span>
                    </div>
                    <a *ngIf="plan.fieldwireProject?.url" mat-stroked-button [href]="plan.fieldwireProject?.url" target="_blank" rel="noopener">
                        OPEN FIELDWIRE
                    </a>
                </section>

                <section class="fieldwire-import__summary">
                    <div>
                        <span>Actions</span>
                        <strong>{{plan.summary.actionsRequired}}</strong>
                    </div>
                    <div>
                        <span>Floorplans</span>
                        <strong>{{plan.summary.floorplansToCreate}} / {{plan.summary.floorplans}}</strong>
                    </div>
                    <div>
                        <span>Tasks</span>
                        <strong>{{plan.summary.tasksToCreate}}</strong>
                    </div>
                </section>

                <section class="fieldwire-import__panel">
                    <div class="fieldwire-import__panel-title">Action List</div>
                    <div *ngIf="plan.actionItems.length <= 0" class="fieldwire-import__empty">
                        Fieldwire already appears current for this project.
                    </div>
                    <div *ngFor="let action of plan.actionItems" class="fieldwire-import__action">
                        <mat-icon [fontIcon]="getActionIcon(action.type)"></mat-icon>
                        <div>
                            <strong>{{action.label}}</strong>
                            <span>{{action.detail}}</span>
                        </div>
                    </div>
                </section>

                <section *ngIf="executeResult?.results?.length" class="fieldwire-import__panel">
                    <div class="fieldwire-import__panel-title">Execution Results</div>
                    <div *ngFor="let result of executeResult?.results" class="fieldwire-import__action" [class.is-failed]="result.status === 'failed'">
                        <mat-icon [fontIcon]="result.status === 'success' ? 'check_circle' : result.status === 'skipped' ? 'skip_next' : result.status === 'pending' ? 'pending' : 'error'"></mat-icon>
                        <div>
                            <strong>{{result.label}}</strong>
                            <span>{{result.detail}}</span>
                        </div>
                    </div>
                </section>

                <section class="fieldwire-import__panel">
                    <div class="fieldwire-import__panel-title">Floorplans</div>
                    <div *ngIf="plan.floorplans.length <= 0" class="fieldwire-import__empty">
                        No Firewire floorplans are available to import.
                    </div>
                    <div *ngFor="let floorplan of plan.floorplans" class="fieldwire-import__floorplan">
                        <div>
                            <strong>{{floorplan.fileName}}</strong>
                            <span>{{getFloorplanStatusText(floorplan)}} · {{floorplan.symbolCount}} symbol{{floorplan.symbolCount === 1 ? '' : 's'}}</span>
                        </div>
                        <span class="fieldwire-import__badge" [class.is-required]="floorplan.status === 'required'" [class.is-pending]="floorplan.status === 'processing'">
                            {{floorplan.status === 'exists' ? 'EXISTS' : floorplan.status === 'processing' ? 'PROCESSING' : 'CREATE'}}
                        </span>
                        <div *ngIf="floorplan.tasks.length > 0" class="fieldwire-import__tasks">
                            <div *ngFor="let task of floorplan.tasks">
                                <span>{{task.taskName}}</span>
                                <small>{{task.status === 'exists' ? 'task exists' : task.status === 'blocked' ? 'waiting on floorplan' : 'create task'}} at {{formatPercent(task.xRatio)}}, {{formatPercent(task.yRatio)}}</small>
                            </div>
                        </div>
                    </div>
                </section>
            </ng-container>
        </mat-dialog-content>
        <mat-dialog-actions align="end">
            <button mat-stroked-button mat-dialog-close type="button">Close</button>
            <button mat-flat-button type="button" class="fieldwire-import__perform" [disabled]="loading || executing || !plan?.canImport" (click)="executeImport()">
                {{executing ? 'EXECUTING...' : 'EXECUTE'}}
            </button>
        </mat-dialog-actions>
    `,
    styles: [`
        .fieldwire-import {
            width: 100%;
            box-sizing: border-box;
            min-height: 560px;
            max-height: min(70vh, 720px);
            overflow-y: auto;
            overflow-x: hidden;
            display: grid;
            align-content: start;
            gap: 16px;
            color: #d9eff9;
        }

        .fieldwire-import__notice,
        .fieldwire-import__status,
        .fieldwire-import__summary,
        .fieldwire-import__panel {
            border: 1px solid rgba(72, 221, 255, 0.18);
            border-radius: 8px;
            background: rgba(7, 14, 25, 0.72);
        }

        .fieldwire-import__notice,
        .fieldwire-import__status {
            display: flex;
            align-items: center;
            gap: 14px;
            padding: 16px;
        }

        .fieldwire-import__notice--error {
            border-color: rgba(255, 150, 150, 0.32);
            color: #ffc4c4;
        }

        .fieldwire-import__status.is-ready {
            border-color: rgba(89, 222, 151, 0.36);
        }

        .fieldwire-import__status div {
            display: grid;
            gap: 4px;
            flex: 1;
            min-width: 0;
        }

        .fieldwire-import__status span,
        .fieldwire-import__action span,
        .fieldwire-import__floorplan span,
        .fieldwire-import__empty {
            color: rgba(217, 239, 249, 0.72);
        }

        .fieldwire-import__summary {
            display: grid;
            grid-template-columns: repeat(3, minmax(0, 1fr));
            gap: 1px;
            overflow: hidden;
        }

        .fieldwire-import__summary div {
            display: grid;
            gap: 6px;
            padding: 14px;
            background: rgba(12, 36, 52, 0.34);
        }

        .fieldwire-import__summary span,
        .fieldwire-import__panel-title {
            color: #7fe8ff;
            font-size: 12px;
            letter-spacing: 0.08em;
            text-transform: uppercase;
        }

        .fieldwire-import__summary strong {
            font-size: 22px;
        }

        .fieldwire-import__panel {
            display: grid;
            gap: 10px;
            padding: 14px;
        }

        .fieldwire-import__action,
        .fieldwire-import__floorplan {
            display: grid;
            grid-template-columns: auto minmax(0, 1fr) auto;
            gap: 12px;
            align-items: start;
            padding: 12px;
            border: 1px solid rgba(139, 199, 255, 0.14);
            border-radius: 6px;
            background: rgba(5, 12, 22, 0.62);
        }

        .fieldwire-import__action.is-failed {
            border-color: rgba(255, 150, 150, 0.32);
        }

        .fieldwire-import__action div,
        .fieldwire-import__floorplan > div:first-child {
            display: grid;
            gap: 4px;
            min-width: 0;
        }

        .fieldwire-import__action strong,
        .fieldwire-import__action span,
        .fieldwire-import__floorplan strong,
        .fieldwire-import__floorplan span {
            overflow-wrap: anywhere;
        }

        .fieldwire-import__badge {
            align-self: center;
            padding: 4px 8px;
            border-radius: 999px;
            background: rgba(89, 222, 151, 0.14);
            color: #9ef4bd;
            font-size: 12px;
            font-weight: 700;
        }

        .fieldwire-import__badge.is-required {
            background: rgba(247, 190, 85, 0.14);
            color: #ffd48a;
        }

        .fieldwire-import__badge.is-pending {
            background: rgba(139, 199, 255, 0.14);
            color: #9ed7ff;
        }

        .fieldwire-import__tasks {
            grid-column: 1 / -1;
            display: grid;
            gap: 6px;
            padding-top: 8px;
        }

        .fieldwire-import__tasks div {
            display: flex;
            justify-content: space-between;
            gap: 12px;
            padding: 8px 10px;
            border-radius: 4px;
            background: rgba(13, 31, 45, 0.7);
        }

        .fieldwire-import__tasks small {
            color: rgba(217, 239, 249, 0.62);
        }

        .fieldwire-import__perform {
            background: linear-gradient(180deg, rgba(19, 86, 116, 0.95), rgba(11, 48, 70, 0.95));
            border: 1px solid rgba(84, 212, 255, 0.52);
            color: #e8f7ff;
        }

        .fieldwire-import__perform:disabled {
            opacity: 0.42;
            cursor: not-allowed;
            filter: grayscale(0.6);
        }
    `]
})
export class FieldwireImportComponent implements OnInit {
    private readonly http = inject(HttpClient)
    readonly data = inject<FieldwireImportDialogData>(MAT_DIALOG_DATA)

    plan?: FieldwireImportPlan
    executeResult?: FieldwireImportExecuteResult
    loading = false
    executing = false
    errorMessage = ''
    executeMessage = ''

    ngOnInit(): void {
        this.loadPlan()
    }

    loadPlan(): void {
        if (!this.data.projectId) {
            this.errorMessage = 'Missing Firewire project id.'
            return
        }
        this.loading = true
        this.errorMessage = ''
        this.executeMessage = ''
        this.executeResult = undefined
        this.http.get<{ data: FieldwireImportPlan }>(`/api/firewire/projects/firewire/${encodeURIComponent(this.data.projectId)}/fieldwire-import/plan`).subscribe({
            next: (response) => {
                this.plan = response.data
                this.loading = false
            },
            error: (err) => {
                this.errorMessage = err?.error?.message || err?.message || 'Unable to prepare Fieldwire import.'
                this.loading = false
            }
        })
    }

    executeImport(): void {
        if (!this.data.projectId || this.loading || this.executing || !this.plan?.canImport) {
            return
        }
        this.executing = true
        this.errorMessage = ''
        this.executeMessage = 'Executing Fieldwire import...'
        this.executeResult = undefined
        this.http.post<{ data: FieldwireImportExecuteResult }>(`/api/firewire/projects/firewire/${encodeURIComponent(this.data.projectId)}/fieldwire-import/execute`, {}).subscribe({
            next: (response) => {
                this.executeResult = response.data
                this.executeMessage = response.data?.message || 'Fieldwire import finished.'
                this.executing = false
                this.refreshPlanAfterExecute()
            },
            error: (err) => {
                this.errorMessage = err?.error?.message || err?.message || 'Unable to execute Fieldwire import.'
                this.executeMessage = ''
                this.executing = false
            }
        })
    }

    private refreshPlanAfterExecute(): void {
        this.http.get<{ data: FieldwireImportPlan }>(`/api/firewire/projects/firewire/${encodeURIComponent(this.data.projectId)}/fieldwire-import/plan`).subscribe({
            next: (response) => {
                this.plan = response.data
            }
        })
    }

    formatDate(value: string | null | undefined): string {
        if (!value) {
            return ''
        }
        const date = new Date(value)
        if (Number.isNaN(date.getTime())) {
            return ''
        }
        return new Intl.DateTimeFormat('en-US', {
            month: 'short',
            day: 'numeric',
            year: 'numeric'
        }).format(date)
    }

    formatPercent(value: number | null): string {
        return typeof value === 'number' ? `${Math.round(value * 1000) / 10}%` : 'unknown'
    }

    getActionIcon(type: FieldwireImportActionItem['type']): string {
        if (type === 'create-project') {
            return 'create_new_folder'
        }
        if (type === 'create-floorplan') {
            return 'map'
        }
        return 'add_task'
    }

    getFloorplanStatusText(floorplan: FieldwireImportFloorplanPlan): string {
        if (floorplan.status === 'exists') {
            return 'Exists in Fieldwire and is ready for tasks'
        }
        if (floorplan.status === 'processing') {
            return 'Fieldwire is still processing this floorplan'
        }
        return 'Will be created as a Fieldwire sheet/floorplan'
    }
}
