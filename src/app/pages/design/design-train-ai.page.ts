import { Component, OnInit, inject } from "@angular/core"
import { CommonModule } from "@angular/common"
import { FormsModule } from "@angular/forms"
import { firstValueFrom } from "rxjs"

import { MatButtonModule } from "@angular/material/button"
import {
    MAT_DIALOG_DATA,
    MatDialog,
    MatDialogActions,
    MatDialogClose,
    MatDialogContent,
    MatDialogRef,
    MatDialogTitle
} from "@angular/material/dialog"
import { MatFormFieldModule } from "@angular/material/form-field"
import { MatIconModule } from "@angular/material/icon"
import { MatInputModule } from "@angular/material/input"

import { PageToolbar } from "../../common/components/page-toolbar"
import { NavToolbar } from "../../common/components/nav-toolbar"
import {
    TrainAiDeviceTagRecord,
    TrainAiFileRecord,
    TrainAiFileVersionRecord,
    TrainAiFolderRecord,
    TrainAiImageAnnotationRecord,
    TrainAiStorageService
} from "../../common/services/train-ai-storage.service"

interface OverwriteDialogData {
    fileName: string
    nextVersionNumber: number
}

interface DeleteFileDialogData {
    fileName: string
    versionCount: number
}

interface TagDevicesDialogData {
    fileId: string
    fileName: string
    imageDataUrl: string
    existingTags: TrainAiDeviceTagRecord[]
}

interface TagDevicesDialogResult {
    tags: TrainAiDeviceTagRecord[]
}

interface DeviceOption {
    id: string
    code: string
    name: string
    color: string
}

const DEVICE_OPTIONS: DeviceOption[] = [
    { id: 'hs-24mcw', code: 'HS', name: 'Horn Strobe Wall Mount', color: '#ff8f3d' },
    { id: 'sd505-aps', code: 'SD', name: 'Addressable Smoke Detector', color: '#58e4ff' },
    { id: 'ms-7caf', code: 'PS', name: 'Manual Pull Station', color: '#84ffbe' },
    { id: 'n16x', code: 'FACP', name: 'Fire Alarm Control Panel', color: '#ffd166' },
    { id: 'rps-1000', code: 'RPS', name: 'Remote Power Supply', color: '#c084fc' },
    { id: 'cell-comm', code: 'COMM', name: 'Cellular Communicator', color: '#ff6b9d' }
]

@Component({
    standalone: true,
    selector: 'design-train-ai-page',
    imports: [
        CommonModule,
        FormsModule,
        MatButtonModule,
        MatFormFieldModule,
        MatIconModule,
        MatInputModule,
        PageToolbar,
        NavToolbar
    ],
    templateUrl: './design-train-ai.page.html',
    styleUrls: ['./design-train-ai.page.scss']
})
export class DesignTrainAiPage implements OnInit {
    private readonly storage = inject(TrainAiStorageService)
    private readonly dialog = inject(MatDialog)

    navItems = NavToolbar.DesignNavItems
    folders: TrainAiFolderRecord[] = []
    files: TrainAiFileRecord[] = []
    annotations: TrainAiImageAnnotationRecord[] = []
    currentFolderId = 'root'
    selectedFileId: string | null = null
    pageWorking = true
    statusText = ''

    async ngOnInit(): Promise<void> {
        this.pageWorking = true
        const workspace = await this.storage.loadWorkspace()
        this.folders = [...workspace.folders]
        this.files = [...workspace.files]
        this.annotations = [...(workspace.annotations || [])]
        this.currentFolderId = this.folders.some((folder) => folder.id === 'root') ? 'root' : this.folders[0]?.id || 'root'
        this.pageWorking = false
    }

    getCurrentFolder(): TrainAiFolderRecord | undefined {
        return this.folders.find((folder) => folder.id === this.currentFolderId)
    }

    getCurrentPath(): TrainAiFolderRecord[] {
        const path: TrainAiFolderRecord[] = []
        let cursor: TrainAiFolderRecord | undefined = this.getCurrentFolder()
        while (cursor) {
            path.unshift(cursor)
            if (!cursor.parentFolderId) {
                break
            }
            cursor = this.folders.find((folder) => folder.id === cursor?.parentFolderId)
        }
        return path
    }

    getChildFolders(): TrainAiFolderRecord[] {
        return this.folders
            .filter((folder) => folder.parentFolderId === this.currentFolderId)
            .sort((left, right) => left.name.localeCompare(right.name))
    }

