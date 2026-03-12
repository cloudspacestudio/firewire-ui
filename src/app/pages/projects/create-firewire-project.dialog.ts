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
import { MatInputModule } from '@angular/material/input'
import { MatSelectModule } from '@angular/material/select'
import { FirewireProjectUpsert } from '../../schemas/firewire-project.schema'
import { ProjectListItemSchema } from '../../schemas/project-list-item.schema'
import { ProjectSettingsCatalogSchema } from '../../schemas/project-settings.schema'
import { ProjectSettingsApi } from './project-settings.api'

interface CreateFirewireProjectDialogData {
    fieldwireProject: ProjectListItemSchema
    projectSettings: ProjectSettingsCatalogSchema
}

@Component({
    standalone: true,
    templateUrl: './create-firewire-project.dialog.html',
    imports: [
        NgIf,
        NgFor,
        FormsModule,
        MatDialogTitle,
        MatDialogContent,
        MatDialogActions,
        MatDialogClose,
        MatButtonModule,
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

    model: FirewireProjectUpsert = this.createInitialModel()

    constructor() {
        if (this.hasProjectSettings(this.data?.projectSettings)) {
            this.projectSettingsLoaded = true
            return
        }

        this.data.projectSettings = {
            jobType: [],
            scopeType: [],
            projectScope: [],
            difficulty: [],
            projectStatus: []
        }

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
        if (this.shouldShowProjectNbrInput() && !this.model.projectNbr.trim()) {
            this.saveError = 'Project Number is required when Fieldwire does not provide one.'
            return
        }
        this.saveWorking = true
        this.dialogRef.close({
            ...this.model,
            name: this.model.name.trim(),
            projectNbr: this.model.projectNbr.trim(),
            address: this.model.address.trim(),
            salesman: this.model.salesman.trim(),
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
            projectStatus: 'Estimation',
            salesman: '',
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
