import { CommonModule, Location } from '@angular/common'
import { Component, ElementRef, ViewChild } from '@angular/core'
import { FormsModule } from '@angular/forms'
import { MatButtonModule } from '@angular/material/button'
import { MatButtonToggleModule } from '@angular/material/button-toggle'
import { MatFormFieldModule } from '@angular/material/form-field'
import { MatIconModule } from '@angular/material/icon'
import { MatInputModule } from '@angular/material/input'
import { MatSlideToggleModule } from '@angular/material/slide-toggle'
import { PageToolbar } from '../../common/components/page-toolbar'
import { UserPreferencesService } from '../../common/services/user-preferences.service'
import { HomeBackgroundMode, HomeBackgroundVideo, HomeBackgroundVideoManifestItem, UserPreferences } from '../../schemas/user-preferences.schema'

@Component({
    standalone: true,
    selector: 'preferences-page',
    imports: [
        CommonModule,
        FormsModule,
        PageToolbar,
        MatButtonModule,
        MatButtonToggleModule,
        MatFormFieldModule,
        MatIconModule,
        MatInputModule,
        MatSlideToggleModule
    ],
    templateUrl: './preferences.page.html',
    styleUrls: ['./preferences.page.scss']
})
export class PreferencesPage {
    @ViewChild('avatarInput') avatarInput?: ElementRef<HTMLInputElement>
    private readonly failedThumbnailFiles = new Set<string>()

    pageWorking = true
    isSaving = false
    saveMessage = ''
    errorMessage = ''

    draft: UserPreferences = {
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
        profile: {
            avatarDataUrl: null
        }
    }
    persistedSnapshot = JSON.stringify(this.draft)

    videoOptions: HomeBackgroundVideoManifestItem[] = []

    readonly backgroundModes: Array<{ value: HomeBackgroundMode, label: string }> = [
        { value: 'video', label: 'Video' },
        { value: 'solid', label: 'Solid' },
        { value: 'gradient', label: 'Gradient' }
    ]

    constructor(
        private readonly location: Location,
        private readonly userPreferences: UserPreferencesService
    ) {
        this.initialize()
    }

    get isDirty(): boolean {
        return JSON.stringify(this.draft) !== this.persistedSnapshot
    }

    get avatarPreviewUrl(): string | null {
        return this.draft.profile.avatarDataUrl
    }

    get isVideoPreviewMode(): boolean {
        return this.draft.homePage.backgroundMode === 'video'
    }

    get backgroundPreviewStyle(): Record<string, string> {
        if (this.draft.homePage.backgroundMode === 'solid') {
            return { background: this.draft.homePage.solidColor }
        }
        if (this.draft.homePage.backgroundMode === 'gradient') {
            return {
                background: `linear-gradient(${this.draft.homePage.gradientAngle}deg, ${this.draft.homePage.gradientFrom}, ${this.draft.homePage.gradientTo})`
            }
        }
        const thumbnailUrl = this.getSelectedVideoThumbnailUrl()
        return thumbnailUrl
            ? {
                backgroundImage: `linear-gradient(180deg, rgba(4, 10, 17, 0.08), rgba(4, 10, 17, 0.32)), url('${thumbnailUrl}')`
            }
            : {}
    }

    getVideoUrl(fileName: HomeBackgroundVideo): string {
        return this.userPreferences.getHomeVideoUrl(fileName)
    }

    getVideoPosterStyle(fileName: string): Record<string, string> {
        const seed = Array.from(fileName).reduce((sum, char) => sum + char.charCodeAt(0), 0)
        const hueA = seed % 360
        const hueB = (seed * 1.7) % 360
        return {
            background: [
                `linear-gradient(180deg, rgba(4, 10, 17, 0.12), rgba(4, 10, 17, 0.82))`,
                `linear-gradient(135deg, hsla(${hueA}, 78%, 54%, 0.42), hsla(${hueB}, 78%, 46%, 0.22))`,
                `radial-gradient(circle at 20% 20%, hsla(${hueA}, 90%, 70%, 0.35), transparent 40%)`,
                `radial-gradient(circle at 82% 78%, hsla(${hueB}, 90%, 64%, 0.28), transparent 36%)`,
                `linear-gradient(180deg, rgba(7, 16, 27, 0.96), rgba(8, 18, 31, 0.72))`
            ].join(', ')
        }
    }