    getChildFiles(): TrainAiFileRecord[] {
        return this.files
            .filter((file) => file.folderId === this.currentFolderId)
            .sort((left, right) => left.name.localeCompare(right.name))
    }

    getSelectedFile(): TrainAiFileRecord | undefined {
        if (!this.selectedFileId) {
            return undefined
        }
        return this.files.find((file) => file.id === this.selectedFileId)
    }

    getLatestVersion(file: TrainAiFileRecord): TrainAiFileVersionRecord | undefined {
        if (!file.versions || file.versions.length <= 0) {
            return undefined
        }
        return file.versions[file.versions.length - 1]
    }

    canTagDevices(file: TrainAiFileRecord): boolean {
        const latest = this.getLatestVersion(file)
        const mimeType = (latest?.mimeType || '').toLowerCase()
        return mimeType.startsWith('image/')
    }

    getReadableSize(sizeBytes: number): string {
        if (sizeBytes >= 1024 * 1024 * 1024) {
            return `${(sizeBytes / (1024 * 1024 * 1024)).toFixed(2)} GB`
        }
        if (sizeBytes >= 1024 * 1024) {
            return `${(sizeBytes / (1024 * 1024)).toFixed(2)} MB`
        }
        if (sizeBytes >= 1024) {
            return `${Math.round(sizeBytes / 1024)} KB`
        }
        return `${sizeBytes} B`
    }

    isSelectedFile(file: TrainAiFileRecord): boolean {
        return file.id === this.selectedFileId
    }

    getDeviceTagCount(fileId: string): number {
        const annotation = this.annotations.find((item) => item.fileId === fileId)
        return annotation?.deviceTags?.length || 0
    }

    async createFolder(): Promise<void> {
        const dialogRef = this.dialog.open(TrainAiCreateFolderDialog, {
            panelClass: 'fw-medium-dialog-pane'
        })
        const folderName = await firstValueFrom(dialogRef.afterClosed())
        if (!folderName) {
            return
        }

        const duplicate = this.getChildFolders().find((folder) => folder.name.toLowerCase() === String(folderName).toLowerCase())
        if (duplicate) {
            this.statusText = `Folder "${folderName}" already exists in this location.`
            return
        }

        const now = new Date().toISOString()
        this.folders.push({
            id: this.createId(),
            parentFolderId: this.currentFolderId,
            name: String(folderName).trim(),
            createdAt: now,
            updatedAt: now
        })
        await this.persistWorkspace('Folder created.')
    }

    openFolder(folder: TrainAiFolderRecord): void {
        this.currentFolderId = folder.id
        this.selectedFileId = null
    }

    openPathFolder(folder: TrainAiFolderRecord): void {
        this.currentFolderId = folder.id
        this.selectedFileId = null
    }

    triggerUpload(fileInput: HTMLInputElement): void {
        fileInput.click()
    }

    async onFileInputChanged(event: Event): Promise<void> {
        const input = event.target as HTMLInputElement
        const files = Array.from(input.files || [])
        if (files.length <= 0) {
            return
        }

        this.statusText = 'Uploading files...'
        for (const file of files) {
            await this.uploadSingleFile(file)
        }

        input.value = ''
        await this.persistWorkspace('Upload complete.')
    }

    selectFile(file: TrainAiFileRecord): void {
        this.selectedFileId = file.id
    }

    async downloadFile(file: TrainAiFileRecord, version?: TrainAiFileVersionRecord): Promise<void> {
        const targetVersion = version || this.getLatestVersion(file)
        if (!targetVersion) {
            return
        }

        const blob = this.dataUrlToBlob(targetVersion.dataUrl)
        const objectUrl = URL.createObjectURL(blob)
        const anchor = document.createElement('a')
        anchor.href = objectUrl
        anchor.download = file.name
        anchor.click()
        URL.revokeObjectURL(objectUrl)
    }

    async confirmDeleteFile(file: TrainAiFileRecord, event?: Event): Promise<void> {
        event?.stopPropagation()

        const dialogRef = this.dialog.open(TrainAiDeleteFileDialog, {
            panelClass: 'fw-medium-dialog-pane',
            data: {
                fileName: file.name,
                versionCount: file.versions?.length || 0
            } as DeleteFileDialogData
        })
        const shouldDelete = await firstValueFrom(dialogRef.afterClosed())
        if (!shouldDelete) {
            return
        }

        this.files = this.files.filter((item) => item.id !== file.id)
        this.annotations = this.annotations.filter((item) => item.fileId !== file.id)
        if (this.selectedFileId === file.id) {
            this.selectedFileId = null
        }
        await this.persistWorkspace(`Deleted ${file.name}.`)
    }

