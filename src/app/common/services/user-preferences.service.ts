import { Injectable } from '@angular/core'
import { HttpClient } from '@angular/common/http'
import { BehaviorSubject, Observable, firstValueFrom } from 'rxjs'
import { map } from 'rxjs/operators'
import { HomeBackgroundMode, HomeBackgroundVideo, HomeBackgroundVideoManifestItem, ProjectMapDimension, ProjectMapStyle, UserPreferences, UserPreferencesRecord } from '../../schemas/user-preferences.schema'

@Injectable({ providedIn: 'root' })
export class UserPreferencesService {
    private readonly projectMapPreferencesVersion = 1
    private readonly preferencesSubject = new BehaviorSubject<UserPreferences>(this.defaultPreferences())
    private loaded = false
    private loadingPromise: Promise<UserPreferences> | null = null
    private readonly fallbackVideoManifest: HomeBackgroundVideoManifestItem[] = [
        { fileName: 'ps3.mp4', label: 'PS3 Legacy', extension: 'mp4', thumbnailFileName: 'ps3.jpg' }
    ]
    private videoManifest: HomeBackgroundVideoManifestItem[] = this.fallbackVideoManifest
    private videoManifestPromise: Promise<HomeBackgroundVideoManifestItem[]> | null = null

    constructor(private readonly http: HttpClient) {}

    get preferences$(): Observable<UserPreferences> {
        return this.preferencesSubject.asObservable()
    }

    get snapshot(): UserPreferences {
        return this.preferencesSubject.value
    }

    async load(): Promise<UserPreferences> {
        if (this.loaded) {
            return this.snapshot
        }
        if (this.loadingPromise) {
            return this.loadingPromise
        }

        this.loadingPromise = firstValueFrom(
            this.http.get<{ data?: UserPreferencesRecord }>('/api/firewire/user-preferences').pipe(
                map((response) => this.normalizePreferences(response?.data?.preferences))
            )
        ).then((preferences) => {
            this.preferencesSubject.next(preferences)
            this.loaded = true
            this.loadingPromise = null
            return preferences
        }).catch((err) => {
            console.error('Failed to load user preferences.', err)
            const fallback = this.snapshot
            this.loaded = true
            this.loadingPromise = null
            return fallback
        })

        return this.loadingPromise
    }

    async save(preferences: UserPreferences): Promise<UserPreferencesRecord> {
        const normalized = this.normalizePreferences(preferences)
        const result = await firstValueFrom(
            this.http.put<{ data?: UserPreferencesRecord }>('/api/firewire/user-preferences', normalized).pipe(
                map((response) => response?.data ?? {
                    userId: '',
                    preferences: normalized,
                    createdAt: null,
                    createdBy: null,
                    updatedAt: null,
                    updatedBy: null
                })
            )
        )
        const persisted = this.normalizePreferences(result.preferences)
        this.preferencesSubject.next(persisted)
        this.loaded = true
        return {
            ...result,
            preferences: persisted
        }
    }

    updateLocal(preferences: UserPreferences): void {
        this.preferencesSubject.next(this.normalizePreferences(preferences))
    }

    async loadVideoManifest(): Promise<HomeBackgroundVideoManifestItem[]> {
        if (this.videoManifestPromise) {
            return this.videoManifestPromise
        }

        this.videoManifestPromise = firstValueFrom(
            this.http.get<HomeBackgroundVideoManifestItem[]>('/images/videos/index.json').pipe(
                map((response) => Array.isArray(response) ? response : [])
            )
        ).then((manifest) => {
            const normalized = manifest
                .filter((item) => item && typeof item.fileName === 'string' && item.fileName.trim().length > 0)
                .map((item) => ({
                    fileName: item.fileName.trim(),
                    label: typeof item.label === 'string' && item.label.trim() ? item.label.trim() : item.fileName.trim(),
                    extension: typeof item.extension === 'string' ? item.extension.trim().toLowerCase() : '',
                    thumbnailFileName: typeof item.thumbnailFileName === 'string' && item.thumbnailFileName.trim()
                        ? item.thumbnailFileName.trim()
                        : null
                }))
            this.videoManifest = normalized.length > 0 ? normalized : this.fallbackVideoManifest
            this.videoManifestPromise = null
            return this.videoManifest
        }).catch((err) => {
            console.error('Failed to load video manifest.', err)
            this.videoManifestPromise = null
            return this.videoManifest
        })

        return this.videoManifestPromise
    }

