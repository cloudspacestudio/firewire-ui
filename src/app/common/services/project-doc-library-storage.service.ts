import { Injectable, inject } from "@angular/core"
import { HttpClient, HttpErrorResponse } from "@angular/common/http"
import { firstValueFrom } from "rxjs"

export interface ProjectDocLibraryFolderDefinition {
    id: string
    label: string
}

export interface ProjectDocLibraryFileVersionRecord {
    id: string
    versionNumber: number
    uploadedAt: string
    uploadedBy: string
    sourceFileName: string
    sizeBytes: number
    mimeType: string
    lastModified: number
    dataUrl: string
}

export interface ProjectDocLibraryFileRecord {
    id: string
    folderId: string
    name: string
    extension: string
    createdAt: string
    updatedAt: string
    versions: ProjectDocLibraryFileVersionRecord[]
}

export interface ProjectDocLibraryWorkspaceState {
    files: ProjectDocLibraryFileRecord[]
    editMarkupDocuments?: any[]
}

export const PROJECT_DOC_LIBRARY_FOLDERS: ProjectDocLibraryFolderDefinition[] = [
    { id: 'estimating', label: 'Estimating' },
    { id: 'submittals', label: 'Submittals' },
    { id: 'drawings', label: 'Drawings' },
    { id: 'site-photos', label: 'Site Photos' },
    { id: 'change-orders', label: 'Change Orders' },
    { id: 'close-out-docs', label: 'Close Out Docs' }
]

@Injectable({
    providedIn: 'root'
})
export class ProjectDocLibraryStorageService {
    private readonly http = inject(HttpClient)

    async loadWorkspace(projectKey: string): Promise<ProjectDocLibraryWorkspaceState> {
        const response = await firstValueFrom(this.http.get<{ data?: { payload?: any } }>(`/api/firewire/storage/project-doc-library/${encodeURIComponent(projectKey)}`))
        return this.normalizeWorkspace(response?.data?.payload)
    }

    async saveWorkspace(projectKey: string, state: ProjectDocLibraryWorkspaceState): Promise<void> {
        const payload: ProjectDocLibraryWorkspaceState = { ...state }
        if (!Array.isArray(payload.editMarkupDocuments)) {
            const existingPayload = await this.loadExistingPayload(projectKey)
            if (Array.isArray(existingPayload?.editMarkupDocuments)) {
                payload.editMarkupDocuments = existingPayload.editMarkupDocuments
            }
        }

        await firstValueFrom(this.http.put(`/api/firewire/storage/project-doc-library/${encodeURIComponent(projectKey)}`, {
            payload
        }))
    }

    createDefaultWorkspace(): ProjectDocLibraryWorkspaceState {
        return {
            files: [],
            editMarkupDocuments: []
        }
    }

    getFolderDefinitions(): ProjectDocLibraryFolderDefinition[] {
        return [...PROJECT_DOC_LIBRARY_FOLDERS]
    }

    private normalizeWorkspace(input: any): ProjectDocLibraryWorkspaceState {
        return {
            files: Array.isArray(input?.files) ? input.files : [],
            editMarkupDocuments: Array.isArray(input?.editMarkupDocuments) ? input.editMarkupDocuments : []
        }
    }

    private async loadExistingPayload(projectKey: string): Promise<any> {
        try {
            const response = await firstValueFrom(this.http.get<{ data?: { payload?: any } }>(`/api/firewire/storage/project-doc-library/${encodeURIComponent(projectKey)}`))
            return response?.data?.payload || {}
        } catch (error) {
            if (error instanceof HttpErrorResponse && error.status === 404) {
                return {}
            }

            throw error
        }
    }
}
