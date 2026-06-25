import { CommonModule } from "@angular/common"
import { Component, ElementRef, OnInit, ViewChild, inject } from "@angular/core"
import { HttpClient } from "@angular/common/http"
import { ActivatedRoute, RouterLink } from "@angular/router"
import { firstValueFrom } from "rxjs"

import { MatButtonModule } from "@angular/material/button"
import { MatDialog, MAT_DIALOG_DATA, MatDialogActions, MatDialogClose, MatDialogContent, MatDialogRef, MatDialogTitle } from "@angular/material/dialog"
import { MatIconModule } from "@angular/material/icon"

import { PageToolbar } from "../../common/components/page-toolbar"
import { FirewireFloorplansComponent } from "../../common/components/firewire-floorplans.component"
import { FirewireTakeoffColumnDefinition, FirewireTakeoffMatrix, FirewireTakeoffMatrixComponent } from "../../common/components/firewire-takeoff-matrix.component"
import { ProjectDocLibraryFileRecord, ProjectDocLibraryFileVersionRecord, ProjectDocLibraryStorageService, ProjectDocLibraryWorkspaceState, ProjectFloorplanDesignState } from "../../common/services/project-doc-library-storage.service"
import { FirewireProjectSchema } from "../../schemas/firewire-project.schema"
import { FloorplanDesignerDialog, FloorplanDesignerDialogResult, FloorplanSymbolBalanceDialog, FloorplanSymbolBalanceDialogData } from "./floorplan-designer.dialog"
import { FloorplanDesignerSymbolOption } from "./floorplan-designer.component"

type DesignProjectTab = 'DETAILS' | 'TAKE_OFF' | 'FLOORPLANS'

