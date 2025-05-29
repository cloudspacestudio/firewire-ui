import { Component, OnChanges, Input } from "@angular/core"
import { NgIf, NgFor } from '@angular/common'
import { RouterLink } from "@angular/router"

import { HttpClient } from "@angular/common/http"
import { CommonModule } from "@angular/common"

import { MatButtonModule } from "@angular/material/button"
import { MatButtonToggleModule } from "@angular/material/button-toggle"
import { MatSelectModule } from "@angular/material/select"
import { MatFormFieldModule } from "@angular/material/form-field"
import { MatChipsModule } from "@angular/material/chips"
import { MatIconModule } from "@angular/material/icon"
import { PageToolbar } from "../../common/components/page-toolbar"
import { DeviceDetailComponent } from "../../common/components/devicedetail.component"

import { VwDevice } from "../../schemas/vwdevice.schema"

@Component({
    standalone: true,
    selector: 'project-page',
    imports: [CommonModule, RouterLink, 
        MatButtonModule, MatFormFieldModule, 
        MatSelectModule, MatButtonToggleModule,
        MatChipsModule, MatIconModule, 
        PageToolbar, DeviceDetailComponent],
    providers: [HttpClient],
    templateUrl: './device.page.html'
})
export class DevicePage implements OnChanges {
    @Input() deviceId?: string

    device?: VwDevice

    constructor() {}

    ngOnChanges(): void {
    }

    loadDevice(input: any) {
        this.device = input
    }

}