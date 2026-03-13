import { Component, OnInit } from "@angular/core"

import { HttpClient } from "@angular/common/http"
import { CommonModule } from "@angular/common"
import { AfterViewInit, ElementRef, ViewChild } from "@angular/core"
import { RouterLink } from "@angular/router"

import { MatCardModule } from "@angular/material/card"
import { MatButtonModule } from "@angular/material/button"

import { PageToolbar } from '../../common/components/page-toolbar';

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
    imports: [CommonModule, MatButtonModule, MatCardModule, PageToolbar, RouterLink],
    providers: [HttpClient],
    templateUrl: './home.page.html',
    styleUrls: ['./home.page.scss']
})
export class HomePage implements OnInit, AfterViewInit {
    private readonly recentProjectsStorageKey = 'firewire.recentProjects'
    recentProjects: RecentProjectLink[] = []
    @ViewChild('backgroundVideo') backgroundVideo?: ElementRef<HTMLVideoElement>

    constructor() {}

    ngOnInit(): void {
        this.loadRecentProjects()
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

    private loadRecentProjects() {
        if (typeof localStorage === 'undefined') {
            return
        }

        try {
            const rawValue = localStorage.getItem(this.recentProjectsStorageKey)
            const parsed = rawValue ? JSON.parse(rawValue) : []
            this.recentProjects = Array.isArray(parsed) ? parsed.slice(0, 3) : []
        } catch {
            this.recentProjects = []
        }
    }

}