@Component({
    standalone: true,
    selector: 'design-project-page',
    imports: [
        CommonModule,
        RouterLink,
        MatButtonModule,
        MatIconModule,
        PageToolbar,
        FirewireFloorplansComponent,
        FirewireTakeoffMatrixComponent
    ],
    providers: [HttpClient],
    template: `
        <page-toolbar title="DESIGN">
            <div class="button-bar">
                <button mat-fab class="back" [routerLink]="'/design'">
                    <mat-icon fontIcon="chevron_left"></mat-icon>
                </button>
            </div>
            <div class="design-project-toolbar-actions" *ngIf="project">
                <button
                    *ngIf="activeTab === 'FLOORPLANS'"
                    mat-stroked-button
                    type="button"
                    class="design-project-upload"
                    [disabled]="floorplanUploadBusy"
                    (click)="onUploadFloorplansClick()">
                    <mat-icon fontIcon="add_photo_alternate"></mat-icon>
                    {{floorplanUploadBusy ? 'UPLOADING...' : 'UPLOAD FLOORPLANS'}}
                </button>
            </div>
        </page-toolbar>

        <input
            #floorplanUploadInput
            type="file"
            multiple
            accept="image/*,.pdf,application/pdf"
            class="design-project-hidden-input"
            (change)="onFloorplanFileSelected($event)" />

        <div class="page-root">
            <div class="page-content">
                <div class="content-root">
                    <div *ngIf="pageWorking" class="design-project-state">
                        Loading design workspace...
                    </div>

                    <div *ngIf="!pageWorking && errText" class="design-project-state design-project-state--error">
                        {{errText}}
                    </div>

                    <section *ngIf="!pageWorking && project" class="design-project-shell">
                        <aside class="design-project-tabs" aria-label="Design project sections">
                            <button type="button" [class.is-active]="activeTab === 'DETAILS'" (click)="setActiveTab('DETAILS')">Details</button>
                            <button type="button" [class.is-active]="activeTab === 'TAKE_OFF'" (click)="setActiveTab('TAKE_OFF')">Take Off</button>
                            <button type="button" [class.is-active]="activeTab === 'FLOORPLANS'" (click)="setActiveTab('FLOORPLANS')">Floorplans</button>
                        </aside>

                        <main class="design-project-main">
                            <section *ngIf="activeTab === 'DETAILS'" class="design-project-details">
                                <div class="design-project-hero">
                                    <div>
                                        <div class="design-project-kicker">Project Design Workspace</div>
                                        <h1>{{project.name}}</h1>
                                        <p>Use this project-specific Design page for drawing review, takeoff visibility, and floorplan markup tied directly to this Firewire project.</p>
                                    </div>
                                    <div class="design-project-badges">
                                        <span *ngIf="project.projectNbr">#{{project.projectNbr}}</span>
                                        <span *ngIf="project.projectStatus">{{project.projectStatus}}</span>
                                        <span *ngIf="project.projectType">{{project.projectType}}</span>
                                    </div>
                                </div>

                                <article class="design-project-card design-project-card--snapshot">
                                    <div class="design-project-card__eyebrow">Project Snapshot</div>
                                    <div class="design-project-snapshot-grid">
                                        <div class="design-project-detail"><span>Address</span><strong>{{project.address || 'Unavailable'}}</strong></div>
                                        <div class="design-project-detail"><span>Bid Due</span><strong>{{toLocalDateString(project.bidDueDate) || 'Unavailable'}}</strong></div>
                                        <div class="design-project-detail"><span>Salesman</span><strong>{{project.salesman || 'Unavailable'}}</strong></div>
                                        <div class="design-project-detail"><span>Total Sq Ft</span><strong>{{formatSqFt(project.totalSqFt)}}</strong></div>
                                        <div class="design-project-detail"><span>Job Type</span><strong>{{project.jobType || 'Unavailable'}}</strong></div>
                                        <div class="design-project-detail"><span>Scope Type</span><strong>{{project.scopeType || 'Unavailable'}}</strong></div>
                                        <div class="design-project-detail"><span>Project Scope</span><strong>{{project.projectScope || 'Unavailable'}}</strong></div>
                                        <div class="design-project-detail"><span>Difficulty</span><strong>{{project.difficulty || 'Unavailable'}}</strong></div>
                                        <div class="design-project-detail"><span>Floorplans</span><strong>{{getFloorplanFiles().length}}</strong></div>
                                        <div class="design-project-detail"><span>BOM Quantity</span><strong>{{getBomQuantityTotal()}}</strong></div>
                                    </div>
                                </article>
                            </section>

                            <section *ngIf="activeTab === 'TAKE_OFF'" class="design-project-takeoff">
                                <div class="design-project-section-kicker">Take Off Totals</div>
                                <div class="design-project-pill">Matrix 1: {{getTakeoffMatrixTotal()}}</div>
                                <firewire-takeoff-matrix
                                    [matrix]="getPrimaryTakeoffMatrix()"
                                    [columns]="getTakeoffColumnDefinitions()"
                                    emptyMessage="Upload a floorplan to start takeoff.">
                                </firewire-takeoff-matrix>
                            </section>

                            <section *ngIf="activeTab === 'FLOORPLANS'" class="design-project-floorplans">
                                <firewire-floorplans
                                    [projectKey]="project.uuid"
                                    [files]="getFloorplanFiles()"
                                    [statusMessage]="floorplanStatusMessage"
                                    [getPreviewContent]="getFloorplanPreviewContent"
                                    (renameFile)="renameFloorplanFile($event)"
                                    (designFile)="openFloorplanDesigner($event)"
                                    (downloadFile)="downloadFloorplanFile($event)"
                                    (deleteFile)="deleteFloorplanFile($event)">
                                </firewire-floorplans>
                            </section>
                        </main>
                    </section>
                </div>
            </div>
        </div>
    `,
    styles: [`
        :host {
            display: block;
        }

        .design-project-toolbar-actions {
            display: flex;
            align-items: center;
            margin-left: auto;
            gap: 10px;
        }

        .design-project-upload {
            min-height: 42px;
            border-radius: var(--fw-control-radius) !important;
            letter-spacing: 0.08em;
            text-transform: uppercase;
        }

        .design-project-hidden-input {
            display: none;
        }

        .design-project-state {
            padding: 18px;
            border: 1px solid rgba(72, 221, 255, 0.18);
            border-radius: 12px;
            background: rgba(8, 14, 25, 0.76);
            color: #d9eff9;
        }

        .design-project-state--error {
            border-color: rgba(255, 164, 61, 0.34);
            color: #ffd6b5;
        }

        .design-project-shell {
            display: grid;
            grid-template-columns: 238px minmax(0, 1fr);
            gap: 22px;
            min-height: calc(100vh - 170px);
        }

        .design-project-tabs {
            display: flex;
            flex-direction: column;
            gap: 12px;
            padding: 18px;
            border: 1px solid rgba(72, 221, 255, 0.16);
            border-radius: 12px;
            background:
                linear-gradient(135deg, rgba(72, 221, 255, 0.05), rgba(72, 221, 255, 0.01)),
                rgba(8, 14, 25, 0.76);
        }

        .design-project-tabs button {
            min-height: 48px;
            padding: 0 16px;
            border: 1px solid rgba(72, 221, 255, 0.15);
            background: rgba(7, 14, 25, 0.78);
            color: #d9eff9;
            text-align: left;
            letter-spacing: 0.12em;
            text-transform: uppercase;
            cursor: pointer;
        }

        .design-project-tabs button.is-active {
            border-color: rgba(72, 221, 255, 0.58);
            background:
                linear-gradient(90deg, rgba(72, 221, 255, 0.20), rgba(72, 221, 255, 0.06)),
                rgba(8, 22, 34, 0.92);
            color: #7fe8ff;
            box-shadow: inset 0 0 0 1px rgba(72, 221, 255, 0.18), 0 0 20px rgba(72, 221, 255, 0.12);
        }

        .design-project-main {
            min-width: 0;
        }

        .design-project-details,
        .design-project-takeoff,
        .design-project-floorplans {
            display: grid;
            gap: 18px;
        }

        .design-project-hero,
        .design-project-card {
            padding: 20px 22px;
            border: 1px solid rgba(72, 221, 255, 0.14);
            border-radius: 12px;
            background:
                radial-gradient(circle at 0% 0%, rgba(72, 221, 255, 0.08), transparent 32%),
                radial-gradient(circle at 100% 0%, rgba(255, 164, 61, 0.08), transparent 28%),
                rgba(8, 14, 25, 0.8);
        }

        .design-project-hero {
            display: grid;
            grid-template-columns: minmax(0, 1fr) auto;
            gap: 18px;
        }

        .design-project-kicker,
        .design-project-section-kicker,
        .design-project-card__eyebrow,
        .design-project-detail span {
            color: #7fe8ff;
            font-size: 0.72rem;
            letter-spacing: 0.18em;
            text-transform: uppercase;
        }

        .design-project-hero h1 {
            margin: 8px 0 0;
            color: #edf8ff;
            font-size: clamp(1.35rem, 2.2vw, 2rem);
        }

        .design-project-hero p {
            margin: 10px 0 0;
            color: rgba(223, 239, 248, 0.8);
            line-height: 1.45;
        }

        .design-project-badges {
            display: flex;
            flex-wrap: wrap;
            gap: 8px;
            align-content: start;
            justify-content: flex-end;
        }

        .design-project-badges span,
        .design-project-pill {
            padding: 7px 10px;
            border: 1px solid rgba(72, 221, 255, 0.16);
            border-radius: 999px;
            background: rgba(8, 18, 30, 0.72);
            color: #f1fbff;
            font-size: 0.76rem;
            letter-spacing: 0.08em;
            text-transform: uppercase;
        }

        .design-project-pill {
            justify-self: start;
            border-color: rgba(112, 255, 173, 0.34);
            color: #b7ffd4;
        }

        .design-project-card--snapshot {
            grid-column: 1 / -1;
        }

        .design-project-snapshot-grid {
            display: grid;
            grid-template-columns: repeat(4, minmax(0, 1fr));
            gap: 12px;
            margin-top: 14px;
        }

        .design-project-detail {
            display: grid;
            gap: 6px;
            padding: 12px 14px;
            border: 1px solid rgba(72, 221, 255, 0.12);
            border-radius: 8px;
            background: rgba(10, 18, 31, 0.48);
        }

        .design-project-detail strong {
            color: #f4fbff;
            font-weight: 600;
            overflow-wrap: anywhere;
        }

        @media (max-width: 1100px) {
            .design-project-shell {
                grid-template-columns: 1fr;
            }

            .design-project-tabs {
                flex-direction: row;
                flex-wrap: wrap;
            }

            .design-project-tabs button {
                flex: 1 1 180px;
            }

            .design-project-snapshot-grid {
                grid-template-columns: repeat(2, minmax(0, 1fr));
            }
        }

        @media (max-width: 700px) {
            .design-project-hero,
            .design-project-snapshot-grid {
                grid-template-columns: 1fr;
            }

            .design-project-badges {
                justify-content: flex-start;
            }
        }
    `]
})
export class DesignProjectPage implements OnInit {
    @ViewChild('floorplanUploadInput') floorplanUploadInput?: ElementRef<HTMLInputElement>

