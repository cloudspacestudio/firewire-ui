export interface FirewireProjectSchema {
    uuid: string
    fieldwireId: string | null
    name: string
    projectNbr: string
    address: string
    bidDueDate: string
    projectStatus: string
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
    name: string
    projectNbr: string
    address: string
    bidDueDate: string
    projectStatus: string
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
