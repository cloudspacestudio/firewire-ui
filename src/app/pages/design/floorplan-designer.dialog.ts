import { CommonModule } from '@angular/common'
import { Component, ElementRef, ViewChild, inject } from '@angular/core'
import { FormsModule } from '@angular/forms'
import { MAT_DIALOG_DATA, MatDialogActions, MatDialogContent, MatDialogRef, MatDialogTitle } from '@angular/material/dialog'
import { MatButtonModule } from '@angular/material/button'
import { MatIconModule } from '@angular/material/icon'

import {
    ProjectDocLibraryFileRecord,
    ProjectFloorplanDesignAnnotation,
    ProjectFloorplanDesignState
} from '../../common/services/project-doc-library-storage.service'

export interface FloorplanDesignerDialogData {
    file: ProjectDocLibraryFileRecord
    imageUrl: string
}

export interface FloorplanDesignerDialogResult {
    design: ProjectFloorplanDesignState
}

type FloorplanDesignerTool = 'select' | 'pan' | 'symbol' | 'note' | 'sticky'

@Component({
    standalone: true,
    selector: 'floorplan-designer-dialog',
    imports: [CommonModule, FormsModule, MatButtonModule, MatDialogActions, MatDialogContent, MatDialogTitle, MatIconModule],
    template: `
        <div mat-dialog-title class="floorplan-designer__titlebar">
            <div>
                <div class="floorplan-designer__kicker">Floorplan Designer</div>
                <div class="floorplan-designer__title">{{data.file.name}}</div>
            </div>
            <button mat-icon-button type="button" aria-label="Close designer" (click)="close()">
                <mat-icon fontIcon="close"></mat-icon>
            </button>
        </div>

        <mat-dialog-content class="floorplan-designer">
            <aside class="floorplan-designer__sidebar">
                <div class="floorplan-designer__section">
                    <div class="floorplan-designer__label">Tools</div>
                    <button type="button" class="floorplan-designer__tool" [class.is-active]="tool === 'select'" (click)="setTool('select')">
                        <mat-icon fontIcon="near_me"></mat-icon>
                        Select
                    </button>
                    <button type="button" class="floorplan-designer__tool" [class.is-active]="tool === 'pan'" (click)="setTool('pan')">
                        <mat-icon fontIcon="pan_tool"></mat-icon>
                        Pan
                    </button>
                    <button type="button" class="floorplan-designer__tool" [class.is-active]="tool === 'symbol'" (click)="setTool('symbol')">
                        <mat-icon fontIcon="add_location_alt"></mat-icon>
                        Symbol
                    </button>
                    <button type="button" class="floorplan-designer__tool" [class.is-active]="tool === 'note'" (click)="setTool('note')">
                        <mat-icon fontIcon="notes"></mat-icon>
                        Note
                    </button>
                    <button type="button" class="floorplan-designer__tool" [class.is-active]="tool === 'sticky'" (click)="setTool('sticky')">
                        <mat-icon fontIcon="sticky_note_2"></mat-icon>
                        Sticky
                    </button>
                </div>

                <div class="floorplan-designer__section" *ngIf="tool === 'symbol'">
                    <div class="floorplan-designer__label">Symbol</div>
                    <button
                        *ngFor="let symbol of symbols"
                        type="button"
                        class="floorplan-designer__symbol-option"
                        [class.is-active]="selectedSymbol.id === symbol.id"
                        (click)="selectedSymbol = symbol">
                        <span [style.background]="symbol.color">{{symbol.code}}</span>
                        {{symbol.label}}
                    </button>
                </div>

                <div class="floorplan-designer__section">
                    <div class="floorplan-designer__label">View</div>
                    <div class="floorplan-designer__zoom-row">
                        <button mat-stroked-button type="button" (click)="zoomOut()"><mat-icon fontIcon="remove"></mat-icon></button>
                        <strong>{{zoomLevel.toFixed(2)}}x</strong>
                        <button mat-stroked-button type="button" (click)="zoomIn()"><mat-icon fontIcon="add"></mat-icon></button>
                    </div>
                    <button mat-stroked-button type="button" (click)="resetView()">Reset View</button>
                </div>

                <div class="floorplan-designer__section" *ngIf="selectedAnnotation">
                    <div class="floorplan-designer__label">Selected</div>
                    <input class="floorplan-designer__input" [(ngModel)]="selectedAnnotation.label" placeholder="Label" />
                    <textarea
                        *ngIf="selectedAnnotation.kind !== 'symbol'"
                        class="floorplan-designer__textarea"
                        rows="4"
                        [(ngModel)]="selectedAnnotation.text"
                        placeholder="Text"></textarea>
                    <button mat-stroked-button color="warn" type="button" (click)="deleteSelected()">Delete</button>
                </div>
            </aside>

            <section
                #stage
                class="floorplan-designer__stage"
                [class.is-pan-mode]="tool === 'pan'"
                [class.is-panning]="isPanning"
                (mousedown)="beginPan($event)"
                (mousemove)="continuePan($event)"
                (mouseup)="endPan()"
                (mouseleave)="endPan()">
                <div
                    class="floorplan-designer__surface"
                    [style.width]="zoomLevel * 100 + '%'"
                    (click)="onSurfaceClick($event)">
                    <img class="floorplan-designer__image" [src]="data.imageUrl" [alt]="data.file.name" draggable="false" />
                    <button
                        *ngFor="let annotation of annotations"
                        type="button"
                        class="floorplan-designer__annotation"
                        [class.is-selected]="selectedAnnotation?.id === annotation.id"
                        [class.floorplan-designer__annotation--note]="annotation.kind === 'note'"
                        [class.floorplan-designer__annotation--sticky]="annotation.kind === 'sticky'"
                        [style.left.%]="annotation.xRatio * 100"
                        [style.top.%]="annotation.yRatio * 100"
                        (click)="selectAnnotation(annotation, $event)">
                        <span
                            *ngIf="annotation.kind === 'symbol'"
                            class="floorplan-designer__symbol"
                            [style.background]="annotation.color">
                            {{annotation.symbol}}
                        </span>
                        <span *ngIf="annotation.kind !== 'symbol'" class="floorplan-designer__note-card">
                            <strong>{{annotation.label || (annotation.kind === 'sticky' ? 'Sticky' : 'Note')}}</strong>
                            <span>{{annotation.text || 'Add text...'}}</span>
                        </span>
                    </button>
                </div>
            </section>
        </mat-dialog-content>

        <mat-dialog-actions align="end" class="floorplan-designer__actions">
            <span class="floorplan-designer__status">{{statusText}}</span>
            <button mat-button type="button" (click)="close()">Cancel</button>
            <button mat-flat-button type="button" (click)="save()">Save Design</button>
        </mat-dialog-actions>
    `,
    styles: [`
        .floorplan-designer__titlebar{display:flex;align-items:center;justify-content:space-between;gap:16px;padding:16px 20px 10px;border-bottom:1px solid rgba(72,221,255,.12);background:#08111d;color:#eaf6ff}.floorplan-designer__kicker{color:#55d8ff;font-size:.72rem;letter-spacing:.16em;text-transform:uppercase}.floorplan-designer__title{font-weight:700;letter-spacing:.04em}.floorplan-designer{display:grid;grid-template-columns:260px minmax(0,1fr);gap:0;width:calc(100vw - 48px);height:calc(100vh - 150px);padding:0!important;background:#07101b;color:#eaf6ff;overflow:hidden}.floorplan-designer__sidebar{display:grid;align-content:start;gap:14px;padding:16px;border-right:1px solid rgba(72,221,255,.12);background:#091522;overflow:auto}.floorplan-designer__section{display:grid;gap:8px}.floorplan-designer__label{color:#6bdcff;font-size:.72rem;letter-spacing:.14em;text-transform:uppercase}.floorplan-designer__tool,.floorplan-designer__symbol-option{display:flex;align-items:center;gap:8px;border:1px solid rgba(72,221,255,.14);border-radius:6px;padding:9px 10px;background:rgba(7,15,26,.86);color:#eaf6ff;text-align:left;cursor:pointer}.floorplan-designer__tool.is-active,.floorplan-designer__symbol-option.is-active{border-color:rgba(121,255,176,.48);background:rgba(24,68,56,.42)}.floorplan-designer__symbol-option span{display:inline-grid;place-items:center;width:28px;height:28px;border-radius:50%;color:#061018;font-weight:800}.floorplan-designer__zoom-row{display:grid;grid-template-columns:44px 1fr 44px;align-items:center;gap:8px;text-align:center}.floorplan-designer__input,.floorplan-designer__textarea{width:100%;box-sizing:border-box;border:1px solid rgba(72,221,255,.16);border-radius:6px;padding:8px 10px;background:#050b13;color:#eaf6ff;font:inherit}.floorplan-designer__stage{overflow:auto;background:#03070c;cursor:crosshair}.floorplan-designer__stage.is-pan-mode{cursor:grab}.floorplan-designer__stage.is-panning{cursor:grabbing}.floorplan-designer__surface{position:relative;min-width:100%;margin:auto;transform-origin:top left}.floorplan-designer__image{display:block;width:100%;height:auto;min-height:320px;object-fit:contain;user-select:none}.floorplan-designer__annotation{position:absolute;transform:translate(-50%,-50%);border:0;background:transparent;color:#061018;cursor:pointer}.floorplan-designer__annotation.is-selected{outline:2px solid #79ffb0;outline-offset:4px;border-radius:6px}.floorplan-designer__symbol{display:inline-grid;place-items:center;width:30px;height:30px;border-radius:50%;font-weight:900;box-shadow:0 3px 12px rgba(0,0,0,.42)}.floorplan-designer__note-card{display:grid;gap:3px;min-width:120px;max-width:180px;padding:8px;border-radius:6px;background:#d7f0ff;color:#07101b;text-align:left;box-shadow:0 8px 22px rgba(0,0,0,.32)}.floorplan-designer__annotation--sticky .floorplan-designer__note-card{background:#fff08a}.floorplan-designer__note-card span{font-size:.78rem}.floorplan-designer__actions{border-top:1px solid rgba(72,221,255,.12);background:#08111d}.floorplan-designer__status{margin-right:auto;color:rgba(167,228,255,.78);font-size:.82rem}@media(max-width:900px){.floorplan-designer{grid-template-columns:1fr;height:calc(100vh - 130px)}.floorplan-designer__sidebar{grid-template-columns:repeat(2,minmax(0,1fr));border-right:0;border-bottom:1px solid rgba(72,221,255,.12);max-height:260px}}
    `]
})
export class FloorplanDesignerDialog {
    readonly data = inject<FloorplanDesignerDialogData>(MAT_DIALOG_DATA)
    private readonly dialogRef = inject(MatDialogRef<FloorplanDesignerDialog>)

