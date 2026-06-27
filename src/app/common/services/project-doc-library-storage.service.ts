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
    sourceFileName?: string
    name: string
    extension: string
    createdAt: string
    updatedAt: string
    floorplanFolderId?: string
    floorplanDesign?: ProjectFloorplanDesignState
    versions: ProjectDocLibraryFileVersionRecord[]
}

export interface ProjectDocLibraryDirectoryRecord {
    id: string
    name: string
    parentId?: string
    createdAt: string
    updatedAt: string
}

export interface ProjectFloorplanDesignAnnotation {
    id: string
    kind: 'symbol' | 'note' | 'sticky' | 'joint'
    xRatio: number
    yRatio: number
    bomRowId?: string
    symbolId?: string
    categoryKey?: string
    categoryName?: string
    partNumber?: string
    deviceName?: string
    partDescription?: string
    iconId?: string | null
    iconLabel?: string | null
    iconDataUrl?: string | null
    iconForegroundColor?: string | null
    materialCost?: number
    laborHours?: number
    customAttributes?: ProjectFloorplanSymbolAttribute[]
    symbol?: string
    label?: string
    text?: string
    color?: string
}

export interface ProjectFloorplanSymbolAttribute {
    name: string
    value?: string
    defaultValue?: string
    valueType?: string
}

export interface ProjectFloorplanDesignState {
    annotations: ProjectFloorplanDesignAnnotation[]
    circuits?: ProjectFloorplanCircuit[]
    calibration?: ProjectFloorplanCalibration
    rotationDegrees?: number
    symbolDisplayMode?: 'icon' | 'bubble'
    updatedAt?: string
}

export interface ProjectFloorplanCircuit {
    id: string
    name: string
    color: string
    lineStyle: 'solid' | 'dashed' | 'dotted'
    lineWeight?: number
    segments: ProjectFloorplanCircuitSegment[]
    closed: boolean
    layerId?: string
    createdAt?: string
    updatedAt?: string
}

export interface ProjectFloorplanCircuitSegment {
    id: string
    fromAnnotationId: string
    toAnnotationId: string
    color?: string
    lineStyle?: 'solid' | 'dashed' | 'dotted'
    lineWeight?: number
}

export interface ProjectFloorplanCalibration {
    pixelLength: number
    realWorldFeet: number
    feetPerPixel: number
    startXRatio: number
    startYRatio: number
    endXRatio: number
    endYRatio: number
    calibratedAt: string
}

export interface ProjectDocLibraryWorkspaceState {
    files: ProjectDocLibraryFileRecord[]
    directories?: ProjectDocLibraryDirectoryRecord[]
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

    async deleteFile(projectKey: string, fileId: string): Promise<ProjectDocLibraryWorkspaceState> {
        try {
            const response = await firstValueFrom(this.http.delete<{ data?: { payload?: any } }>(
                `/api/firewire/storage/project-doc-library/${encodeURIComponent(projectKey)}/files/${encodeURIComponent(fileId)}`
            ))
            return this.normalizeWorkspace(response?.data?.payload, projectKey)
        } catch (error) {
            throw new Error(this.getHttpErrorMessage(error, 'Document delete failed.'))
        }
    }

    createDefaultWorkspace(): ProjectDocLibraryWorkspaceState {
        return {
            files: [],
            directories: [],
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

    getDisplayNameFromSourceFileName(fileName: string): string {
        const normalized = String(fileName || '').trim()
        if (!normalized) {
            return 'Floorplan'
        }
        const slashIndex = Math.max(normalized.lastIndexOf('/'), normalized.lastIndexOf('\\'))
        const leafName = slashIndex >= 0 ? normalized.slice(slashIndex + 1) : normalized
        const dotIndex = leafName.lastIndexOf('.')
        return (dotIndex > 0 ? leafName.slice(0, dotIndex) : leafName).trim() || 'Floorplan'
    }

    getSourceFileName(file: ProjectDocLibraryFileRecord): string {
        return String(file.sourceFileName || file.versions?.[0]?.sourceFileName || file.versions?.[file.versions.length - 1]?.sourceFileName || file.name || '').trim()
    }

    hasSourceFileName(file: ProjectDocLibraryFileRecord, fileName: string): boolean {
        return this.normalizeFileName(this.getSourceFileName(file)) === this.normalizeFileName(fileName)
    }

    private normalizeWorkspace(input: any, projectKey: string): ProjectDocLibraryWorkspaceState {
        return {
            files: Array.isArray(input?.files) ? input.files.map((file: ProjectDocLibraryFileRecord) => {
                const storageKey = String(file.storageKey || projectKey || '').trim()
                const versions = (file.versions || []).map((version) => this.withContentUrl(storageKey || projectKey, file.id, version))
                const sourceFileName = String(file.sourceFileName || versions[0]?.sourceFileName || versions[versions.length - 1]?.sourceFileName || '').trim()
                const rawName = String(file.name || '').trim()
                const shouldPromoteFloorplanDisplayName = file.folderId === 'floorplans'
                    && sourceFileName
                    && this.normalizeFileName(rawName) === this.normalizeFileName(sourceFileName)
                const name = shouldPromoteFloorplanDisplayName
                    ? this.getDisplayNameFromSourceFileName(sourceFileName)
                    : rawName || this.getDisplayNameFromSourceFileName(sourceFileName)
                return {
                    ...file,
                    sourceFileName: sourceFileName || undefined,
                    name,
                    extension: String(file.extension || this.getFileExtension(sourceFileName || rawName)).toLowerCase(),
                    storageKey: storageKey || projectKey,
                    versions
                }
            }) : [],
            directories: Array.isArray(input?.directories) ? input.directories.map((directory: ProjectDocLibraryDirectoryRecord) => ({
                id: String(directory?.id || '').trim(),
                name: String(directory?.name || 'New Folder').trim() || 'New Folder',
                parentId: String(directory?.parentId || '').trim() || undefined,
                createdAt: String(directory?.createdAt || new Date().toISOString()),
                updatedAt: String(directory?.updatedAt || directory?.createdAt || new Date().toISOString())
            })).filter((directory: ProjectDocLibraryDirectoryRecord) => !!directory.id) : [],
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
            storageKey: String(file.storageKey || '').trim() || undefined,
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

    private getFileExtension(fileName: string): string {
        const normalized = String(fileName || '').trim()
        const dotIndex = normalized.lastIndexOf('.')
        if (dotIndex <= 0 || dotIndex === normalized.length - 1) {
            return ''
        }
        return normalized.slice(dotIndex + 1)
    }

    private normalizeFileName(fileName: string): string {
        return String(fileName || '').trim().toLowerCase()
    }
}
