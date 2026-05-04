import { Injectable, inject } from "@angular/core"
import { HttpClient, HttpErrorResponse } from "@angular/common/http"
import { firstValueFrom } from "rxjs"
import { FirewireProjectSchema } from "../../schemas/firewire-project.schema"

export interface EditMarkupTagRecord {
    id: string
    itemId: string
    itemCode: string
    itemName: string
    partNumber?: string
    itemCategory?: string
    color: string
    xRatio: number
    yRatio: number
    createdAt: string
    updatedAt: string
}

export interface EditMarkupNoteRecord {
    id: string
    kind: 'sticky' | 'paper'
    color: string
    text: string
    xRatio: number
    yRatio: number
    createdAt: string
    updatedAt: string
}

export interface EditMarkupDocumentRecord {
    projectKey: string
    fileId: string
    fileName: string
    tags: EditMarkupTagRecord[]
    notes?: EditMarkupNoteRecord[]
    updatedAt: string
}

export interface EditMarkupWorkspaceState {
    documents: EditMarkupDocumentRecord[]
}

@Injectable({
    providedIn: 'root'
})
export class EditMarkupStorageService {
    private readonly http = inject(HttpClient)

    async loadWorkspace(projectKey: string): Promise<EditMarkupWorkspaceState> {
        try {
            const response = await firstValueFrom(this.http.get<{ data?: FirewireProjectSchema }>(this.getProjectUrl(projectKey)))
            return this.normalizeWorkspace(response?.data?.worksheetData)
        } catch (error) {
            if (error instanceof HttpErrorResponse && error.status === 404) {
                return this.createDefaultWorkspace()
            }

            throw error
        }
    }

    async saveWorkspace(projectKey: string, state: EditMarkupWorkspaceState): Promise<void> {
        const response = await firstValueFrom(this.http.get<{ data?: FirewireProjectSchema }>(this.getProjectUrl(projectKey)))
        const project = response?.data
        if (!project) {
            throw new Error('Unable to load project for markup save.')
        }

        await firstValueFrom(this.http.patch(this.getProjectUrl(projectKey), {
            ...this.buildProjectPatch(project),
            worksheetData: {
                ...(project.worksheetData || {}),
                editMarkupDocuments: state.documents
            }
        }))
    }

    private normalizeWorkspace(input: any): EditMarkupWorkspaceState {
        return {
            documents: Array.isArray(input?.editMarkupDocuments)
                ? input.editMarkupDocuments
                : (Array.isArray(input?.documents) ? input.documents : [])
        }
    }

    private createDefaultWorkspace(): EditMarkupWorkspaceState {
        return {
            documents: []
        }
    }

    private buildProjectPatch(project: FirewireProjectSchema): any {
        return {
            fieldwireId: project.fieldwireId,
            name: project.name,
            projectNbr: project.projectNbr,
            address: project.address,
            bidDueDate: project.bidDueDate,
            projectStatus: project.projectStatus,
            projectType: project.projectType,
            salesman: project.salesman,
            jobType: project.jobType,
            scopeType: project.scopeType,
            projectScope: project.projectScope,
            difficulty: project.difficulty,
            totalSqFt: project.totalSqFt
        }
    }

    private getProjectUrl(projectKey: string): string {
        return `/api/firewire/projects/firewire/${encodeURIComponent(projectKey)}`
    }
}
