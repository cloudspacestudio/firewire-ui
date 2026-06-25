import { CommonModule } from '@angular/common'
import { AfterViewInit, Component, ElementRef, EventEmitter, inject, Input, OnChanges, OnDestroy, Output, SimpleChanges, ViewChild } from '@angular/core'
import { FormsModule } from '@angular/forms'
import { HttpClient } from '@angular/common/http'
import { MatButtonModule } from '@angular/material/button'
import { MatIconModule } from '@angular/material/icon'
import { firstValueFrom } from 'rxjs'

import {
    ProjectFloorplanDesignAnnotation,
    ProjectFloorplanDesignState,
    ProjectFloorplanSymbolAttribute
} from '../../common/services/project-doc-library-storage.service'

export type FloorplanDesignerTool = 'select' | 'pan' | 'symbol' | 'note' | 'sticky'

export interface FloorplanDesignerSaveEvent {
    design: ProjectFloorplanDesignState
}

export interface FloorplanDesignerVersionRequest {
    file: File
    versionName: string
    versionNotes: string
}

export interface FloorplanDesignerSymbolOption {
    id: string
    bomRowId?: string
    code: string
    label: string
    color: string
    totalQty: number
    placedQty: number
    remainingQty: number
    categoryKey: string
    categoryName: string
    partNumber: string
    deviceName: string
    materialCost?: number
    laborHours?: number
    customAttributes?: ProjectFloorplanSymbolAttribute[]
}

@Component({
    standalone: true,
    selector: 'floorplan-designer',
    imports: [CommonModule, FormsModule, MatButtonModule, MatIconModule],
    templateUrl: './floorplan-designer.component.html',
    styleUrls: ['./floorplan-designer.component.scss']
})
export class FloorplanDesignerComponent implements OnChanges, AfterViewInit, OnDestroy {
    private readonly http = inject(HttpClient)

    @Input() title = 'Floorplan'
    @Input() sourceUrl = ''
    @Input() mimeType = ''
    @Input() design?: ProjectFloorplanDesignState
    @Input() symbols: FloorplanDesignerSymbolOption[] = []
    @Input() showHeader = true
    @Input() showActions = true
    @Input() closeLabel = 'Cancel'

    @Output() saveDesign = new EventEmitter<FloorplanDesignerSaveEvent>()
    @Output() closeDesigner = new EventEmitter<void>()
    @Output() versionRequested = new EventEmitter<FloorplanDesignerVersionRequest>()

    @ViewChild('stage')
    stage?: ElementRef<HTMLElement>

    @ViewChild('pdfCanvas')
    pdfCanvas?: ElementRef<HTMLCanvasElement>

    tool: FloorplanDesignerTool = 'select'
    selectedSymbol?: FloorplanDesignerSymbolOption
    annotations: ProjectFloorplanDesignAnnotation[] = []
    selectedAnnotation?: ProjectFloorplanDesignAnnotation
    zoomLevel = 1
    statusText = 'Choose a tool, then click the floorplan.'
    showLayerMenu = false
    showSymbolLayer = true
    showNoteLayer = true
    versionDialogOpen = false
    versionName = ''
    versionNotes = ''
    versionFile?: File
    isPanning = false
    imageNaturalWidth = 0
    imageNaturalHeight = 0
    pdfCssWidth = 0
    pdfCssHeight = 0
    pdfRenderWorking = false
    renderError = ''
    imageDisplayUrl = ''
    baseLayerReady = false
    private panStartX = 0
    private panStartY = 0
    private panStartScrollLeft = 0
    private panStartScrollTop = 0
    private pdfWorkerConfigured = false
    private pdfRenderToken = 0
    private imageObjectUrl = ''
    private versionSourceObjectUrl = ''
    private initialSymbolCounts = new Map<string, number>()
    private initialDesignSignature = ''

