import { CommonModule } from '@angular/common'
import { Component } from '@angular/core'
import { FormsModule } from '@angular/forms'
import { MatButtonModule } from '@angular/material/button'
import { MatDialogActions, MatDialogClose, MatDialogContent, MatDialogRef, MatDialogTitle } from '@angular/material/dialog'
import { MatFormFieldModule } from '@angular/material/form-field'
import { MatInputModule } from '@angular/material/input'

@Component({
    standalone: true,
    imports: [CommonModule, FormsModule, MatDialogTitle, MatDialogContent, MatDialogActions, MatDialogClose, MatButtonModule, MatFormFieldModule, MatInputModule],
    template: `
        <div mat-dialog-title class="pin-setup__title">Initialize Lock PIN</div>
        <mat-dialog-content class="pin-setup">
            <div class="pin-setup__copy">Create a numeric PIN for unlocking the Firewire workspace. You’ll use this every time the command deck is locked.</div>
            <mat-form-field appearance="outline">
                <mat-label>New PIN</mat-label>
                <input matInput type="password" inputmode="numeric" [(ngModel)]="newPin" />
            </mat-form-field>
            <mat-form-field appearance="outline">
                <mat-label>Confirm PIN</mat-label>
                <input matInput type="password" inputmode="numeric" [(ngModel)]="confirmPin" />
            </mat-form-field>
            <div *ngIf="errorMessage" class="pin-setup__error">{{errorMessage}}</div>
        </mat-dialog-content>
        <mat-dialog-actions align="end" class="pin-setup__actions">
            <button mat-button type="button" mat-dialog-close>Cancel</button>
            <button mat-flat-button type="button" (click)="save()">Arm Lock</button>
        </mat-dialog-actions>
    `,
    styles: [`
        .pin-setup{display:grid;gap:14px;padding-top:4px;min-width:min(320px,82vw);background:linear-gradient(180deg,rgba(255,255,255,.02),rgba(255,255,255,0)),#0b111b}
        .pin-setup__title{color:#f4fbff;letter-spacing:.08em;text-transform:uppercase}
        .pin-setup__copy{color:rgba(226,239,245,.8);font-size:.92rem;line-height:1.45}
        .pin-setup__error{color:#ffb180;font-weight:600}
        .pin-setup__actions{padding:8px 24px 18px;background:#0b111b}
    `]
})
export class WorkspacePinSetupDialog {
    newPin = ''
    confirmPin = ''
    errorMessage = ''

    constructor(private readonly dialogRef: MatDialogRef<WorkspacePinSetupDialog>) {}

    save(): void {
        if (!/^\d{4,8}$/.test(this.newPin.trim())) {
            this.errorMessage = 'PIN must be 4 to 8 numeric digits.'
            return
        }
        if (this.newPin !== this.confirmPin) {
            this.errorMessage = 'PIN confirmation does not match.'
            return
        }
        this.dialogRef.close(this.newPin)
    }
}
