export type HomeBackgroundMode = 'video' | 'solid' | 'gradient'
export type HomeBackgroundVideo = string

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
