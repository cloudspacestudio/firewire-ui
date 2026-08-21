import { Component, Injectable, inject } from '@angular/core'
import { HttpClient } from '@angular/common/http'
import { MatDialog } from '@angular/material/dialog'
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner'
import { Router } from '@angular/router'
import { firstValueFrom } from 'rxjs'

import { FirewireDocumentAnalysisDialog, FirewireDocumentAnalysisDialogData } from '../components/firewire-document-analysis.dialog'
import { FirewireProjectSchema, FirewireProjectUpsert } from '../../schemas/firewire-project.schema'
import { ProjectListItemSchema } from '../../schemas/project-list-item.schema'
import { ProjectSettingsCatalogSchema } from '../../schemas/project-settings.schema'
import { ProjectDocLibraryFileRecord, ProjectDocLibraryStorageService } from './project-doc-library-storage.service'

@Component({
    standalone: true,
    imports: [MatProgressSpinnerModule],
    template: `
        <div class="package-transition" role="status" aria-live="polite">
            <mat-spinner diameter="42"></mat-spinner>
            <div><strong>Creating project from package</strong><span>Saving approved findings, preparing the document library, and opening project details...</span></div>
        </div>
    `,
    styles: [`
        :host { display:block; width:100%; }
        .package-transition { display:flex; align-items:center; gap:24px; width:100%; min-height:132px; padding:30px 34px; box-sizing:border-box; }
        .package-transition div { display:grid; flex:1; min-width:0; gap:8px; }
        .package-transition strong { color:#f4fbff; font-size:1.08rem; }
        .package-transition span { color:#a9bed0; line-height:1.5; white-space:normal; overflow-wrap:anywhere; }
    `]
})
export class ProjectPackageTransitionDialog {}

@Injectable({ providedIn: 'root' })
export class ProjectPackageIntakeService {
    private readonly http = inject(HttpClient)
    private readonly dialog = inject(MatDialog)
    private readonly router = inject(Router)
    private readonly storage = inject(ProjectDocLibraryStorageService)