    @ViewChild('stage')
    stage?: ElementRef<HTMLElement>

    readonly symbols = [
        { id: 'smoke', code: 'SD', label: 'Smoke Detector', color: '#77d7ff' },
        { id: 'strobe', code: 'S', label: 'Strobe', color: '#ffcf7a' },
        { id: 'horn-strobe', code: 'HS', label: 'Horn/Strobe', color: '#ff8d8d' },
        { id: 'pull', code: 'PS', label: 'Pull Station', color: '#ff6b6b' },
        { id: 'module', code: 'M', label: 'Module', color: '#9effb6' }
    ]

    tool: FloorplanDesignerTool = 'select'
    selectedSymbol = this.symbols[0]
    annotations: ProjectFloorplanDesignAnnotation[] = [...(this.data.file.floorplanDesign?.annotations || [])]
    selectedAnnotation?: ProjectFloorplanDesignAnnotation
    zoomLevel = 1
    statusText = 'Choose a tool, then click the floorplan.'
    isPanning = false
    private panStartX = 0
    private panStartY = 0
    private panStartScrollLeft = 0
    private panStartScrollTop = 0

    setTool(tool: FloorplanDesignerTool): void {
        this.tool = tool
        this.statusText = tool === 'pan' ? 'Drag the canvas to pan.' : 'Click the floorplan to place or select items.'
    }