    ngOnChanges(changes: SimpleChanges): void {
        if (changes['design']) {
            this.annotations = [...(this.design?.annotations || [])]
            this.selectedAnnotation = undefined
            this.refreshInitialSymbolCounts()
            this.initialDesignSignature = this.serializeDesign(this.getCurrentDesignState())
        }
        if (changes['symbols'] || changes['design']) {
            this.syncSelectedSymbol()
        }
        if (changes['sourceUrl'] || changes['mimeType']) {
            this.renderError = ''
            this.baseLayerReady = false
            this.imageNaturalWidth = 0
            this.imageNaturalHeight = 0
            this.pdfCssWidth = 0
            this.pdfCssHeight = 0
            if (this.isPdfSource()) {
                this.setImageDisplayUrl('')
                queueMicrotask(() => void this.renderPdf())
            } else {
                queueMicrotask(() => void this.prepareImageSource())
            }
        }
    }

    ngAfterViewInit(): void {
        if (this.isPdfSource()) {
            queueMicrotask(() => void this.renderPdf())
        }
    }

    ngOnDestroy(): void {
        this.revokeImageObjectUrl()
        this.revokeVersionSourceObjectUrl()
    }

    isPdfSource(): boolean {
        return String(this.mimeType || '').toLowerCase() === 'application/pdf'
            || String(this.sourceUrl || '').toLowerCase().startsWith('data:application/pdf')
    }

    getSurfaceWidth(): string {
        const baseWidth = this.isPdfSource() ? this.pdfCssWidth : this.imageNaturalWidth
        return baseWidth > 0 ? `${Math.max(1, Math.round(baseWidth * this.zoomLevel))}px` : `${this.zoomLevel * 100}%`
    }

    getSurfaceHeight(): string {
        const baseHeight = this.isPdfSource() ? this.pdfCssHeight : this.imageNaturalHeight
        return baseHeight > 0 ? `${Math.max(1, Math.round(baseHeight * this.zoomLevel))}px` : 'auto'
    }

    getPdfCanvasWidth(): string {
        return this.pdfCssWidth > 0 ? `${Math.round(this.pdfCssWidth * this.zoomLevel)}px` : '100%'
    }

    getPdfCanvasHeight(): string {
        return this.pdfCssHeight > 0 ? `${Math.round(this.pdfCssHeight * this.zoomLevel)}px` : 'auto'
    }

    get annotationSurfaceReady(): boolean {
        if (!this.sourceUrl || this.renderError) {
            return false
        }
        if (this.isPdfSource()) {
            return this.baseLayerReady && this.pdfCssWidth > 0 && this.pdfCssHeight > 0
        }
        return this.baseLayerReady && this.imageNaturalWidth > 0 && this.imageNaturalHeight > 0
    }

    get visibleAnnotations(): ProjectFloorplanDesignAnnotation[] {
        if (!this.annotationSurfaceReady) {
            return []
        }
        return this.annotations.filter((annotation) => this.isAnnotationLayerVisible(annotation))
    }

    onImageLoad(event: Event): void {
        const image = event.target as HTMLImageElement
        this.imageNaturalWidth = image.naturalWidth || image.clientWidth || 1
        this.imageNaturalHeight = image.naturalHeight || image.clientHeight || 1
        this.baseLayerReady = true
    }

    setTool(tool: FloorplanDesignerTool): void {
        if (tool === 'symbol' && !this.showSymbolLayer) {
            this.tool = 'select'
            this.selectedAnnotation = undefined
            this.statusText = 'Symbol layer is hidden. Show the Symbols layer before placing or editing symbols.'
            return
        }
        if ((tool === 'note' || tool === 'sticky') && !this.showNoteLayer) {
            this.tool = 'select'
            this.selectedAnnotation = undefined
            this.statusText = 'Notes layer is hidden. Show the Notes layer before placing or editing notes.'
            return
        }
        this.tool = tool
        if (tool === 'symbol' && !this.selectedSymbol && this.symbols.length > 0) {
            this.selectedSymbol = this.symbols[0]
        }
        this.statusText = tool === 'pan' ? 'Drag the canvas to pan.' : 'Click the floorplan to place or select items.'
    }

    selectSymbol(symbol: FloorplanDesignerSymbolOption): void {
        if (!this.showSymbolLayer) {
            this.statusText = 'Symbol layer is hidden. Show the Symbols layer before placing symbols.'
            return
        }
        this.selectedSymbol = symbol
        this.statusText = `${this.getSymbolPrimaryText(symbol)}: ${this.getSymbolDescriptionText(symbol)}. Click the floorplan to place another symbol.`
    }

