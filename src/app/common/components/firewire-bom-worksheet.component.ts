import { CommonModule } from '@angular/common'
import { Component, Input } from '@angular/core'
import { FormsModule } from '@angular/forms'

import { MatButtonModule } from '@angular/material/button'
import { MatFormFieldModule } from '@angular/material/form-field'
import { MatIconModule } from '@angular/material/icon'
import { MatSelectModule } from '@angular/material/select'

import { AutosizeTextareaDirective } from '../directives/autosize-textarea.directive'

@Component({
    standalone: true,
    selector: 'firewire-bom-worksheet',
    imports: [
        CommonModule,
        FormsModule,
        MatButtonModule,
        MatFormFieldModule,
        MatIconModule,
        MatSelectModule,
        AutosizeTextareaDirective
    ],
    templateUrl: './firewire-bom-worksheet.component.html',
    styleUrls: ['../../pages/sales/sales-project.page.scss']
})
export class FirewireBomWorksheetComponent {
    @Input({ required: true }) host!: any
    @Input() context: 'sales' | 'project' = 'project'

    get locked(): boolean {
        return this.context === 'project' && !!this.host?.isActiveFirewireWorkspaceLocked?.()
    }

    get saveWorking(): boolean {
        return this.context === 'sales' ? !!this.host?.saveWorking : !!this.host?.firewireSaveWorking
    }

    get saveMessage(): string {
        return this.context === 'sales' ? String(this.host?.saveMessage || '') : String(this.host?.firewireSaveMessage || '')
    }

    get canAddDeviceSet(): boolean {
        return Array.isArray(this.host?.deviceSets) && typeof this.host?.addSelectedDeviceSetToBom === 'function'
    }

    get canAddSection(): boolean {
        return typeof this.host?.addBomSection === 'function'
    }

    get canExportCsv(): boolean {
        return typeof this.host?.exportBomCsv === 'function'
    }

    get canRemoveSection(): boolean {
        return typeof this.host?.removeBomSection === 'function'
    }

    onBomShapeChanged(): void {
        if (this.context === 'project') {
            this.host?.refreshTakeoffColumnDefinitions?.()
        }
    }
}
