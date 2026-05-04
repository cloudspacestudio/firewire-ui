import { HttpClient } from "@angular/common/http"
import { HttpErrorResponse } from "@angular/common/http"
import { Injectable } from "@angular/core"
import { firstValueFrom } from "rxjs"

import { MaterialAttribute } from "../../schemas/materialattribute.schema"
import { MaterialSubTask } from "../../schemas/materialsubtask.schema"
import { VwDevice } from "../../schemas/vwdevice.schema"
import { VwDeviceMaterial } from "../../schemas/vwdevicematerial.schema"
import { VwEddyPricelist } from "../../schemas/vwEddyPricelist"

export interface DevicePartPriceSyncResult {
    deviceId: string
    deviceName: string
    previousCost: number
    refreshedCost: number
    updated: boolean
    missingPartNumbers: string[]
    syncedBy: 'endpoint' | 'fallback'
}

interface DevicePartPriceSyncEndpointResponse {
    data?: Partial<DevicePartPriceSyncResult>
}

@Injectable({
    providedIn: 'root'
})
export class DevicePartPriceSyncService {
    private vendorPartRowsPromise?: Promise<VwEddyPricelist[]>

    constructor(private http: HttpClient) {}

    async getVendorPartRows(): Promise<VwEddyPricelist[]> {
        if (!this.vendorPartRowsPromise) {
            this.vendorPartRowsPromise = firstValueFrom(this.http.get<{ rows?: VwEddyPricelist[] }>('/api/firewire/vweddypricelist'))
                .then((response) => Array.isArray(response?.rows) ? response.rows : [])
                .catch((err) => {
                    this.vendorPartRowsPromise = undefined
                    throw err
                })
        }

        return this.vendorPartRowsPromise
    }

    async syncDevice(deviceId: string): Promise<DevicePartPriceSyncResult> {
        const endpointResult = await this.trySyncDeviceWithEndpoint(deviceId)
        if (endpointResult) {
            return endpointResult
        }

        const [device, materials, attributes, subTasks, vendorParts] = await Promise.all([
            firstValueFrom(this.http.get<VwDevice>(`/api/firewire/devices/${deviceId}`)),
            firstValueFrom(this.http.get<{ rows?: VwDeviceMaterial[] }>(`/api/firewire/vwdevicematerials/${deviceId}`)),
            firstValueFrom(this.http.get<{ rows?: MaterialAttribute[] }>(`/api/firewire/devices/${deviceId}/attributes`)),
            firstValueFrom(this.http.get<{ rows?: MaterialSubTask[] }>(`/api/firewire/devices/${deviceId}/subtasks`)),
            this.getVendorPartRows()
        ])

        const materialRows = Array.isArray(materials?.rows) ? materials.rows : []
        const partNumbers = materialRows
            .map((row) => String(row.materialPartNumber || '').trim())
            .filter(Boolean)
        const fallbackPartNumbers = partNumbers.length > 0
            ? partNumbers
            : [String(device.partNumber || '').trim()].filter(Boolean)
        const priceResult = this.calculateCurrentPrice(fallbackPartNumbers, vendorParts, materialRows, Number(device.cost || 0))
        const previousCost = Number(device.cost || 0)
        const refreshedCost = Number(priceResult.total.toFixed(2))
        const updated = Math.abs(previousCost - refreshedCost) >= 0.005

        if (updated) {
            await firstValueFrom(this.http.put(`/api/firewire/devices/${deviceId}/detail`, {
                device: {
                    ...device,
                    cost: refreshedCost
                },
                partNumbers,
                attributes: (Array.isArray(attributes?.rows) ? attributes.rows : []).map((attribute, index) => ({
                    ...attribute,
                    ordinal: index,
                    valueType: attribute.valueType || 'text'
                })),
                subTasks: (Array.isArray(subTasks?.rows) ? subTasks.rows : []).map((subTask, index) => ({
                    ...subTask,
                    ordinal: index
                }))
            }))
        }

        return {
            deviceId,
            deviceName: String(device.name || ''),
            previousCost,
            refreshedCost,
            updated,
            missingPartNumbers: priceResult.missingPartNumbers,
            syncedBy: 'fallback'
        }
    }

    private async trySyncDeviceWithEndpoint(deviceId: string): Promise<DevicePartPriceSyncResult | null> {
        try {
            const response = await firstValueFrom(this.http.post<DevicePartPriceSyncEndpointResponse>(
                `/api/firewire/devices/${deviceId}/sync-part-prices`,
                {}
            ))
            const data = response?.data
            if (!data) {
                return null
            }

            return {
                deviceId: String(data.deviceId || deviceId),
                deviceName: String(data.deviceName || ''),
                previousCost: Number(data.previousCost || 0),
                refreshedCost: Number(data.refreshedCost || 0),
                updated: !!data.updated,
                missingPartNumbers: Array.isArray(data.missingPartNumbers) ? data.missingPartNumbers : [],
                syncedBy: 'endpoint'
            }
        } catch (err) {
            if (this.isMissingEndpointError(err)) {
                return null
            }
            throw err
        }
    }

    calculateCurrentPrice(
        partNumbers: string[],
        vendorParts: VwEddyPricelist[],
        materialRows: VwDeviceMaterial[] = [],
        fallbackCost = 0
    ): { total: number, missingPartNumbers: string[] } {
        if (partNumbers.length <= 0) {
            return { total: Number(fallbackCost || 0), missingPartNumbers: [] }
        }

        const vendorPartByNumber = this.createVendorPartMap(vendorParts)
        const materialCostByNumber = new Map(materialRows.map((row) => [
            this.normalizePartNumber(row.materialPartNumber),
            Number(row.materialCost || 0)
        ] as const))
        const missingPartNumbers: string[] = []
        const total = partNumbers.reduce((sum, partNumber) => {
            const normalized = this.normalizePartNumber(partNumber)
            const vendorPart = vendorPartByNumber.get(normalized)
            if (vendorPart) {
                return sum + this.getVendorPartPrice(vendorPart)
            }

            missingPartNumbers.push(partNumber)
            return sum + Number(materialCostByNumber.get(normalized) || 0)
        }, 0)

        return { total, missingPartNumbers }
    }

    getVendorPartPrice(part: VwEddyPricelist): number {
        return Number(part.SalesPrice || part.MSRPPrice || part.FutureSalesPrice || part.FuturePrice || 0)
    }

    createVendorPartMap(vendorParts: VwEddyPricelist[]): Map<string, VwEddyPricelist> {
        return new Map(vendorParts
            .map((part) => [this.normalizePartNumber(part.PartNumber), part] as const)
            .filter(([partNumber]) => !!partNumber))
    }

    normalizePartNumber(partNumber: string | null | undefined): string {
        return String(partNumber || '').trim().toLowerCase()
    }

    private isMissingEndpointError(err: unknown): boolean {
        return err instanceof HttpErrorResponse && (err.status === 404 || err.status === 405)
    }
}
