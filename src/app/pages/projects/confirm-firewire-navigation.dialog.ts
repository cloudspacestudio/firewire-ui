
import { Component, inject, ChangeDetectionStrategy } from '@angular/core'
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
    MatDialogTitle,
    MatDialogContent,
    MatDialogActions,
    MatDialogClose,
    MatButtonModule,
    MatIconModule
],
    styles: [`
        :host {
            display: block;
            width: 100%;
            max-width: 460px;
        }

        .confirm-firewire-navigation__content {
            max-width: 44ch;
            line-height: 1.5;
        }

        .confirm-firewire-navigation__actions {
            flex-wrap: nowrap;
            gap: 8px;
        }

        .confirm-firewire-navigation__actions button {
            flex: 0 0 auto;
            white-space: nowrap;
        }
    `],
    changeDetection: ChangeDetectionStrategy.Eager,
    template: `
        <div mat-dialog-title style="display:flex;align-items:center;justify-content:space-between;gap:12px;">
          <span>{{data.title || 'Unsaved Changes'}}</span>
          <button mat-icon-button type="button" aria-label="Close dialog" mat-dialog-close>
            <mat-icon>close</mat-icon>
          </button>
        </div>
        <mat-dialog-content class="confirm-firewire-navigation__content">{{data.message || 'You have unsaved Firewire project changes. Leave this page?'}}</mat-dialog-content>
        <mat-dialog-actions class="confirm-firewire-navigation__actions" align="end">
          <button mat-button type="button" [mat-dialog-close]="'stay'">Stay</button>
          @if (data.canSave !== false) {
            <button mat-stroked-button type="button" [mat-dialog-close]="'save'">Save Changes</button>
          }
          <button mat-flat-button type="button" [mat-dialog-close]="'leave'">Leave</button>
        </mat-dialog-actions>
        `
})
export class ConfirmFirewireNavigationDialog {
    data: ConfirmFirewireNavigationDialogData = inject(MAT_DIALOG_DATA)
}
