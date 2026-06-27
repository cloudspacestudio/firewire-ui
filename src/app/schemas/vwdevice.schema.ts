export interface VwDevice {
    categoryName: string
    includeOnFloorplan: boolean
    cost: number
    createat: Date
    createby: string
    defaultLabor: number
    laborRate?: number
    iconId?: string | null
    iconLabel?: string | null
    iconDataUrl?: string | null
    iconForegroundColor?: string | null
    deviceId: string
    name: string
    partNumber: string
    serialNumber: string
    shortName: string
    slcAddress: string
    speakerAddress: string
    strobeAddress: string
    updateat: Date
    updateby: string
    vendorId: string
    vendorName: string
    attributeCount?: number
    subTaskCount?: number
}