    getSymbolRemaining(symbol: FloorplanDesignerSymbolOption): number {
        const initialCurrentCount = this.initialSymbolCounts.get(symbol.id) || 0
        const currentCount = this.getCurrentSymbolCount(symbol.id)
        return Math.max(0, Number(symbol.remainingQty || 0) + initialCurrentCount - currentCount)
    }

    getSymbolPlacedText(symbol: FloorplanDesignerSymbolOption): string {
        return `${this.getCurrentSymbolCount(symbol.id)} placed`
    }

    getSymbolPrimaryText(symbol: FloorplanDesignerSymbolOption): string {
        const partNumber = String(symbol.partNumber || '').trim()
        const categoryName = String(symbol.categoryName || '').trim()
        return [partNumber, categoryName].filter(Boolean).join(' · ') || String(symbol.label || 'BOM Symbol').trim()
    }

    getSymbolDescriptionText(symbol: FloorplanDesignerSymbolOption): string {
        return String(symbol.label || symbol.deviceName || '').trim() || 'No description'
    }

    getStickyFontSize(text?: string): number {
        const normalizedLength = String(text || '').replace(/\s+/g, ' ').trim().length
        if (normalizedLength <= 8) {
            return 24
        }
        if (normalizedLength <= 18) {
            return 20
        }
        if (normalizedLength <= 36) {
            return 16
        }
        if (normalizedLength <= 72) {
            return 13
        }
        return 11
    }

    zoomIn(): void {
        this.zoomLevel = Math.min(4, Number((this.zoomLevel + 0.1).toFixed(2)))
        if (this.isPdfSource()) {
            void this.renderPdf()
        }
    }

    zoomOut(): void {
        this.zoomLevel = Math.max(0.25, Number((this.zoomLevel - 0.1).toFixed(2)))
        if (this.isPdfSource()) {
            void this.renderPdf()
        }
    }

    resetView(): void {
        this.zoomLevel = 1
        if (this.stage?.nativeElement) {
            this.stage.nativeElement.scrollLeft = 0
            this.stage.nativeElement.scrollTop = 0
        }
        if (this.isPdfSource()) {
            void this.renderPdf()
        }
    }

    toggleLayerMenu(): void {
        this.showLayerMenu = !this.showLayerMenu
    }

    setLayerVisibility(layer: 'symbols' | 'notes', visible: boolean): void {
        if (layer === 'symbols') {
            this.showSymbolLayer = visible
            if (!visible) {
                if (this.tool === 'symbol') {
                    this.tool = 'select'
                }
                if (this.selectedAnnotation?.kind === 'symbol') {
                    this.selectedAnnotation = undefined
                }
                this.statusText = 'Symbol layer hidden. Symbol placement and symbol selection are disabled.'
            }
        }
        if (layer === 'notes') {
            this.showNoteLayer = visible
            if (!visible) {
                if (this.tool === 'note' || this.tool === 'sticky') {
                    this.tool = 'select'
                }
                if (this.selectedAnnotation && this.selectedAnnotation.kind !== 'symbol') {
                    this.selectedAnnotation = undefined
                }
                this.statusText = 'Notes layer hidden. Note placement and note selection are disabled.'
            }
        }
    }

    openVersionDialog(): void {
        this.showLayerMenu = false
        this.versionDialogOpen = true
        this.versionFile = undefined
        this.versionName = this.getDefaultVersionName()
        this.versionNotes = ''
    }

    closeVersionDialog(): void {
        this.versionDialogOpen = false
        this.versionFile = undefined
        this.versionNotes = ''
    }

    onVersionFileSelected(event: Event): void {
        const input = event.target as HTMLInputElement
        this.versionFile = input.files?.[0]
        if (this.versionFile && (!this.versionName || this.versionName === this.getDefaultVersionName())) {
            this.versionName = this.getDefaultVersionName()
        }
    }

