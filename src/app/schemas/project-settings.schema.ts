export type ProjectSettingsListKey = 'jobType' | 'scopeType' | 'projectScope' | 'difficulty' | 'projectStatus' | 'assumptions' | 'inclusions' | 'exclusions'
export type ProjectSettingDivision = 'Fire Alarm' | 'Sprinkler' | 'Security'

export const PROJECT_SETTING_DIVISIONS: ProjectSettingDivision[] = ['Fire Alarm', 'Sprinkler', 'Security']

export interface ProjectSettingItemSchema {
    uuid: string
    listKey: ProjectSettingsListKey
    division: ProjectSettingDivision | null
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
    assumptions: ProjectSettingItemSchema[]
    inclusions: ProjectSettingItemSchema[]
    exclusions: ProjectSettingItemSchema[]
}

export interface ProjectSettingUpsert {
    listKey: ProjectSettingsListKey
    division: ProjectSettingDivision | null
    label: string
    description: string
    sortOrder: number
    isActive: boolean
}

export function createEmptyProjectSettingsCatalog(): ProjectSettingsCatalogSchema {
    return {
        jobType: [],
        scopeType: [],
        projectScope: [],
        difficulty: [],
        projectStatus: [],
        assumptions: [],
        inclusions: [],
        exclusions: []
    }
}
