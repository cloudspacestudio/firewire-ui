import { Component, DestroyRef, OnInit, inject } from "@angular/core"

import { HttpClient } from "@angular/common/http"
import { CommonModule } from "@angular/common"
import { AfterViewInit, ElementRef, ViewChild } from "@angular/core"
import { takeUntilDestroyed } from "@angular/core/rxjs-interop"
import { Router, RouterLink } from "@angular/router"

import { MatCardModule } from "@angular/material/card"
import { MatButtonModule } from "@angular/material/button"

import { PageToolbar } from '../../common/components/page-toolbar';
import { UserPreferencesService } from "../../common/services/user-preferences.service";
import { NgStyle } from "@angular/common";

interface RecentProjectLink {
    id: string
    name: string
    projectNbr: string
    route: string
    lastViewedAt: string
}

@Component({
    standalone: true,
    selector: 'home-page',
    imports: [CommonModule, NgStyle, MatButtonModule, MatCardModule, PageToolbar, RouterLink],
    providers: [HttpClient],
    templateUrl: './home.page.html',
    styleUrls: ['./home.page.scss']
})
export class HomePage implements OnInit, AfterViewInit {
    private readonly recentProjectsStorageKey = 'firewire.recentProjects'
    private readonly recentProjectsLimit = 6
    private readonly destroyRef = inject(DestroyRef)
    recentProjects: RecentProjectLink[] = []
    showRecentProjects = true
    compactHero = false
    backgroundMode: 'video' | 'solid' | 'gradient' = 'video'
    backgroundVideoUrl = '/images/videos/fire1.mp4'
    backgroundSurfaceStyle: Record<string, string> = {}
    @ViewChild('backgroundVideo') backgroundVideo?: ElementRef<HTMLVideoElement>

    constructor(
        private readonly userPreferences: UserPreferencesService,
        private readonly router: Router
    ) {}

    ngOnInit(): void {
        this.loadRecentProjects()
        this.userPreferences.preferences$
            .pipe(takeUntilDestroyed(this.destroyRef))
            .subscribe((preferences) => {
                this.backgroundMode = preferences.homePage.backgroundMode
                this.showRecentProjects = preferences.homePage.showRecentProjects
                this.compactHero = preferences.homePage.compactHero
                this.backgroundVideoUrl = this.userPreferences.getHomeVideoUrl(preferences.homePage.backgroundVideo)
                this.backgroundSurfaceStyle = this.buildBackgroundSurfaceStyle(preferences)
                this.refreshVideo()
            })
        this.userPreferences.load().catch((err) => {
            console.error('Failed to load home page preferences.', err)
        })
    }

    ngAfterViewInit(): void {
        const video = this.backgroundVideo?.nativeElement
        if (!video) {
            return
        }

        video.muted = true
        video.defaultMuted = true
        video.play().catch(() => {
        })
    }

    private refreshVideo(): void {
        const video = this.backgroundVideo?.nativeElement
        if (!video || this.backgroundMode !== 'video') {
            return
        }
        video.load()
        video.muted = true
        video.defaultMuted = true
        video.play().catch(() => {
        })
    }

    private loadRecentProjects() {
        if (typeof localStorage === 'undefined') {
            return
        }

        try {
            const rawValue = localStorage.getItem(this.recentProjectsStorageKey)
            const parsed = rawValue ? JSON.parse(rawValue) : []
            this.recentProjects = Array.isArray(parsed) ? parsed.slice(0, this.recentProjectsLimit) : []
        } catch {
            this.recentProjects = []
        }
    }

    private buildBackgroundSurfaceStyle(preferences: { homePage: { backgroundMode: 'video' | 'solid' | 'gradient', solidColor: string, gradientFrom: string, gradientTo: string, gradientAngle: number } }): Record<string, string> {
        if (preferences.homePage.backgroundMode === 'solid') {
            return {
                background: preferences.homePage.solidColor
            }
        }

        if (preferences.homePage.backgroundMode === 'gradient') {
            return {
                background: `linear-gradient(${preferences.homePage.gradientAngle}deg, ${preferences.homePage.gradientFrom}, ${preferences.homePage.gradientTo})`
            }
        }

        return {}
    }

    navigateTo(route: string): void {
        void this.router.navigateByUrl(route)
    }

}