    submitVersionRequest(): void {
        if (!this.versionFile) {
            this.statusText = 'Choose a replacement base layer file before creating a version.'
            return
        }
        this.versionRequested.emit({
            file: this.versionFile,
            versionName: String(this.versionName || '').trim() || this.getDefaultVersionName(),
            versionNotes: String(this.versionNotes || '').trim()
        })
        this.previewVersionBaseLayer(this.versionFile)
        this.statusText = `Base layer preview swapped to ${this.versionFile.name}. Save the design after confirming the new version.`
        this.closeVersionDialog()
    }

    beginPan(event: MouseEvent): void {
        if (this.tool !== 'pan' || event.button !== 0 || !this.stage?.nativeElement) {
            return
        }
        this.isPanning = true
        this.panStartX = event.clientX
        this.panStartY = event.clientY
        this.panStartScrollLeft = this.stage.nativeElement.scrollLeft
        this.panStartScrollTop = this.stage.nativeElement.scrollTop
        event.preventDefault()
    }

    continuePan(event: MouseEvent): void {
        if (!this.isPanning || !this.stage?.nativeElement) {
            return
        }
        this.stage.nativeElement.scrollLeft = this.panStartScrollLeft - (event.clientX - this.panStartX)
        this.stage.nativeElement.scrollTop = this.panStartScrollTop - (event.clientY - this.panStartY)
    }

    endPan(): void {
        this.isPanning = false
    }

    onSurfaceClick(event: MouseEvent): void {
        if (this.tool === 'select' || this.tool === 'pan' || this.isPanning) {
            return
        }
        if (!this.annotationSurfaceReady) {
            this.statusText = 'Floorplan is still loading. Symbols and notes will be available when the base layer is ready.'
            return
        }
        if (this.tool === 'symbol' && !this.showSymbolLayer) {
            this.statusText = 'Symbol layer is hidden. Open Layers and show Symbols before placing symbols.'
            return
        }
        if ((this.tool === 'note' || this.tool === 'sticky') && !this.showNoteLayer) {
            this.statusText = 'Notes layer is hidden. Open Layers and show Notes before placing notes.'
            return
        }
        if (this.tool === 'symbol' && !this.selectedSymbol) {
            this.statusText = 'No BOM symbols are available to place.'
            return
        }

        const surface = event.currentTarget as HTMLElement
        const rect = surface.getBoundingClientRect()
        const xRatio = Math.max(0, Math.min(1, (event.clientX - rect.left) / rect.width))
        const yRatio = Math.max(0, Math.min(1, (event.clientY - rect.top) / rect.height))
        const annotation = this.createAnnotation(xRatio, yRatio)
        this.annotations = [...this.annotations, annotation]
        if (this.tool === 'symbol') {
            this.selectedAnnotation = undefined
            this.statusText = this.selectedSymbol
                ? `${this.selectedSymbol.label} placed. BOM quantity will update when the design is saved.`
                : 'Symbol placed.'
            return
        }
        this.selectedAnnotation = annotation
        this.tool = 'select'
        this.statusText = 'Item placed.'
    }

    selectAnnotation(annotation: ProjectFloorplanDesignAnnotation, event: MouseEvent): void {
        event.stopPropagation()
        if (!this.isAnnotationLayerVisible(annotation)) {
            this.statusText = annotation.kind === 'symbol'
                ? 'Symbol layer is hidden. Show the Symbols layer before selecting symbols.'
                : 'Notes layer is hidden. Show the Notes layer before selecting notes.'
            return
        }
        this.selectedAnnotation = annotation
        this.tool = 'select'
    }

    deleteSelected(): void {
        if (!this.selectedAnnotation) {
            return
        }
        this.annotations = this.annotations.filter((item) => item.id !== this.selectedAnnotation?.id)
        this.selectedAnnotation = undefined
        this.statusText = 'Item deleted.'
    }

    save(): void {
        this.saveDesign.emit({ design: this.getCurrentDesignState() })
    }

    close(): void {
        this.closeDesigner.emit()
    }

    getCurrentDesignState(): ProjectFloorplanDesignState {
        return {
            annotations: this.annotations,
            updatedAt: new Date().toISOString()
        }
    }

    isDirty(): boolean {
        return this.serializeDesign(this.getCurrentDesignState()) !== this.initialDesignSignature
    }

