export interface DeviceIcon {
    iconId: string
    iconGroupId: string
    label: string
    fileName?: string
    mimeType?: string
    dataUrl: string
    sortOrder?: number
    createat?: string | Date
    updateat?: string | Date
}

export interface DeviceIconGroup {
    iconGroupId: string
    name: string
    sortOrder?: number
    createat?: string | Date
    updateat?: string | Date
    icons: DeviceIcon[]
}
