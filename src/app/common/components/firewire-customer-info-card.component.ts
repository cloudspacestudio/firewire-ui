import { CommonModule } from '@angular/common'
import { Component, Input, OnChanges, SimpleChanges } from '@angular/core'
import { FormsModule } from '@angular/forms'

import { MatButtonModule } from '@angular/material/button'
import { MatFormFieldModule } from '@angular/material/form-field'
import { MatIconModule } from '@angular/material/icon'
import { MatInputModule } from '@angular/material/input'

export interface FirewireCustomerInfo {
    billingName: string
    businessPointOfContactName: string
    billingAddress: string
    billingEmail: string
    billingPhone: string
    contractOrPoNumber: string
}

@Component({
    standalone: true,
    selector: 'firewire-customer-info-card',
    imports: [
        CommonModule,
        FormsModule,
        MatButtonModule,
        MatFormFieldModule,
        MatIconModule,
        MatInputModule
    ],
    templateUrl: './firewire-customer-info-card.component.html',
    styleUrls: ['./firewire-customer-info-card.component.scss']
})
export class FirewireCustomerInfoCardComponent implements OnChanges {
    @Input({ required: true }) customerInfo!: FirewireCustomerInfo
    @Input() locked = false

    editMode = false
    private initializedForInfo = false

    ngOnChanges(changes: SimpleChanges): void {
        if (changes['customerInfo']) {
            this.initializedForInfo = false
        }

        if (!this.initializedForInfo) {
            this.editMode = !this.locked && !this.hasAnyCustomerInfoData()
            this.initializedForInfo = true
        }

        if (this.locked) {
            this.editMode = false
        }
    }

    setEditMode(isEditing: boolean): void {
        this.editMode = !this.locked && isEditing
    }

    getDisplayValue(value: string | null | undefined): string {
        const normalized = String(value || '').trim()
        return normalized || 'Not set'
    }

    isValidEmail(value: string | null | undefined): boolean {
        const normalized = String(value || '').trim()
        return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalized)
    }

    getEmailHref(value: string | null | undefined): string {
        return `mailto:${String(value || '').trim()}`
    }

    isValidPhone(value: string | null | undefined): boolean {
        const digits = String(value || '').replace(/\D/g, '')
        return digits.length >= 7
    }

    getPhoneHref(value: string | null | undefined): string {
        const normalized = String(value || '').trim()
        const prefix = normalized.startsWith('+') ? '+' : ''
        const digits = normalized.replace(/\D/g, '')
        return `tel:${prefix}${digits}`
    }

    private hasAnyCustomerInfoData(): boolean {
        const info = this.customerInfo || {} as FirewireCustomerInfo
        return [
            info.billingName,
            info.businessPointOfContactName,
            info.billingAddress,
            info.billingEmail,
            info.billingPhone,
            info.contractOrPoNumber
        ].some((value) => !!String(value || '').trim())
    }
}