    getVideoThumbnailUrl(option: HomeBackgroundVideoManifestItem): string | null {
        if (this.failedThumbnailFiles.has(option.fileName)) {
            return null
        }
        return this.userPreferences.getHomeVideoThumbnailUrl(option.thumbnailFileName)
    }

    getSelectedVideoThumbnailUrl(): string | null {
        const selected = this.videoOptions.find((option) => option.fileName === this.draft.homePage.backgroundVideo)
        return selected ? this.getVideoThumbnailUrl(selected) : null
    }

    onVideoThumbnailError(fileName: string): void {
        this.failedThumbnailFiles.add(fileName)
    }

    openAvatarPicker(): void {
        this.avatarInput?.nativeElement.click()
    }

    onBack(): void {
        this.location.back()
    }

    selectBackgroundMode(mode: HomeBackgroundMode): void {
        this.draft = {
            ...this.draft,
            homePage: {
                ...this.draft.homePage,
                backgroundMode: mode
            }
        }
        this.saveMessage = ''
        this.errorMessage = ''
    }

    selectBackgroundVideo(video: HomeBackgroundVideo): void {
        this.draft = {
            ...this.draft,
            homePage: {
                ...this.draft.homePage,
                backgroundVideo: video
            }
        }
        this.saveMessage = ''
        this.errorMessage = ''
    }

    onAvatarSelected(event: Event): void {
        const input = event.target as HTMLInputElement | null
        const file = input?.files?.[0]
        if (!file) {
            return
        }
        if (!file.type.startsWith('image/')) {
            this.errorMessage = 'Avatar uploads must be image files.'
            input.value = ''
            return
        }

        const reader = new FileReader()
        reader.onload = () => {
            const result = typeof reader.result === 'string' ? reader.result : ''
            this.draft = {
                ...this.draft,
                profile: {
                    avatarDataUrl: result || null
                }
            }
            this.errorMessage = ''
            this.saveMessage = ''
        }
        reader.onerror = () => {
            this.errorMessage = 'Avatar upload could not be read.'
        }
        reader.readAsDataURL(file)
        input.value = ''
    }

    clearAvatar(): void {
        this.draft = {
            ...this.draft,
            profile: {
                avatarDataUrl: null
            }
        }
        this.errorMessage = ''
        this.saveMessage = ''
    }

    async savePreferences(): Promise<void> {
        if (this.isSaving) {
            return
        }

        this.isSaving = true
        this.errorMessage = ''
        this.saveMessage = ''
        try {
            const result = await this.userPreferences.save(this.draft)
            this.draft = result.preferences
            this.persistedSnapshot = JSON.stringify(result.preferences)
            this.saveMessage = 'Preferences saved.'
        } catch (err: any) {
            console.error('Failed to save preferences.', err)
            this.errorMessage = err?.error?.message || err?.message || 'Preferences could not be saved.'
        } finally {
            this.isSaving = false
        }
    }

    private async initialize(): Promise<void> {
        try {
            this.videoOptions = await this.userPreferences.loadVideoManifest()
            const preferences = await this.userPreferences.load()
            this.draft = JSON.parse(JSON.stringify(preferences))
            this.persistedSnapshot = JSON.stringify(preferences)
        } catch (err) {
            console.error('Failed to load preferences page.', err)
            this.errorMessage = 'Preferences could not be loaded.'
        } finally {
            this.pageWorking = false
        }
    }

}