    private readonly floorplansFolderId = 'floorplans'
    pageWorking = true
    errText = ''
    project: FirewireProjectSchema | null = null
    activeTab: DesignProjectTab = 'DETAILS'
    docLibraryFiles: ProjectDocLibraryFileRecord[] = []
    docLibraryDirectories: ProjectDocLibraryWorkspaceState['directories'] = []
    floorplanStatusMessage = ''
    floorplanUploadBusy = false
    private takeoffColumnDefinitionCache: FirewireTakeoffColumnDefinition[] = []

    constructor(
        private readonly http: HttpClient,
        private readonly route: ActivatedRoute,
        private readonly projectDocLibraryStorage: ProjectDocLibraryStorageService,
        private readonly dialog: MatDialog
    ) {}

    ngOnInit(): void {
        const projectId = this.route.snapshot.paramMap.get('projectId')
        if (!projectId) {
            this.errText = 'Project id is required.'
            this.pageWorking = false
            return
        }

        void this.loadProject(projectId)
    }

    setActiveTab(tab: DesignProjectTab): void {
        this.activeTab = tab
    }

    async loadProject(projectId: string): Promise<void> {
        try {
            const response = await firstValueFrom(this.http.get<{ data?: FirewireProjectSchema }>(`/api/firewire/projects/firewire/${projectId}`))
            this.project = response?.data || null
            this.errText = this.project ? '' : 'Project not found.'
            if (this.project) {
                await this.loadDocLibraryWorkspace()
                this.refreshTakeoffColumnDefinitions()
            }
        } catch (err: any) {
            this.errText = err?.error?.message || err?.message || 'Unable to load design project.'
        } finally {
            this.pageWorking = false
        }
    }

