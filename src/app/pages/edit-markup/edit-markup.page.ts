import { CommonModule } from "@angular/common"
import { HttpClient } from "@angular/common/http"
import { Component, OnInit, inject } from "@angular/core"
import { FormsModule } from "@angular/forms"
import { ActivatedRoute, RouterLink } from "@angular/router"
import { firstValueFrom, from, map, Observable, of, switchMap } from "rxjs"

import { MatButtonModule } from "@angular/material/button"
import {
    MAT_DIALOG_DATA,
    MatDialog,
    MatDialogActions,
    MatDialogClose,
    MatDialogContent,
    MatDialogTitle
} from "@angular/material/dialog"
import { MatIconModule } from "@angular/material/icon"

import { PageToolbar } from "../../common/components/page-toolbar"
import { EditMarkupNoteRecord, EditMarkupStorageService, EditMarkupTagRecord } from "../../common/services/edit-markup-storage.service"
import { ProjectDocLibraryFileRecord, ProjectDocLibraryStorageService } from "../../common/services/project-doc-library-storage.service"
import { FirewireProjectSchema } from "../../schemas/firewire-project.schema"

interface MarkupPaletteItem {
    id: string
    code: string
    name: string
    partNumber: string
    category: string
    quantity: number
    color: string
}

interface StickyNoteColor {
    label: string
    value: string
}

type EditMarkupDirtyDialogResult = 'stay' | 'save' | 'leave'

@Component({
    standalone: true,
    selector: 'edit-markup-page',
    imports: [
        CommonModule,
        FormsModule,
        RouterLink,
        MatButtonModule,
        MatIconModule,
        PageToolbar
    ],
    providers: [HttpClient],
    templateUrl: './edit-markup.page.html',
    styleUrls: ['./edit-markup.page.scss']
})
export class EditMarkupPage implements OnInit {
    private readonly route = inject(ActivatedRoute)
    private readonly http = inject(HttpClient)
    private readonly dialog = inject(MatDialog)
    private readonly docLibraryStorage = inject(ProjectDocLibraryStorageService)
    private readonly markupStorage = inject(EditMarkupStorageService)

    projectKey = ''
    bomProjectKey = ''
    fileId = ''
    returnTo = '/'
    sourceFile?: ProjectDocLibraryFileRecord
    imageDataUrl = ''
    tags: EditMarkupTagRecord[] = []
    notes: EditMarkupNoteRecord[] = []
    paletteItems: MarkupPaletteItem[] = []
    activeItemId = ''
    selectedTagId: string | null = null
    selectedNoteId: string | null = null
    hiddenItemIds = new Set<string>()
    pageWorking = true
    saveWorking = false
    statusText = ''
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
    private moveArmed = false
    private noteDragState: {
        noteId: string
        surface: HTMLElement
        pointerId: number
        offsetXRatio: number
        offsetYRatio: number
    } | null = null
    private initialMarkupSnapshot = ''
    readonly stickyNoteColors: StickyNoteColor[] = [
        { label: 'Sunbeam', value: '#ffe66d' },
        { label: 'Melon', value: '#ffb38a' },
        { label: 'Rose', value: '#ff8fab' },
        { label: 'Mint', value: '#a7f3d0' },
        { label: 'Sky', value: '#93c5fd' },
        { label: 'Lavender', value: '#c4b5fd' }
    ]
    readonly paperNoteColor = '#fffaf0'

