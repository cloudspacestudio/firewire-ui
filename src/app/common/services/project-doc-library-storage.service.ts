import { Injectable, inject } from "@angular/core"
import { HttpClient } from "@angular/common/http"
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
        await firstValueFrom(this.http.put(`/api/firewire/storage/project-doc-library/${encodeURIComponent(projectKey)}`, {
            payload: state
        }))
    }

    createDefaultWorkspace(): ProjectDocLibraryWorkspaceState {
        return {
            files: []
        }
    }

    getFolderDefinitions(): ProjectDocLibraryFolderDefinition[] {
        return [...PROJECT_DOC_LIBRARY_FOLDERS]
    }

    private normalizeWorkspace(input: any): ProjectDocLibraryWorkspaceState {
        return {
            files: Array.isArray(input?.files) ? input.files : []
        }
    }
}
