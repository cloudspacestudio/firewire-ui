export type ProjectSettingsListKey = 'jobType' | 'scopeType' | 'projectScope' | 'difficulty' | 'projectStatus'

export interface ProjectSettingItemSchema {
    uuid: string
    listKey: ProjectSettingsListKey
    label: string
    description: string
    sortOrder: number
    isActive: boolean
    createdAt: string
    createdBy: string
    updatedAt: string
    updatedBy: string
}

export interface ProjectSettingsCatalogSchema {
    jobType: ProjectSettingItemSchema[]
    scopeType: ProjectSettingItemSchema[]
    projectScope: ProjectSettingItemSchema[]
    difficulty: ProjectSettingItemSchema[]
    projectStatus: ProjectSettingItemSchema[]
}

export interface ProjectSettingUpsert {
    listKey: ProjectSettingsListKey
    label: string
    description: string
    sortOrder: number
    isActive: boolean
}
