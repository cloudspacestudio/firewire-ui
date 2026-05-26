import { Injectable, inject } from "@angular/core"
import { HttpClient, HttpErrorResponse } from "@angular/common/http"
import { firstValueFrom } from "rxjs"

export interface ProjectDocLibraryFolderDefinition {
    id: string
    label: string
    parentId?: string
    documentKind?: ProjectDocLibraryDocumentKind
    hidden?: boolean
}

export type ProjectDocLibraryDocumentKind = 'drawing'

export interface ProjectDocLibraryFileVersionRecord {
    id: string
    versionNumber: number
    uploadedAt: string
    uploadedBy: string
    sourceFileName: string
    sizeBytes: number
    mimeType: string
    lastModified: number
    dataUrl?: string
    thumbnailDataUrl?: string
    blobName?: string
    blobContainerName?: string
    contentUrl?: string
}

export interface ProjectDocLibraryFileRecord {
    id: string
    folderId: string
    documentKind?: ProjectDocLibraryDocumentKind
    storageKey?: string
    name: string
    extension: string
    createdAt: string
    updatedAt: string
    floorplanDesign?: ProjectFloorplanDesignState
    versions: ProjectDocLibraryFileVersionRecord[]
}

export interface ProjectFloorplanDesignAnnotation {
    id: string
    kind: 'symbol' | 'note' | 'sticky'
    xRatio: number
    yRatio: number
    symbol?: string
    label?: string
    text?: string
    color?: string
}

export interface ProjectFloorplanDesignState {
    annotations: ProjectFloorplanDesignAnnotation[]
    updatedAt?: string
}

export interface ProjectDocLibraryWorkspaceState {
    files: ProjectDocLibraryFileRecord[]
    editMarkupDocuments?: any[]
}

export const PROJECT_DOC_LIBRARY_FOLDERS: ProjectDocLibraryFolderDefinition[] = [
    { id: 'floorplans', label: 'FLOORPLANS', documentKind: 'drawing', hidden: true },
    { id: 'cad', label: 'CAD', documentKind: 'drawing' },
    { id: 'om', label: 'O&M' },
    { id: 'proj-mgmt', label: 'PROJ MGMT' },
    { id: 'sales', label: 'SALES' },
    { id: 'submittal', label: 'SUBMITTAL' },
    { id: 'cad/customer-drawings', label: 'CUSTOMER DRAWINGS', parentId: 'cad', documentKind: 'drawing' },
    { id: 'proj-mgmt/change-orders', label: 'CHANGE ORDERS', parentId: 'proj-mgmt' },
    { id: 'proj-mgmt/inspection-reports', label: 'INSPECTION REPORTS', parentId: 'proj-mgmt' },
    { id: 'proj-mgmt/parts-ordered', label: 'PARTS ORDERED', parentId: 'proj-mgmt' },
    { id: 'sales/booking', label: 'BOOKING', parentId: 'sales' },
    { id: 'sales/customer-drawings', label: 'CUSTOMER DRAWINGS', parentId: 'sales', documentKind: 'drawing' },
    { id: 'submittal/ahj', label: 'AHJ', parentId: 'submittal' },
    { id: 'submittal/response-templates', label: 'RESPONSE TEMPLATES', parentId: 'submittal' }
]

@Injectable({
    providedIn: 'root'
})
export class ProjectDocLibraryStorageService {
    private readonly http = inject(HttpClient)

    async loadWorkspace(projectKey: string): Promise<ProjectDocLibraryWorkspaceState> {
        const response = await firstValueFrom(this.http.get<{ data?: { payload?: any } }>(`/api/firewire/storage/project-doc-library/${encodeURIComponent(projectKey)}`))
        return this.normalizeWorkspace(response?.data?.payload, projectKey)
    }