    async ngOnInit(): Promise<void> {
        this.projectKey = String(this.route.snapshot.queryParamMap.get('projectKey') || '').trim()
        this.bomProjectKey = String(this.route.snapshot.queryParamMap.get('bomProjectKey') || this.projectKey).trim()
        this.fileId = String(this.route.snapshot.queryParamMap.get('fileId') || '').trim()
        this.returnTo = String(this.route.snapshot.queryParamMap.get('returnTo') || '/').trim() || '/'

        if (!this.projectKey || !this.fileId) {
            this.statusText = 'Missing markup source.'
            this.pageWorking = false
            return
        }

        try {
            const [workspace, bomSections, markupWorkspace] = await Promise.all([
                this.docLibraryStorage.loadWorkspace(this.projectKey),
                this.loadBomSections(),
                this.markupStorage.loadWorkspace(this.bomProjectKey)
            ])
            this.sourceFile = workspace.files.find((file) => file.id === this.fileId)
            const latest = this.sourceFile?.versions?.[this.sourceFile.versions.length - 1]
            if (!this.sourceFile || !latest?.dataUrl || !String(latest.mimeType || '').toLowerCase().startsWith('image/')) {
                this.statusText = 'The selected drawing is not a displayable image.'
                this.pageWorking = false
                return
            }

            this.imageDataUrl = latest.dataUrl
            this.paletteItems = this.buildPaletteItems(bomSections)
            this.activeItemId = this.paletteItems[0]?.id || ''
            const markupDocument = markupWorkspace.documents.find((doc) => doc.fileId === this.fileId)
            this.tags = this.reconcileTagsWithPalette(markupDocument?.tags || [])
            this.notes = this.reconcileNotes(markupDocument?.notes || [])
            this.captureMarkupSnapshot()
            if (this.paletteItems.length <= 0) {
                this.statusText = 'No categorized BOM items with quantity are available for markup.'
            }
        } catch (err: any) {
            this.statusText = err?.error?.message || err?.message || 'Unable to open markup editor.'
        } finally {
            this.pageWorking = false
        }
    }

    get visibleTags(): EditMarkupTagRecord[] {
        return this.tags.filter((tag) => !this.hiddenItemIds.has(tag.itemId))
    }

    get isCanvasDirty(): boolean {
        return !this.pageWorking && this.initialMarkupSnapshot !== '' && this.initialMarkupSnapshot !== this.buildMarkupSnapshot()
    }

    getSurfaceStyle(): Record<string, string> {
        return { width: `${this.zoomLevel * 100}%` }
    }

    getTagStyle(tag: EditMarkupTagRecord): Record<string, string> {
        return {
            left: `${Math.max(0, Math.min(1, tag.xRatio)) * 100}%`,
            top: `${Math.max(0, Math.min(1, tag.yRatio)) * 100}%`,
            borderColor: tag.color
        }
    }

    getNoteStyle(note: EditMarkupNoteRecord): Record<string, string> {
        const style: Record<string, string> = {
            left: `${Math.max(0, Math.min(1, note.xRatio)) * 100}%`,
            top: `${Math.max(0, Math.min(1, note.yRatio)) * 100}%`,
            background: note.color,
            fontSize: `${this.getNoteFontSize(note)}px`
        }
        if (note.kind === 'paper') {
            style['width'] = '128px'
            style['height'] = `${this.getPaperNoteHeight(note)}px`
        }
        return style
    }

    getDefaultStickyNoteColor(): string {
        return this.stickyNoteColors[0]?.value || '#ffe66d'
    }

    getNotePlaceholder(note: EditMarkupNoteRecord): string {
        return note.kind === 'paper' ? 'Type note...' : 'Sticky note'
    }

    getItemTagCount(itemId: string): number {
        return this.tags.filter((tag) => tag.itemId === itemId).length
    }

    getItemRemainingCount(item: MarkupPaletteItem): number {
        return Math.max(0, item.quantity - this.getItemTagCount(item.id))
    }

    isItemComplete(item: MarkupPaletteItem): boolean {
        return this.getItemRemainingCount(item) <= 0
    }

    setActiveItem(item: MarkupPaletteItem): void {
        this.activeItemId = item.id
        this.statusText = `Active item: ${item.code} (${this.getItemTagCount(item.id)} of ${item.quantity} placed)`
    }