    getHomeVideoUrl(video: HomeBackgroundVideo): string {
        return `/images/videos/${this.normalizeBackgroundVideo(video)}`
    }

    getHomeVideoThumbnailUrl(thumbnailFileName: string | null | undefined): string | null {
        if (typeof thumbnailFileName !== 'string' || !thumbnailFileName.trim()) {
            return null
        }
        return `/images/videos/${thumbnailFileName.trim()}`
    }

    private normalizePreferences(input: UserPreferences | null | undefined): UserPreferences {
        return {
            homePage: {
                backgroundMode: this.normalizeBackgroundMode(input?.homePage?.backgroundMode),
                backgroundVideo: this.normalizeBackgroundVideo(input?.homePage?.backgroundVideo),
                showRecentProjects: input?.homePage?.showRecentProjects !== false,
                compactHero: !!input?.homePage?.compactHero,
                solidColor: this.normalizeColor(input?.homePage?.solidColor, '#08111b'),
                gradientFrom: this.normalizeColor(input?.homePage?.gradientFrom, '#09111d'),
                gradientTo: this.normalizeColor(input?.homePage?.gradientTo, '#060a12'),
                gradientAngle: this.normalizeAngle(input?.homePage?.gradientAngle)
            },
            projectMap: {
                ...(Number(input?.projectMap?.version) === this.projectMapPreferencesVersion
                    ? {
                        version: this.projectMapPreferencesVersion,
                        style: this.normalizeProjectMapStyle(input?.projectMap?.style),
                        dimension: this.normalizeProjectMapDimension(input?.projectMap?.dimension),
                        showRoadDetails: input?.projectMap?.showRoadDetails !== false,
                        showBuildingFootprints: input?.projectMap?.showBuildingFootprints !== false,
                        autoFitPins: input?.projectMap?.autoFitPins !== false
                    }
                    : this.defaultPreferences().projectMap)
            },
            profile: {
                avatarDataUrl: typeof input?.profile?.avatarDataUrl === 'string' && input.profile.avatarDataUrl.trim()
                    ? input.profile.avatarDataUrl.trim()
                    : null
            }
        }
    }

    private normalizeBackgroundMode(input: string | undefined): HomeBackgroundMode {
        return input === 'solid' || input === 'gradient' ? input : 'video'
    }

    private normalizeBackgroundVideo(input: string | undefined): HomeBackgroundVideo {
        if (typeof input !== 'string' || !input.trim()) {
            return 'ps3.mp4'
        }
        const value = input.trim()
        if (/^[^\\/:*?"<>|]+\.(mp4|mov|webm)$/i.test(value)) {
            return value
        }
        if (/^media\d+$/i.test(value)) {
            return `${value.replace(/^media/i, 'Media')}.mp4`
        }
        if (/^fire1$/i.test(value)) {
            return 'fire1.mp4'
        }
        if (/^fire2$/i.test(value)) {
            return 'fire2.mp4'
        }
        if (/^ps3$/i.test(value)) {
            return 'ps3.mp4'
        }
        return 'ps3.mp4'
    }

    private normalizeColor(input: string | undefined, fallback: string): string {
        if (typeof input !== 'string') {
            return fallback
        }
        const value = input.trim()
        return /^#[0-9a-fA-F]{6}$/.test(value) ? value : fallback
    }

    private normalizeAngle(input: number | undefined): number {
        const value = Number(input)
        if (!Number.isFinite(value)) {
            return 135
        }
        return Math.min(360, Math.max(0, Math.round(value)))
    }

    private normalizeProjectMapStyle(input: string | undefined): ProjectMapStyle {
        switch (input) {
            case 'road':
            case 'satellite':
            case 'road_shaded_relief':
            case 'night':
                return input
            default:
                return 'night'
        }
    }

    private normalizeProjectMapDimension(input: string | undefined): ProjectMapDimension {
        return input === '3d' ? '3d' : '2d'
    }

    private defaultPreferences(): UserPreferences {
        return {
            homePage: {
                backgroundMode: 'video',
                backgroundVideo: 'ps3.mp4',
                showRecentProjects: true,
                compactHero: false,
                solidColor: '#08111b',
                gradientFrom: '#09111d',
                gradientTo: '#060a12',
                gradientAngle: 135
            },
            projectMap: {
                version: this.projectMapPreferencesVersion,
                style: 'night',
                dimension: '2d',
                showRoadDetails: true,
                showBuildingFootprints: true,
                autoFitPins: true
            },
            profile: {
                avatarDataUrl: null
            }
        }
    }
}