    async start(file: File, options: {
        projectSettings: ProjectSettingsCatalogSchema
        salesman?: string
        destination: 'sales' | 'projects'
        status?: (message: string) => void
        refresh?: () => void
    }): Promise<void> {
        let stagingProjectId = ''
        let transitionRef: { close: () => void } | null = null
        let promotedProjectId = ''
        let promotionPromise: Promise<string> | null = null
        const status = options.status || (() => undefined)
        try {
            status('Preparing package intake...')
            const stem = file.name.replace(/\.[^.]+$/, '').trim() || 'New project package'
            const staging = await firstValueFrom(this.http.post<{ data: FirewireProjectSchema }>('/api/firewire/projects', {
                name: stem,
                projectNbr: '',
                address: '',
                bidDueDate: this.defaultBidDate(),
                projectStatus: 'Package Intake',
                projectType: 'Fire Alarm',
                salesman: options.salesman || '',
                jobType: '',
                scopeType: '',
                projectScope: '',
                difficulty: '',
                totalSqFt: 0,
                worksheetData: {}
            }))
            stagingProjectId = String(staging.data?.uuid || '')
            if (!stagingProjectId) throw new Error('Package intake could not create its temporary workspace.')

            status('Uploading package document...')
            const fileId = `doc-${crypto.randomUUID()}`
            const versionId = `ver-${crypto.randomUUID()}`
            const uploaded = await this.storage.uploadFileVersion(stagingProjectId, file, {
                fileId,
                versionId,
                folderId: 'unfiled',
                versionNumber: 1,
                lastModified: file.lastModified || Date.now()
            })
            const now = new Date().toISOString()
            const libraryFile: ProjectDocLibraryFileRecord = {
                id: fileId,
                folderId: 'unfiled',
                storageKey: stagingProjectId,
                sourceFileName: file.name,
                name: file.name,
                extension: file.name.includes('.') ? file.name.split('.').pop()!.toLowerCase() : '',
                createdAt: now,
                updatedAt: now,
                versions: [uploaded]
            }
            const workspace = await this.storage.loadWorkspace(stagingProjectId)
            workspace.files = [...workspace.files.filter((item) => item.id !== fileId), libraryFile]
            await this.storage.saveWorkspace(stagingProjectId, workspace)

            status('Inspecting package with AI...')
            const analysisRef = this.dialog.open(FirewireDocumentAnalysisDialog, {
                panelClass: ['fw-fit-content-dialog-pane', 'fw-document-analysis-dialog-pane'],
                width: 'min(1400px, 96vw)',
                maxWidth: '96vw',
                disableClose: true,
                closeOnNavigation: false,
                data: {
                    projectId: stagingProjectId,
                    workspaceKey: stagingProjectId,
                    fileId,
                    versionId,
                    sourceFilename: file.name,
                    potentialNewProject: true,
                    ensurePotentialProject: async(updateLabel, record) => {
                        if (!promotionPromise) {
                            promotionPromise = this.promotePotentialProject(
                                stagingProjectId, record, file, libraryFile, fileId, versionId, updateLabel, status)
                                .catch((error) => { promotionPromise = null; throw error })
                        } else {
                            status(`Updating ${updateLabel} on the new project...`)
                        }
                        promotedProjectId = await promotionPromise
                    }
                } as FirewireDocumentAnalysisDialogData
            })
            const analysisComponent = analysisRef.componentInstance
            await firstValueFrom(analysisRef.afterClosed())
            const analysisRecord = analysisComponent.record
            if (!analysisRecord || !promotedProjectId) {
                await this.deleteStagingProject(stagingProjectId)
                stagingProjectId = ''
                status('No document actions were applied; no project was created.')
                options.refresh?.()
                return
            }

            transitionRef = this.dialog.open(ProjectPackageTransitionDialog, {
                disableClose: true,
                closeOnNavigation: false,
                width: 'min(640px, calc(100vw - 40px))',
                maxWidth: 'min(640px, calc(100vw - 40px))',
                panelClass: 'fw-package-transition-dialog-pane'
            })

            const completedId = promotedProjectId
            status('Confirming the original package document in the new project library...')
            const completedDocument = await this.publishOriginalDocument(completedId, file, libraryFile, fileId, versionId)
            await this.persistPackageDocumentManifest(completedId, completedDocument)
            stagingProjectId = ''
            sessionStorage.setItem(`firewire.package-ready.${completedId}`, '1')
            status('Project created from package.')
            options.refresh?.()
            await this.router.navigate(options.destination === 'sales'
                ? ['/sales', completedId]
                : ['/projects', 'firewire', completedId, 'project-details'])
            transitionRef.close()
        } catch (error) {
            transitionRef?.close()
            if (stagingProjectId) await this.deleteStagingProject(stagingProjectId)
            const message = error instanceof Error ? error.message : 'Unable to create a project from this package.'
            status(message)
            throw error
        }
    }