    getFloorplanFiles(): ProjectDocLibraryFileRecord[] {
        return this.docLibraryFiles
            .filter((file) => file.folderId === this.floorplansFolderId)
            .sort((left, right) => {
                const nameComparison = String(left.name || '').localeCompare(String(right.name || ''), undefined, { numeric: true, sensitivity: 'base' })
                return nameComparison !== 0 ? nameComparison : String(left.id || '').localeCompare(String(right.id || ''))
            })
    }

    getPrimaryTakeoffMatrix(): FirewireTakeoffMatrix {
        this.syncTakeoffMatrixShape()
        const columns = this.getTakeoffColumnDefinitions()
        const values: Record<string, Record<string, number | null>> = {}
        for (const file of this.getFloorplanFiles()) {
            const rowKey = this.getFloorplanAreaName(file)
            values[rowKey] = {}
            for (const column of columns) {
                values[rowKey][column.key] = this.getTakeoffCellValue(file, column)
            }
        }
        return {
            title: 'Matrix 1',
            rows: this.getFloorplanFiles().map((file) => this.getFloorplanAreaName(file)),
            values
        }
    }

    getTakeoffColumnDefinitions(): FirewireTakeoffColumnDefinition[] {
        if (this.takeoffColumnDefinitionCache.length <= 0) {
            this.refreshTakeoffColumnDefinitions()
        }
        return this.takeoffColumnDefinitionCache
    }

    getTakeoffMatrixTotal(): number {
        const matrix = this.getPrimaryTakeoffMatrix()
        return matrix.rows.reduce((sum, row) => {
            return sum + this.getTakeoffColumnDefinitions().reduce((rowSum, column) => rowSum + Number(matrix.values[row]?.[column.key] || 0), 0)
        }, 0)
    }

    refreshTakeoffColumnDefinitions(): void {
        const byCategory = new Map<string, FirewireTakeoffColumnDefinition>()
        for (const section of this.getBomSections()) {
            for (const row of section.rows || []) {
                const label = String(row.type || '').trim()
                const qty = Math.max(0, Math.trunc(Number(row.qty || 0)))
                if (!label || qty <= 0) {
                    continue
                }
                const key = `category-${this.normalizeKey(label)}`
                const existing = byCategory.get(key)
                byCategory.set(key, {
                    key,
                    label,
                    sourceQty: Number(existing?.sourceQty || 0) + qty
                })
            }
        }
        this.takeoffColumnDefinitionCache = [...byCategory.values()]
    }

