import { CommonModule } from '@angular/common'
import { Component, EventEmitter, HostListener, Input, OnInit, Output, ChangeDetectionStrategy } from '@angular/core'
import { RouterLink } from '@angular/router'

import { MatButtonModule } from '@angular/material/button'
import { MatDialog } from '@angular/material/dialog'
import { MatIconModule } from '@angular/material/icon'
import { MatProgressBarModule } from '@angular/material/progress-bar'
import { MatTooltipModule } from '@angular/material/tooltip'

import {
    ProjectDocLibraryDirectoryRecord,
    ProjectDocLibraryFileRecord,
    ProjectDocLibraryFileVersionRecord,
    ProjectDocLibraryWorkspaceState,
    ProjectDocLibraryStorageService
} from '../services/project-doc-library-storage.service'
import { PdfThumbnailService } from '../services/pdf-thumbnail.service'
import {
    FirewireDocumentAnalysisDialog,
    FirewireDocumentAnalysisDialogData
} from './firewire-document-analysis.dialog'
import { FirewireProjectSchema } from '../../schemas/firewire-project.schema'

export interface DocumentAnalysisProjectUpdateEvent {
    project: FirewireProjectSchema
    targetFields: string[]
}

export interface DocumentLibraryUploadIndicator {
    active: boolean
    fileName: string
    fileIndex: number
    fileCount: number
    percent: number
    loadedBytes: number
    totalBytes: number
    phase: 'uploading' | 'processing'
}

type DocLibraryViewMode = 'tiles' | 'icons' | 'list' | 'details'
type ContextMenuState =
    | { kind: 'folder', folderId: string, x: number, y: number }
    | { kind: 'file', fileId: string, x: number, y: number }
    | null

interface ExplorerDirectory {
    id: string
    name: string
    parentId?: string
    depth: number
}

@Component({
    standalone: true,
    selector: 'firewire-doc-library-explorer',
    imports: [CommonModule, RouterLink, MatButtonModule, MatIconModule, MatProgressBarModule, MatTooltipModule],
    templateUrl: './firewire-doc-library-explorer.component.html',
    changeDetection: ChangeDetectionStrategy.Eager,
    styleUrls: ['./firewire-doc-library-explorer.component.scss']
})
export class FirewireDocLibraryExplorerComponent implements OnInit {
    private readonly rootFolderId = 'all'
    private readonly viewModeStorageKey = 'firewire.docLibrary.viewMode'

    @Input() projectKey = 'UNASSIGNED'
    @Input() analysisProjectId = ''
    @Input() files: ProjectDocLibraryFileRecord[] = []
    @Input() directories: ProjectDocLibraryDirectoryRecord[] = []
    @Input() selectedFolder = this.rootFolderId
    @Input() statusMessage = ''
    @Input() uploadIndicator?: DocumentLibraryUploadIndicator
    @Input() allowMarkup = false
    @Input() allowVersions = false
    @Input() allowMove = false
    @Input() markupQueryParams?: (file: ProjectDocLibraryFileRecord) => Record<string, string>

    @Output() selectedFolderChange = new EventEmitter<string>()
    @Output() downloadFile = new EventEmitter<string>()
    @Output() deleteFile = new EventEmitter<string>()
    @Output() openVersions = new EventEmitter<string>()
    @Output() moveFile = new EventEmitter<string>()
    @Output() createDirectory = new EventEmitter<string>()
    @Output() renameDirectory = new EventEmitter<string>()
    @Output() deleteDirectory = new EventEmitter<string>()
    @Output() projectUpdated = new EventEmitter<DocumentAnalysisProjectUpdateEvent>()
    @Output() workspaceUpdated = new EventEmitter<ProjectDocLibraryWorkspaceState>()

    viewMode: DocLibraryViewMode = 'details'
    contextMenu: ContextMenuState = null

    constructor(
        private readonly storage: ProjectDocLibraryStorageService,
        private readonly pdfThumbnailService: PdfThumbnailService,
        private readonly dialog: MatDialog
    ) {}

    ngOnInit(): void {
        const stored = localStorage.getItem(this.viewModeStorageKey)
        if (stored === 'tiles' || stored === 'icons' || stored === 'list' || stored === 'details') {
            this.viewMode = stored
        }
    }

    @HostListener('document:click')
    closeContextMenu(): void {
        this.contextMenu = null
    }

    get allDirectories(): ExplorerDirectory[] {
        const directories = this.directories.map((directory) => ({
            id: directory.id,
            name: directory.name,
            parentId: directory.parentId || this.rootFolderId,
            depth: 0
        }))

        const byId = new Map(directories.map((directory) => [directory.id, directory]))
        return [...byId.values()]
            .map((directory) => ({ ...directory, depth: this.getDirectoryDepth(directory.id, byId) }))
            .sort((left, right) => {
                const leftPath = this.getDirectoryPath(left.id).join('/')
                const rightPath = this.getDirectoryPath(right.id).join('/')
                return leftPath.localeCompare(rightPath)
            })
    }

