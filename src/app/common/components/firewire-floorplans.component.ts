import { CommonModule } from '@angular/common'
import { Component, EventEmitter, Input, Output } from '@angular/core'
import { FormsModule } from '@angular/forms'

import { MatButtonModule } from '@angular/material/button'
import { MatIconModule } from '@angular/material/icon'
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner'

import {
    ProjectDocLibraryFileRecord,
    ProjectDocLibraryFileVersionRecord
} from '../services/project-doc-library-storage.service'

export interface FirewireFloorplanFolder {
    id: string
    name: string
    expanded?: boolean
}

export interface FirewireFloorplanFolderRenameEvent {
    folderId: string
    name: string
}

export interface FirewireFloorplanMoveEvent {
    fileId: string
    folderId: string
}

@Component({
    standalone: true,
    selector: 'firewire-floorplans',
    imports: [CommonModule, FormsModule, MatButtonModule, MatIconModule, MatProgressSpinnerModule],
    templateUrl: './firewire-floorplans.component.html',
    styleUrls: ['./firewire-floorplans.component.scss']
})
export class FirewireFloorplansComponent {
    @Input() projectKey = 'UNASSIGNED'
    @Input() files: ProjectDocLibraryFileRecord[] = []
    @Input() statusMessage = ''
    @Input() savingFileIds: string[] = []
    @Input() folders: FirewireFloorplanFolder[] = []
    @Input() uploadBusy = false
    @Input() uploadDisabled = false
    @Input() getPreviewContent: (file: ProjectDocLibraryFileRecord) => string = () => ''

    @Output() createFolder = new EventEmitter<void>()
    @Output() renameFolder = new EventEmitter<FirewireFloorplanFolderRenameEvent>()
    @Output() deleteFolder = new EventEmitter<string>()
    @Output() toggleFolder = new EventEmitter<string>()
    @Output() uploadFiles = new EventEmitter<string>()
    @Output() moveFile = new EventEmitter<FirewireFloorplanMoveEvent>()
    @Output() renameFile = new EventEmitter<ProjectDocLibraryFileRecord>()
    @Output() designFile = new EventEmitter<ProjectDocLibraryFileRecord>()
    @Output() downloadFile = new EventEmitter<string>()
    @Output() deleteFile = new EventEmitter<string>()

    private readonly draftNames = new Map<string, string>()
    private readonly draftFolderNames = new Map<string, string>()

    get totalBytes(): number {
        return this.files.reduce((sum, file) => sum + Number(this.latestVersion(file)?.sizeBytes || 0), 0)
    }

    get sortedFiles(): ProjectDocLibraryFileRecord[] {
        return [...this.files].sort((left, right) => {
            const nameComparison = String(left.name || '').localeCompare(String(right.name || ''), undefined, { numeric: true, sensitivity: 'base' })
            if (nameComparison !== 0) {
                return nameComparison
            }
            return String(left.id || '').localeCompare(String(right.id || ''))
        })
    }

    get hasFolders(): boolean {
        return this.folders.length > 0
    }

    get sortedFolders(): FirewireFloorplanFolder[] {
        return [...this.folders]
    }

    get unassignedFolderId(): string {
        return this.folders[0]?.id || 'general'
    }

    filesForFolder(folder: FirewireFloorplanFolder): ProjectDocLibraryFileRecord[] {
        return this.sortedFiles.filter((file) => this.getFileFolderId(file) === folder.id)
    }

    getFileFolderId(file: ProjectDocLibraryFileRecord): string {
        return String(file.floorplanFolderId || this.unassignedFolderId)
    }

    latestVersion(file: ProjectDocLibraryFileRecord): ProjectDocLibraryFileVersionRecord | undefined {
        return file.versions?.[file.versions.length - 1]
    }

    formatBytes(sizeBytes: number): string {
        if (sizeBytes >= 1024 * 1024) {
            return `${(sizeBytes / (1024 * 1024)).toFixed(2)} MB`
        }
        if (sizeBytes >= 1024) {
            return `${Math.round(sizeBytes / 1024)} KB`
        }
        return `${sizeBytes} B`
    }

    annotationCount(file: ProjectDocLibraryFileRecord): number {
        return file.floorplanDesign?.annotations?.length || 0
    }

    formatMarkCount(count: number): string {
        return Math.max(0, Math.trunc(Number(count) || 0)).toLocaleString()
    }

    getDraftName(file: ProjectDocLibraryFileRecord): string {
        return this.draftNames.get(file.id) ?? file.name
    }

    setDraftName(file: ProjectDocLibraryFileRecord, value: string): void {
        this.draftNames.set(file.id, value)
    }

    commitFloorplanName(file: ProjectDocLibraryFileRecord): void {
        const draftName = String(this.getDraftName(file) || '').trim() || 'Floorplan'
        this.draftNames.delete(file.id)
        if (draftName === file.name) {
            return
        }
        file.name = draftName
        this.renameFile.emit(file)
    }

    getDraftFolderName(folder: FirewireFloorplanFolder): string {
        return this.draftFolderNames.get(folder.id) ?? folder.name
    }

    setDraftFolderName(folder: FirewireFloorplanFolder, value: string): void {
        this.draftFolderNames.set(folder.id, value)
    }

    commitFolderName(folder: FirewireFloorplanFolder): void {
        const draftName = String(this.getDraftFolderName(folder) || '').trim() || 'Folder'
        this.draftFolderNames.delete(folder.id)
        if (draftName === folder.name) {
            return
        }
        this.renameFolder.emit({ folderId: folder.id, name: draftName })
    }

    moveToFolder(file: ProjectDocLibraryFileRecord, folderId: string): void {
        if (!folderId || folderId === this.getFileFolderId(file)) {
            return
        }
        this.moveFile.emit({ fileId: file.id, folderId })
    }

    isSaving(file: ProjectDocLibraryFileRecord): boolean {
        return this.savingFileIds.includes(file.id)
    }
}