    async openTagDevices(file: TrainAiFileRecord, event?: Event): Promise<void> {
        event?.stopPropagation()
        const latest = this.getLatestVersion(file)
        if (!latest?.dataUrl) {
            this.statusText = 'The selected file is missing image data.'
            return
        }
        const mimeType = (latest.mimeType || '').toLowerCase()
        if (!mimeType.startsWith('image/')) {
            this.statusText = 'Tag Devices is available for image files only.'
            return
        }

        const existingAnnotation = this.annotations.find((item) => item.fileId === file.id)
        const existingTags = existingAnnotation?.deviceTags || []

        const dialogRef = this.dialog.open(TagDevicesDialog, {
            panelClass: 'fw-fullscreen-dialog-pane',
            maxWidth: '100vw',
            data: {
                fileId: file.id,
                fileName: file.name,
                imageDataUrl: latest.dataUrl,
                existingTags
            } as TagDevicesDialogData
        })

        const result = await firstValueFrom(dialogRef.afterClosed() as any) as TagDevicesDialogResult | undefined
        if (!result) {
            return
        }

        const now = new Date().toISOString()
        const annotation = this.annotations.find((item) => item.fileId === file.id)
        if (annotation) {
            annotation.deviceTags = [...result.tags]
            annotation.updatedAt = now
        } else {
            this.annotations.push({
                fileId: file.id,
                deviceTags: [...result.tags],
                updatedAt: now
            })
        }

        await this.persistWorkspace(`Saved ${result.tags.length} device tag${result.tags.length === 1 ? '' : 's'} for ${file.name}.`)
    }

    private async uploadSingleFile(file: File): Promise<void> {
        const duplicate = this.getChildFiles()
            .find((item) => item.name.toLowerCase() === file.name.toLowerCase())
        const dataUrl = await this.readFileAsDataUrl(file)
        const now = new Date().toISOString()

        if (duplicate) {
            const dialogRef = this.dialog.open(TrainAiOverwriteDialog, {
                panelClass: 'fw-medium-dialog-pane',
                data: {
                    fileName: duplicate.name,
                    nextVersionNumber: duplicate.versions.length + 1
                } as OverwriteDialogData
            })
            const shouldOverwrite = await firstValueFrom(dialogRef.afterClosed())
            if (!shouldOverwrite) {
                this.statusText = `Skipped "${file.name}".`
                return
            }

            duplicate.versions.push({
                id: this.createId(),
                versionNumber: duplicate.versions.length + 1,
                uploadedAt: now,
                uploadedBy: 'Current User',
                sourceFileName: file.name,
                sizeBytes: file.size,
                mimeType: file.type || 'application/octet-stream',
                lastModified: file.lastModified,
                dataUrl
            })
            duplicate.updatedAt = now
            this.selectedFileId = duplicate.id
            this.statusText = `Updated ${duplicate.name} to version ${duplicate.versions.length}.`
            return
        }

        const extension = this.getExtension(file.name)
        const newRecord: TrainAiFileRecord = {
            id: this.createId(),
            folderId: this.currentFolderId,
            name: file.name,
            extension,
            createdAt: now,
            updatedAt: now,
            versions: [
                {
                    id: this.createId(),
                    versionNumber: 1,
                    uploadedAt: now,
                    uploadedBy: 'Current User',
                    sourceFileName: file.name,
                    sizeBytes: file.size,
                    mimeType: file.type || 'application/octet-stream',
                    lastModified: file.lastModified,
                    dataUrl
                }
            ]
        }

        this.files.push(newRecord)
        this.selectedFileId = newRecord.id
    }

    private async persistWorkspace(statusMessage?: string): Promise<void> {
        await this.storage.saveWorkspace({
            folders: this.folders,
            files: this.files,
            annotations: this.annotations
        })
        if (statusMessage) {
            this.statusText = statusMessage
        }
    }

    private getExtension(fileName: string): string {
        const dotIndex = fileName.lastIndexOf('.')
        if (dotIndex <= 0 || dotIndex === fileName.length - 1) {
            return ''
        }
        return fileName.slice(dotIndex + 1).toLowerCase()
    }

