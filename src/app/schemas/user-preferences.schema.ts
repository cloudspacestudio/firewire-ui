export type HomeBackgroundMode = 'video' | 'solid' | 'gradient'
export type HomeBackgroundVideo = string
export type ProjectMapStyle = 'night' | 'road' | 'satellite' | 'road_shaded_relief'
export type ProjectMapDimension = '2d' | '3d'

export interface ProjectMapPreferences {
    version: number
    style: ProjectMapStyle
    dimension: ProjectMapDimension
    showRoadDetails: boolean
    showBuildingFootprints: boolean
    autoFitPins: boolean
}

export interface HomeBackgroundVideoManifestItem {
    fileName: string
    label: string
    extension: string
    thumbnailFileName?: string | null
}

export interface UserPreferences {
    homePage: {
        backgroundMode: HomeBackgroundMode
        backgroundVideo: HomeBackgroundVideo
        showRecentProjects: boolean
        compactHero: boolean
        solidColor: string
        gradientFrom: string
        gradientTo: string
        gradientAngle: number
    }
    projectMap: ProjectMapPreferences
    profile: {
        avatarDataUrl: string | null
    }
}

export interface UserPreferencesRecord {
    userId: string
    preferences: UserPreferences
    createdAt: string | null
    createdBy: string | null
    updatedAt: string | null
    updatedBy: string | null
}

export const PROJECT_MAP_STYLE_OPTIONS: Array<{ value: ProjectMapStyle, label: string, note: string }> = [
    { value: 'night', label: 'Night', note: 'Sci-fi dark command view' },
    { value: 'road', label: 'Road', note: 'Clean standard street map' },
    { value: 'satellite', label: 'Satellite', note: 'Aerial imagery for site context' },
    { value: 'road_shaded_relief', label: 'Relief', note: 'Road map with terrain shading' }
]

export const PROJECT_MAP_DIMENSION_OPTIONS: Array<{ value: ProjectMapDimension, label: string, note: string }> = [
    { value: '2d', label: '2D', note: 'Flat tactical map' },
    { value: '3d', label: '3D', note: 'Pitched command perspective' }
]
