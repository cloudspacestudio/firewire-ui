import { Injectable } from "@angular/core"

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
    private readonly dbName = 'firewire-train-ai'
    private readonly dbVersion = 1
    private readonly storeName = 'workspace'
    private readonly workspaceKey = 'train-ai-workspace'
    private dbPromise?: Promise<IDBDatabase>

    async loadWorkspace(): Promise<TrainAiWorkspaceState> {
        const db = await this.getDb()
        if (!db) {
            return this.createDefaultWorkspace()
        }

        const tx = db.transaction(this.storeName, 'readonly')
        const store = tx.objectStore(this.storeName)
        const request = store.get(this.workspaceKey)
        const result = await this.requestToPromise<any>(request)

        if (!result?.value) {
            return this.createDefaultWorkspace()
        }

        return this.normalizeWorkspace(result.value)
    }

    async saveWorkspace(state: TrainAiWorkspaceState): Promise<void> {
        const db = await this.getDb()
        if (!db) {
            return
        }

        const tx = db.transaction(this.storeName, 'readwrite')
        const store = tx.objectStore(this.storeName)
        store.put({
            key: this.workspaceKey,
            value: state
        })

        await this.transactionDone(tx)
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

    private async getDb(): Promise<IDBDatabase | null> {
        if (typeof indexedDB === 'undefined') {
            return null
        }

        if (!this.dbPromise) {
            this.dbPromise = new Promise((resolve, reject) => {
                const request = indexedDB.open(this.dbName, this.dbVersion)

                request.onupgradeneeded = () => {
                    const db = request.result
                    if (!db.objectStoreNames.contains(this.storeName)) {
                        db.createObjectStore(this.storeName, { keyPath: 'key' })
                    }
                }

                request.onsuccess = () => resolve(request.result)
                request.onerror = () => reject(request.error)
            })
        }

        return this.dbPromise
    }

    private requestToPromise<T>(request: IDBRequest<T>): Promise<T> {
        return new Promise((resolve, reject) => {
            request.onsuccess = () => resolve(request.result)
            request.onerror = () => reject(request.error)
        })
    }

    private transactionDone(transaction: IDBTransaction): Promise<void> {
        return new Promise((resolve, reject) => {
            transaction.oncomplete = () => resolve()
            transaction.onerror = () => reject(transaction.error)
            transaction.onabort = () => reject(transaction.error)
        })
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