    private async renderPdf(): Promise<void> {
        if (!this.sourceUrl || !this.pdfCanvas?.nativeElement) {
            return
        }
        const token = ++this.pdfRenderToken
        this.pdfRenderWorking = true
        this.renderError = ''
        try {
            const pdfjs = await import('pdfjs-dist')
            if (!this.pdfWorkerConfigured) {
                pdfjs.GlobalWorkerOptions.workerSrc = new URL('pdfjs-dist/build/pdf.worker.mjs', import.meta.url).toString()
                this.pdfWorkerConfigured = true
            }

            const bytes = await this.loadSourceBytes(this.sourceUrl)
            this.assertPdfBytes(bytes)
            const pdf = await pdfjs.getDocument({ data: bytes }).promise
            const page = await pdf.getPage(1)
            const baseViewport = page.getViewport({ scale: 1 })
            const renderScale = Math.max(1, window.devicePixelRatio || 1) * this.zoomLevel
            const viewport = page.getViewport({ scale: renderScale })
            const canvas = this.pdfCanvas.nativeElement
            const context = canvas.getContext('2d')
            if (!context || token !== this.pdfRenderToken) {
                return
            }

            this.pdfCssWidth = baseViewport.width
            this.pdfCssHeight = baseViewport.height
            canvas.width = Math.ceil(viewport.width)
            canvas.height = Math.ceil(viewport.height)
            await page.render({
                canvas,
                canvasContext: context,
                viewport
            }).promise
            if (token === this.pdfRenderToken) {
                this.baseLayerReady = true
            }
        } catch (err: any) {
            this.renderError = err?.message || 'Unable to render the PDF floorplan.'
            if (token === this.pdfRenderToken) {
                this.baseLayerReady = false
            }
        } finally {
            if (token === this.pdfRenderToken) {
                this.pdfRenderWorking = false
            }
        }
    }

    private async prepareImageSource(): Promise<void> {
        if (!this.sourceUrl) {
            this.setImageDisplayUrl('')
            return
        }
        if (this.isDirectBrowserUrl(this.sourceUrl)) {
            this.setImageDisplayUrl(this.sourceUrl)
            return
        }

        try {
            const blob = await firstValueFrom(this.http.get(this.sourceUrl, { responseType: 'blob' }))
            this.setImageDisplayUrl(URL.createObjectURL(blob))
        } catch (err: any) {
            this.renderError = err?.message || 'Unable to load the floorplan image.'
            this.setImageDisplayUrl('')
        }
    }

    private async loadSourceBytes(sourceUrl: string): Promise<ArrayBuffer> {
        if (this.isDirectBrowserUrl(sourceUrl)) {
            const response = await fetch(sourceUrl)
            if (!response.ok) {
                throw new Error(`Unable to load floorplan PDF (${response.status}).`)
            }
            return response.arrayBuffer()
        }

        return firstValueFrom(this.http.get(sourceUrl, { responseType: 'arraybuffer' }))
    }

    private assertPdfBytes(bytes: ArrayBuffer): void {
        const header = new TextDecoder('ascii').decode(new Uint8Array(bytes.slice(0, 5)))
        if (header !== '%PDF-') {
            throw new Error('Unable to render this PDF because the source content is not PDF data.')
        }
    }

    private isDirectBrowserUrl(sourceUrl: string): boolean {
        return sourceUrl.startsWith('data:') || sourceUrl.startsWith('blob:')
    }

    private setImageDisplayUrl(url: string): void {
        this.revokeImageObjectUrl()
        this.imageDisplayUrl = url
        if (url.startsWith('blob:')) {
            this.imageObjectUrl = url === this.versionSourceObjectUrl ? '' : url
        }
    }

    private revokeImageObjectUrl(): void {
        if (this.imageObjectUrl) {
            URL.revokeObjectURL(this.imageObjectUrl)
            this.imageObjectUrl = ''
        }
    }

    private revokeVersionSourceObjectUrl(): void {
        if (this.versionSourceObjectUrl) {
            URL.revokeObjectURL(this.versionSourceObjectUrl)
            this.versionSourceObjectUrl = ''
        }
    }

