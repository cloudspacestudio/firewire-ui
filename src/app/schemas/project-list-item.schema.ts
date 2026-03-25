import type { FirewireProjectType } from './firewire-project.schema'

export type ProjectSource = 'fieldwire' | 'firewire' | 'both'

export interface ProjectListItemSchema {
    projectSource: ProjectSource
    fieldwireProjectId: string | null
    firewireProjectId: string | null
    fieldwireId: string | null
    mappedFieldwireProjectName: string | null
    name: string
    projectNbr: string
    address: string
    addressNeedsVerification: boolean
    latitude: number | null
    longitude: number | null
    geocodeStatus: string | null
    geocodedAt: string | null
    bidDueDate: string | null
    projectStatus: string | null
    projectType: FirewireProjectType | null
    salesman: string | null
    jobType: string | null
    scopeType: string | null
    projectScope: string | null
    difficulty: string | null
    totalSqFt: number | null
    createdAt: string | null
    createdBy: string | null
    updatedAt: string | null
    updatedBy: string | null
}