    get childDirectories(): ExplorerDirectory[] {
        return this.allDirectories.filter((directory) => (directory.parentId || this.rootFolderId) === this.selectedFolder)
    }

    get visibleFiles(): ProjectDocLibraryFileRecord[] {
        return this.files
            .filter((file) => file.folderId !== 'floorplans')
            .filter((file) => this.normalizeFolderId(file.folderId) === this.selectedFolder)
            .sort((left, right) => String(left.name || '').localeCompare(String(right.name || '')))
    }

    get fileCount(): number {
        return this.getDescendantFiles(this.selectedFolder).length
    }

    get totalBytes(): number {
        return this.getDescendantFiles(this.selectedFolder).reduce((sum, file) => sum + Number(this.latestVersion(file)?.sizeBytes || 0), 0)
    }

    get versionCount(): number {
        return this.getDescendantFiles(this.selectedFolder).reduce((sum, file) => sum + Number(file.versions?.length || 0), 0)
    }

    get selectedFolderLabel(): string {
        return this.getFolderLabel(this.selectedFolder)
    }

    get breadcrumb(): Array<{ id: string, label: string }> {
        if (this.selectedFolder === this.rootFolderId) {
            return [{ id: this.rootFolderId, label: 'Project Files' }]
        }

        const ids: string[] = []
        let current = this.findDirectory(this.selectedFolder)
        while (current) {
            ids.unshift(current.id)
            current = current.parentId && current.parentId !== this.rootFolderId ? this.findDirectory(current.parentId) : undefined
        }
        return [
            { id: this.rootFolderId, label: 'Project Files' },
            ...ids.map((id) => ({ id, label: this.getFolderLabel(id) }))
        ]
    }

    setViewMode(mode: DocLibraryViewMode): void {
        this.viewMode = mode
        localStorage.setItem(this.viewModeStorageKey, mode)
    }

    selectFolder(folderId: string): void {
        this.selectedFolderChange.emit(folderId || this.rootFolderId)
    }

    onBackgroundContextMenu(event: MouseEvent): void {
        event.preventDefault()
        event.stopPropagation()
        this.contextMenu = { kind: 'folder', folderId: this.selectedFolder || this.rootFolderId, x: event.clientX, y: event.clientY }
    }

    onFolderContextMenu(event: MouseEvent, folderId: string): void {
        event.preventDefault()
        event.stopPropagation()
        this.contextMenu = { kind: 'folder', folderId, x: event.clientX, y: event.clientY }
    }

    onFileContextMenu(event: MouseEvent, fileId: string): void {
        event.preventDefault()
        event.stopPropagation()
        this.contextMenu = { kind: 'file', fileId, x: event.clientX, y: event.clientY }
    }

    canRenameContextFolder(): boolean {
        return this.contextMenu?.kind === 'folder'
            && this.contextMenu.folderId !== this.rootFolderId
            && !!this.findDirectory(this.contextMenu.folderId)
    }

    canDeleteContextFolder(): boolean {
        return this.canRenameContextFolder()
    }

    getContextFolderId(): string {
        return this.contextMenu?.kind === 'folder' ? this.contextMenu.folderId : this.rootFolderId
    }

    getContextFileId(): string {
        return this.contextMenu?.kind === 'file' ? this.contextMenu.fileId : ''
    }

    getFolderCount(folderId: string): number {
        return this.getDescendantFiles(folderId).length
    }

    getFolderLabel(folderId: string): string {
        if (folderId === this.rootFolderId) {
            return 'Project Files'
        }
        return this.findDirectory(folderId)?.name || 'Unfiled'
    }