    private previewVersionBaseLayer(file: File): void {
        this.revokeVersionSourceObjectUrl()
        this.renderError = ''
        this.baseLayerReady = false
        this.imageNaturalWidth = 0
        this.imageNaturalHeight = 0
        this.pdfCssWidth = 0
        this.pdfCssHeight = 0
        this.mimeType = file.type || this.mimeType
        this.sourceUrl = URL.createObjectURL(file)
        this.versionSourceObjectUrl = this.sourceUrl
        if (this.isPdfSource()) {
            this.setImageDisplayUrl('')
            queueMicrotask(() => void this.renderPdf())
        } else {
            this.setImageDisplayUrl(this.sourceUrl)
        }
    }

    private createAnnotation(xRatio: number, yRatio: number): ProjectFloorplanDesignAnnotation {
        if (this.tool === 'symbol') {
            const symbol = this.selectedSymbol
            return {
                id: this.createClientId(),
                kind: 'symbol',
                xRatio,
                yRatio,
                bomRowId: symbol?.bomRowId,
                symbolId: symbol?.id,
                categoryKey: symbol?.categoryKey,
                categoryName: symbol?.categoryName,
                partNumber: symbol?.partNumber,
                deviceName: symbol?.deviceName,
                materialCost: symbol?.materialCost,
                laborHours: symbol?.laborHours,
                customAttributes: symbol?.customAttributes ? [...symbol.customAttributes] : undefined,
                symbol: symbol?.code || '?',
                label: symbol?.label || 'Symbol',
                color: symbol?.color || '#77d7ff'
            }
        }

        const kind = this.tool === 'sticky' ? 'sticky' : 'note'
        return {
            id: this.createClientId(),
            kind,
            xRatio,
            yRatio,
            label: kind === 'sticky' ? 'Sticky' : 'Note',
            text: ''
        }
    }

    private createClientId(): string {
        const cryptoApi = globalThis.crypto as Crypto | undefined
        return cryptoApi?.randomUUID
            ? cryptoApi.randomUUID()
            : `floorplan-design-${Date.now()}-${Math.random().toString(16).slice(2, 10)}`
    }

    private syncSelectedSymbol(): void {
        if (this.selectedSymbol && this.symbols.some((symbol) => symbol.id === this.selectedSymbol?.id)) {
            return
        }
        this.selectedSymbol = this.symbols[0]
    }

    private refreshInitialSymbolCounts(): void {
        this.initialSymbolCounts = this.countSymbols(this.annotations)
    }

    private getCurrentSymbolCount(symbolId: string): number {
        return this.countSymbols(this.annotations).get(symbolId) || 0
    }

    private countSymbols(annotations: ProjectFloorplanDesignAnnotation[]): Map<string, number> {
        const counts = new Map<string, number>()
        for (const annotation of annotations || []) {
            if (annotation.kind !== 'symbol' || !annotation.symbolId) {
                continue
            }
            counts.set(annotation.symbolId, (counts.get(annotation.symbolId) || 0) + 1)
        }
        return counts
    }

    private isAnnotationLayerVisible(annotation: ProjectFloorplanDesignAnnotation): boolean {
        if (annotation.kind === 'symbol') {
            return this.showSymbolLayer
        }
        return this.showNoteLayer
    }

    private getDefaultVersionName(): string {
        return `Version ${new Date().toLocaleString()}`
    }

    private serializeDesign(design: ProjectFloorplanDesignState): string {
        const annotations = (design.annotations || []).map((annotation) => ({
            id: annotation.id,
            kind: annotation.kind,
            xRatio: annotation.xRatio,
            yRatio: annotation.yRatio,
            bomRowId: annotation.bomRowId || '',
            symbolId: annotation.symbolId || '',
            categoryKey: annotation.categoryKey || '',
            categoryName: annotation.categoryName || '',
            partNumber: annotation.partNumber || '',
            deviceName: annotation.deviceName || '',
            customAttributes: annotation.customAttributes || [],
            symbol: annotation.symbol || '',
            label: annotation.label || '',
            text: annotation.text || '',
            color: annotation.color || ''
        }))
        return JSON.stringify({ annotations })
    }
}