    async saveWorkspace(projectKey: string, state: ProjectDocLibraryWorkspaceState): Promise<void> {
        const payload: ProjectDocLibraryWorkspaceState = {
            ...state,
            files: this.stripPhysicalContent(state.files || [])
        }
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

    async uploadFileVersion(projectKey: string, file: File, params: {
        fileId: string
        versionId: string
        folderId: string
        versionNumber: number
        lastModified: number
    }): Promise<ProjectDocLibraryFileVersionRecord> {
        const body = new FormData()
        body.append('file', file, file.name)
        body.append('fileId', params.fileId)
        body.append('versionId', params.versionId)
        body.append('folderId', params.folderId)
        body.append('versionNumber', String(params.versionNumber))
        body.append('lastModified', String(params.lastModified))

        try {
            const response = await firstValueFrom(this.http.post<{ data: ProjectDocLibraryFileVersionRecord }>(
                `/api/firewire/storage/project-doc-library/${encodeURIComponent(projectKey)}/files`,
                body
            ))
            return this.withContentUrl(projectKey, params.fileId, response.data)
        } catch (error) {
            throw new Error(this.getHttpErrorMessage(error, 'Document upload failed.'))
        }
    }

    getVersionContentUrl(projectKey: string, fileId: string, versionId: string): string {
        return `/api/firewire/storage/project-doc-library/${encodeURIComponent(projectKey)}/files/${encodeURIComponent(fileId)}/versions/${encodeURIComponent(versionId)}/content`
    }

    async downloadVersion(projectKey: string, fileId: string, version: ProjectDocLibraryFileVersionRecord): Promise<Blob> {
        try {
            const response = await firstValueFrom(this.http.get(
                this.getVersionContentUrl(projectKey, fileId, version.id),
                { responseType: 'blob' }
            ))
            return response
        } catch (error) {
            throw new Error(this.getHttpErrorMessage(error, 'Document download failed.'))
        }
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

    getRootFolderDefinitions(): ProjectDocLibraryFolderDefinition[] {
        return PROJECT_DOC_LIBRARY_FOLDERS
            .filter((folder) => !folder.parentId && !folder.hidden)
            .map((folder) => ({ ...folder }))
    }

    getSelectableFolderDefinitions(): ProjectDocLibraryFolderDefinition[] {
        return PROJECT_DOC_LIBRARY_FOLDERS
            .filter((folder) => !folder.hidden)
            .map((folder) => ({ ...folder }))
    }

    getFolderPathLabel(folderId: string): string {
        const folder = PROJECT_DOC_LIBRARY_FOLDERS.find((item) => item.id === folderId)
        if (!folder) {
            return 'Unfiled'
        }

        if (!folder.parentId) {
            return folder.label
        }

        const parent = PROJECT_DOC_LIBRARY_FOLDERS.find((item) => item.id === folder.parentId)
        return parent ? `${parent.label} / ${folder.label}` : folder.label
    }

    getRootFolderId(folderId: string): string {
        const folder = PROJECT_DOC_LIBRARY_FOLDERS.find((item) => item.id === folderId)
        return folder?.parentId || folder?.id || folderId
    }

    isInFolderBranch(file: ProjectDocLibraryFileRecord, folderId: string): boolean {
        return file.folderId === folderId || this.getRootFolderId(file.folderId) === folderId
    }

    getDocumentKindForFolder(folderId: string): ProjectDocLibraryDocumentKind | undefined {
        const folder = PROJECT_DOC_LIBRARY_FOLDERS.find((item) => item.id === folderId)
        const parent = folder?.parentId
            ? PROJECT_DOC_LIBRARY_FOLDERS.find((item) => item.id === folder.parentId)
            : undefined
        return folder?.documentKind || parent?.documentKind
    }

    identifyDocumentKind(file: Pick<ProjectDocLibraryFileRecord, 'folderId' | 'name' | 'documentKind'>): ProjectDocLibraryDocumentKind | undefined {
        if (file.documentKind) {
            return file.documentKind
        }

        const folderKind = this.getDocumentKindForFolder(file.folderId)
        if (folderKind) {
            return folderKind
        }

        const normalizedName = String(file.name || '').toLowerCase()
        return /\b(floor\s*plan|floorplan|drawing|plan\s*set|sheet)\b/.test(normalizedName) ? 'drawing' : undefined
    }

    isDrawing(file: Pick<ProjectDocLibraryFileRecord, 'folderId' | 'name' | 'documentKind'>): boolean {
        return this.identifyDocumentKind(file) === 'drawing'
    }

    private normalizeWorkspace(input: any, projectKey: string): ProjectDocLibraryWorkspaceState {
        return {
            files: Array.isArray(input?.files) ? input.files.map((file: ProjectDocLibraryFileRecord) => ({
                ...file,
                storageKey: file.storageKey || projectKey,
                versions: (file.versions || []).map((version) => this.withContentUrl(projectKey, file.id, version))
            })) : [],
            editMarkupDocuments: Array.isArray(input?.editMarkupDocuments) ? input.editMarkupDocuments : []
        }
    }

    private withContentUrl(projectKey: string, fileId: string, version: ProjectDocLibraryFileVersionRecord): ProjectDocLibraryFileVersionRecord {
        if (!version) {
            return version
        }
        if (version.contentUrl || version.dataUrl) {
            return version
        }
        return {
            ...version,
            contentUrl: this.getVersionContentUrl(projectKey, fileId, version.id)
        }
    }

    private stripPhysicalContent(files: ProjectDocLibraryFileRecord[]): ProjectDocLibraryFileRecord[] {
        return files.map((file) => ({
            ...file,
            storageKey: undefined,
            versions: (file.versions || []).map((version) => {
                const { dataUrl, contentUrl, ...metadata } = version
                return version.blobName ? metadata : { ...metadata, dataUrl }
            })
        }))
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

    private getHttpErrorMessage(error: unknown, fallback: string): string {
        if (error instanceof HttpErrorResponse) {
            const serverMessage = typeof error.error === 'string'
                ? error.error
                : error.error?.message
            return serverMessage || error.message || fallback
        }

        return error instanceof Error ? error.message : fallback
    }
}
