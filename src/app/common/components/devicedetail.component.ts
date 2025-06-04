import { Component, OnChanges, Input, Output } from "@angular/core"
import { EventEmitter } from "@angular/core"
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
import { MatListModule } from "@angular/material/list"

import { VwDevice } from "../../schemas/vwdevice.schema"
import { VwDeviceMaterial } from "../../schemas/vwdevicematerial.schema"
import { MaterialAttribute } from "../../schemas/materialattribute.schema"
import { MaterialSubTask } from "../../schemas/materialsubtask.schema"
import { VwEddyPricelist } from "../../schemas/vwEddyPricelist"

@Component({
    standalone: true,
    selector: 'device-detail',
    imports: [CommonModule, 
        MatButtonModule, MatFormFieldModule, 
        MatSelectModule, MatButtonToggleModule,
        MatChipsModule, MatIconModule,
        MatListModule],
    providers: [HttpClient],
    templateUrl: './devicedetail.component.html'
})
export class DeviceDetailComponent implements OnChanges {
    @Input() deviceId?: string
    @Output() deviceLoaded: EventEmitter<VwDevice> = new EventEmitter()

    device?: VwDevice
    deviceMaterials?: VwDeviceMaterial[]
    deviceAttributes?: MaterialAttribute[]
    deviceSubTasks?: MaterialSubTask[]
    partlist?: VwEddyPricelist[] = []
    partImagePath: string = ''

    pageWorking = true

    constructor(private http: HttpClient) {}

    ngOnChanges(): void {
        this.pageWorking = true

        if (!this.deviceId) {
            console.error(`Invalid Device Id`)
            return
        }

        this.http.get(`/api/fieldwire/devices/${this.deviceId}`).subscribe({
            next: async(s: any) => {
                if (s) {
                    this.device = Object.assign({}, s)
                    this.deviceLoaded?.emit(this.device)
                    this.pageWorking = false
                    this.loadEddyPartDetail(this.device?.partNumber||'')
                    return
                }
                this.pageWorking = false
            },
            error: (err: Error) => {
                console.dir(err)
                this.pageWorking = false
            }
        })
        this.http.get(`/api/fieldwire/vwdevicematerials/${this.deviceId}`).subscribe({
            next: async(s: any) => {
                if (s && s.rows) {
                    this.deviceMaterials = s.rows
                }
            },
            error: (err: Error) => {
                console.dir(err)
            }
        })
        this.http.get(`/api/fieldwire/devices/${this.deviceId}/attributes`).subscribe({
            next: async(s: any) => {
                if (s && s.rows) {
                    this.deviceAttributes = s.rows
                }
            },
            error: (err: Error) => {
                console.dir(err)
            }
        })
        this.http.get(`/api/fieldwire/devices/${this.deviceId}/subtasks`).subscribe({
            next: async(s: any) => {
                if (s && s.rows) {
                    this.deviceSubTasks = s.rows
                }
            },
            error: (err: Error) => {
                console.dir(err)
            }
        })

    }

    loadEddyPartDetail(partNumber: string): Promise<VwEddyPricelist|null> {
        return new Promise(async(resolve, reject) => {
            try {
                if (!this.device || !partNumber) {
                    this.partlist = []
                }
                const test = this.partlist?.find(s => s.PartNumber===partNumber)
                if (test) {
                    return resolve(test)
                }
                this.http.get(`/api/fieldwire/vweddypricelist/${partNumber}`).subscribe({
                    next: async(s: any) => {
                        if (s && s.rows && s.rows.length > 0) {
                            for(let i = 0; i < s.rows.length; i++) {
                                const record = s.rows[i]
                                this.partlist?.push(record)
                            }
                            // https://myeddie.edwardsfiresafety.com/Media/ProductImages/SIGA-SD.jpg
                            this.partImagePath = this.getPartImagePath()
                            return resolve(s.rows[0])
                        } else {
                            return resolve(null)
                        }
                    },
                    error: (err: Error) => {
                        console.dir(err)
                        return reject(err)
                    }
                })
            } catch (err) {
                return reject(err)
            }
        })
    }

    getPartImagePath() {
        if(this.partlist && this.partlist.length > 0) {
            const record = this.partlist[0]
            if (record && record.PrimaryImage) {
                return `https://myeddie.edwardsfiresafety.com${record.PrimaryImage}`
            }
        }
        return ''
    }

    sortAttributes(): MaterialAttribute[] {
        if (!this.deviceAttributes || this.deviceAttributes.length <= 0) {
            return []
        }
        return this.deviceAttributes.sort((a, b) => a.ordinal-b.ordinal)
    }
    sortSubTasks(): MaterialSubTask[] {
        if (!this.deviceSubTasks || this.deviceSubTasks.length <= 0) {
            return []
        }
        return this.deviceSubTasks.sort((a, b) => a.ordinal-b.ordinal)
    }

    settingText(setting: string) {
        if (!setting) {
            return 'None'
        }
        if (setting.toLowerCase()==='n/a') {
            return 'True'
        }
        if (setting.toLowerCase()==='macaddress'||setting.toLowerCase()==='mac address') {
            return 'Mac Address'
        }
        return ''
    }

}