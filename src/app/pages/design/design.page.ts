import { Component, OnInit } from "@angular/core"
import { CommonModule } from "@angular/common"
import { HttpClient } from "@angular/common/http"
import { RouterLink } from "@angular/router"

import { MatButtonModule } from "@angular/material/button"
import { MatIconModule } from "@angular/material/icon"

import { PageToolbar } from "../../common/components/page-toolbar"
import { NavToolbar } from "../../common/components/nav-toolbar"
import { ProjectListItemSchema } from "../../schemas/project-list-item.schema"

@Component({
    standalone: true,
    selector: 'design-page',
    imports: [CommonModule, RouterLink, MatButtonModule, MatIconModule, PageToolbar, NavToolbar],
    providers: [HttpClient],
    template: `
        <page-toolbar title="DESIGN">
            <nav-toolbar [navItems]="navItems" [selectedItem]="'design-projects'"></nav-toolbar>
        </page-toolbar>

        <div class="design-page">
            <div class="design-header">
                <div class="design-eyebrow">Design Projects</div>
                <h1>Choose a project to enter the design workspace.</h1>
            </div>

            <div *ngIf="pageWorking" class="state-panel">
                Loading design projects...
            </div>
            <div *ngIf="!pageWorking && errText" class="state-panel state-panel--error">
                {{errText}}
            </div>
            <div *ngIf="!pageWorking && !errText && projects.length <= 0" class="state-panel">
                No projects available yet.
            </div>

            <div *ngIf="!pageWorking && projects.length > 0" class="project-list">
                <a
                    *ngFor="let row of projects"
                    class="project-card"
                    [routerLink]="getProjectLink(row)"
                    [queryParams]="{ returnTo: '/design' }">
                    <div class="project-card__title-row">
                        <span class="project-card__title">{{row.name}}</span>
                        <mat-icon fontIcon="arrow_forward"></mat-icon>
                    </div>
                    <div class="project-card__meta">
                        <span *ngIf="row.projectNbr">#{{row.projectNbr}}</span>
                        <span *ngIf="row.projectStatus">{{row.projectStatus}}</span>
                    </div>
                    <div *ngIf="row.address" class="project-card__address">{{row.address}}</div>
                </a>
            </div>
        </div>
    `,
    styles: [`
        .design-page {
            min-height: calc(100vh - 58px);
            padding: 20px;
            display: grid;
            gap: 16px;
            background: linear-gradient(180deg, #091425, #08111d);
        }

        .design-header h1 {
            margin: 4px 0 0;
            color: #edf8ff;
            font-size: clamp(1.4rem, 2.4vw, 2rem);
        }

        .design-eyebrow {
            color: #84ffbe;
            font-size: 0.72rem;
            letter-spacing: 0.2em;
            text-transform: uppercase;
        }

        .state-panel {
            border: 1px solid rgba(72, 221, 255, 0.22);
            border-radius: 14px;
            padding: 18px;
            color: #cfe8f5;
            background: rgba(7, 15, 25, 0.78);
        }

        .state-panel--error {
            border-color: rgba(255, 177, 128, 0.44);
            color: #ffd6b5;
        }

        .project-list {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(260px, 1fr));
            gap: 14px;
        }

        .project-card {
            display: grid;
            gap: 8px;
            text-decoration: none;
            border: 1px solid rgba(72, 221, 255, 0.22);
            border-radius: 14px;
            padding: 14px;
            color: #e6f6ff;
            background: linear-gradient(145deg, rgba(8, 17, 30, 0.9), rgba(12, 27, 37, 0.82));
            transition: border-color 120ms ease, box-shadow 120ms ease, transform 120ms ease;
        }

        .project-card:hover {
            border-color: rgba(255, 164, 61, 0.62);
            box-shadow: 0 0 0 1px rgba(255, 164, 61, 0.28), 0 12px 26px rgba(0, 0, 0, 0.35);
            transform: translateY(-1px);
        }

        .project-card__title-row {
            display: flex;
            align-items: center;
            gap: 8px;
        }

        .project-card__title-row mat-icon {
            margin-left: auto;
            color: #ffb780;
            font-size: 19px;
            width: 19px;
            height: 19px;
        }

        .project-card__title {
            font-size: 1rem;
            font-weight: 700;
            letter-spacing: 0.02em;
        }

        .project-card__meta {
            display: flex;
            flex-wrap: wrap;
            gap: 8px;
            color: #a7ccdb;
            font-size: 0.74rem;
            text-transform: uppercase;
            letter-spacing: 0.06em;
        }

        .project-card__address {
            color: rgba(230, 246, 255, 0.82);
            font-size: 0.83rem;
            line-height: 1.45;
        }
    `]
})
export class DesignPage implements OnInit {
    pageWorking = true
    errText = ''
    projects: ProjectListItemSchema[] = []
    navItems = NavToolbar.DesignNavItems

    constructor(private http: HttpClient) {}

    ngOnInit(): void {
        this.loadProjects()
    }

    loadProjects() {
        this.pageWorking = true
        this.errText = ''
        this.projects = []

        this.http.get('/api/firewire/projects').subscribe({
            next: (s: any) => {
                const rows = Array.isArray(s?.rows) ? s.rows as ProjectListItemSchema[] : []
                this.projects = rows.filter((row) => !!row.firewireProjectId || !!row.fieldwireProjectId)
                this.pageWorking = false
            },
            error: (err: any) => {
                this.errText = err?.error?.message || err?.message || 'Unable to load projects.'
                this.pageWorking = false
            }
        })
    }

    getProjectLink(row: ProjectListItemSchema): string[] {
        if (row.firewireProjectId) {
            return ['/projects', 'firewire', row.firewireProjectId, 'project-details']
        }
        if (row.fieldwireProjectId) {
            return ['/projects', 'fieldwire', row.fieldwireProjectId, 'project-details']
        }
        return ['/projects']
    }
}