    private readFileAsDataUrl(file: File): Promise<string> {
        return new Promise((resolve, reject) => {
            const reader = new FileReader()
            reader.onload = () => resolve(String(reader.result || ''))
            reader.onerror = () => reject(reader.error)
            reader.readAsDataURL(file)
        })
    }

    private dataUrlToBlob(dataUrl: string): Blob {
        const commaIndex = dataUrl.indexOf(',')
        const header = commaIndex >= 0 ? dataUrl.slice(0, commaIndex) : ''
        const base64 = commaIndex >= 0 ? dataUrl.slice(commaIndex + 1) : dataUrl
        const mimeTypeMatch = header.match(/data:(.*?);base64/)
        const mimeType = mimeTypeMatch ? mimeTypeMatch[1] : 'application/octet-stream'
        const binary = atob(base64)
        const bytes = new Uint8Array(binary.length)
        for (let i = 0; i < binary.length; i += 1) {
            bytes[i] = binary.charCodeAt(i)
        }
        return new Blob([bytes], { type: mimeType })
    }

    private createId(): string {
        if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
            return crypto.randomUUID()
        }
        return `${Date.now()}-${Math.random().toString(16).slice(2)}`
    }
}

@Component({
    standalone: true,
    selector: 'tag-devices-dialog',
    imports: [CommonModule, FormsModule, MatButtonModule, MatIconModule, MatDialogTitle, MatDialogContent, MatDialogActions, MatDialogClose],
    template: `
        <div mat-dialog-title class="tag-devices__titlebar">
            <div>
                <div class="tag-devices__eyebrow">Tag Devices</div>
                <div class="tag-devices__title">{{data.fileName}}</div>
                <div class="tag-devices__hint">Select a device on the right, then click image to drop a tag.</div>
            </div>
        </div>
        <mat-dialog-content class="tag-devices__content">
            <div class="tag-devices__layout">
                <div
                    class="tag-devices__stage"
                    [class.is-pan-mode]="panMode"
                    [class.is-panning]="isPanning"
                    (mousedown)="onPanStart($event)"
                    (mousemove)="onPanMove($event)"
                    (mouseup)="onPanEnd()"
                    (mouseleave)="onPanEnd()">
                    <div
                        class="tag-devices__surface"
                        [ngStyle]="getSurfaceStyle()"
                        (click)="onStageClick($event)">
                        <img #stageImage [src]="data.imageDataUrl" alt="Target image for tagging" />
                        <button
                            *ngFor="let tag of getVisibleTags(); let idx = index"
                            type="button"
                            class="tag-devices__tag"
                            [class.is-selected]="selectedTagId === tag.id"
                            [ngStyle]="getTagStyle(tag)"
                            (click)="selectTag(tag, $event)">
                            <span class="tag-devices__dot" [style.background]="tag.color"></span>
                            <span class="tag-devices__code">{{tag.deviceCode}}</span>
                        </button>
                    </div>
                </div>
                <aside class="tag-devices__rail">
                    <div class="tag-devices__rail-title">Devices</div>
                    <div class="tag-devices__view-controls">
                        <button mat-stroked-button type="button" (click)="zoomOut()">Zoom -</button>
                        <button mat-stroked-button type="button" (click)="zoomIn()">Zoom +</button>
                        <button mat-stroked-button type="button" (click)="resetView()">Reset</button>
                        <button mat-stroked-button type="button" (click)="togglePanMode()" [class.is-active]="panMode">
                            {{panMode ? 'Pan: On' : 'Pan: Off'}}
                        </button>
                        <div class="tag-devices__zoom-readout">Zoom {{zoomLevel.toFixed(2)}}x</div>
                    </div>
                    <div
                        class="tag-devices__device-row"
                        *ngFor="let device of devices"
                        [class.is-active]="activeDeviceId === device.id"
                        role="button"
                        tabindex="0"
                        (click)="setActiveDevice(device)"
                        (keyup.enter)="setActiveDevice(device)">
                        <span class="tag-devices__device-chip" [style.background]="device.color">{{device.code}}</span>
                        <span class="tag-devices__device-name">{{device.name}}</span>
                        <span class="tag-devices__device-count">{{getDeviceTagCountByDevice(device.id)}}</span>
                        <div class="tag-devices__device-row-actions" *ngIf="activeDeviceId === device.id">
                            <button mat-stroked-button type="button" (click)="toggleDeviceVisibility(device, $event)">
                                {{isDeviceHidden(device.id) ? 'Show' : 'Hide'}}
                            </button>
                            <button
                                mat-stroked-button
                                type="button"
                                (click)="clearDeviceTags(device, $event)"
                                [disabled]="getDeviceTagCountByDevice(device.id) <= 0">
                                Clear
                            </button>
                        </div>
                    </div>
                    <div class="tag-devices__actions">
                        <button mat-stroked-button type="button" (click)="armMoveSelected()" [disabled]="!selectedTagId">Move Selected</button>
                        <button mat-stroked-button type="button" (click)="deleteSelected()" [disabled]="!selectedTagId">Delete Selected</button>
                        <div class="tag-devices__status">{{statusText}}</div>
                    </div>
                </aside>
            </div>
        </mat-dialog-content>
        <mat-dialog-actions align="end">
            <button mat-button mat-dialog-close type="button">Cancel</button>
            <button mat-flat-button type="button" (click)="save()">Save</button>
        </mat-dialog-actions>
    `,
    styles: [`
        .tag-devices__titlebar {
            display: flex;
            align-items: center;
            justify-content: space-between;
            gap: 12px;
        }
        .tag-devices__eyebrow {
            font-size: 0.72rem;
            letter-spacing: 0.18em;
            text-transform: uppercase;
            opacity: 0.82;
        }
        .tag-devices__title {
            font-size: 1.05rem;
            margin-top: 4px;
        }
        .tag-devices__hint {
            margin-top: 4px;
            font-size: 0.8rem;
            opacity: 0.82;
        }
        .tag-devices__content {
            height: calc(100vh - 170px);
            min-height: 420px;
            padding: 0;
        }
        .tag-devices__layout {
            display: grid;
            grid-template-columns: minmax(0, 1fr) 320px;
            height: 100%;
        }
        .tag-devices__stage {
            overflow: auto;
            background: rgba(2, 6, 12, 0.88);
            border-right: 1px solid rgba(72, 221, 255, 0.14);
        }
        .tag-devices__surface {
            position: relative;
            width: 100%;
            line-height: 0;
            cursor: crosshair;
        }
        .tag-devices__stage.is-pan-mode .tag-devices__surface {
            cursor: grab;
        }
        .tag-devices__stage.is-pan-mode.is-panning .tag-devices__surface {
            cursor: grabbing;
        }
        .tag-devices__stage img {
            display: block;
            width: 100%;
            height: auto;
            user-select: none;
            pointer-events: none;
        }
        .tag-devices__tag {
            position: absolute;
            transform: translate(-50%, -50%);
            display: inline-flex;
            align-items: center;
            gap: 4px;
            padding: 2px 4px;
            border: 1px solid rgba(255, 255, 255, 0.9);
            border-radius: 4px;
            background: rgba(8, 20, 32, 0.9);
            color: #f7fbff;
            font-size: 0.65rem;
            font-weight: 700;
            cursor: pointer;
        }
        .tag-devices__tag.is-selected {
            box-shadow: 0 0 0 2px rgba(255, 164, 61, 0.82);
        }
        .tag-devices__dot {
            width: 10px;
            height: 10px;
            border-radius: 2px;
            border: 1px solid rgba(0, 0, 0, 0.4);
            flex: 0 0 auto;
        }
        .tag-devices__rail {
            display: grid;
            grid-template-rows: auto 1fr auto;
            gap: 10px;
            padding: 12px;
            overflow: auto;
        }
        .tag-devices__rail-title {
            font-size: 0.75rem;
            letter-spacing: 0.14em;
            text-transform: uppercase;
            opacity: 0.85;
        }
        .tag-devices__view-controls {
            display: grid;
            grid-template-columns: repeat(2, minmax(0, 1fr));
            gap: 8px;
            margin-bottom: 6px;
        }
        .tag-devices__view-controls .is-active {
            border-color: rgba(255, 164, 61, 0.72);
            box-shadow: 0 0 0 1px rgba(255, 164, 61, 0.32);
        }
        .tag-devices__zoom-readout {
            grid-column: 1 / -1;
            font-size: 0.78rem;
            color: #b9d8e8;
        }
        .tag-devices__device-row {
            width: 100%;
            box-sizing: border-box;
            border: 1px solid rgba(72, 221, 255, 0.16);
            border-radius: 10px;
            background: rgba(8, 20, 32, 0.68);
            color: inherit;
            display: flex;
            align-items: center;
            flex-wrap: wrap;
            gap: 8px;
            padding: 8px;
            text-align: left;
            cursor: pointer;
            margin-bottom: 8px;
            min-width: 0;
        }
        .tag-devices__device-row.is-active {
            border-color: rgba(255, 164, 61, 0.72);
            box-shadow: 0 0 0 1px rgba(255, 164, 61, 0.32);
        }
        .tag-devices__device-chip {
            min-width: 40px;
            text-align: center;
            color: #071018;
            font-weight: 700;
            font-size: 0.68rem;
            border-radius: 999px;
            padding: 3px 8px;
        }
        .tag-devices__device-name {
            flex: 1 1 140px;
            min-width: 0;
            font-size: 0.78rem;
            line-height: 1.3;
            overflow: hidden;
            text-overflow: ellipsis;
            white-space: nowrap;
        }
        .tag-devices__device-count {
            flex: 0 0 auto;
            min-width: 28px;
            text-align: center;
            border-radius: 999px;
            border: 1px solid rgba(72, 221, 255, 0.26);
            background: rgba(8, 20, 32, 0.92);
            color: #d8f2ff;
            font-size: 0.72rem;
            font-weight: 700;
            line-height: 1;
            padding: 4px 8px;
        }
        .tag-devices__device-row-actions {
            display: flex;
            flex-wrap: wrap;
            gap: 6px;
            width: auto;
            margin-left: auto;
            justify-content: flex-end;
            max-width: 100%;
            flex: 0 0 auto;
        }
        .tag-devices__device-row-actions button {
            min-height: 30px;
            line-height: 28px;
            padding: 0 10px;
            font-size: 0.72rem;
        }
        .tag-devices__actions {
            display: grid;
            gap: 8px;
        }
        .tag-devices__status {
            min-height: 20px;
            font-size: 0.78rem;
            color: #b9d8e8;
        }
        @media (max-width: 980px) {
            .tag-devices__layout {
                grid-template-columns: 1fr;
                grid-template-rows: minmax(320px, 1fr) auto;
            }
            .tag-devices__stage {
                border-right: 0;
                border-bottom: 1px solid rgba(72, 221, 255, 0.14);
            }
        }
    `]
})
export class TagDevicesDialog {
    readonly data = inject<TagDevicesDialogData>(MAT_DIALOG_DATA)
    private readonly dialogRef = inject(MatDialogRef<TagDevicesDialog>)

