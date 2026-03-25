import { CommonModule } from '@angular/common'
import { Component, inject } from '@angular/core'
import { FormsModule } from '@angular/forms'
import { MatButtonModule } from '@angular/material/button'
import { MatButtonToggleModule } from '@angular/material/button-toggle'
import {
    MAT_DIALOG_DATA,
    MatDialogActions,
    MatDialogClose,
    MatDialogContent,
    MatDialogTitle
} from '@angular/material/dialog'
import { MatFormFieldModule } from '@angular/material/form-field'
import { MatIconModule } from '@angular/material/icon'
import { MatInputModule } from '@angular/material/input'

export interface ProjectTemplateDialogItem {
    templateId: string
    name: string
    visibility: 'Private' | 'Public'
    updatedAt: string
}

export interface ProjectTemplateDialogData {
    mode: 'save' | 'load'
    templates: ProjectTemplateDialogItem[]
    selectedTemplateId?: string
    suggestedName?: string
    suggestedVisibility?: 'Private' | 'Public'
}

export interface SaveProjectTemplateDialogResult {
    templateId?: string
    name: string
    visibility: 'Private' | 'Public'
}

@Component({
    standalone: true,
    imports: [
        CommonModule,
        FormsModule,
        MatDialogTitle,
        MatDialogContent,
        MatDialogActions,
        MatDialogClose,
        MatButtonModule,
        MatButtonToggleModule,
        MatFormFieldModule,
        MatInputModule,
        MatIconModule
    ],
    template: `
        <div mat-dialog-title class="template-dialog__titlebar">
            <span>{{data.mode === 'save' ? 'Save Project Template' : 'Load Project Template'}}</span>
            <button mat-icon-button type="button" aria-label="Close dialog" mat-dialog-close>
                <mat-icon>close</mat-icon>
            </button>
        </div>
        <mat-dialog-content class="template-dialog">
            <mat-form-field *ngIf="data.mode === 'save'" appearance="outline" class="template-dialog__field">
                <mat-label>Template Name</mat-label>
                <input matInput [(ngModel)]="templateName" />
            </mat-form-field>

            <div *ngIf="data.mode === 'save'" class="template-dialog__visibility">
                <span class="template-dialog__visibility-label">Visibility</span>
                <mat-button-toggle-group [(ngModel)]="visibility" aria-label="Template visibility">
                    <mat-button-toggle value="Private">Private</mat-button-toggle>
                    <mat-button-toggle value="Public">Public</mat-button-toggle>
                </mat-button-toggle-group>
            </div>

            <div class="template-dialog__list">
                <button
                    *ngFor="let template of data.templates"
                    type="button"
                    class="template-dialog__item"
                    [class.is-selected]="template.templateId === selectedTemplateId"
                    (click)="selectTemplate(template)">
                    <span class="template-dialog__item-main">
                        <span class="template-dialog__item-name">{{template.name}}</span>
                        <span class="template-dialog__item-visibility">{{template.visibility}}</span>
                    </span>
                    <span class="template-dialog__item-date">{{formatSavedAt(template.updatedAt)}}</span>
                </button>
                <div *ngIf="data.templates.length <= 0" class="template-dialog__empty">
                    <mat-icon fontIcon="inventory_2"></mat-icon>
                    <span>No saved templates yet.</span>
                </div>
            </div>
        </mat-dialog-content>
        <mat-dialog-actions align="end">
            <button mat-button type="button" mat-dialog-close>Cancel</button>
            <button
                mat-flat-button
                color="primary"
                type="button"
                [mat-dialog-close]="data.mode === 'save' ? resolveSaveResult() : resolveLoadResult()"
                [disabled]="!canSubmit()">
                {{data.mode === 'save' ? 'Save Template' : 'Load Template'}}
            </button>
        </mat-dialog-actions>
    `,
    styles: [`
        .template-dialog__titlebar {
            display: flex;
            align-items: center;
            justify-content: space-between;
            gap: 12px;
        }

        .template-dialog {
            display: grid;
            gap: 14px;
            width: min(420px, 78vw);
            max-width: 420px;
        }

        .template-dialog__field {
            width: 100%;
        }

        .template-dialog__visibility {
            display: grid;
            gap: 8px;
        }

        .template-dialog__visibility-label {
            color: rgba(177, 213, 228, 0.72);
            font-size: 0.78rem;
            letter-spacing: 0.08em;
            text-transform: uppercase;
        }

        .template-dialog__list {
            display: grid;
            gap: 8px;
            max-height: 320px;
            overflow: auto;
        }

        .template-dialog__item {
            display: flex;
            align-items: center;
            justify-content: space-between;
            gap: 12px;
            width: 100%;
            padding: 12px 14px;
            border: 1px solid rgba(72, 221, 255, 0.16);
            border-radius: 12px;
            background: rgba(8, 14, 25, 0.84);
            color: #eef8ff;
            text-align: left;
            cursor: pointer;
        }

        .template-dialog__item.is-selected {
            border-color: rgba(121, 255, 176, 0.42);
            box-shadow: 0 0 0 1px rgba(121, 255, 176, 0.16);
        }

        .template-dialog__item-main {
            display: grid;
            gap: 4px;
        }

        .template-dialog__item-name {
            font-weight: 600;
        }

        .template-dialog__item-visibility {
            color: rgba(121, 255, 176, 0.78);
            font-size: 0.74rem;
            letter-spacing: 0.08em;
            text-transform: uppercase;
        }

        .template-dialog__item-date {
            color: rgba(177, 213, 228, 0.72);
            font-size: 0.78rem;
        }

        .template-dialog__empty {
            display: flex;
            align-items: center;
            gap: 10px;
            padding: 14px;
            border: 1px dashed rgba(72, 221, 255, 0.16);
            border-radius: 12px;
            color: rgba(177, 213, 228, 0.72);
        }
    `]
})
export class ProjectTemplateDialog {
    data: ProjectTemplateDialogData = inject(MAT_DIALOG_DATA)
    selectedTemplateId = this.data.selectedTemplateId || ''
    templateName = this.data.suggestedName || ''
    visibility: 'Private' | 'Public' = this.data.suggestedVisibility || 'Private'

    selectTemplate(template: ProjectTemplateDialogItem) {
        this.selectedTemplateId = template.templateId
        if (this.data.mode === 'save') {
            this.templateName = template.name
            this.visibility = template.visibility
        }
    }

    canSubmit(): boolean {
        return this.data.mode === 'save'
            ? this.templateName.trim().length > 0
            : this.selectedTemplateId.trim().length > 0
    }

    resolveLoadResult(): string | null {
        return this.selectedTemplateId.trim() || null
    }

    resolveSaveResult(): SaveProjectTemplateDialogResult | null {
        if (!this.templateName.trim()) {
            return null
        }

        return {
            templateId: this.selectedTemplateId.trim() || undefined,
            name: this.templateName.trim(),
            visibility: this.visibility
        }
    }

    formatSavedAt(value: string): string {
        if (!value) {
            return ''
        }

        const parsed = new Date(value)
        return Number.isNaN(parsed.getTime()) ? value : parsed.toLocaleString()
    }
}
