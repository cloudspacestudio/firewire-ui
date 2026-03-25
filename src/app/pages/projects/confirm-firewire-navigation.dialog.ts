import { NgIf } from '@angular/common'
import { Component, inject } from '@angular/core'
import { MatButtonModule } from '@angular/material/button'
import { MatIconModule } from '@angular/material/icon'
import {
    MAT_DIALOG_DATA,
    MatDialogActions,
    MatDialogClose,
    MatDialogContent,
    MatDialogTitle
} from '@angular/material/dialog'

interface ConfirmFirewireNavigationDialogData {
    title?: string
    message?: string
    canSave?: boolean
}

@Component({
    standalone: true,
    imports: [
        NgIf,
        MatDialogTitle,
        MatDialogContent,
        MatDialogActions,
        MatDialogClose,
        MatButtonModule,
        MatIconModule
    ],
    template: `
        <div mat-dialog-title style="display:flex;align-items:center;justify-content:space-between;gap:12px;">
            <span>{{data.title || 'Unsaved Changes'}}</span>
            <button mat-icon-button type="button" aria-label="Close dialog" mat-dialog-close>
                <mat-icon>close</mat-icon>
            </button>
        </div>
        <mat-dialog-content>{{data.message || 'You have unsaved Firewire project changes. Leave this page?'}}</mat-dialog-content>
        <mat-dialog-actions align="end">
            <button mat-button type="button" [mat-dialog-close]="'stay'">Stay</button>
            <button *ngIf="data.canSave !== false" mat-stroked-button type="button" [mat-dialog-close]="'save'">Save Changes</button>
            <button mat-flat-button type="button" [mat-dialog-close]="'leave'">Leave</button>
        </mat-dialog-actions>
    `
})
export class ConfirmFirewireNavigationDialog {
    data: ConfirmFirewireNavigationDialogData = inject(MAT_DIALOG_DATA)
}