    devices = DEVICE_OPTIONS
    tags: TrainAiDeviceTagRecord[] = []
    hiddenDeviceIds = new Set<string>()
    activeDeviceId = this.devices[0]?.id || ''
    selectedTagId: string | null = null
    moveArmed = false
    zoomLevel = 1
    readonly minZoom = 0.5
    readonly maxZoom = 4
    panMode = false
    isPanning = false
    private panStartX = 0
    private panStartY = 0
    private panStartScrollLeft = 0
    private panStartScrollTop = 0
    private panStageEl: HTMLElement | null = null
    statusText = ''

    ngOnInit(): void {
        this.tags = Array.isArray(this.data.existingTags) ? [...this.data.existingTags] : []
    }

    setActiveDevice(device: DeviceOption): void {
        this.activeDeviceId = device.id
        this.statusText = `Active device: ${device.code}`
    }

    getSurfaceStyle(): Record<string, string> {
        return {
            width: `${this.zoomLevel * 100}%`
        }
    }

    getVisibleTags(): TrainAiDeviceTagRecord[] {
        return this.tags.filter((tag) => !this.hiddenDeviceIds.has(tag.deviceId))
    }

    getTagStyle(tag: TrainAiDeviceTagRecord): Record<string, string> {
        return {
            left: `${Math.max(0, Math.min(1, tag.xRatio)) * 100}%`,
            top: `${Math.max(0, Math.min(1, tag.yRatio)) * 100}%`,
            borderColor: tag.color
        }
    }

