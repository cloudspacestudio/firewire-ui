import { CommonModule } from '@angular/common'
import { Component, ViewChild, inject } from '@angular/core'
import { MatButtonModule } from '@angular/material/button'
import { MAT_DIALOG_DATA, MatDialog, MatDialogActions, MatDialogClose, MatDialogContent, MatDialogRef, MatDialogTitle } from '@angular/material/dialog'
import { firstValueFrom } from 'rxjs'

import {
    ProjectDocLibraryFileRecord,
    ProjectFloorplanDesignState
} from '../../common/services/project-doc-library-storage.service'
import { ConfirmFirewireNavigationDialog } from '../projects/confirm-firewire-navigation.dialog'
import { FloorplanDesignerComponent, FloorplanDesignerSaveEvent, FloorplanDesignerSymbolOption } from './floorplan-designer.component'

export interface FloorplanDesignerDialogData {
    file: ProjectDocLibraryFileRecord
    imageUrl: string
    symbols?: FloorplanDesignerSymbolOption[]
    validateDesign?: (design: ProjectFloorplanDesignState) => string[]
}

export interface FloorplanDesignerDialogResult {
    design: ProjectFloorplanDesignState
}

export interface FloorplanSymbolBalanceDialogData {
    errors: string[]
}

@Component({
    standalone: true,
    selector: 'floorplan-designer-dialog',
    imports: [FloorplanDesignerComponent],
    template: `
        <floorplan-designer
            class="floorplan-designer-dialog-host"
            [title]="data.file.name"
            [sourceUrl]="data.imageUrl"
            [mimeType]="latestMimeType"
            [design]="data.file.floorplanDesign"
            [symbols]="data.symbols || []"
            (closeDesigner)="close()"
            (saveDesign)="save($event)">
        </floorplan-designer>
    `,
    styles: [`
        :host,
        .floorplan-designer-dialog-host {
            display: block;
            width: 100%;
            height: 100%;
            min-width: 0;
            min-height: 0;
        }
    `]
})
export class FloorplanDesignerDialog {
    readonly data = inject<FloorplanDesignerDialogData>(MAT_DIALOG_DATA)
    private readonly dialogRef = inject(MatDialogRef<FloorplanDesignerDialog>)
    private readonly dialog = inject(MatDialog)

    @ViewChild(FloorplanDesignerComponent)
    private designer?: FloorplanDesignerComponent

    constructor() {
        this.dialogRef.disableClose = true
        this.dialogRef.backdropClick().subscribe(() => void this.close())
        this.dialogRef.keydownEvents().subscribe((event) => {
            if (event.key === 'Escape') {
                event.preventDefault()
                void this.close()
            }
        })
    }

    get latestMimeType(): string {
        return this.data.file.versions[this.data.file.versions.length - 1]?.mimeType || ''
    }

    async close(): Promise<void> {
        if (this.designer?.isDirty()) {
            const decision = await this.openDirtyGuard()
            if (decision === 'stay' || !decision) {
                return
            }
            if (decision === 'save') {
                this.saveCurrentDesign()
                return
            }
        }
        this.dialogRef.close()
    }

    save(event: FloorplanDesignerSaveEvent): void {
        this.saveDesign(event.design)
    }

    private saveCurrentDesign(): void {
        const design = this.designer?.getCurrentDesignState()
        if (!design) {
            this.dialogRef.close()
            return
        }
        this.saveDesign(design)
    }

    private saveDesign(design: ProjectFloorplanDesignState): void {
        const errors = this.data.validateDesign?.(design) || []
        if (errors.length > 0) {
            this.dialog.open(FloorplanSymbolBalanceDialog, {
                width: '520px',
                maxWidth: '92vw',
                panelClass: 'fw-compact-dialog-pane',
                data: { errors } as FloorplanSymbolBalanceDialogData
            })
            return
        }
        this.dialogRef.close({
            design
        } as FloorplanDesignerDialogResult)
    }

    private async openDirtyGuard(): Promise<'stay' | 'save' | 'leave' | undefined> {
        return await firstValueFrom(this.dialog.open(ConfirmFirewireNavigationDialog, {
            width: '420px',
            maxWidth: '92vw',
            panelClass: 'fw-compact-dialog-pane',
            data: {
                title: 'Unsaved Floorplan Design',
                message: 'You have unsaved floorplan design changes.',
                canSave: true
            }
        }).afterClosed())
    }
}

@Component({
    standalone: true,
    selector: 'floorplan-symbol-balance-dialog',
    imports: [CommonModule, MatButtonModule, MatDialogActions, MatDialogClose, MatDialogContent, MatDialogTitle],
    template: `
        <h2 mat-dialog-title>Floorplan Symbol Counts</h2>
        <mat-dialog-content>
            <p>The design cannot be saved because some floorplan symbols no longer match BOM rows.</p>
            <ul>
                <li *ngFor="let error of data.errors">{{error}}</li>
            </ul>
        </mat-dialog-content>
        <mat-dialog-actions align="end">
            <button mat-flat-button mat-dialog-close type="button">Review Symbols</button>
        </mat-dialog-actions>
    `
})
export class FloorplanSymbolBalanceDialog {
    readonly data = inject<FloorplanSymbolBalanceDialogData>(MAT_DIALOG_DATA)
}