    toggleItemVisibility(item: MarkupPaletteItem, event: Event): void {
        event.stopPropagation()
        if (this.hiddenItemIds.has(item.id)) {
            this.hiddenItemIds.delete(item.id)
            return
        }
        this.hiddenItemIds.add(item.id)
        if (this.tags.find((tag) => tag.id === this.selectedTagId)?.itemId === item.id) {
            this.selectedTagId = null
            this.moveArmed = false
        }
    }

    clearItemTags(item: MarkupPaletteItem, event: Event): void {
        event.stopPropagation()
        this.tags = this.tags.filter((tag) => tag.itemId !== item.id)
        if (!this.tags.find((tag) => tag.id === this.selectedTagId)) {
            this.selectedTagId = null
            this.moveArmed = false
        }
    }

    selectTag(tag: EditMarkupTagRecord, event: Event): void {
        event.stopPropagation()
        this.selectedTagId = tag.id
        this.selectedNoteId = null
        this.moveArmed = false
    }

    selectNote(note: EditMarkupNoteRecord, event: Event): void {
        event.stopPropagation()
        this.selectedNoteId = note.id
        this.selectedTagId = null
        this.moveArmed = false
    }

    onNoteGripperPointerDown(note: EditMarkupNoteRecord, event: PointerEvent): void {
        event.preventDefault()
        event.stopPropagation()
        const surface = (event.currentTarget as HTMLElement).closest('.edit-markup-surface') as HTMLElement | null
        const position = surface ? this.getImageRatiosFromPointer(surface, event.clientX, event.clientY) : null
        if (!surface || !position) {
            return
        }

        this.selectedNoteId = note.id
        this.selectedTagId = null
        this.moveArmed = false
        this.noteDragState = {
            noteId: note.id,
            surface,
            pointerId: event.pointerId,
            offsetXRatio: position.xRatio - note.xRatio,
            offsetYRatio: position.yRatio - note.yRatio
        }
        ;(event.currentTarget as HTMLElement).setPointerCapture(event.pointerId)
    }

    onNoteGripperPointerMove(event: PointerEvent): void {
        if (!this.noteDragState || this.noteDragState.pointerId !== event.pointerId) {
            return
        }

        event.preventDefault()
        event.stopPropagation()
        const position = this.getImageRatiosFromPointer(this.noteDragState.surface, event.clientX, event.clientY)
        const note = this.notes.find((item) => item.id === this.noteDragState?.noteId)
        if (!position || !note) {
            return
        }

        note.xRatio = Math.max(0, Math.min(1, position.xRatio - this.noteDragState.offsetXRatio))
        note.yRatio = Math.max(0, Math.min(1, position.yRatio - this.noteDragState.offsetYRatio))
        note.updatedAt = new Date().toISOString()
    }

    onNoteGripperPointerUp(event: PointerEvent): void {
        if (!this.noteDragState || this.noteDragState.pointerId !== event.pointerId) {
            return
        }

        event.preventDefault()
        event.stopPropagation()
        this.noteDragState = null
    }

    armMoveSelected(): void {
        if (!this.selectedTagId && !this.selectedNoteId) {
            return
        }
        this.moveArmed = true
        this.statusText = 'Move armed. Click the drawing to reposition the selected markup.'
    }