    getDeviceTagCountByDevice(deviceId: string): number {
        return this.tags.filter((tag) => tag.deviceId === deviceId).length
    }

    isDeviceHidden(deviceId: string): boolean {
        return this.hiddenDeviceIds.has(deviceId)
    }

    selectTag(tag: TrainAiDeviceTagRecord, event: Event): void {
        event.stopPropagation()
        this.selectedTagId = tag.id
        this.moveArmed = false
    }

    armMoveSelected(): void {
        if (!this.selectedTagId) {
            return
        }
        this.moveArmed = true
        this.statusText = 'Move armed: click on image to reposition selected tag.'
    }

    deleteSelected(): void {
        if (!this.selectedTagId) {
            return
        }
        this.tags = this.tags.filter((tag) => tag.id !== this.selectedTagId)
        this.selectedTagId = null
        this.moveArmed = false
        this.statusText = 'Selected tag deleted.'
    }

    toggleDeviceVisibility(device: DeviceOption, event: Event): void {
        event.stopPropagation()

        if (this.hiddenDeviceIds.has(device.id)) {
            this.hiddenDeviceIds.delete(device.id)
            this.statusText = `Showing ${device.code} tags.`
            return
        }

        this.hiddenDeviceIds.add(device.id)
        const selected = this.tags.find((tag) => tag.id === this.selectedTagId)
        if (selected?.deviceId === device.id) {
            this.selectedTagId = null
            this.moveArmed = false
        }
        this.statusText = `Hid ${device.code} tags.`
    }

