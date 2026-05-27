import { CommonModule } from '@angular/common'
import { Component, OnInit, inject } from '@angular/core'
import { MatButtonModule } from '@angular/material/button'
import { MatIconModule } from '@angular/material/icon'

import { PageToolbar } from '../../common/components/page-toolbar'
import { NavToolbar } from '../../common/components/nav-toolbar'
import {
    TrainAiFileRecord,
    TrainAiFileVersionRecord,
    TrainAiStorageService
} from '../../common/services/train-ai-storage.service'
import { ProjectFloorplanDesignState } from '../../common/services/project-doc-library-storage.service'
import { FloorplanDesignerComponent, FloorplanDesignerSaveEvent } from './floorplan-designer.component'

type DesignerFileRecord = TrainAiFileRecord & {
    floorplanDesign?: ProjectFloorplanDesignState
}

@Component({
    standalone: true,
    selector: 'design-floorplan-designer-page',
    imports: [CommonModule, MatButtonModule, MatIconModule, PageToolbar, NavToolbar, FloorplanDesignerComponent],
    templateUrl: './design-floorplan-designer.page.html',
    styleUrls: ['./design-floorplan-designer.page.scss']
})
export class DesignFloorplanDesignerPage implements OnInit {
    private readonly storage = inject(TrainAiStorageService)

    navItems = NavToolbar.DesignNavItems
    files: DesignerFileRecord[] = []
    selectedFileId = ''
    pageWorking = true
    statusText = ''

    async ngOnInit(): Promise<void> {
        this.pageWorking = true
        const workspace = await this.storage.loadWorkspace()
        this.files = (workspace.files || []) as DesignerFileRecord[]
        this.selectedFileId = this.files[0]?.id || ''
        this.pageWorking = false
    }

    get selectedFile(): DesignerFileRecord | undefined {
        return this.files.find((file) => file.id === this.selectedFileId)
    }

    get selectedVersion(): TrainAiFileVersionRecord | undefined {
        const file = this.selectedFile
        return file?.versions?.[file.versions.length - 1]
    }

    get selectedSourceUrl(): string {
        return this.selectedVersion?.dataUrl || ''
    }

    get selectedMimeType(): string {
        return this.selectedVersion?.mimeType || ''
    }

    canUseFile(file: DesignerFileRecord): boolean {
        const version = file.versions?.[file.versions.length - 1]
        const mimeType = String(version?.mimeType || '').toLowerCase()
        return mimeType.startsWith('image/') || mimeType === 'application/pdf'
    }

    selectFile(file: DesignerFileRecord): void {
        this.selectedFileId = file.id
    }

    triggerUpload(input: HTMLInputElement): void {
        input.click()
    }

    async onFileInputChanged(event: Event): Promise<void> {
        const input = event.target as HTMLInputElement
        const files = Array.from(input.files || [])
        if (files.length <= 0) {
            return
        }

        this.statusText = 'Uploading floorplans...'
        const now = new Date().toISOString()
        for (const file of files) {
            const dataUrl = await this.readFileAsDataUrl(file)
            const record: DesignerFileRecord = {
                id: this.createId(),
                folderId: 'root',
                name: file.name,
                extension: this.getFileExtension(file.name),
                createdAt: now,
                updatedAt: now,
                versions: [{
                    id: this.createId(),
                    versionNumber: 1,
                    uploadedAt: now,
                    uploadedBy: 'system',
                    sourceFileName: file.name,
                    sizeBytes: file.size,
                    mimeType: file.type || this.getMimeTypeFromName(file.name),
                    lastModified: file.lastModified,
                    dataUrl
                }]
            }
            this.files = [record, ...this.files]
            this.selectedFileId = record.id
        }

        input.value = ''
        await this.persistWorkspace('Floorplan uploaded.')
    }

    async saveDesign(event: FloorplanDesignerSaveEvent): Promise<void> {
        const file = this.selectedFile
        if (!file) {
            return
        }
        file.floorplanDesign = event.design
        file.updatedAt = new Date().toISOString()
        await this.persistWorkspace(`Saved design markup for ${file.name}.`)
    }

    private async persistWorkspace(message: string): Promise<void> {
        const workspace = await this.storage.loadWorkspace()
        await this.storage.saveWorkspace({
            ...workspace,
            files: this.files
        })
        this.statusText = message
    }

    private readFileAsDataUrl(file: File): Promise<string> {
        return new Promise((resolve, reject) => {
            const reader = new FileReader()
            reader.onload = () => resolve(String(reader.result || ''))
            reader.onerror = () => reject(reader.error || new Error('Unable to read file.'))
            reader.readAsDataURL(file)
        })
    }

    private getFileExtension(name: string): string {
        const match = /\.([^.]+)$/.exec(name)
        return match ? match[1].toLowerCase() : ''
    }

    private getMimeTypeFromName(name: string): string {
        return this.getFileExtension(name) === 'pdf' ? 'application/pdf' : 'application/octet-stream'
    }

    private createId(): string {
        const cryptoApi = globalThis.crypto as Crypto | undefined
        return cryptoApi?.randomUUID
            ? cryptoApi.randomUUID()
            : `floorplan-${Date.now()}-${Math.random().toString(16).slice(2, 10)}`
    }
}