    deleteSelected(): void {
        if (!this.selectedTagId && !this.selectedNoteId) {
            return
        }
        const deletedTag = this.selectedTagId
            ? this.tags.find((tag) => tag.id === this.selectedTagId)
            : undefined
        const deletedNote = this.selectedNoteId
            ? this.notes.find((note) => note.id === this.selectedNoteId)
            : undefined

        if (deletedTag) {
            this.tags = this.tags.filter((tag) => tag.id !== deletedTag.id)
            this.activeItemId = deletedTag.itemId
            this.hiddenItemIds.delete(deletedTag.itemId)
            const item = this.paletteItems.find((candidate) => candidate.id === deletedTag.itemId)
            this.statusText = item
                ? `${item.code}: ${this.getItemTagCount(item.id)} of ${item.quantity} placed.`
                : 'Deleted selected device tag.'
        }

        if (deletedNote) {
            this.notes = this.notes.filter((note) => note.id !== deletedNote.id)
            this.statusText = 'Deleted selected note.'
        }

        this.selectedTagId = null
        this.selectedNoteId = null
        this.moveArmed = false
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

        const xRatio = Math.max(0, Math.min(1, (event.clientX - rect.left) / rect.width))
        const yRatio = Math.max(0, Math.min(1, (event.clientY - rect.top) / rect.height))
        const now = new Date().toISOString()

        if (this.moveArmed && (this.selectedTagId || this.selectedNoteId)) {
            const tag = this.selectedTagId ? this.tags.find((item) => item.id === this.selectedTagId) : undefined
            if (tag) {
                tag.xRatio = xRatio
                tag.yRatio = yRatio
                tag.updatedAt = now
            }
            const note = this.selectedNoteId ? this.notes.find((item) => item.id === this.selectedNoteId) : undefined
            if (note) {
                note.xRatio = xRatio
                note.yRatio = yRatio
                note.updatedAt = now
            }
            this.moveArmed = false
            return
        }

        const item = this.paletteItems.find((candidate) => candidate.id === this.activeItemId)
        if (!item) {
            return
        }
        if (this.getItemTagCount(item.id) >= item.quantity) {
            this.statusText = `${item.code} already has all ${item.quantity} BOM item${item.quantity === 1 ? '' : 's'} placed.`
            return
        }
        this.hiddenItemIds.delete(item.id)
        const created: EditMarkupTagRecord = {
            id: this.createId(),
            itemId: item.id,
            itemCode: item.code,
            itemName: item.name,
            partNumber: item.partNumber,
            itemCategory: item.category,
            color: item.color,
            xRatio,
            yRatio,
            createdAt: now,
            updatedAt: now
        }
        this.tags = [...this.tags, created]
        this.selectedTagId = created.id
        this.selectedNoteId = null
        this.statusText = `${item.code}: ${this.getItemTagCount(item.id)} of ${item.quantity} placed.`
    }

    onMarkupToolDragStart(event: DragEvent, kind: 'sticky' | 'paper', color: string): void {
        event.dataTransfer?.setData('application/firewire-markup-tool', JSON.stringify({ kind, color }))
        event.dataTransfer?.setData('text/plain', kind)
        if (event.dataTransfer) {
            event.dataTransfer.effectAllowed = 'copy'
        }
    }

    onSurfaceDragOver(event: DragEvent): void {
        const dataTransfer = event.dataTransfer
        if (dataTransfer && Array.from(dataTransfer.types || []).includes('application/firewire-markup-tool')) {
            event.preventDefault()
            dataTransfer.dropEffect = 'copy'
        }
    }

    onSurfaceDrop(event: DragEvent): void {
        const payload = event.dataTransfer?.getData('application/firewire-markup-tool')
        if (!payload) {
            return
        }

        event.preventDefault()
        event.stopPropagation()

        try {
            const parsed = JSON.parse(payload) as { kind?: string; color?: string }
            const kind = parsed.kind === 'paper' ? 'paper' : 'sticky'
            const color = String(parsed.color || (kind === 'paper' ? this.paperNoteColor : this.getDefaultStickyNoteColor()))
            const position = this.getImageRatiosFromEvent(event)
            if (!position) {
                return
            }

            this.createNote(kind, color, position.xRatio, position.yRatio)
        } catch {
            this.statusText = 'Unable to drop note.'
        }
    }

    onNoteTextChange(note: EditMarkupNoteRecord, value: string): void {
        note.text = String(value || '')
        note.updatedAt = new Date().toISOString()
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
    }

    togglePanMode(): void {
        this.panMode = !this.panMode
        this.isPanning = false
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
        this.panStageEl.scrollLeft = this.panStartScrollLeft - (event.clientX - this.panStartX)
        this.panStageEl.scrollTop = this.panStartScrollTop - (event.clientY - this.panStartY)
    }

    onPanEnd(): void {
        this.isPanning = false
    }