    clearDeviceTags(device: DeviceOption, event: Event): void {
        event.stopPropagation()
        const before = this.tags.length
        this.tags = this.tags.filter((tag) => tag.deviceId !== device.id)
        const removed = before - this.tags.length
        if (removed <= 0) {
            return
        }

        const selected = this.tags.find((tag) => tag.id === this.selectedTagId)
        if (!selected) {
            this.selectedTagId = null
            this.moveArmed = false
        }
        this.statusText = `Cleared ${removed} ${device.code} tag${removed === 1 ? '' : 's'}.`
    }

    zoomIn(): void {
        this.zoomLevel = Math.min(this.maxZoom, Number((this.zoomLevel + 0.1).toFixed(2)))
    }

    zoomOut(): void {
        this.zoomLevel = Math.max(this.minZoom, Number((this.zoomLevel - 0.1).toFixed(2)))
    }

    resetView(): void {
        this.zoomLevel = 1
        if (this.panStageEl) {
            this.panStageEl.scrollLeft = 0
            this.panStageEl.scrollTop = 0
        }
        this.statusText = 'View reset.'
    }

    togglePanMode(): void {
        this.panMode = !this.panMode
        this.isPanning = false
        this.statusText = this.panMode
            ? 'Pan mode enabled. Drag on the image to move around.'
            : 'Pan mode disabled.'
    }

    onPanStart(event: MouseEvent): void {
        if (!this.panMode || event.button !== 0) {
            return
        }
        const stage = event.currentTarget as HTMLElement
        this.isPanning = true
        this.panStageEl = stage
        this.panStartX = event.clientX
        this.panStartY = event.clientY
        this.panStartScrollLeft = stage.scrollLeft
        this.panStartScrollTop = stage.scrollTop
        event.preventDefault()
    }

    onPanMove(event: MouseEvent): void {
        if (!this.isPanning || !this.panStageEl) {
            return
        }
        const deltaX = event.clientX - this.panStartX
        const deltaY = event.clientY - this.panStartY
        this.panStageEl.scrollLeft = this.panStartScrollLeft - deltaX
        this.panStageEl.scrollTop = this.panStartScrollTop - deltaY
    }

    onPanEnd(): void {
        this.isPanning = false
    }

    onStageClick(event: MouseEvent): void {
        if (this.panMode || this.isPanning) {
            return
        }
        const surface = event.currentTarget as HTMLElement
        const image = surface.querySelector('img') as HTMLImageElement | null
        const rect = image?.getBoundingClientRect() || surface.getBoundingClientRect()
        if (rect.width <= 0 || rect.height <= 0) {
            return
        }

        const xRatio = (event.clientX - rect.left) / rect.width
        const yRatio = (event.clientY - rect.top) / rect.height
        const clampedX = Math.max(0, Math.min(1, xRatio))
        const clampedY = Math.max(0, Math.min(1, yRatio))
        const now = new Date().toISOString()

        if (this.moveArmed && this.selectedTagId) {
            const target = this.tags.find((tag) => tag.id === this.selectedTagId)
            if (!target) {
                return
            }
            target.xRatio = clampedX
            target.yRatio = clampedY
            target.updatedAt = now
            this.moveArmed = false
            this.statusText = 'Selected tag moved.'
            return
        }

        const device = this.devices.find((item) => item.id === this.activeDeviceId) || this.devices[0]
        if (!device) {
            return
        }
        if (this.hiddenDeviceIds.has(device.id)) {
            this.hiddenDeviceIds.delete(device.id)
        }

        const created: TrainAiDeviceTagRecord = {
            id: this.createId(),
            deviceId: device.id,
            deviceCode: device.code,
            deviceName: device.name,
            color: device.color,
            xRatio: clampedX,
            yRatio: clampedY,
            createdAt: now,
            updatedAt: now
        }
        this.tags.push(created)
        this.selectedTagId = created.id
        this.statusText = `Tag added for ${device.code}.`
    }