    zoomIn(): void {
        this.zoomLevel = Math.min(3, Number((this.zoomLevel + 0.1).toFixed(2)))
    }

    zoomOut(): void {
        this.zoomLevel = Math.max(0.4, Number((this.zoomLevel - 0.1).toFixed(2)))
    }

    resetView(): void {
        this.zoomLevel = 1
        if (this.stage?.nativeElement) {
            this.stage.nativeElement.scrollLeft = 0
            this.stage.nativeElement.scrollTop = 0
        }
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

        const surface = event.currentTarget as HTMLElement
        const rect = surface.getBoundingClientRect()
        const xRatio = Math.max(0, Math.min(1, (event.clientX - rect.left) / rect.width))
        const yRatio = Math.max(0, Math.min(1, (event.clientY - rect.top) / rect.height))
        const annotation = this.createAnnotation(xRatio, yRatio)
        this.annotations = [...this.annotations, annotation]
        this.selectedAnnotation = annotation
        this.tool = 'select'
        this.statusText = 'Item placed.'
    }

    selectAnnotation(annotation: ProjectFloorplanDesignAnnotation, event: MouseEvent): void {
        event.stopPropagation()
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

    close(): void {
        this.dialogRef.close()
    }

    save(): void {
        this.dialogRef.close({
            design: {
                annotations: this.annotations,
                updatedAt: new Date().toISOString()
            }
        } as FloorplanDesignerDialogResult)
    }

    private createAnnotation(xRatio: number, yRatio: number): ProjectFloorplanDesignAnnotation {
        if (this.tool === 'symbol') {
            return {
                id: this.createClientId(),
                kind: 'symbol',
                xRatio,
                yRatio,
                symbol: this.selectedSymbol.code,
                label: this.selectedSymbol.label,
                color: this.selectedSymbol.color
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
}