    canDeactivate(): boolean | Observable<boolean> {
        if (!this.isCanvasDirty) {
            return true
        }

        return this.dialog.open(EditMarkupDirtyNavigationDialog, {
            width: '420px',
            maxWidth: '92vw',
            panelClass: 'edit-markup-dirty-dialog-pane',
            disableClose: true,
            data: {
                fileName: this.sourceFile?.name || 'this drawing'
            }
        }).afterClosed().pipe(
            map((result: EditMarkupDirtyDialogResult | undefined) => result || 'stay'),
            switchMap((result) => {
                if (result === 'leave') {
                    return of(true)
                }
                if (result === 'save') {
                    return from(this.saveMarkup())
                }
                return of(false)
            })
        )
    }

    async saveMarkup(): Promise<boolean> {
        if (!this.sourceFile) {
            return false
        }
        this.saveWorking = true
        try {
            const workspace = await this.markupStorage.loadWorkspace(this.bomProjectKey)
            const now = new Date().toISOString()
            const existing = workspace.documents.find((doc) => doc.fileId === this.fileId)
            if (existing) {
                existing.fileName = this.sourceFile.name
                existing.tags = [...this.tags]
                existing.notes = [...this.notes]
                existing.updatedAt = now
            } else {
                workspace.documents.push({
                    projectKey: this.projectKey,
                    fileId: this.fileId,
                    fileName: this.sourceFile.name,
                    tags: [...this.tags],
                    notes: [...this.notes],
                    updatedAt: now
                })
            }
            await this.markupStorage.saveWorkspace(this.bomProjectKey, workspace)
            const totalItems = this.tags.length + this.notes.length
            this.captureMarkupSnapshot()
            this.statusText = `Saved ${totalItems} markup item${totalItems === 1 ? '' : 's'}.`
            return true
        } catch (err: any) {
            this.statusText = err?.error?.message || err?.message || 'Unable to save markup.'
            return false
        } finally {
            this.saveWorking = false
        }
    }

    private buildPaletteItems(sectionsInput: any): MarkupPaletteItem[] {
        const colors = ['#ff8f3d', '#58e4ff', '#84ffbe', '#ffd166', '#c084fc', '#ff6b9d', '#a3e635', '#fb7185']
        const itemMap = new Map<string, MarkupPaletteItem>()
        const sections = Array.isArray(sectionsInput) ? sectionsInput : []

        sections.forEach((section: any) => {
            const rows = Array.isArray(section?.rows) ? section.rows : []
            rows.forEach((row: any) => {
                const quantity = Number(row?.qty || 0)
                const category = String(row?.type || '').trim()
                const partNumber = String(row?.partNbr || '').trim()
                const name = String(row?.description || partNumber || 'Unnamed BOM Item').trim()

                if (quantity <= 0 || !category) {
                    return
                }

                const id = this.createBomItemId(category, partNumber, name)
                const existing = itemMap.get(id)
                if (existing) {
                    existing.quantity += quantity
                    return
                }

                itemMap.set(id, {
                    id,
                    code: this.createBomItemCode(partNumber, name),
                    name,
                    partNumber,
                    category,
                    quantity,
                    color: colors[itemMap.size % colors.length]
                })
            })
        })

        return [...itemMap.values()]
            .sort((left, right) =>
                left.category.localeCompare(right.category)
                || left.name.localeCompare(right.name)
                || left.partNumber.localeCompare(right.partNumber))
            .map((item, index) => ({
                ...item,
                color: colors[index % colors.length]
            }))
    }

    private async loadBomSections(): Promise<any[]> {
        if (!this.bomProjectKey) {
            return []
        }

        try {
            const response = await firstValueFrom(this.http.get<{ data?: FirewireProjectSchema }>(`/api/firewire/projects/firewire/${encodeURIComponent(this.bomProjectKey)}`))
            return Array.isArray(response?.data?.worksheetData?.bomSections) ? response.data.worksheetData.bomSections : []
        } catch {
            return []
        }
    }