    save(): void {
        this.dialogRef.close({
            tags: this.tags
        } as TagDevicesDialogResult)
    }

    private createId(): string {
        if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
            return crypto.randomUUID()
        }
        return `${Date.now()}-${Math.random().toString(16).slice(2)}`
    }
}

@Component({
    standalone: true,
    selector: 'train-ai-create-folder-dialog',
    imports: [
        FormsModule,
        MatButtonModule,
        MatFormFieldModule,
        MatInputModule,
        MatDialogTitle,
        MatDialogContent,
        MatDialogActions,
        MatDialogClose
    ],
    template: `
        <h2 mat-dialog-title>Create Folder</h2>
        <mat-dialog-content>
            <mat-form-field appearance="outline" style="width: 100%;">
                <mat-label>Folder name</mat-label>
                <input matInput [(ngModel)]="folderName" maxlength="120" (keyup.enter)="save()" />
            </mat-form-field>
        </mat-dialog-content>
        <mat-dialog-actions align="end">
            <button mat-button mat-dialog-close type="button">Cancel</button>
            <button mat-flat-button type="button" (click)="save()" [disabled]="!folderName.trim()">Create</button>
        </mat-dialog-actions>
    `
})
export class TrainAiCreateFolderDialog {
    folderName = ''
    private readonly dialogRef = inject(MatDialogRef<TrainAiCreateFolderDialog>)

    save(): void {
        const name = this.folderName.trim()
        if (!name) {
            return
        }
        this.dialogRef.close(name)
    }
}

@Component({
    standalone: true,
    selector: 'train-ai-overwrite-dialog',
    imports: [
        MatButtonModule,
        MatDialogTitle,
        MatDialogContent,
        MatDialogActions,
        MatDialogClose
    ],
    template: `
        <h2 mat-dialog-title>File Already Exists</h2>
        <mat-dialog-content>
            <p><strong>{{data.fileName}}</strong> already exists in this folder.</p>
            <p>If you continue, the file will be overwritten and saved as version {{data.nextVersionNumber}}.</p>
        </mat-dialog-content>
        <mat-dialog-actions align="end">
            <button mat-button mat-dialog-close type="button">Cancel</button>
            <button mat-flat-button type="button" (click)="overwrite()">Overwrite + New Version</button>
        </mat-dialog-actions>
    `
})
export class TrainAiOverwriteDialog {
    readonly data = inject<OverwriteDialogData>(MAT_DIALOG_DATA)
    private readonly dialogRef = inject(MatDialogRef<TrainAiOverwriteDialog>)

    overwrite(): void {
        this.dialogRef.close(true)
    }
}

@Component({
    standalone: true,
    selector: 'train-ai-delete-file-dialog',
    imports: [
        CommonModule,
        MatButtonModule,
        MatDialogTitle,
        MatDialogContent,
        MatDialogActions,
        MatDialogClose
    ],
    template: `
        <h2 mat-dialog-title>Delete File?</h2>
        <mat-dialog-content>
            <p>Delete <strong>{{data.fileName}}</strong> from this folder?</p>
            <p>{{data.versionCount > 1 ? ('All ' + data.versionCount + ' versions will be removed.') : 'This will remove the only version of this file.'}}</p>
        </mat-dialog-content>
        <mat-dialog-actions align="end">
            <button mat-button mat-dialog-close type="button">Cancel</button>
            <button mat-flat-button type="button" (click)="confirmDelete()">Delete File</button>
        </mat-dialog-actions>
    `
})
export class TrainAiDeleteFileDialog {
    readonly data = inject<DeleteFileDialogData>(MAT_DIALOG_DATA)
    private readonly dialogRef = inject(MatDialogRef<TrainAiDeleteFileDialog>)

    confirmDelete(): void {
        this.dialogRef.close(true)
    }
}
