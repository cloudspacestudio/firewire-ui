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
    @Input() getPreviewContent: (file: ProjectDocLibraryFileRecord) => string = () => ''

    @Output() renameFile = new EventEmitter<ProjectDocLibraryFileRecord>()
    @Output() designFile = new EventEmitter<ProjectDocLibraryFileRecord>()
    @Output() downloadFile = new EventEmitter<string>()
    @Output() deleteFile = new EventEmitter<string>()

    private readonly draftNames = new Map<string, string>()

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

    isSaving(file: ProjectDocLibraryFileRecord): boolean {
        return this.savingFileIds.includes(file.id)
    }
}
