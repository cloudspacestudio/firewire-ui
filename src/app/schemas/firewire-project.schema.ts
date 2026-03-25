export type FirewireProjectType = 'Fire Alarm' | 'Sprinkler' | 'Security'
export const FIREWIRE_PROJECT_TYPE_OPTIONS: FirewireProjectType[] = ['Fire Alarm', 'Sprinkler', 'Security']

export interface FirewireProjectSchema {
    uuid: string
    fieldwireId: string | null
    worksheetData?: any | null
    isManualLocked: boolean
    manualLockedAt: string | null
    manualLockedBy: string | null
    name: string
    projectNbr: string
    address: string
    addressNeedsVerification: boolean
    latitude: number | null
    longitude: number | null
    geocodeStatus: string | null
    geocodedAt: string | null
    bidDueDate: string
    projectStatus: string
    projectType: FirewireProjectType
    salesman: string
    jobType: string
    scopeType: string
    projectScope: string
    difficulty: string
    totalSqFt: number
    createdAt: string
    createdBy: string
    updatedAt: string
    updatedBy: string
}

export interface FirewireProjectUpsert {
    fieldwireId?: string | null
    worksheetData?: any
    name: string
    projectNbr: string
    address: string
    bidDueDate: string
    projectStatus: string
    projectType: FirewireProjectType
    salesman: string
    jobType: string
    scopeType: string
    projectScope: string
    difficulty: string
    totalSqFt: number
}

export interface FirewireProjectFieldwireMap {
    fieldwireId: string | null
}