    private async promotePotentialProject(
        stagingProjectId: string,
        record: { result: { proposedActions?: Array<{ targetField: string; proposedValue: string }> } | null },
        sourceFile: File,
        libraryFile: ProjectDocLibraryFileRecord,
        fileId: string,
        versionId: string,
        updateLabel: string,
        status: (message: string) => void
    ): Promise<string> {
        status(`Creating the new project before updating ${updateLabel}...`)
        const projectResponse = await firstValueFrom(this.http.get<{ data: FirewireProjectSchema }>(`/api/firewire/projects/firewire/${stagingProjectId}`))
        const inspectedProject = projectResponse.data
        const recommendation = this.applyAnalysisRecommendations(this.toUpsert(inspectedProject), record.result?.proposedActions || [])
        const recommendedProject = { ...inspectedProject, ...recommendation }
        const listResponse = await firstValueFrom(this.http.get<{ rows: ProjectListItemSchema[] }>('/api/firewire/projects'))
        const duplicate = (listResponse.rows || []).find((item) =>
            item.firewireProjectId !== stagingProjectId
            && item.projectStatus !== 'Package Intake'
            && this.isLikelySameProject(item, recommendedProject))
        if (duplicate) {
            throw new Error(`This package appears to belong to existing project "${duplicate.name}". No new project was created.`)
        }

        const finalizedResponse = await firstValueFrom(this.http.patch<{ data?: FirewireProjectSchema }>(`/api/firewire/projects/firewire/${stagingProjectId}`, {
            // Promotion only makes the intake workspace a persisted, visible project.
            // The action that triggered promotion must remain responsible for applying
            // exactly the recommendations the user selected. Pre-applying them here
            // makes the subsequent audited action stale against its inspected values.
            ...this.toUpsert(inspectedProject),
            projectStatus: 'Estimation',
            worksheetData: inspectedProject.worksheetData || {}
        }))
        const canonicalProjectId = String(finalizedResponse.data?.uuid || stagingProjectId).trim() || stagingProjectId
        status('Adding the original package document to the new project...')
        const publishedDocument = await this.publishOriginalDocument(canonicalProjectId, sourceFile, libraryFile, fileId, versionId, stagingProjectId)
        await this.persistPackageDocumentManifest(canonicalProjectId, publishedDocument)
        status(`New project created. Updating ${updateLabel}...`)
        return canonicalProjectId
    }

    private async publishOriginalDocument(
        projectId: string,
        sourceFile: File,
        libraryFile: ProjectDocLibraryFileRecord,
        fileId: string,
        versionId: string,
        sourceWorkspaceKey = ''
    ): Promise<ProjectDocLibraryFileRecord> {
        const projectWorkspace = await this.storage.loadWorkspace(projectId)
        const sourceWorkspace = sourceWorkspaceKey && sourceWorkspaceKey !== projectId
            ? await this.storage.loadWorkspace(sourceWorkspaceKey)
            : this.storage.createDefaultWorkspace()
        const existingFinalFile = (projectWorkspace.files || []).find((item) => item.id === fileId)
        const existingFinalVersion = existingFinalFile?.versions?.find((item) => item.id === versionId)
        // Upload into the final namespace when it is genuinely different or a later
        // action replaced the metadata. A metadata-only key rewrite cannot move a blob.
        const publishedVersion = existingFinalVersion || await this.storage.uploadFileVersion(projectId, sourceFile, {
                fileId,
                versionId,
                folderId: libraryFile.folderId || 'unfiled',
                versionNumber: 1,
                lastModified: sourceFile.lastModified || Date.now()
            })
        const publishedFile: ProjectDocLibraryFileRecord = {
            ...libraryFile,
            storageKey: projectId,
            versions: [publishedVersion]
        }
        const filesById = new Map([
            ...(sourceWorkspace.files || []),
            ...(projectWorkspace.files || []),
            publishedFile
        ].map((item) => [item.id, item.id === fileId ? publishedFile : { ...item, storageKey: item.storageKey || projectId }]))
        await this.storage.saveWorkspace(projectId, {
            ...projectWorkspace,
            files: [...filesById.values()],
            directories: projectWorkspace.directories?.length ? projectWorkspace.directories : sourceWorkspace.directories
        })
        const verifiedWorkspace = await this.storage.loadWorkspace(projectId)
        const verifiedSource = verifiedWorkspace.files.find((item) => item.id === fileId)
        if (!verifiedSource?.versions?.some((item) => item.id === versionId)) {
            throw new Error('The original package document could not be verified in the new project Document Library.')
        }
        return verifiedSource
    }