    private reconcileTagsWithPalette(input: EditMarkupTagRecord[]): EditMarkupTagRecord[] {
        const paletteById = new Map(this.paletteItems.map((item) => [item.id, item]))
        const countsByItemId = new Map<string, number>()
        const reconciled: EditMarkupTagRecord[] = []

        input.forEach((tag) => {
            const item = paletteById.get(tag.itemId)
            if (!item) {
                return
            }

            const nextCount = (countsByItemId.get(item.id) || 0) + 1
            if (nextCount > item.quantity) {
                return
            }

            countsByItemId.set(item.id, nextCount)
            reconciled.push({
                ...tag,
                itemCode: item.code,
                itemName: item.name,
                partNumber: item.partNumber,
                itemCategory: item.category,
                color: item.color
            })
        })

        return reconciled
    }

    private reconcileNotes(input: EditMarkupNoteRecord[]): EditMarkupNoteRecord[] {
        if (!Array.isArray(input)) {
            return []
        }

        return input
            .filter((note) => note && typeof note === 'object')
            .map((note) => ({
                id: String(note.id || this.createId()),
                kind: note.kind === 'paper' ? 'paper' : 'sticky',
                color: String(note.color || (note.kind === 'paper' ? this.paperNoteColor : this.getDefaultStickyNoteColor())),
                text: String(note.text || ''),
                xRatio: Math.max(0, Math.min(1, Number(note.xRatio || 0))),
                yRatio: Math.max(0, Math.min(1, Number(note.yRatio || 0))),
                createdAt: String(note.createdAt || new Date().toISOString()),
                updatedAt: String(note.updatedAt || note.createdAt || new Date().toISOString())
            }))
    }

    private createNote(kind: 'sticky' | 'paper', color: string, xRatio: number, yRatio: number): void {
        const now = new Date().toISOString()
        const created: EditMarkupNoteRecord = {
            id: this.createId(),
            kind,
            color,
            text: '',
            xRatio,
            yRatio,
            createdAt: now,
            updatedAt: now
        }

        this.notes = [...this.notes, created]
        this.selectedNoteId = created.id
        this.selectedTagId = null
        this.statusText = kind === 'paper' ? 'Dropped note paper. Type directly into it.' : 'Dropped sticky note. Type directly into it.'
        window.setTimeout(() => {
            const editor = document.querySelector<HTMLElement>(`[data-markup-note-editor="${created.id}"]`)
            editor?.focus()
        }, 0)
    }

    private getImageRatiosFromEvent(event: MouseEvent | DragEvent): { xRatio: number; yRatio: number } | null {
        const surface = event.currentTarget as HTMLElement
        return this.getImageRatiosFromPointer(surface, event.clientX, event.clientY)
    }

    private getImageRatiosFromPointer(surface: HTMLElement, clientX: number, clientY: number): { xRatio: number; yRatio: number } | null {
        const image = surface.querySelector('img') as HTMLImageElement | null
        const rect = image?.getBoundingClientRect() || surface.getBoundingClientRect()
        if (rect.width <= 0 || rect.height <= 0) {
            return null
        }

        return {
            xRatio: Math.max(0, Math.min(1, (clientX - rect.left) / rect.width)),
            yRatio: Math.max(0, Math.min(1, (clientY - rect.top) / rect.height))
        }
    }

    private getNoteFontSize(note: EditMarkupNoteRecord): number {
        const length = String(note.text || '').trim().length
        if (note.kind === 'paper') {
            return 12
        }

        if (length > 150) {
            return 9
        }
        if (length > 88) {
            return 10
        }
        if (length > 42) {
            return 12
        }
        return 14
    }

    private getPaperNoteHeight(note: EditMarkupNoteRecord): number {
        const text = String(note.text || '')
        const approximateCharactersPerLine = 15
        const lineCount = text
            .split(/\r?\n/)
            .reduce((total, line) => total + Math.max(1, Math.ceil(line.length / approximateCharactersPerLine)), 0)
        return Math.max(128, 32 + (lineCount * 16))
    }