    getFloorplanPreviewContent = (file: ProjectDocLibraryFileRecord): string => {
        const version = this.getLatestVersion(file)
        return version?.thumbnailDataUrl || version?.dataUrl || version?.contentUrl || ''
    }

    onUploadFloorplansClick(): void {
        this.floorplanUploadInput?.nativeElement.click()
    }

    async onFloorplanFileSelected(event: Event): Promise<void> {
        const input = event.target as HTMLInputElement | null
        if (!input?.files?.length || !this.project) {
            return
        }

        this.floorplanUploadBusy = true
        this.floorplanStatusMessage = ''
        try {
            let uploadedCount = 0
            let skippedCount = 0
            for (const file of Array.from(input.files)) {
                if (!this.isFloorplanUploadFile(file)) {
                    skippedCount += 1
                    continue
                }
                await this.uploadFloorplanFile(file)
                uploadedCount += 1
            }
            await this.persistDocLibraryWorkspace()
            this.refreshTakeoffColumnDefinitions()
            const parts = []
            if (uploadedCount) parts.push(`${uploadedCount} uploaded`)
            if (skippedCount) parts.push(`${skippedCount} skipped`)
            this.floorplanStatusMessage = parts.length ? `Floorplans updated: ${parts.join(', ')}.` : 'No floorplan changes were made.'
        } catch (err: any) {
            this.floorplanStatusMessage = err?.message || 'Floorplan upload failed.'
        } finally {
            this.floorplanUploadBusy = false
            input.value = ''
        }
    }

    async renameFloorplanFile(file: ProjectDocLibraryFileRecord): Promise<void> {
        file.name = String(file.name || '').trim() || 'Floorplan'
        file.updatedAt = new Date().toISOString()
        await this.persistDocLibraryWorkspace()
        this.floorplanStatusMessage = `Renamed ${file.name}.`
    }

    async openFloorplanDesigner(file: ProjectDocLibraryFileRecord): Promise<void> {
        const result = await firstValueFrom(this.dialog.open(FloorplanDesignerDialog, {
            panelClass: 'fw-fullscreen-dialog-pane',
            maxWidth: '100vw',
            width: '100vw',
            data: {
                file,
                imageUrl: this.getFloorplanVersionContent(file),
                symbols: this.getFloorplanDesignerSymbols(),
                validateDesign: (design: ProjectFloorplanDesignState) => this.getFloorplanSymbolBalanceErrors(file.id, design)
            }
        }).afterClosed()) as FloorplanDesignerDialogResult | undefined

        if (!result?.design) {
            return
        }

        file.floorplanDesign = result.design
        file.updatedAt = new Date().toISOString()
        this.syncFloorplanQuantitiesToBom()
        await this.persistDocLibraryWorkspace()
        await this.persistBomAfterFloorplanSync()
        this.floorplanStatusMessage = `Saved design markup for ${file.name}.`
    }

    async downloadFloorplanFile(fileId: string): Promise<void> {
        if (!this.project) {
            return
        }
        const file = this.docLibraryFiles.find((row) => row.id === fileId)
        const version = file ? this.getLatestVersion(file) : undefined
        if (!file || !version) {
            return
        }
        const blob = await this.projectDocLibraryStorage.downloadVersion(this.project.uuid, file.id, version)
        const url = URL.createObjectURL(blob)
        const anchor = document.createElement('a')
        anchor.href = url
        anchor.download = version.sourceFileName || file.name
        anchor.click()
        URL.revokeObjectURL(url)
    }

    async deleteFloorplanFile(fileId: string): Promise<void> {
        if (!this.project) {
            return
        }
        const file = this.docLibraryFiles.find((row) => row.id === fileId)
        if (!file) {
            return
        }
        const confirmed = await firstValueFrom(this.dialog.open(DesignFloorplanDeleteDialog, {
            width: '420px',
            maxWidth: '92vw',
            panelClass: 'fw-compact-dialog-pane',
            data: { fileName: file.name }
        }).afterClosed())
        if (!confirmed) {
            return
        }
        const workspace = await this.projectDocLibraryStorage.deleteFile(this.project.uuid, fileId)
        this.docLibraryFiles = [...(workspace.files || [])]
        this.docLibraryDirectories = [...(workspace.directories || [])]
        this.syncFloorplanQuantitiesToBom()
        await this.persistBomAfterFloorplanSync()
        this.floorplanStatusMessage = `Deleted ${file.name}.`
    }

