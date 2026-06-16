import { VwDevice } from "./vwdevice.schema"

export interface DeviceSetSummary {
    deviceSetId: string
    name: string
    visibility: string[]
    ownerUserId?: string | null
    deviceCount: number
    vendors: string[]
    createat?: Date
    updateat?: Date
}

export interface DeviceSetDetail {
    deviceSetId: string
    name: string
    visibility: string[]
    ownerUserId?: string | null
    devices: VwDevice[]
}
