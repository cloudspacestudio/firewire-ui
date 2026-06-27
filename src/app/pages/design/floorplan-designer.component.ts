import { CommonModule } from '@angular/common'
import { AfterViewInit, Component, ElementRef, EventEmitter, inject, Input, OnChanges, OnDestroy, Output, SimpleChanges, ViewChild } from '@angular/core'
import { FormsModule } from '@angular/forms'
import { HttpClient } from '@angular/common/http'
import { MatButtonModule } from '@angular/material/button'
import { MatIconModule } from '@angular/material/icon'
import { firstValueFrom } from 'rxjs'

import {
    ProjectFloorplanCalibration,
    ProjectFloorplanCircuit,
    ProjectFloorplanCircuitSegment,
    ProjectFloorplanDesignAnnotation,
    ProjectFloorplanDesignState,
    ProjectFloorplanSymbolAttribute
} from '../../common/services/project-doc-library-storage.service'

export type FloorplanDesignerTool = 'select' | 'pan' | 'symbol' | 'note' | 'sticky' | 'calibrate' | 'joint' | 'circuit'

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
    partDescription?: string
    iconId?: string | null
    iconLabel?: string | null
    iconDataUrl?: string | null
    iconForegroundColor?: string | null
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

    @ViewChild('designerRoot')
    designerRoot?: ElementRef<HTMLElement>

    @ViewChild('surface')
    surface?: ElementRef<HTMLElement>

    @ViewChild('pdfCanvas')
    pdfCanvas?: ElementRef<HTMLCanvasElement>

    tool: FloorplanDesignerTool = 'select'
    selectedSymbol?: FloorplanDesignerSymbolOption
    annotations: ProjectFloorplanDesignAnnotation[] = []
    circuits: ProjectFloorplanCircuit[] = []
    selectedAnnotation?: ProjectFloorplanDesignAnnotation
    selectedCircuitId = ''
    selectedCircuitSegmentId = ''
    zoomLevel = 1
    statusText = 'Choose a tool, then click the floorplan.'
    showLayerMenu = false
    showStickyColorMenu = false
    showSymbolLayer = true
    showNoteLayer = true
    showCircuitLayer = true
    symbolDisplayMode: 'icon' | 'bubble' = 'icon'
    rotationDegrees = 0
    isFullscreen = false
    versionDialogOpen = false
    versionName = ''
    versionNotes = ''
    versionFile?: File
    calibration?: ProjectFloorplanCalibration
    calibrationDialogOpen = false
    calibrationKnownFeet: number | null = null
    calibrationDraft?: { startXRatio: number; startYRatio: number; endXRatio: number; endYRatio: number; pixelLength: number }
    isCalibrating = false
    circuitEditActive = false
    circuitEditOriginal?: ProjectFloorplanCircuit
    circuitActiveNodeId = ''
    circuitName = ''
    circuitColor = '#ff3448'
    circuitLineStyle: ProjectFloorplanCircuit['lineStyle'] = 'solid'
    circuitLineWeight = 1.45
    readonly circuitLineWeightOptions = [1.04, 1.45, 2.03, 2.84, 3.98]
    isPanning = false
    isDraggingAnnotation = false
    dragAnnotationId = ''
    imageNaturalWidth = 0
    imageNaturalHeight = 0
    pdfCssWidth = 0
    pdfCssHeight = 0
    pdfRenderWorking = false
    renderError = ''
    imageDisplayUrl = ''
    baseLayerReady = false
    readonly stickyColors = [
        { label: 'Yellow', value: '#fff08a' },
        { label: 'Cyan', value: '#b7f4ff' },
        { label: 'Green', value: '#baffc9' },
        { label: 'Pink', value: '#ffc1dc' },
        { label: 'Orange', value: '#ffd19a' },
        { label: 'Violet', value: '#d9c2ff' }
    ]
    selectedStickyColor = this.stickyColors[0].value
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
    private symbolPulseTimeout?: number
    pulseSymbolId = ''
    private pulseAnnotationId = ''
    private dragStartClientX = 0
    private dragStartClientY = 0
    private dragStartXRatio = 0
    private dragStartYRatio = 0
    private dragDidMove = false
    private ignoreNextAnnotationClickId = ''
    private readonly annotationDragMoveListener = (event: MouseEvent) => this.continueAnnotationDrag(event)
    private readonly annotationDragEndListener = (event: MouseEvent) => this.endAnnotationDrag(event)
    private readonly calibrationMoveListener = (event: MouseEvent) => this.continueCalibration(event)
    private readonly calibrationEndListener = (event: MouseEvent) => this.endCalibration(event)
    private readonly fullscreenChangeListener = () => {
        this.isFullscreen = document.fullscreenElement === this.designerRoot?.nativeElement
    }

    ngOnChanges(changes: SimpleChanges): void {
        if (changes['design']) {
            this.annotations = [...(this.design?.annotations || [])]
            this.circuits = (this.design?.circuits || []).map((circuit) => ({
                ...circuit,
                lineWeight: this.normalizeCircuitLineWeight(circuit.lineWeight),
                segments: (circuit.segments || []).map((segment) => ({
                    ...segment,
                    lineWeight: segment.lineWeight ? this.normalizeCircuitLineWeight(segment.lineWeight) : undefined
                }))
            }))
            this.calibration = this.design?.calibration ? { ...this.design.calibration } : undefined
            this.rotationDegrees = this.normalizeRotation(this.design?.rotationDegrees)
            this.symbolDisplayMode = this.design?.symbolDisplayMode === 'bubble' ? 'bubble' : 'icon'
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
        document.addEventListener('fullscreenchange', this.fullscreenChangeListener)
        if (this.isPdfSource()) {
            queueMicrotask(() => void this.renderPdf())
        }
    }

    ngOnDestroy(): void {
        this.revokeImageObjectUrl()
        this.revokeVersionSourceObjectUrl()
        this.clearSymbolPulse()
        this.removeAnnotationDragListeners()
        this.removeCalibrationListeners()
        document.removeEventListener('fullscreenchange', this.fullscreenChangeListener)
    }

    isPdfSource(): boolean {
        return String(this.mimeType || '').toLowerCase() === 'application/pdf'
            || String(this.sourceUrl || '').toLowerCase().startsWith('data:application/pdf')
    }

    getSurfaceWidth(): string {
        const baseWidth = this.isPdfSource() ? this.pdfCssWidth : this.imageNaturalWidth
        const baseHeight = this.isPdfSource() ? this.pdfCssHeight : this.imageNaturalHeight
        const displayWidth = this.isQuarterTurnRotation() ? baseHeight : baseWidth
        return displayWidth > 0 ? `${Math.max(1, Math.round(displayWidth * this.zoomLevel))}px` : `${this.zoomLevel * 100}%`
    }

    getSurfaceHeight(): string {
        const baseHeight = this.isPdfSource() ? this.pdfCssHeight : this.imageNaturalHeight
        const baseWidth = this.isPdfSource() ? this.pdfCssWidth : this.imageNaturalWidth
        const displayHeight = this.isQuarterTurnRotation() ? baseWidth : baseHeight
        return displayHeight > 0 ? `${Math.max(1, Math.round(displayHeight * this.zoomLevel))}px` : 'auto'
    }

    getContentWidth(): string {
        const baseWidth = this.isPdfSource() ? this.pdfCssWidth : this.imageNaturalWidth
        return baseWidth > 0 ? `${Math.max(1, Math.round(baseWidth * this.zoomLevel))}px` : `${this.zoomLevel * 100}%`
    }

    getContentHeight(): string {
        const baseHeight = this.isPdfSource() ? this.pdfCssHeight : this.imageNaturalHeight
        return baseHeight > 0 ? `${Math.max(1, Math.round(baseHeight * this.zoomLevel))}px` : 'auto'
    }

    getSurfaceContentStyle(): Record<string, string> {
        const width = Math.max(1, this.baseLayerPixelWidth * this.zoomLevel)
        const height = Math.max(1, this.baseLayerPixelHeight * this.zoomLevel)
        if (this.rotationDegrees === 90) {
            return { transform: `translateX(${height}px) rotate(90deg)` }
        }
        if (this.rotationDegrees === 180) {
            return { transform: `translate(${width}px, ${height}px) rotate(180deg)` }
        }
        if (this.rotationDegrees === 270) {
            return { transform: `translateY(${width}px) rotate(270deg)` }
        }
        return { transform: 'rotate(0deg)' }
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

    get visibleCircuits(): ProjectFloorplanCircuit[] {
        if (!this.annotationSurfaceReady || !this.showCircuitLayer) {
            return []
        }
        return this.circuits
    }

    get selectedCircuit(): ProjectFloorplanCircuit | undefined {
        return this.circuits.find((circuit) => circuit.id === this.selectedCircuitId)
    }

    get selectedCircuitSegment(): ProjectFloorplanCircuitSegment | undefined {
        const circuit = this.selectedCircuit
        return circuit?.segments.find((segment) => segment.id === this.selectedCircuitSegmentId)
    }

    get circuitEditCircuit(): ProjectFloorplanCircuit | undefined {
        return this.selectedCircuit
    }

    get baseLayerPixelWidth(): number {
        return this.isPdfSource() ? this.pdfCssWidth : this.imageNaturalWidth
    }

    get baseLayerPixelHeight(): number {
        return this.isPdfSource() ? this.pdfCssHeight : this.imageNaturalHeight
    }

    getCalibrationSummary(): string {
        if (!this.calibration) {
            return 'Scale not set'
        }
        return `${this.calibration.realWorldFeet.toFixed(2)} ft / ${Math.round(this.calibration.pixelLength)} px`
    }

    getCalibrationDetail(): string {
        if (!this.calibration) {
            return 'No scale calibration has been set for this floorplan.'
        }
        return [
            `Reference length: ${this.calibration.realWorldFeet.toFixed(2)} ft`,
            `Image pixels: ${this.calibration.pixelLength.toFixed(2)} px`,
            `Scale: ${this.calibration.feetPerPixel.toFixed(5)} ft/px`,
            `Calibrated: ${new Date(this.calibration.calibratedAt).toLocaleString()}`
        ].join('\n')
    }

    getCalibrationDraftLineStyle(): Record<string, string> {
        const draft = this.calibrationDraft
        if (!draft) {
            return {}
        }
        const startX = draft.startXRatio * 100
        const startY = draft.startYRatio * 100
        const endX = draft.endXRatio * 100
        const endY = draft.endYRatio * 100
        const dx = endX - startX
        const dy = endY - startY
        const length = Math.hypot(dx, dy)
        const angle = Math.atan2(dy, dx) * 180 / Math.PI
        return {
            left: `${startX}%`,
            top: `${startY}%`,
            width: `${length}%`,
            transform: `rotate(${angle}deg)`
        }
    }

    getCircuitSegmentLine(circuit: ProjectFloorplanCircuit, segment: ProjectFloorplanCircuitSegment): { x1: number; y1: number; x2: number; y2: number } | null {
        const from = this.getAnnotationById(segment.fromAnnotationId)
        const to = this.getAnnotationById(segment.toAnnotationId)
        if (!from || !to) {
            return null
        }
        return {
            x1: from.xRatio * 100,
            y1: from.yRatio * 100,
            x2: to.xRatio * 100,
            y2: to.yRatio * 100
        }
    }

    getCircuitSegmentColor(circuit: ProjectFloorplanCircuit, segment: ProjectFloorplanCircuitSegment): string {
        return segment.color || circuit.color || '#ff3448'
    }

    getCircuitSegmentWeight(circuit: ProjectFloorplanCircuit, segment: ProjectFloorplanCircuitSegment): number {
        return this.normalizeCircuitLineWeight(segment.lineWeight || circuit.lineWeight)
    }

    getCircuitSegmentStrokeWidth(circuit: ProjectFloorplanCircuit, segment: ProjectFloorplanCircuitSegment): number {
        return this.selectedCircuitSegmentId === segment.id
            ? this.getCircuitSegmentWeight(circuit, segment) * 1.35
            : this.getCircuitSegmentWeight(circuit, segment)
    }

    getCircuitStrokeDashArray(circuit: ProjectFloorplanCircuit, segment?: ProjectFloorplanCircuitSegment): string | null {
        const lineStyle = segment?.lineStyle || circuit.lineStyle
        if (lineStyle === 'dashed') {
            return '2.4 1.4'
        }
        if (lineStyle === 'dotted') {
            return '0.45 1.15'
        }
        return null
    }

    getCircuitSegmentLengthFeet(circuit?: ProjectFloorplanCircuit, segment?: ProjectFloorplanCircuitSegment): number {
        if (!circuit || !segment || !this.calibration) {
            return 0
        }
        const from = this.getAnnotationById(segment.fromAnnotationId)
        const to = this.getAnnotationById(segment.toAnnotationId)
        if (!from || !to) {
            return 0
        }
        return this.getImagePixelDistance(from.xRatio, from.yRatio, to.xRatio, to.yRatio) * this.calibration.feetPerPixel
    }

    getCircuitLengthFeet(circuit?: ProjectFloorplanCircuit): number {
        if (!circuit || !this.calibration) {
            return 0
        }
        return (circuit.segments || []).reduce((total, segment) => {
            const from = this.getAnnotationById(segment.fromAnnotationId)
            const to = this.getAnnotationById(segment.toAnnotationId)
            if (!from || !to) {
                return total
            }
            return total + this.getImagePixelDistance(from.xRatio, from.yRatio, to.xRatio, to.yRatio) * this.calibration!.feetPerPixel
        }, 0)
    }

    getCircuitStatusText(circuit?: ProjectFloorplanCircuit): string {
        if (!circuit) {
            return 'No circuit selected'
        }
        return `${circuit.closed ? 'Closed' : 'Open'} · ${this.getCircuitLengthFeet(circuit).toFixed(1)} ft`
    }

    isJointInCircuit(annotation: ProjectFloorplanDesignAnnotation): boolean {
        return annotation.kind === 'joint' && this.circuits.some((circuit) =>
            circuit.segments.some((segment) => segment.fromAnnotationId === annotation.id || segment.toAnnotationId === annotation.id)
        )
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
        if (tool === 'circuit' && !this.calibration) {
            this.tool = 'select'
            this.statusText = 'Set floorplan scale calibration before creating or editing circuits.'
            return
        }
        this.tool = tool
        this.showStickyColorMenu = false
        if (tool === 'circuit') {
            this.showCircuitLayer = true
        }
        if (tool === 'joint') {
            this.showCircuitLayer = true
        }
        if (tool === 'symbol' && !this.selectedSymbol && this.symbols.length > 0) {
            this.selectedSymbol = this.symbols[0]
            this.triggerSymbolPulse(this.selectedSymbol)
        }
        if (tool === 'pan') {
            this.statusText = 'Drag the canvas to pan.'
        } else if (tool === 'calibrate') {
            this.statusText = 'Drag across a known scale length, then enter the real-world distance.'
        } else if (tool === 'joint') {
            this.statusText = 'Click the floorplan to place a joint.'
        } else if (tool === 'circuit') {
            this.statusText = 'Choose Create Circuit, or select a circuit line to edit.'
        } else {
            this.statusText = 'Click the floorplan to place or select items.'
        }
    }

    selectSymbol(symbol: FloorplanDesignerSymbolOption): void {
        if (!this.showSymbolLayer) {
            this.statusText = 'Symbol layer is hidden. Show the Symbols layer before placing symbols.'
            return
        }
        this.selectedSymbol = symbol
        this.triggerSymbolPulse(symbol)
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

    getSymbolPartDescriptionText(symbol: FloorplanDesignerSymbolOption): string {
        return String(symbol.partDescription || '').replace(/\s+/g, ' ').trim()
    }

    getAnnotationIconStyle(annotation: ProjectFloorplanDesignAnnotation): Record<string, string> {
        const dataUrl = String(annotation.iconDataUrl || '').trim()
        const color = String(annotation.iconForegroundColor || '#210507').trim() || '#210507'
        return dataUrl
            ? {
                'background-color': color,
                'mask-image': `url("${dataUrl}")`,
                '-webkit-mask-image': `url("${dataUrl}")`,
            }
            : {}
    }

    getSymbolOptionIconStyle(symbol: FloorplanDesignerSymbolOption): Record<string, string> {
        const dataUrl = String(symbol.iconDataUrl || '').trim()
        const color = String(symbol.iconForegroundColor || '#210507').trim() || '#210507'
        return dataUrl
            ? {
                'background-color': color,
                'mask-image': `url("${dataUrl}")`,
                '-webkit-mask-image': `url("${dataUrl}")`,
            }
            : {}
    }

    getVerticalSymbolIconStyle(symbol: FloorplanDesignerSymbolOption): Record<string, string> {
        const dataUrl = String(symbol.iconDataUrl || '').trim()
        const color = String(symbol.iconForegroundColor || '#210507').trim() || '#210507'
        return dataUrl
            ? {
                '--floorplan-vertical-symbol-icon': `url("${dataUrl}")`,
                '--floorplan-vertical-symbol-color': color
            }
            : {}
    }

    getSymbolAnnotationStyle(): Record<string, string> {
        return {
            '--floorplan-symbol-zoom': String(this.zoomLevel)
        }
    }

    shouldRenderAnnotationIcon(annotation: ProjectFloorplanDesignAnnotation): boolean {
        return annotation.kind === 'symbol' && this.symbolDisplayMode === 'icon' && !!annotation.iconDataUrl
    }

    shouldRenderAnnotationBubble(annotation: ProjectFloorplanDesignAnnotation): boolean {
        return annotation.kind === 'symbol' && (this.symbolDisplayMode === 'bubble' || !annotation.iconDataUrl)
    }

    getSymbolToolTitle(): string {
        return this.selectedSymbol
            ? `Symbol: ${this.getSymbolPrimaryText(this.selectedSymbol)}`
            : 'Symbol'
    }

    isPulsingSymbolAnnotation(annotation: ProjectFloorplanDesignAnnotation): boolean {
        return (!!this.pulseAnnotationId && annotation.id === this.pulseAnnotationId)
            || (annotation.kind === 'symbol' && !!this.pulseSymbolId && String(annotation.symbolId || '').trim() === this.pulseSymbolId)
    }

    getStickyNoteStyle(annotation: ProjectFloorplanDesignAnnotation): Record<string, string> {
        const color = String(annotation.color || this.stickyColors[0].value).trim() || this.stickyColors[0].value
        return {
            '--floorplan-sticky-color': color
        }
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

    getNoteBodyHeight(text?: string): number {
        const lineHeight = 18
        const minLines = 12
        const maxLines = 30
        const estimatedCharactersPerLine = 34
        const lines = String(text || '')
            .split(/\r?\n/)
            .reduce((total, line) => total + Math.max(1, Math.ceil(line.length / estimatedCharactersPerLine)), 0)
        return Math.min(maxLines, Math.max(minLines, lines || minLines)) * lineHeight
    }

    noteBodyHasOverflow(text?: string): boolean {
        const estimatedCharactersPerLine = 34
        const lines = String(text || '')
            .split(/\r?\n/)
            .reduce((total, line) => total + Math.max(1, Math.ceil(line.length / estimatedCharactersPerLine)), 0)
        return lines > 30
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
        this.showStickyColorMenu = false
        this.showLayerMenu = !this.showLayerMenu
    }

    toggleStickyColorMenu(event: MouseEvent): void {
        event.stopPropagation()
        this.showLayerMenu = false
        this.showStickyColorMenu = !this.showStickyColorMenu
    }

    selectStickyColor(color: string): void {
        this.selectedStickyColor = color || this.stickyColors[0].value
        this.showStickyColorMenu = false
        this.setTool('sticky')
    }

    async toggleFullscreen(): Promise<void> {
        const root = this.designerRoot?.nativeElement
        if (!root) {
            return
        }

        try {
            if (document.fullscreenElement) {
                await document.exitFullscreen()
                this.isFullscreen = false
                return
            }

            await root.requestFullscreen()
            this.isFullscreen = true
        } catch (err: any) {
            this.statusText = err?.message || 'Unable to toggle fullscreen.'
        }
    }

    toggleSymbolDisplayMode(): void {
        this.symbolDisplayMode = this.symbolDisplayMode === 'icon' ? 'bubble' : 'icon'
        this.statusText = this.symbolDisplayMode === 'icon'
            ? 'Icon view enabled for floorplan symbols.'
            : 'Bubble view enabled for floorplan symbols.'
    }

    rotateFloorplan(): void {
        this.rotationDegrees = this.normalizeRotation(this.rotationDegrees + 90)
        this.tool = 'select'
        this.statusText = `Floorplan rotated to ${this.rotationDegrees} degrees. Save the design to persist it.`
    }

    createCircuit(): void {
        if (!this.calibration) {
            this.statusText = 'Set floorplan scale calibration before creating circuits.'
            return
        }
        const now = new Date().toISOString()
        const circuit: ProjectFloorplanCircuit = {
            id: this.createClientId(),
            name: `Circuit ${this.circuits.length + 1}`,
            color: '#ff3448',
            lineStyle: this.circuitLineStyle || 'solid',
            lineWeight: this.circuitLineWeight,
            segments: [],
            closed: false,
            createdAt: now,
            updatedAt: now
        }
        this.circuits = [...this.circuits, circuit]
        this.selectedCircuitId = circuit.id
        this.circuitName = circuit.name
        this.circuitColor = circuit.color
        this.circuitLineStyle = circuit.lineStyle
        this.circuitLineWeight = this.normalizeCircuitLineWeight(circuit.lineWeight)
        this.selectedCircuitSegmentId = ''
        this.circuitEditOriginal = undefined
        this.circuitEditActive = true
        this.circuitActiveNodeId = ''
        this.tool = 'circuit'
        this.showCircuitLayer = true
        this.statusText = 'Circuit started. Select a symbol or joint as the first circuit element.'
    }

    editSelectedCircuit(): void {
        const circuit = this.selectedCircuit
        if (!circuit) {
            this.statusText = 'Select a circuit line before editing.'
            return
        }
        this.circuitEditOriginal = { ...circuit, segments: circuit.segments.map((segment) => ({ ...segment })) }
        this.circuitEditActive = true
        this.circuitActiveNodeId = ''
        this.circuitName = circuit.name
        this.circuitColor = circuit.color
        this.circuitLineStyle = circuit.lineStyle
        this.circuitLineWeight = this.normalizeCircuitLineWeight(circuit.lineWeight)
        this.tool = 'circuit'
        this.showCircuitLayer = true
        this.statusText = 'Circuit edit mode active. Select an existing circuit element to branch or extend.'
    }

    endCircuitEdit(): void {
        if (!this.circuitEditActive) {
            return
        }
        const circuit = this.selectedCircuit
        if (circuit && circuit.segments.length <= 0) {
            this.circuits = this.circuits.filter((item) => item.id !== circuit.id)
            this.selectedCircuitId = ''
        }
        this.circuitEditActive = false
        this.circuitEditOriginal = undefined
        this.circuitActiveNodeId = ''
        this.selectedCircuitSegmentId = ''
        this.tool = 'select'
        this.statusText = circuit
            ? `Circuit saved as ${this.getCircuitStatusText(circuit)}. Save the design to persist it.`
            : 'Circuit edit ended.'
    }

    cancelCircuitEdit(): void {
        if (!this.circuitEditActive) {
            return
        }
        if (this.circuitEditOriginal) {
            this.circuits = this.circuits.map((circuit) =>
                circuit.id === this.circuitEditOriginal?.id
                    ? { ...this.circuitEditOriginal, segments: this.circuitEditOriginal.segments.map((segment) => ({ ...segment })) }
                    : circuit
            )
            this.selectedCircuitId = this.circuitEditOriginal.id
        } else if (this.selectedCircuitId) {
            this.circuits = this.circuits.filter((circuit) => circuit.id !== this.selectedCircuitId)
            this.selectedCircuitId = ''
        }
        this.circuitEditActive = false
        this.circuitEditOriginal = undefined
        this.circuitActiveNodeId = ''
        this.selectedCircuitSegmentId = ''
        this.tool = 'select'
        this.statusText = 'Circuit edit reset.'
    }

    exitCircuitMode(): void {
        if (this.circuitEditActive) {
            this.statusText = 'End Circuit to keep the current circuit changes, or Reset before exiting.'
            return
        }
        this.circuitActiveNodeId = ''
        this.selectedCircuitSegmentId = ''
        this.tool = 'select'
        this.statusText = 'Circuit mode exited.'
    }

    selectCircuit(circuit: ProjectFloorplanCircuit, event?: MouseEvent): void {
        event?.stopPropagation()
        if (!this.showCircuitLayer) {
            return
        }
        this.selectedCircuitId = circuit.id
        this.selectedCircuitSegmentId = ''
        this.selectedAnnotation = undefined
        this.circuitName = circuit.name
        this.circuitColor = circuit.color
        this.circuitLineStyle = circuit.lineStyle
        this.circuitLineWeight = this.normalizeCircuitLineWeight(circuit.lineWeight)
        this.statusText = `${circuit.name}: ${this.getCircuitStatusText(circuit)}.`
        if (this.tool === 'circuit' && !this.circuitEditActive) {
            this.editSelectedCircuit()
        }
    }

    deleteSelectedCircuit(): void {
        if (!this.selectedCircuitId) {
            this.statusText = 'Select a circuit before deleting.'
            return
        }
        const circuitName = this.selectedCircuit?.name || 'Circuit'
        this.circuits = this.circuits.filter((circuit) => circuit.id !== this.selectedCircuitId)
        this.selectedCircuitId = ''
        this.selectedCircuitSegmentId = ''
        this.circuitEditActive = false
        this.circuitEditOriginal = undefined
        this.circuitActiveNodeId = ''
        this.statusText = `${circuitName} deleted. Save the design to persist it.`
    }

    selectCircuitSegment(circuit: ProjectFloorplanCircuit, segment: ProjectFloorplanCircuitSegment, event?: MouseEvent): void {
        event?.stopPropagation()
        if (!this.showCircuitLayer) {
            return
        }
        this.selectedCircuitId = circuit.id
        this.selectedCircuitSegmentId = segment.id
        this.selectedAnnotation = undefined
        this.circuitName = circuit.name
        this.circuitColor = segment.color || circuit.color
        this.circuitLineStyle = segment.lineStyle || circuit.lineStyle
        this.circuitLineWeight = this.normalizeCircuitLineWeight(segment.lineWeight || circuit.lineWeight)
        this.statusText = `${circuit.name} segment: ${this.getCircuitSegmentLengthFeet(circuit, segment).toFixed(1)} ft.`
    }

    updateCircuitStyle(): void {
        const circuit = this.selectedCircuit
        if (!circuit) {
            return
        }
        const name = String(this.circuitName || '').trim() || circuit.name
        const lineWeight = this.normalizeCircuitLineWeight(this.circuitLineWeight)
        this.circuits = this.circuits.map((item) =>
            item.id === circuit.id
                ? this.selectedCircuitSegmentId
                    ? {
                        ...item,
                        name,
                        segments: item.segments.map((segment) =>
                            segment.id === this.selectedCircuitSegmentId
                                ? {
                                    ...segment,
                                    color: this.circuitColor || item.color || '#ff3448',
                                    lineStyle: this.circuitLineStyle || item.lineStyle || 'solid',
                                    lineWeight
                                }
                                : segment
                        ),
                        updatedAt: new Date().toISOString()
                    }
                    : { ...item, name, color: this.circuitColor || '#ff3448', lineStyle: this.circuitLineStyle || 'solid', lineWeight, updatedAt: new Date().toISOString() }
                : item
        )
    }

    private handleCircuitNodeSelection(annotation: ProjectFloorplanDesignAnnotation): void {
        if (!this.circuitEditActive || !this.selectedCircuit) {
            this.statusText = 'Create or edit a circuit before selecting circuit elements.'
            return
        }
        if (annotation.kind !== 'symbol' && annotation.kind !== 'joint') {
            this.statusText = 'Circuits can only connect symbols and joints.'
            return
        }

        const circuit = this.selectedCircuit
        if (!this.circuitActiveNodeId) {
            this.circuitActiveNodeId = annotation.id
            this.selectedAnnotation = annotation
            this.selectedCircuitSegmentId = ''
            this.statusText = `${annotation.label || 'Circuit element'} selected. Choose the next symbol or joint.`
            return
        }

        if (annotation.id === this.circuitActiveNodeId) {
            this.selectedAnnotation = annotation
            this.selectedCircuitSegmentId = ''
            this.statusText = `${annotation.label || 'Circuit element'} is the active circuit anchor. Choose the next symbol or joint.`
            return
        }

        const firstNodeId = this.getCircuitFirstNodeId(circuit)
        const closingCircuit = !!firstNodeId && annotation.id === firstNodeId && circuit.segments.length > 1
        const segmentExists = circuit.segments.some((segment) =>
            (segment.fromAnnotationId === this.circuitActiveNodeId && segment.toAnnotationId === annotation.id)
            || (segment.fromAnnotationId === annotation.id && segment.toAnnotationId === this.circuitActiveNodeId)
        )
        if (segmentExists) {
            this.circuitActiveNodeId = annotation.id
            this.selectedAnnotation = annotation
            this.selectedCircuitSegmentId = ''
            this.statusText = 'Circuit segment already exists. Anchor moved to selected element.'
            return
        }

        const newSegment: ProjectFloorplanCircuitSegment = {
            id: this.createClientId(),
            fromAnnotationId: this.circuitActiveNodeId,
            toAnnotationId: annotation.id,
            color: this.circuitColor || circuit.color,
            lineStyle: this.circuitLineStyle || circuit.lineStyle,
            lineWeight: this.normalizeCircuitLineWeight(this.circuitLineWeight || circuit.lineWeight)
        }
        this.circuits = this.circuits.map((item) =>
            item.id === circuit.id
                ? {
                    ...item,
                    color: this.circuitColor || item.color,
                    lineStyle: this.circuitLineStyle || item.lineStyle,
                    lineWeight: this.normalizeCircuitLineWeight(this.circuitLineWeight || item.lineWeight),
                    segments: [...item.segments, newSegment],
                    closed: closingCircuit ? true : item.closed,
                    updatedAt: new Date().toISOString()
                }
                : item
        )
        this.circuitActiveNodeId = annotation.id
        this.selectedAnnotation = annotation
        this.selectedCircuitSegmentId = ''
        const updated = this.selectedCircuit
        this.statusText = closingCircuit
            ? `Circuit closed at ${this.getCircuitLengthFeet(updated).toFixed(1)} ft.`
            : `Circuit segment added. Current length ${this.getCircuitLengthFeet(updated).toFixed(1)} ft.`
    }

    setLayerVisibility(layer: 'symbols' | 'notes' | 'circuits', visible: boolean): void {
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
        if (layer === 'circuits') {
            this.showCircuitLayer = visible
            if (!visible) {
                this.selectedCircuitId = ''
                this.selectedCircuitSegmentId = ''
                if (this.tool === 'circuit') {
                    this.cancelCircuitEdit()
                    this.tool = 'select'
                }
                this.statusText = 'Circuit layer hidden. Show Circuits before editing circuit paths.'
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

    beginCalibration(event: MouseEvent): void {
        if (this.tool !== 'calibrate' || event.button !== 0 || !this.annotationSurfaceReady || !this.surface?.nativeElement) {
            return
        }

        const point = this.getSurfacePoint(event)
        this.isCalibrating = true
        this.calibrationDialogOpen = false
        this.calibrationKnownFeet = null
        this.calibrationDraft = {
            startXRatio: point.xRatio,
            startYRatio: point.yRatio,
            endXRatio: point.xRatio,
            endYRatio: point.yRatio,
            pixelLength: 0
        }
        window.addEventListener('mousemove', this.calibrationMoveListener)
        window.addEventListener('mouseup', this.calibrationEndListener)
        event.stopPropagation()
        event.preventDefault()
    }

    continueCalibration(event: MouseEvent): void {
        if (!this.isCalibrating || !this.calibrationDraft) {
            return
        }

        const point = this.getSurfacePoint(event)
        this.calibrationDraft = {
            ...this.calibrationDraft,
            endXRatio: point.xRatio,
            endYRatio: point.yRatio,
            pixelLength: this.getImagePixelDistance(
                this.calibrationDraft.startXRatio,
                this.calibrationDraft.startYRatio,
                point.xRatio,
                point.yRatio
            )
        }
        event.preventDefault()
    }

    endCalibration(event: MouseEvent): void {
        if (!this.isCalibrating) {
            return
        }

        this.isCalibrating = false
        this.removeCalibrationListeners()
        if (this.calibrationDraft && this.calibrationDraft.pixelLength >= 4) {
            this.calibrationDialogOpen = true
            this.statusText = 'Enter the real-world length for the calibration line.'
        } else {
            this.calibrationDraft = undefined
            this.statusText = 'Calibration line was too short. Drag across a known scale length.'
        }
        event.preventDefault()
    }

    cancelCalibrationDialog(): void {
        this.calibrationDialogOpen = false
        this.calibrationKnownFeet = null
        this.calibrationDraft = undefined
        this.statusText = 'Calibration cancelled.'
    }

    confirmCalibration(): void {
        if (!this.calibrationDraft || !Number(this.calibrationKnownFeet) || Number(this.calibrationKnownFeet) <= 0) {
            this.statusText = 'Enter a valid length in feet before confirming calibration.'
            return
        }

        const realWorldFeet = Number(this.calibrationKnownFeet)
        const pixelLength = this.calibrationDraft.pixelLength
        this.calibration = {
            pixelLength,
            realWorldFeet,
            feetPerPixel: realWorldFeet / pixelLength,
            startXRatio: this.calibrationDraft.startXRatio,
            startYRatio: this.calibrationDraft.startYRatio,
            endXRatio: this.calibrationDraft.endXRatio,
            endYRatio: this.calibrationDraft.endYRatio,
            calibratedAt: new Date().toISOString()
        }
        this.calibrationDialogOpen = false
        this.calibrationKnownFeet = null
        this.calibrationDraft = undefined
        this.tool = 'select'
        this.statusText = `Scale calibrated at ${this.calibration.feetPerPixel.toFixed(5)} ft per image pixel. Save the design to persist it.`
    }

    beginAnnotationDrag(annotation: ProjectFloorplanDesignAnnotation, event: MouseEvent): void {
        event.stopPropagation()
        if (this.tool === 'circuit' || (this.circuitEditActive && (annotation.kind === 'symbol' || annotation.kind === 'joint'))) {
            return
        }
        if (event.button !== 0 || (annotation.kind !== 'symbol' && annotation.kind !== 'sticky' && annotation.kind !== 'note' && annotation.kind !== 'joint') || this.tool === 'pan' || !this.isAnnotationLayerVisible(annotation)) {
            return
        }

        this.selectedAnnotation = annotation
        this.tool = 'select'
        this.isDraggingAnnotation = true
        this.dragAnnotationId = annotation.id
        this.dragStartClientX = event.clientX
        this.dragStartClientY = event.clientY
        this.dragStartXRatio = Number(annotation.xRatio || 0)
        this.dragStartYRatio = Number(annotation.yRatio || 0)
        this.dragDidMove = false
        this.clearSymbolPulse()
        window.addEventListener('mousemove', this.annotationDragMoveListener)
        window.addEventListener('mouseup', this.annotationDragEndListener)
        event.preventDefault()
    }

    continueAnnotationDrag(event: MouseEvent): void {
        if (!this.isDraggingAnnotation || !this.dragAnnotationId || !this.surface?.nativeElement) {
            return
        }

        const rect = this.surface.nativeElement.getBoundingClientRect()
        if (rect.width <= 0 || rect.height <= 0) {
            return
        }

        const deltaX = event.clientX - this.dragStartClientX
        const deltaY = event.clientY - this.dragStartClientY
        if (!this.dragDidMove && Math.hypot(deltaX, deltaY) < 3) {
            return
        }

        this.dragDidMove = true
        const contentDelta = this.getUnrotatedContentDelta(deltaX, deltaY)
        const contentWidth = Math.max(1, this.baseLayerPixelWidth * this.zoomLevel)
        const contentHeight = Math.max(1, this.baseLayerPixelHeight * this.zoomLevel)
        const xRatio = this.clampRatio(this.dragStartXRatio + contentDelta.x / contentWidth)
        const yRatio = this.clampRatio(this.dragStartYRatio + contentDelta.y / contentHeight)
        this.moveAnnotation(this.dragAnnotationId, xRatio, yRatio)
        event.preventDefault()
    }

    endAnnotationDrag(event: MouseEvent): void {
        if (!this.isDraggingAnnotation) {
            return
        }

        const movedAnnotationId = this.dragAnnotationId
        const didMove = this.dragDidMove
        this.isDraggingAnnotation = false
        this.dragAnnotationId = ''
        this.dragDidMove = false
        this.removeAnnotationDragListeners()
        if (didMove && movedAnnotationId) {
            this.ignoreNextAnnotationClickId = movedAnnotationId
            if (this.selectedAnnotation?.kind === 'symbol') {
                this.triggerAnnotationPulse(movedAnnotationId)
            }
            this.statusText = 'Item moved. Save the design to persist the new location.'
        }
        event.preventDefault()
    }

    onSurfaceClick(event: MouseEvent): void {
        if (this.tool === 'select' || this.tool === 'pan' || this.tool === 'calibrate' || this.isPanning) {
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
        if (this.tool === 'joint' && !this.showCircuitLayer) {
            this.statusText = 'Circuit layer is hidden. Open Layers and show Circuits before placing joints.'
            return
        }
        if (this.tool === 'symbol' && !this.selectedSymbol) {
            this.statusText = 'No BOM symbols are available to place.'
            return
        }
        if (this.tool === 'circuit') {
            this.statusText = 'Select a symbol or joint to add it to the circuit.'
            return
        }

        const point = this.getSurfacePoint(event)
        const xRatio = point.xRatio
        const yRatio = point.yRatio
        const annotation = this.createAnnotation(xRatio, yRatio)
        this.annotations = [...this.annotations, annotation]
        if (this.tool === 'symbol') {
            this.selectedAnnotation = undefined
            this.selectedCircuitSegmentId = ''
            this.statusText = this.selectedSymbol
                ? `${this.selectedSymbol.label} placed. BOM quantity will update when the design is saved.`
                : 'Symbol placed.'
            return
        }
        if (this.tool === 'joint') {
            this.selectedAnnotation = undefined
            this.selectedCircuitSegmentId = ''
            this.statusText = 'Joint placed. Click again to place another joint.'
            return
        }
        this.selectedAnnotation = annotation
        this.selectedCircuitSegmentId = ''
        this.tool = 'select'
        this.statusText = 'Item placed.'
    }

    selectAnnotation(annotation: ProjectFloorplanDesignAnnotation, event: MouseEvent): void {
        event.stopPropagation()
        if (this.ignoreNextAnnotationClickId === annotation.id) {
            this.ignoreNextAnnotationClickId = ''
            return
        }
        if (!this.isAnnotationLayerVisible(annotation)) {
            this.statusText = annotation.kind === 'symbol'
                ? 'Symbol layer is hidden. Show the Symbols layer before selecting symbols.'
                : annotation.kind === 'joint'
                    ? 'Circuit layer is hidden. Show the Circuits layer before selecting joints.'
                : 'Notes layer is hidden. Show the Notes layer before selecting notes.'
            return
        }
        if (this.tool === 'circuit' || (this.circuitEditActive && (annotation.kind === 'symbol' || annotation.kind === 'joint'))) {
            this.handleCircuitNodeSelection(annotation)
            return
        }
        this.selectedAnnotation = annotation
        this.selectedCircuitSegmentId = ''
        this.tool = 'select'
    }

    deleteSelected(): void {
        if (!this.selectedAnnotation) {
            return
        }
        if (this.selectedAnnotation.kind === 'joint' && this.isJointInCircuit(this.selectedAnnotation)) {
            this.statusText = 'Joint is used by an existing circuit and cannot be deleted.'
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
            circuits: this.circuits.map((circuit) => ({ ...circuit, segments: circuit.segments.map((segment) => ({ ...segment })) })),
            calibration: this.calibration ? { ...this.calibration } : undefined,
            rotationDegrees: this.rotationDegrees,
            symbolDisplayMode: this.symbolDisplayMode,
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
                partDescription: symbol?.partDescription,
                iconId: symbol?.iconId,
                iconLabel: symbol?.iconLabel,
                iconDataUrl: symbol?.iconDataUrl,
                iconForegroundColor: symbol?.iconForegroundColor,
                materialCost: symbol?.materialCost,
                laborHours: symbol?.laborHours,
                customAttributes: symbol?.customAttributes ? [...symbol.customAttributes] : undefined,
                symbol: symbol?.code || '?',
                label: symbol?.label || 'Symbol',
                color: symbol?.color || '#77d7ff'
            }
        }

        if (this.tool === 'joint') {
            return {
                id: this.createClientId(),
                kind: 'joint',
                xRatio,
                yRatio,
                symbol: 'J',
                label: 'Joint',
                color: '#68f3ff'
            }
        }

        const kind = this.tool === 'sticky' ? 'sticky' : 'note'
        return {
            id: this.createClientId(),
            kind,
            xRatio,
            yRatio,
            label: kind === 'sticky' ? 'Sticky' : 'Note',
            color: kind === 'sticky' ? this.selectedStickyColor : undefined,
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

    private triggerSymbolPulse(symbol: FloorplanDesignerSymbolOption): void {
        const symbolId = String(symbol?.id || '').trim()
        if (!symbolId || this.getCurrentSymbolCount(symbolId) <= 0) {
            this.clearSymbolPulse()
            return
        }

        this.clearSymbolPulse()
        window.setTimeout(() => {
            this.pulseSymbolId = symbolId
            this.symbolPulseTimeout = window.setTimeout(() => {
                this.pulseSymbolId = ''
                this.symbolPulseTimeout = undefined
            }, 2100)
        })
    }

    private clearSymbolPulse(): void {
        if (this.symbolPulseTimeout) {
            window.clearTimeout(this.symbolPulseTimeout)
            this.symbolPulseTimeout = undefined
        }
        this.pulseSymbolId = ''
        this.pulseAnnotationId = ''
    }

    private triggerAnnotationPulse(annotationId: string): void {
        const normalizedAnnotationId = String(annotationId || '').trim()
        if (!normalizedAnnotationId) {
            return
        }

        this.clearSymbolPulse()
        window.setTimeout(() => {
            this.pulseAnnotationId = normalizedAnnotationId
            this.symbolPulseTimeout = window.setTimeout(() => {
                this.pulseAnnotationId = ''
                this.symbolPulseTimeout = undefined
            }, 2100)
        })
    }

    private moveAnnotation(annotationId: string, xRatio: number, yRatio: number): void {
        let selectedAnnotation: ProjectFloorplanDesignAnnotation | undefined
        this.annotations = this.annotations.map((annotation) => {
            if (annotation.id !== annotationId) {
                return annotation
            }
            selectedAnnotation = {
                ...annotation,
                xRatio,
                yRatio
            }
            return selectedAnnotation
        })
        if (selectedAnnotation) {
            this.selectedAnnotation = selectedAnnotation
        }
    }

    private clampRatio(value: number): number {
        return Math.max(0, Math.min(1, Number.isFinite(value) ? value : 0))
    }

    private getSurfacePoint(event: MouseEvent): { xRatio: number; yRatio: number } {
        const surface = this.surface?.nativeElement
        if (!surface) {
            return { xRatio: 0, yRatio: 0 }
        }
        const rect = surface.getBoundingClientRect()
        const surfaceX = event.clientX - rect.left
        const surfaceY = event.clientY - rect.top
        const contentWidth = Math.max(1, this.baseLayerPixelWidth * this.zoomLevel)
        const contentHeight = Math.max(1, this.baseLayerPixelHeight * this.zoomLevel)
        const point = this.getUnrotatedContentPoint(surfaceX, surfaceY, contentWidth, contentHeight)
        return {
            xRatio: this.clampRatio(point.x / contentWidth),
            yRatio: this.clampRatio(point.y / contentHeight)
        }
    }

    private getUnrotatedContentPoint(surfaceX: number, surfaceY: number, contentWidth: number, contentHeight: number): { x: number; y: number } {
        if (this.rotationDegrees === 90) {
            return { x: surfaceY, y: contentHeight - surfaceX }
        }
        if (this.rotationDegrees === 180) {
            return { x: contentWidth - surfaceX, y: contentHeight - surfaceY }
        }
        if (this.rotationDegrees === 270) {
            return { x: contentWidth - surfaceY, y: surfaceX }
        }
        return { x: surfaceX, y: surfaceY }
    }

    private getUnrotatedContentDelta(deltaX: number, deltaY: number): { x: number; y: number } {
        if (this.rotationDegrees === 90) {
            return { x: deltaY, y: -deltaX }
        }
        if (this.rotationDegrees === 180) {
            return { x: -deltaX, y: -deltaY }
        }
        if (this.rotationDegrees === 270) {
            return { x: -deltaY, y: deltaX }
        }
        return { x: deltaX, y: deltaY }
    }

    private getImagePixelDistance(startXRatio: number, startYRatio: number, endXRatio: number, endYRatio: number): number {
        const width = Math.max(1, this.baseLayerPixelWidth)
        const height = Math.max(1, this.baseLayerPixelHeight)
        return Math.hypot((endXRatio - startXRatio) * width, (endYRatio - startYRatio) * height)
    }

    private getAnnotationById(annotationId: string): ProjectFloorplanDesignAnnotation | undefined {
        return this.annotations.find((annotation) => annotation.id === annotationId)
    }

    private getCircuitFirstNodeId(circuit: ProjectFloorplanCircuit): string {
        return circuit.segments[0]?.fromAnnotationId || this.circuitActiveNodeId || ''
    }

    private normalizeRotation(value: unknown): number {
        const rotation = Number(value || 0)
        const normalized = ((Math.round(rotation / 90) * 90) % 360 + 360) % 360
        return [0, 90, 180, 270].includes(normalized) ? normalized : 0
    }

    private isQuarterTurnRotation(): boolean {
        return this.rotationDegrees === 90 || this.rotationDegrees === 270
    }

    private removeAnnotationDragListeners(): void {
        window.removeEventListener('mousemove', this.annotationDragMoveListener)
        window.removeEventListener('mouseup', this.annotationDragEndListener)
    }

    private removeCalibrationListeners(): void {
        window.removeEventListener('mousemove', this.calibrationMoveListener)
        window.removeEventListener('mouseup', this.calibrationEndListener)
    }

    private isAnnotationLayerVisible(annotation: ProjectFloorplanDesignAnnotation): boolean {
        if (annotation.kind === 'symbol') {
            return this.showSymbolLayer
        }
        if (annotation.kind === 'joint') {
            return this.showCircuitLayer
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
        const circuits = (design.circuits || []).map((circuit) => ({
            id: circuit.id,
            name: circuit.name || '',
            color: circuit.color || '',
            lineStyle: circuit.lineStyle || 'solid',
            lineWeight: this.normalizeCircuitLineWeight(circuit.lineWeight),
            closed: !!circuit.closed,
            layerId: circuit.layerId || '',
            segments: (circuit.segments || []).map((segment) => ({
                id: segment.id,
                fromAnnotationId: segment.fromAnnotationId,
                toAnnotationId: segment.toAnnotationId,
                color: segment.color || '',
                lineStyle: segment.lineStyle || '',
                lineWeight: segment.lineWeight ? this.normalizeCircuitLineWeight(segment.lineWeight) : 0
            }))
        }))
        const calibration = design.calibration
            ? {
                pixelLength: design.calibration.pixelLength,
                realWorldFeet: design.calibration.realWorldFeet,
                feetPerPixel: design.calibration.feetPerPixel,
                startXRatio: design.calibration.startXRatio,
                startYRatio: design.calibration.startYRatio,
                endXRatio: design.calibration.endXRatio,
                endYRatio: design.calibration.endYRatio
            }
            : null
        return JSON.stringify({
            annotations,
            circuits,
            calibration,
            rotationDegrees: this.normalizeRotation(design.rotationDegrees),
            symbolDisplayMode: design.symbolDisplayMode === 'bubble' ? 'bubble' : 'icon'
        })
    }

    private normalizeCircuitLineWeight(value: unknown): number {
        const numeric = Number(value)
        if (!Number.isFinite(numeric) || numeric <= 0) {
            return 1.45
        }
        return this.circuitLineWeightOptions.reduce((closest, option) =>
            Math.abs(option - numeric) < Math.abs(closest - numeric) ? option : closest
        , this.circuitLineWeightOptions[1])
    }
}
