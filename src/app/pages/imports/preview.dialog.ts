import {Component, inject, OnInit} from '@angular/core'
import { Resolve, RouterLink } from '@angular/router'
import { NgIf, NgFor } from '@angular/common'
import {
    MatDialog,
    MAT_DIALOG_DATA,
    MatDialogTitle,
    MatDialogContent,
    MatDialogActions,
    MatDialogClose
} from '@angular/material/dialog'
import { MatButtonModule } from '@angular/material/button'
import { MatToolbarModule } from '@angular/material/toolbar'
import { MatListModule } from '@angular/material/list'
import { MatIconModule } from '@angular/material/icon'
import { MatBadgeModule } from '@angular/material/badge'
import { MatMenuModule } from '@angular/material/menu'
import { MatCardModule } from '@angular/material/card'

import { PreviewDialogSchema } from '../../schemas/previewdialog.schema'
import { ResolvedDevice } from '../../schemas/resolveddevice.schema'
import { MaterialAttribute } from '../../schemas/materialattribute.schema'
import { MaterialSubTask } from '../../schemas/materialsubtask.schema'
import { PreviewRecord } from '../../schemas/previewrecord.schema'
import { ExecuteDialog } from './execute.dialog'
import { DeviceDialog } from './device.dialog'

@Component({
    standalone: true,
    templateUrl: './preview.dialog.html',
    imports: [NgIf, NgFor, MatDialogTitle, MatDialogContent, 
        MatDialogActions, MatButtonModule,
        MatDialogClose, MatToolbarModule,
        MatListModule, MatIconModule,
        MatBadgeModule, MatMenuModule,
        MatCardModule],
})
export class PreviewDialog implements OnInit {
    previewResponse: PreviewDialogSchema = inject(MAT_DIALOG_DATA)
    tab = 'devices'
    dialog = inject(MatDialog)

    ngOnInit(): void {
        console.dir(this.previewResponse)
    }

    selectTab(tabName: string) {
        if (tabName!==this.tab) {
            this.tab = tabName
        }
    }

    getDeviceCount(device: ResolvedDevice) {
        const test = this.previewResponse.data.preview.filter(s => s.deviceId===device.id)
        if (!test) {
            return 0
        }
        return test.length
    }

    getDeviceAttrAndSubTaskCount(device: ResolvedDevice): ResolvedDeviceAttrAndTaskDetail|null {
        const test = this.previewResponse.data.preview.find(s => s.deviceId===device.id)
        if (!test) {
            return null
        }
        return {
            attrs: [...test.attrs],
            tasks: [...test.subTaskDefs]
        }
    }

    getDeviceAttributeCount(device: ResolvedDevice): number {
        const test = this.getDeviceAttrAndSubTaskCount(device)
        if (test && test.attrs) {
            return test.attrs.length
        }
        return 0
    }

    getDeviceSubTaskCount(device: ResolvedDevice): number {
        const test = this.getDeviceAttrAndSubTaskCount(device)
        if (test && test.tasks) {
            return test.tasks.length
        }
        return 0
    }

    getDeviceAttrAndSubTaskCountNumber(device: ResolvedDevice): number {
        const testAttrs = this.getDeviceAttributeCount(device)
        const testTasks = this.getDeviceSubTaskCount(device)
        return testAttrs + testTasks
    }

    getUnresolvedDeviceCount(name: string) {
        const test = this.previewResponse.data.preview.filter(s => s.messages.indexOf(name)>=0)
        if (!test) {
            return 0
        }
        return test.length
    }

    getDeviceFromId(id: string): ResolvedDevice | null {
        const test = this.previewResponse.data.devices.find(s => s.id===id)
        if (!test) {
            return null
        }
        return test
    }

    sortRowSubTasks(row: PreviewRecord): MaterialSubTask[] {
        return row.subTaskDefs.sort((a, b) => a.ordinal - b.ordinal)
    }

    isWarning() {
        if (!this.previewResponse || !this.previewResponse.data) {
            return true
        }
        if (this.previewResponse.data.preview.length <= 0) {
            return true
        }
        if (this.previewResponse.data.unresolvedNames.length > 0) {
            return true
        }
        return false
    }

    execute() {
        this.dialog.open(ExecuteDialog, {
            data: this.previewResponse,
            closeOnNavigation: true,
            disableClose: true
        })
    }

    openDevice(deviceId: string) {
        this.dialog.open(DeviceDialog, {
            data: deviceId,
            closeOnNavigation: true,
            disableClose: true
        })
    }

}

export interface ResolvedDeviceAttrAndTaskDetail {
    attrs: MaterialAttribute[]
    tasks: MaterialSubTask[]
}