    private async persistPackageDocumentManifest(projectId: string, document: ProjectDocLibraryFileRecord): Promise<void> {
        const response = await firstValueFrom(this.http.get<{ data: FirewireProjectSchema }>(`/api/firewire/projects/firewire/${projectId}`))
        const project = response.data
        const worksheetData = project.worksheetData && typeof project.worksheetData === 'object'
            ? { ...project.worksheetData }
            : {}
        const existing = Array.isArray(worksheetData.packageIntakeDocuments)
            ? worksheetData.packageIntakeDocuments as ProjectDocLibraryFileRecord[]
            : []
        worksheetData.packageIntakeDocuments = [
            document,
            ...existing.filter((item) => item?.id !== document.id)
        ].slice(0, 10)
        await firstValueFrom(this.http.patch(`/api/firewire/projects/firewire/${projectId}`, {
            ...this.toUpsert(project),
            worksheetData
        }))
    }

    private toUpsert(project: FirewireProjectSchema): FirewireProjectUpsert {
        return {
            fieldwireId: project.fieldwireId,
            worksheetData: project.worksheetData || {},
            name: project.name || '', projectNbr: project.projectNbr || '', address: project.address || '',
            bidDueDate: String(project.bidDueDate || this.defaultBidDate()).slice(0, 10),
            projectStatus: project.projectStatus === 'Package Intake' ? 'Estimation' : project.projectStatus,
            projectType: project.projectType || 'Fire Alarm', salesman: project.salesman || '',
            jobType: project.jobType || '', scopeType: project.scopeType || '', projectScope: project.projectScope || '',
            difficulty: project.difficulty || '', totalSqFt: Number(project.totalSqFt || 0)
        }
    }

    private applyAnalysisRecommendations(model: FirewireProjectUpsert, actions: Array<{ targetField: string; proposedValue: string }>): FirewireProjectUpsert {
        const next = { ...model }
        for (const action of actions) {
            const value = String(action.proposedValue || '').trim()
            if (!value) continue
            switch (action.targetField) {
                case 'name': next.name = value; break
                case 'projectNbr': next.projectNbr = value; break
                case 'address': next.address = value; break
                case 'bidDueDate': next.bidDueDate = value.slice(0, 10); break
                case 'projectType':
                    if (value === 'Fire Alarm' || value === 'Sprinkler' || value === 'Security') next.projectType = value
                    break
                case 'jobType': next.jobType = value; break
                case 'scopeType': next.scopeType = value; break
                case 'projectScope': next.projectScope = value; break
                case 'totalSqFt': next.totalSqFt = Math.max(0, Number(value.replace(/,/g, '')) || 0); break
            }
        }
        return next
    }

    private hasAcceptedAnalysisActions(record: {
        actionApplications?: unknown[]
        bomActionApplications?: unknown[]
        deviceCreationApplications?: unknown[]
        floorplanApplications?: unknown[]
        floorplanPlacementApplications?: unknown[]
        coordinationApplications?: unknown[]
    }): boolean {
        return [
            record.actionApplications,
            record.bomActionApplications,
            record.deviceCreationApplications,
            record.floorplanApplications,
            record.floorplanPlacementApplications,
            record.coordinationApplications
        ].some((applications) => Array.isArray(applications) && applications.length > 0)
    }

    private isLikelySameProject(item: ProjectListItemSchema, project: FirewireProjectSchema): boolean {
        const normalize = (value: unknown) => String(value || '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim()
        const projectNbr = normalize(project.projectNbr)
        if (projectNbr && projectNbr === normalize(item.projectNbr)) return true
        const name = normalize(project.name)
        const address = normalize(project.address)
        return !!name && name === normalize(item.name) && (!address || !normalize(item.address) || address === normalize(item.address))
    }

    private async deleteStagingProject(projectId: string): Promise<void> {
        try { await firstValueFrom(this.http.delete(`/api/firewire/projects/firewire/${projectId}`)) } catch {}
    }

    private defaultBidDate(): string {
        const date = new Date(); date.setDate(date.getDate() + 30); return date.toISOString().slice(0, 10)
    }
}
