import { Injectable, inject } from "@angular/core"
import { HttpClient } from "@angular/common/http"
import { firstValueFrom } from "rxjs"

export interface TrainAiFolderRecord {
    id: string
    parentFolderId: string | null
    name: string
    createdAt: string
    updatedAt: string
}

export interface TrainAiFileVersionRecord {
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

export interface TrainAiFileRecord {
    id: string
    folderId: string
    name: string
    extension: string
    createdAt: string
    updatedAt: string
    versions: TrainAiFileVersionRecord[]
}

export interface TrainAiImageBoxRecord {
    id: string
    x: number
    y: number
    width: number
    height: number
    label?: string
    createdAt: string
}

export interface TrainAiDeviceTagRecord {
    id: string
    deviceId: string
    deviceCode: string
    deviceName: string
    color: string
    xRatio: number
    yRatio: number
    createdAt: string
    updatedAt: string
}

export interface TrainAiImageAnnotationRecord {
    fileId: string
    boxes?: TrainAiImageBoxRecord[]
    deviceTags?: TrainAiDeviceTagRecord[]
    updatedAt: string
}

export interface TrainAiWorkspaceState {
    folders: TrainAiFolderRecord[]
    files: TrainAiFileRecord[]
    annotations: TrainAiImageAnnotationRecord[]
}

@Injectable({
    providedIn: 'root'
})
export class TrainAiStorageService {
    private readonly http = inject(HttpClient)

    async loadWorkspace(): Promise<TrainAiWorkspaceState> {
        const response = await firstValueFrom(this.http.get<{ data?: { payload?: any } }>('/api/firewire/storage/design-train-ai'))
        return this.normalizeWorkspace(response?.data?.payload)
    }

    async saveWorkspace(state: TrainAiWorkspaceState): Promise<void> {
        await firstValueFrom(this.http.put('/api/firewire/storage/design-train-ai', {
            payload: state
        }))
    }

    createDefaultWorkspace(): TrainAiWorkspaceState {
        const timestamp = new Date().toISOString()
        return {
            folders: [
                {
                    id: 'root',
                    parentFolderId: null,
                    name: 'Train AI',
                    createdAt: timestamp,
                    updatedAt: timestamp
                }
            ],
            files: [],
            annotations: []
        }
    }

    private normalizeWorkspace(input: any): TrainAiWorkspaceState {
        const workspace = {
            folders: Array.isArray(input?.folders) ? input.folders : [],
            files: Array.isArray(input?.files) ? input.files : [],
            annotations: Array.isArray(input?.annotations) ? input.annotations : []
        } as TrainAiWorkspaceState

        const hasRoot = workspace.folders.some((folder) => folder.id === 'root')
        if (!hasRoot) {
            const now = new Date().toISOString()
            workspace.folders.unshift({
                id: 'root',
                parentFolderId: null,
                name: 'Train AI',
                createdAt: now,
                updatedAt: now
            })
        }

        return workspace
    }
}