    private createBomItemId(category: string, partNumber: string, name: string): string {
        return [
            this.normalizeKey(category),
            this.normalizeKey(partNumber || name)
        ].join('::')
    }

    private createBomItemCode(partNumber: string, name: string): string {
        return String(partNumber || name || 'ITEM').trim().slice(0, 8).toUpperCase()
    }

    private normalizeKey(value: string): string {
        return String(value || '').trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '')
    }

    private captureMarkupSnapshot(): void {
        this.initialMarkupSnapshot = this.buildMarkupSnapshot()
    }

    private buildMarkupSnapshot(): string {
        const tags = this.tags.map((tag) => ({
            id: tag.id,
            itemId: tag.itemId,
            itemCode: tag.itemCode,
            itemName: tag.itemName,
            partNumber: tag.partNumber || '',
            itemCategory: tag.itemCategory || '',
            color: tag.color,
            xRatio: Number(tag.xRatio || 0),
            yRatio: Number(tag.yRatio || 0)
        }))
        const notes = this.notes.map((note) => ({
            id: note.id,
            kind: note.kind,
            color: note.color,
            text: note.text,
            xRatio: Number(note.xRatio || 0),
            yRatio: Number(note.yRatio || 0)
        }))
        return JSON.stringify({ tags, notes })
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
    selector: 'edit-markup-dirty-navigation-dialog',
    imports: [
        CommonModule,
        MatButtonModule,
        MatIconModule,
        MatDialogTitle,
        MatDialogContent,
        MatDialogActions,
        MatDialogClose
    ],
    styles: [`
        :host {
            display: block;
            color: #eaf6ff;
        }

        .edit-markup-dirty-dialog {
            border: 1px solid rgba(72, 221, 255, 0.22);
            background:
                radial-gradient(circle at top left, rgba(255, 209, 102, 0.14), transparent 34%),
                linear-gradient(135deg, #07101c, #0b1726);
        }

        .edit-markup-dirty-dialog__title {
            display: flex;
            align-items: center;
            justify-content: space-between;
            gap: 12px;
            color: #84ffbe;
            letter-spacing: 0.08em;
            text-transform: uppercase;
        }

        .edit-markup-dirty-dialog__content {
            color: rgba(234, 246, 255, 0.86);
            line-height: 1.55;
        }

        .edit-markup-dirty-dialog__file {
            margin-top: 10px;
            padding: 10px;
            border: 1px solid rgba(72, 221, 255, 0.18);
            border-radius: 6px;
            background: rgba(2, 8, 16, 0.48);
            color: #58e4ff;
            font-weight: 700;
            word-break: break-word;
        }

        .edit-markup-dirty-dialog__actions {
            gap: 8px;
        }
    `],
    template: `
        <section class="edit-markup-dirty-dialog">
            <div mat-dialog-title class="edit-markup-dirty-dialog__title">
                <span>Unsaved Markup</span>
                <button mat-icon-button type="button" aria-label="Stay on editor" [mat-dialog-close]="'stay'">
                    <mat-icon>close</mat-icon>
                </button>
            </div>
            <mat-dialog-content class="edit-markup-dirty-dialog__content">
                <div>You have pending canvas changes. Save before leaving, discard the changes, or stay in the markup editor.</div>
                <div class="edit-markup-dirty-dialog__file">{{data.fileName}}</div>
            </mat-dialog-content>
            <mat-dialog-actions align="end" class="edit-markup-dirty-dialog__actions">
                <button mat-button type="button" [mat-dialog-close]="'stay'">Stay</button>
                <button mat-stroked-button type="button" [mat-dialog-close]="'leave'">Discard</button>
                <button mat-flat-button type="button" [mat-dialog-close]="'save'">Save Changes</button>
            </mat-dialog-actions>
        </section>
    `
})
export class EditMarkupDirtyNavigationDialog {
    data: { fileName: string } = inject(MAT_DIALOG_DATA)
}