    toLocalDateString(input: string | null | undefined): string {
        if (!input) {
            return ''
        }
        const parsed = new Date(input)
        return Number.isNaN(parsed.getTime()) ? '' : new Intl.DateTimeFormat(undefined, { dateStyle: 'short' }).format(parsed)
    }

    formatSqFt(value: number | null | undefined): string {
        const parsed = Number(value || 0)
        return parsed > 0 ? parsed.toLocaleString() : 'Unavailable'
    }

    getBomQuantityTotal(): number {
        return this.getBomSections().reduce((sum, section) => {
            return sum + (section.rows || []).reduce((rowSum: number, row: any) => rowSum + Number(row.qty || 0), 0)
        }, 0)
    }

    private async loadDocLibraryWorkspace(): Promise<void> {
        if (!this.project) {
            return
        }
        const workspace = await this.projectDocLibraryStorage.loadWorkspace(this.project.uuid)
        this.docLibraryFiles = [...(workspace.files || [])]
        this.docLibraryDirectories = [...(workspace.directories || [])]
    }

    private async persistDocLibraryWorkspace(): Promise<void> {
        if (!this.project) {
            return
        }
        await this.projectDocLibraryStorage.saveWorkspace(this.project.uuid, {
            files: this.docLibraryFiles,
            directories: this.docLibraryDirectories || []
        })
    }

    private async uploadFloorplanFile(file: File): Promise<void> {
        if (!this.project) {
            return
        }
        const fileId = crypto.randomUUID()
        const versionId = crypto.randomUUID()
        const now = new Date().toISOString()
        const thumbnailDataUrl = await this.createFloorplanThumbnailIfNeeded(file)
        const version = await this.projectDocLibraryStorage.uploadFileVersion(this.project.uuid, file, {
            fileId,
            versionId,
            folderId: this.floorplansFolderId,
            versionNumber: 1,
            lastModified: file.lastModified || Date.now()
        })
        this.docLibraryFiles.push({
            id: fileId,
            folderId: this.floorplansFolderId,
            documentKind: 'drawing',
            storageKey: this.project.uuid,
            sourceFileName: file.name,
            name: this.projectDocLibraryStorage.getDisplayNameFromSourceFileName(file.name),
            extension: this.getExtension(file.name),
            createdAt: now,
            updatedAt: now,
            versions: [{
                ...version,
                thumbnailDataUrl: thumbnailDataUrl || version.thumbnailDataUrl
            }]
        })
    }

    private getTakeoffCellValue(file: ProjectDocLibraryFileRecord, column: FirewireTakeoffColumnDefinition): number | null {
        const placementCounts = this.getFloorplanCategoryPlacementCounts()
        const hasPlacements = placementCounts.size > 0
        if (hasPlacements) {
            return placementCounts.get(file.id)?.get(column.key) || 0
        }
        const firstFloorplan = this.getFloorplanFiles()[0]
        return firstFloorplan?.id === file.id ? Number(column.sourceQty || 0) : null
    }

    private getFloorplanCategoryPlacementCounts(): Map<string, Map<string, number>> {
        const counts = new Map<string, Map<string, number>>()
        for (const file of this.getFloorplanFiles()) {
            for (const annotation of file.floorplanDesign?.annotations || []) {
                if (annotation.kind !== 'symbol' || !annotation.categoryKey) {
                    continue
                }
                const rowCounts = counts.get(file.id) || new Map<string, number>()
                rowCounts.set(annotation.categoryKey, (rowCounts.get(annotation.categoryKey) || 0) + 1)
                counts.set(file.id, rowCounts)
            }
        }
        return counts
    }

    private getFloorplanDesignerSymbols(): FloorplanDesignerSymbolOption[] {
        const inventory = this.getFloorplanSymbolInventory()
        const placedCounts = this.getFloorplanSymbolPlacementCounts()
        return inventory.map((symbol) => {
            const placedQty = placedCounts.get(symbol.id) || 0
            return {
                ...symbol,
                placedQty,
                remainingQty: Math.max(0, symbol.totalQty - placedQty)
            }
        })
    }

