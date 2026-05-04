import { CommonModule } from "@angular/common"
import { HttpClient } from "@angular/common/http"
import { Component, OnInit } from "@angular/core"
import { FormsModule } from "@angular/forms"
import { ActivatedRoute, RouterLink } from "@angular/router"
import { firstValueFrom } from "rxjs"

import { MatButtonModule } from "@angular/material/button"
import { MatIconModule } from "@angular/material/icon"
import { MatInputModule } from "@angular/material/input"
import { MatFormFieldModule } from "@angular/material/form-field"

import { NavToolbar } from "../../common/components/nav-toolbar"
import { PageToolbar } from "../../common/components/page-toolbar"
import { DevicePartPriceSyncService } from "../../common/services/device-part-price-sync.service"
import { DeviceSetDetail } from "../../schemas/device-set.schema"
import { VwDeviceMaterial } from "../../schemas/vwdevicematerial.schema"
import { VwEddyPricelist } from "../../schemas/vwEddyPricelist"

interface DeviceSetLinkedPartRow extends VwDeviceMaterial {
    sourceDeviceName: string
    sourceDevicePartNumber: string
    sourceDeviceVendorName: string
    currentVendorPrice: number | null
}

@Component({
    standalone: true,
    selector: 'device-set-parts-page',
    imports: [
        CommonModule,
        FormsModule,
        RouterLink,
        MatButtonModule,
        MatIconModule,
        MatInputModule,
        MatFormFieldModule,
        PageToolbar,
        NavToolbar
    ],
    providers: [HttpClient],
    templateUrl: './device-set-parts.page.html',
    styleUrls: ['./device-set-parts.page.scss']
})
export class DeviceSetPartsPage implements OnInit {
    navItems = NavToolbar.DeviceNavItems
    deviceSetId = ''
    detail: DeviceSetDetail | null = null
    partRows: DeviceSetLinkedPartRow[] = []
    vendorPartMap = new Map<string, VwEddyPricelist>()
    pageWorking = true
    syncWorking = false
    errText = ''
    statusText = ''
    filterText = ''

    constructor(
        private route: ActivatedRoute,
        private http: HttpClient,
        private priceSync: DevicePartPriceSyncService
    ) {}

    ngOnInit(): void {
        this.deviceSetId = String(this.route.snapshot.paramMap.get('deviceSetId') || '').trim()
        this.load()
    }

    async load(): Promise<void> {
        if (!this.deviceSetId) {
            this.errText = 'Missing device set id.'
            this.pageWorking = false
            return
        }

        this.pageWorking = true
        this.errText = ''

        try {
            const [detailResponse, vendorParts] = await Promise.all([
                firstValueFrom(this.http.get<{ data?: DeviceSetDetail }>(`/api/firewire/device-sets/${this.deviceSetId}`)),
                this.priceSync.getVendorPartRows()
            ])
            this.detail = detailResponse?.data || null
            this.vendorPartMap = this.priceSync.createVendorPartMap(vendorParts)
            const devices = this.detail?.devices || []
            const materialResults = await Promise.all(devices.map(async (device) => {
                const response = await firstValueFrom(this.http.get<{ rows?: VwDeviceMaterial[] }>(`/api/firewire/vwdevicematerials/${device.deviceId}`))
                return (Array.isArray(response?.rows) ? response.rows : []).map((material) => ({
                    ...material,
                    sourceDeviceName: device.name,
                    sourceDevicePartNumber: device.partNumber,
                    sourceDeviceVendorName: device.vendorName,
                    currentVendorPrice: this.getCurrentVendorPrice(material.materialPartNumber)
                } as DeviceSetLinkedPartRow))
            }))

            this.partRows = materialResults
                .flat()
                .sort((left, right) => {
                    const deviceCompare = left.sourceDeviceName.localeCompare(right.sourceDeviceName)
                    return deviceCompare || String(left.materialName || '').localeCompare(String(right.materialName || ''))
                })
        } catch (err: any) {
            this.errText = err?.error?.message || err?.message || 'Unable to load linked part details.'
        } finally {
            this.pageWorking = false
        }
    }

    async syncDeviceSetPartPrices(): Promise<void> {
        const devices = this.detail?.devices || []
        if (devices.length <= 0) {
            this.statusText = 'No devices are linked to this set.'
            return
        }

        this.syncWorking = true
        this.statusText = 'Refreshing linked part prices from vendor list...'
        try {
            const results = []
            for (const device of devices) {
                results.push(await this.priceSync.syncDevice(device.deviceId))
            }
            const updatedCount = results.filter((result) => result.updated).length
            const missingCount = results.reduce((total, result) => total + result.missingPartNumbers.length, 0)
            this.statusText = `Updated ${updatedCount} device${updatedCount === 1 ? '' : 's'} from vendor prices.${missingCount > 0 ? ` ${missingCount} linked part${missingCount === 1 ? '' : 's'} still missing vendor price matches.` : ''}`
            await this.load()
        } catch (err: any) {
            this.statusText = err?.error?.message || err?.message || 'Unable to refresh linked part prices.'
        } finally {
            this.syncWorking = false
        }
    }

    get filteredPartRows(): DeviceSetLinkedPartRow[] {
        const filter = this.filterText.trim().toLowerCase()
        if (!filter) {
            return this.partRows
        }

        return this.partRows.filter((row) => [
            row.sourceDeviceName,
            row.sourceDevicePartNumber,
            row.sourceDeviceVendorName,
            row.materialName,
            row.materialPartNumber,
            row.materialShortName,
            row.deviceCategoryName,
            row.org
        ].join(' ').toLowerCase().includes(filter))
    }

    get deviceCount(): number {
        return this.detail?.devices?.length || 0
    }

    get totalMaterialCost(): number {
        return this.partRows.reduce((total, row) => total + Number(row.materialCost || 0), 0)
    }

    get totalVendorCost(): number {
        return this.partRows.reduce((total, row) => total + Number(row.currentVendorPrice ?? row.materialCost ?? 0), 0)
    }

    isPriceOutOfSync(row: DeviceSetLinkedPartRow): boolean {
        if (row.currentVendorPrice === null) {
            return false
        }
        return Math.abs(Number(row.materialCost || 0) - Number(row.currentVendorPrice || 0)) >= 0.005
    }

    get outOfSyncCount(): number {
        return this.partRows.filter((row) => this.isPriceOutOfSync(row)).length
    }

    private getCurrentVendorPrice(partNumber: string): number | null {
        const vendorPart = this.vendorPartMap.get(this.priceSync.normalizePartNumber(partNumber))
        return vendorPart ? this.priceSync.getVendorPartPrice(vendorPart) : null
    }
}
