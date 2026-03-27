import { Component, OnChanges, Input, ViewChild } from "@angular/core"
import { Observable } from "rxjs"
import { Router, RouterLink } from "@angular/router"

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
    @ViewChild(DeviceDetailComponent) detailComponent?: DeviceDetailComponent

    device?: VwDevice

    constructor(private router: Router) {}

    ngOnChanges(): void {
    }

    loadDevice(input: any) {
        this.device = input
    }

    onDeviceDeleted() {
        void this.router.navigate(['/devices'])
    }

    canDeactivate(): boolean | Observable<boolean> {
        if (this.detailComponent && typeof this.detailComponent.canDeactivate === 'function') {
            return this.detailComponent.canDeactivate()
        }
        return true
    }

}