    private getFloorplanSymbolInventory(): FloorplanDesignerSymbolOption[] {
        const bySymbol = new Map<string, FloorplanDesignerSymbolOption>()
        for (const section of this.getBomSections()) {
            for (const row of section.rows || []) {
                const categoryName = String(row.type || '').trim()
                const qty = Math.max(0, Math.trunc(Number(row.qty || 0)))
                if (!row.includeOnFloorplan || !categoryName) {
                    continue
                }
                const categoryKey = `category-${this.normalizeKey(categoryName)}`
                const partNumber = String(row.partNbr || '').trim()
                const deviceName = String(row.description || row.partNbr || categoryName).trim()
                const id = this.getFloorplanSymbolIdForBomRow(row)
                const existing = bySymbol.get(id)
                if (existing) {
                    existing.totalQty += qty
                    continue
                }
                bySymbol.set(id, {
                    id,
                    code: this.createFloorplanSymbolCode(categoryName, deviceName),
                    label: deviceName,
                    color: this.getFloorplanSymbolColor(categoryKey),
                    totalQty: qty,
                    placedQty: 0,
                    remainingQty: qty,
                    categoryKey,
                    categoryName,
                    partNumber,
                    deviceName,
                    materialCost: Number(row.cost || 0),
                    laborHours: Number(row.labor || 0),
                    customAttributes: []
                })
            }
        }
        return [...bySymbol.values()]
    }

    private getFloorplanSymbolPlacementCounts(overrideFileId?: string, overrideDesign?: ProjectFloorplanDesignState): Map<string, number> {
        const counts = new Map<string, number>()
        for (const file of this.getFloorplanFiles()) {
            const design = overrideFileId && file.id === overrideFileId ? overrideDesign : file.floorplanDesign
            for (const annotation of design?.annotations || []) {
                if (annotation.kind !== 'symbol' || !annotation.symbolId) {
                    continue
                }
                counts.set(annotation.symbolId, (counts.get(annotation.symbolId) || 0) + 1)
            }
        }
        return counts
    }

    private getFloorplanSymbolBalanceErrors(overrideFileId?: string, overrideDesign?: ProjectFloorplanDesignState): string[] {
        const inventory = new Map(this.getFloorplanSymbolInventory().map((symbol) => [symbol.id, symbol]))
        const placedCounts = this.getFloorplanSymbolPlacementCounts(overrideFileId, overrideDesign)
        const errors: string[] = []
        for (const [symbolId, placedQty] of placedCounts) {
            const symbol = inventory.get(symbolId)
            if (!symbol) {
                errors.push(`A placed symbol no longer exists on the BOM. Remove ${placedQty} orphaned placement${placedQty === 1 ? '' : 's'} from the floorplans.`)
            }
        }
        if (errors.length > 0) {
            this.dialog.open(FloorplanSymbolBalanceDialog, {
                width: '520px',
                maxWidth: '92vw',
                panelClass: 'fw-compact-dialog-pane',
                data: { errors } as FloorplanSymbolBalanceDialogData
            })
        }
        return errors
    }

    private syncFloorplanQuantitiesToBom(): void {
        const placedCounts = this.getFloorplanSymbolPlacementCounts()
        const synchronized = new Set<string>()
        for (const section of this.getBomSections()) {
            for (const row of section.rows || []) {
                if (!row.includeOnFloorplan || !String(row.type || '').trim()) {
                    continue
                }
                const symbolId = this.getFloorplanSymbolIdForBomRow(row)
                row.qty = synchronized.has(symbolId) ? 0 : (placedCounts.get(symbolId) || 0)
                synchronized.add(symbolId)
            }
        }
        this.refreshTakeoffColumnDefinitions()
    }

    private getFloorplanSymbolIdForBomRow(row: any): string {
        const categoryName = String(row.type || '').trim()
        const categoryKey = `category-${this.normalizeKey(categoryName)}`
        const partNumber = String(row.partNbr || '').trim()
        const deviceName = String(row.description || row.partNbr || categoryName).trim()
        return `${categoryKey}::${this.normalizeKey(partNumber || deviceName)}`
    }

