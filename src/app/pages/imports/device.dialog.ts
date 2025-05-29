import {Component, inject, OnInit} from '@angular/core'
import { Resolve, RouterLink } from '@angular/router'
import { NgIf, NgFor } from '@angular/common'
import {
    MAT_DIALOG_DATA,
    MatDialogTitle,
    MatDialogContent,
    MatDialogActions,
    MatDialogClose
} from '@angular/material/dialog'
import { MatButtonModule } from '@angular/material/button'
import { MatIconModule } from '@angular/material/icon'
import { DeviceDetailComponent } from '../../common/components/devicedetail.component'

import { VwDevice } from '../../schemas/vwdevice.schema'

@Component({
    standalone: true,
    templateUrl: './device.dialog.html',
    imports: [NgIf, MatDialogTitle, MatDialogContent, 
        MatDialogActions, MatButtonModule,
        MatDialogClose, MatIconModule,
        DeviceDetailComponent]
})
export class DeviceDialog implements OnInit {
    deviceInput: string = inject(MAT_DIALOG_DATA)
    deviceId?: string
    
    device?: VwDevice

    ngOnInit() {
        console.dir(this.deviceInput)
        this.deviceId = this.deviceInput
    }

    doDeviceLoaded(e: VwDevice) {
        this.device = e
    }

}