    getFolderPathLabel(folderId: string): string {
        return this.getDirectoryPath(folderId).join(' / ') || 'Project Files'
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

    extensionLabel(file: ProjectDocLibraryFileRecord): string {
        return String(file.extension || this.getExtension(file.name) || 'FILE').replace(/^\./, '').toUpperCase()
    }

    modifiedAt(file: ProjectDocLibraryFileRecord): string {
        const value = this.latestVersion(file)?.uploadedAt || file.updatedAt || file.createdAt
        return value ? new Date(value).toLocaleString() : ''
    }

    modifiedBy(file: ProjectDocLibraryFileRecord): string {
        return this.latestVersion(file)?.uploadedBy || 'Current User'
    }

    canShowMarkup(file: ProjectDocLibraryFileRecord): boolean {
        if (!this.allowMarkup || !this.markupQueryParams) {
            return false
        }
        const version = this.latestVersion(file)
        return this.storage.isDrawing(file)
            && String(version?.mimeType || '').toLowerCase().startsWith('image/')
            && !!(version?.dataUrl || version?.contentUrl)
    }

    canInspect(file: ProjectDocLibraryFileRecord): boolean {
        const version = this.latestVersion(file)
        if (!this.analysisProjectId || !version || Number(version.sizeBytes || 0) >= 50 * 1024 * 1024) {
            return false
        }
        return ['csv', 'doc', 'docx', 'md', 'pdf', 'ppt', 'pptx', 'tsv', 'txt', 'xls', 'xlsx']
            .includes(this.extensionLabel(file).toLowerCase())
    }

    getInspectTooltip(file: ProjectDocLibraryFileRecord): string {
        if (!this.analysisProjectId) {
            return 'AI inspection requires a saved Firewire project.'
        }
        if (Number(this.latestVersion(file)?.sizeBytes || 0) >= 50 * 1024 * 1024) {
            return 'Direct AI inspection supports documents under 50 MB.'
        }
        if (!this.canInspect(file)) {
            return 'This file type is not supported by document inspection yet.'
        }
        return 'Inspect document findings with AI'
    }

    openInspection(file: ProjectDocLibraryFileRecord): void {
        if (!this.canInspect(file)) {
            return
        }
        const version = this.latestVersion(file)
        if (!version) {
            return
        }
        const activeElement = document.activeElement
        if (activeElement instanceof HTMLElement) {
            activeElement.blur()
        }
        this.dialog.open(FirewireDocumentAnalysisDialog, {
            panelClass: ['fw-fit-content-dialog-pane', 'fw-document-analysis-dialog-pane'],
            width: 'min(1400px, 96vw)',
            maxWidth: '96vw',
            disableClose: true,
            closeOnNavigation: false,
            data: {
                projectId: this.analysisProjectId,
                workspaceKey: file.storageKey || this.projectKey,
                fileId: file.id,
                versionId: version.id,
                sourceFilename: version.sourceFileName || file.sourceFileName || file.name,
                onProjectUpdated: (project: FirewireProjectSchema, targetFields: string[]) => {
                    this.projectUpdated.emit({ project, targetFields })
                },
                onWorkspaceUpdated: async (workspace: any, changedFileId?: string) => {
                    const projectKey = file.storageKey || this.projectKey
                    const hydrated = this.storage.hydrateWorkspace(workspace, projectKey)
                    const changedFile = changedFileId
                        ? hydrated.files.find((item) => item.id === changedFileId)
                        : undefined
                    const changedVersion = changedFile?.versions?.[changedFile.versions.length - 1]
                    if (changedFile?.folderId === 'floorplans'
                        && changedVersion
                        && !changedVersion.thumbnailDataUrl
                        && (String(changedVersion.mimeType || '').toLowerCase() === 'application/pdf'
                            || String(changedFile.extension || '').toLowerCase() === 'pdf')) {
                        try {
                            const blob = await this.storage.downloadVersion(projectKey, changedFile.id, changedVersion)
                            changedVersion.thumbnailDataUrl = await this.pdfThumbnailService.createThumbnail(blob)
                            await this.storage.saveWorkspace(projectKey, hydrated)
                        } catch (error) {
                            console.error('Unable to generate the AI-created floorplan thumbnail.', error)
                        }
                    }
                    const nextFiles = hydrated.files
                    const nextDirectories = hydrated.directories || []
                    this.files.splice(0, this.files.length, ...nextFiles)
                    this.directories.splice(0, this.directories.length, ...nextDirectories)
                    this.workspaceUpdated.emit(hydrated)
                }
            } as FirewireDocumentAnalysisDialogData
        })
    }

    getContextFile(): ProjectDocLibraryFileRecord | undefined {
        const fileId = this.getContextFileId()
        return fileId ? this.files.find((file) => file.id === fileId) : undefined
    }

    getMarkupQueryParams(file: ProjectDocLibraryFileRecord): Record<string, string> {
        return this.markupQueryParams?.(file) || {}
    }

    private getDescendantFiles(folderId: string): ProjectDocLibraryFileRecord[] {
        const ids = new Set([folderId || this.rootFolderId])
        let changed = true
        while (changed) {
            changed = false
            for (const directory of this.allDirectories) {
                if (!ids.has(directory.id) && ids.has(directory.parentId || this.rootFolderId)) {
                    ids.add(directory.id)
                    changed = true
                }
            }
        }

        return this.files
            .filter((file) => file.folderId !== 'floorplans')
            .filter((file) => ids.has(this.normalizeFolderId(file.folderId)))
    }

    private normalizeFolderId(folderId: string): string {
        return String(folderId || this.rootFolderId).trim() || this.rootFolderId
    }

    private findDirectory(folderId: string): ExplorerDirectory | undefined {
        return this.allDirectories.find((directory) => directory.id === folderId)
    }

    private getDirectoryDepth(folderId: string, byId: Map<string, ExplorerDirectory>): number {
        let depth = 0
        let current = byId.get(folderId)
        while (current?.parentId && current.parentId !== this.rootFolderId && byId.has(current.parentId)) {
            depth += 1
            current = byId.get(current.parentId)
        }
        return depth
    }

    private getDirectoryPath(folderId: string): string[] {
        if (folderId === this.rootFolderId) {
            return ['Project Files']
        }

        const labels: string[] = []
        let current = this.findDirectory(folderId)
        while (current) {
            labels.unshift(current.name)
            current = current.parentId && current.parentId !== this.rootFolderId ? this.findDirectory(current.parentId) : undefined
        }
        return labels
    }

    private getExtension(fileName: string): string {
        const match = String(fileName || '').match(/\.([^.]+)$/)
        return match?.[1] || ''
    }
}