    private async persistBomAfterFloorplanSync(): Promise<void> {
        if (!this.project) {
            return
        }
        const worksheetData = {
            ...(this.project.worksheetData || {}),
            bomSections: this.getBomSections()
        }
        const response = await firstValueFrom(this.http.patch<{ data?: FirewireProjectSchema }>(`/api/firewire/projects/firewire/${this.project.uuid}`, {
            ...this.project,
            worksheetData
        }))
        if (response?.data) {
            this.project = response.data
            this.refreshTakeoffColumnDefinitions()
        }
    }

    private getFloorplanAreaName(file: ProjectDocLibraryFileRecord): string {
        return String(file.name || 'Floorplan').replace(/\.[^/.]+$/, '').trim() || 'Floorplan'
    }

    private getFloorplanVersionContent(file: ProjectDocLibraryFileRecord): string {
        const version = this.getLatestVersion(file)
        return version?.dataUrl || version?.contentUrl || ''
    }

    private getLatestVersion(file: ProjectDocLibraryFileRecord): ProjectDocLibraryFileVersionRecord | undefined {
        return file.versions?.[file.versions.length - 1]
    }

    private getBomSections(): any[] {
        return Array.isArray(this.project?.worksheetData?.bomSections) ? this.project?.worksheetData?.bomSections : []
    }

    private syncTakeoffMatrixShape(): void {
        if (this.takeoffColumnDefinitionCache.length <= 0) {
            this.refreshTakeoffColumnDefinitions()
        }
    }

    private normalizeKey(value: string): string {
        return String(value || '').trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '') || 'item'
    }

    private createFloorplanSymbolCode(categoryName: string, deviceName: string): string {
        const source = String(categoryName || deviceName || 'SY').trim()
        const words = source.split(/[^a-z0-9]+/i).filter(Boolean)
        const code = words.length > 1 ? words.map((word) => word[0]).join('') : source.slice(0, 3)
        return code.slice(0, 3).toUpperCase() || 'SY'
    }

    private getFloorplanSymbolColor(key: string): string {
        const palette = ['#77d7ff', '#ffcf7a', '#ff8d8d', '#9effb6', '#d49bff', '#8dd7ff', '#ffd07f', '#a5f3fc']
        let hash = 0
        for (const char of key) {
            hash = ((hash << 5) - hash) + char.charCodeAt(0)
            hash |= 0
        }
        return palette[Math.abs(hash) % palette.length]
    }

    private isFloorplanUploadFile(file: File): boolean {
        const mimeType = String(file.type || '').toLowerCase()
        const extension = this.getExtension(file.name)
        return mimeType.startsWith('image/') || mimeType === 'application/pdf' || ['pdf', 'png', 'jpg', 'jpeg', 'webp', 'gif'].includes(extension)
    }

    private getExtension(fileName: string): string {
        const match = String(fileName || '').match(/\.([^.]+)$/)
        return match ? match[1].toLowerCase() : ''
    }

    private async createFloorplanThumbnailIfNeeded(file: File): Promise<string> {
        if (!String(file.type || '').toLowerCase().startsWith('image/')) {
            return ''
        }
        return await new Promise((resolve) => {
            const reader = new FileReader()
            reader.onload = () => resolve(String(reader.result || ''))
            reader.onerror = () => resolve('')
            reader.readAsDataURL(file)
        })
    }
}

@Component({
    standalone: true,
    selector: 'design-floorplan-delete-dialog',
    imports: [CommonModule, MatButtonModule, MatDialogActions, MatDialogClose, MatDialogContent, MatDialogTitle],
    template: `
        <h2 mat-dialog-title>Delete Floorplan</h2>
        <mat-dialog-content>
            Delete <strong>{{data.fileName}}</strong>? This removes it from this workspace.
        </mat-dialog-content>
        <mat-dialog-actions align="end">
            <button mat-button mat-dialog-close type="button">Cancel</button>
            <button mat-flat-button color="warn" type="button" (click)="confirm()">Delete</button>
        </mat-dialog-actions>
    `
})
export class DesignFloorplanDeleteDialog {
    readonly data = inject<{ fileName: string }>(MAT_DIALOG_DATA)
    private readonly dialogRef = inject(MatDialogRef<DesignFloorplanDeleteDialog>)

    confirm(): void {
        this.dialogRef.close(true)
    }
}
