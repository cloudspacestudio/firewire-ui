import { Component, inject } from '@angular/core'
import { FormsModule } from '@angular/forms'
import { NgFor, NgIf } from '@angular/common'
import {
    MAT_DIALOG_DATA,
    MatDialogActions,
    MatDialogClose,
    MatDialogContent,
    MatDialogRef,
    MatDialogTitle
} from '@angular/material/dialog'
import { MatButtonModule } from '@angular/material/button'
import { MatFormFieldModule } from '@angular/material/form-field'
import { MatIconModule } from '@angular/material/icon'
import { MatInputModule } from '@angular/material/input'
import { MatSelectModule } from '@angular/material/select'
import { FIREWIRE_PROJECT_TYPE_OPTIONS, FirewireProjectUpsert } from '../../schemas/firewire-project.schema'
import { ProjectListItemSchema } from '../../schemas/project-list-item.schema'
import { createEmptyProjectSettingsCatalog, ProjectSettingsCatalogSchema } from '../../schemas/project-settings.schema'
import { ProjectSettingsApi } from './project-settings.api'

interface CreateFirewireProjectDialogData {
    fieldwireProject: Partial<ProjectListItemSchema>
    projectSettings: ProjectSettingsCatalogSchema
    suggestedProjectStatus?: string
    suggestedSalesman?: string
}

@Component({
    standalone: true,
    templateUrl: './create-firewire-project.dialog.html',
    styles: [`
        :host {
            display: block;
            width: min(980px, calc(100vw - 48px));
        }

        .create-firewire-project-dialog {
            width: min(980px, calc(100vw - 48px));
            max-width: 100%;
            box-sizing: border-box;
        }

        .create-firewire-project-dialog__grid {
            display: grid;
            grid-template-columns: repeat(3, minmax(0, 1fr));
            gap: 14px 16px;
            align-items: start;
        }

        .create-firewire-project-dialog__span-2 {
            grid-column: span 2;
        }

        .create-firewire-project-dialog__span-3 {
            grid-column: 1 / -1;
        }

        .create-firewire-project-dialog mat-form-field {
            width: 100%;
            min-width: 0;
        }

        .project-create-status {
            margin-top: 12px;
            color: rgba(255, 184, 184, 0.96);
        }

        @media (max-width: 860px) {
            :host,
            .create-firewire-project-dialog {
                width: min(680px, calc(100vw - 32px));
            }

            .create-firewire-project-dialog__grid {
                grid-template-columns: repeat(2, minmax(0, 1fr));
            }

            .create-firewire-project-dialog__span-3 {
                grid-column: 1 / -1;
            }
        }

        @media (max-width: 620px) {
            .create-firewire-project-dialog__grid {
                grid-template-columns: 1fr;
            }

            .create-firewire-project-dialog__span-2,
            .create-firewire-project-dialog__span-3 {
                grid-column: 1 / -1;
            }
        }
    `],
    imports: [
        NgIf,
        NgFor,
        FormsModule,
        MatDialogTitle,
        MatDialogContent,
        MatDialogActions,
        MatDialogClose,
        MatButtonModule,
        MatIconModule,
        MatFormFieldModule,
        MatInputModule,
        MatSelectModule
    ]
})
export class CreateFirewireProjectDialog {
    private dialogRef = inject(MatDialogRef<CreateFirewireProjectDialog>)
    private projectSettingsApi = inject(ProjectSettingsApi)
    data: CreateFirewireProjectDialogData = inject(MAT_DIALOG_DATA)
    saveWorking = false
    saveError = ''
    projectSettingsLoaded = false
    readonly projectTypeOptions = FIREWIRE_PROJECT_TYPE_OPTIONS

    model: FirewireProjectUpsert = this.createInitialModel()

    constructor() {
        if (this.hasProjectSettings(this.data?.projectSettings)) {
            this.projectSettingsLoaded = true
            return
        }

        this.data.projectSettings = createEmptyProjectSettingsCatalog()

        this.projectSettingsApi.getCatalog().subscribe({
            next: (catalog) => {
                this.data.projectSettings = catalog
                this.projectSettingsLoaded = true
            },
            error: () => {
                this.projectSettingsLoaded = true
            }
        })
    }

    submit() {
        this.saveError = ''
        if (!this.model.name.trim()) {
            this.saveError = 'Name is required.'
            return
        }
        this.saveWorking = true
        this.dialogRef.close({
            ...this.model,
            name: this.model.name.trim(),
            projectNbr: this.model.projectNbr.trim(),
            address: this.model.address.trim(),
            salesman: this.model.salesman.trim(),
            projectType: this.model.projectType,
            jobType: this.model.jobType.trim(),
            scopeType: this.model.scopeType.trim(),
            projectScope: this.model.projectScope.trim(),
            difficulty: this.model.difficulty.trim()
        } satisfies FirewireProjectUpsert)
    }

    get projectSettings(): ProjectSettingsCatalogSchema {
        return this.data.projectSettings
    }

    getActiveSettings(listKey: keyof ProjectSettingsCatalogSchema) {
        return (this.projectSettings[listKey] || []).filter((item) => item.isActive)
    }

    shouldShowProjectNbrInput(): boolean {
        return !this.data.fieldwireProject?.projectNbr?.trim()
    }

    private createInitialModel(): FirewireProjectUpsert {
        const defaultBidDate = new Date()
        defaultBidDate.setDate(defaultBidDate.getDate() + 30)
        const fieldwireProject = this.data.fieldwireProject

        return {
            fieldwireId: fieldwireProject.fieldwireProjectId,
            name: fieldwireProject.name || '',
            projectNbr: fieldwireProject.projectNbr || '',
            address: fieldwireProject.address || '',
            bidDueDate: defaultBidDate.toISOString().slice(0, 10),
            projectStatus: this.data.suggestedProjectStatus || 'Estimation',
            projectType: 'Fire Alarm',
            salesman: this.data.suggestedSalesman || '',
            jobType: '',
            scopeType: '',
            projectScope: '',
            difficulty: '',
            totalSqFt: 0
        }
    }

    private hasProjectSettings(catalog?: ProjectSettingsCatalogSchema | null): boolean {
        if (!catalog) {
            return false
        }

        const totalOptions = [
            catalog.jobType,
            catalog.scopeType,
            catalog.projectScope,
            catalog.difficulty
        ].reduce((count, list) => count + (Array.isArray(list) ? list.length : 0), 0)

        return totalOptions > 0
    }
}
