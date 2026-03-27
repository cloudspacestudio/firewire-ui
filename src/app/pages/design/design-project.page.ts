import { Component, OnInit } from "@angular/core"
import { CommonModule } from "@angular/common"
import { HttpClient } from "@angular/common/http"
import { ActivatedRoute, RouterLink } from "@angular/router"

import { MatButtonModule } from "@angular/material/button"
import { MatIconModule } from "@angular/material/icon"

import { PageToolbar } from "../../common/components/page-toolbar"
import { FirewireProjectSchema } from "../../schemas/firewire-project.schema"

@Component({
    standalone: true,
    selector: 'design-project-page',
    imports: [CommonModule, RouterLink, MatButtonModule, MatIconModule, PageToolbar],
    providers: [HttpClient],
    template: `
        <page-toolbar title="DESIGN">
            <div class="button-bar">
                <button mat-fab class="back" [routerLink]="'/design'">
                    <mat-icon fontIcon="chevron_left"></mat-icon>
                </button>
            </div>
            <div class="design-project-toolbar-nav">
                <button mat-flat-button type="button" class="active">DETAILS</button>
                <button mat-raised-button type="button" class="inactive" disabled>SHEETS SOON</button>
                <button mat-raised-button type="button" class="inactive" disabled>DELIVERABLES SOON</button>
            </div>
        </page-toolbar>

        <div class="page-root">
            <div class="page-content">
                <div class="content-root">
                    <div *ngIf="pageWorking" class="design-project-state">
                        Loading design workspace...
                    </div>

                    <div *ngIf="!pageWorking && errText" class="design-project-state design-project-state--error">
                        {{errText}}
                    </div>

                    <section *ngIf="!pageWorking && project" class="design-project-shell">
                        <div class="design-project-hero">
                            <div>
                                <div class="design-project-kicker">Project Design Workspace</div>
                                <h1>{{project.name}}</h1>
                                <p>Use this project-specific Design page as the workspace entry point for future design tools, drawing coordination, and design deliverables tied to this Firewire project.</p>
                            </div>
                            <div class="design-project-badges">
                                <span *ngIf="project.projectNbr">#{{project.projectNbr}}</span>
                                <span *ngIf="project.projectStatus">{{project.projectStatus}}</span>
                                <span *ngIf="project.projectType">{{project.projectType}}</span>
                            </div>
                        </div>

                        <div class="design-project-grid">
                            <article class="design-project-card">
                                <div class="design-project-card__eyebrow">Project Snapshot</div>
                                <div class="design-project-detail"><span>Address</span><strong>{{project.address || 'Unavailable'}}</strong></div>
                                <div class="design-project-detail"><span>Bid Due</span><strong>{{toLocalDateString(project.bidDueDate) || 'Unavailable'}}</strong></div>
                                <div class="design-project-detail"><span>Salesman</span><strong>{{project.salesman || 'Unavailable'}}</strong></div>
                                <div class="design-project-detail"><span>Total Sq Ft</span><strong>{{formatSqFt(project.totalSqFt)}}</strong></div>
                            </article>

                            <article class="design-project-card">
                                <div class="design-project-card__eyebrow">Workspace Links</div>
                                <div class="design-project-actions">
                                    <a mat-flat-button class="design-project-button" [routerLink]="['/projects', 'firewire', project.uuid, 'project-details']" [queryParams]="{ returnTo: '/design' }">Open Project Details</a>
                                    <a mat-stroked-button class="design-project-button" [routerLink]="'/design/train-ai'">Open Train AI</a>
                                </div>
                                <p class="design-project-card__note">This page is now project-specific, so later design tools can hang directly off the Firewire project instead of the generic Design landing page.</p>
                            </article>
                        </div>
                    </section>
                </div>
            </div>
        </div>
    `,
    styles: [`
        :host {
            display: block;
        }

        .design-project-toolbar-nav {
            display: flex;
            align-items: center;
            align-self: center;
            gap: 3px;
            flex-wrap: wrap;
            margin-left: 6px;
            min-height: 58px;
        }

        .design-project-toolbar-nav button {
            margin-right: 0 !important;
            border-radius: var(--fw-control-radius) !important;
            min-height: 38px;
            min-width: 0;
            padding-inline: 12px;
            letter-spacing: 0.12em;
            font-size: 0.72rem;
            text-transform: uppercase;
        }

        .design-project-toolbar-nav button.active {
            border: 1px solid rgba(255, 164, 61, 0.72);
            background:
                linear-gradient(180deg, rgba(255, 170, 72, 0.34), rgba(255, 132, 28, 0.14)),
                rgba(10, 18, 32, 0.95) !important;
            color: #ffe2b2 !important;
            box-shadow: 0 0 0 1px rgba(255, 164, 61, 0.28), 0 0 22px rgba(255, 140, 40, 0.22);
        }

        .design-project-toolbar-nav button.inactive {
            border: 1px solid rgba(72, 221, 255, 0.20);
            background:
                linear-gradient(180deg, rgba(72, 221, 255, 0.10), rgba(72, 221, 255, 0.03)),
                rgba(10, 18, 32, 0.94) !important;
            color: var(--fw-text) !important;
        }

        .design-project-toolbar-nav button[disabled] {
            opacity: 0.62;
        }

        .design-project-state {
            padding: 18px;
            border: 1px solid rgba(72, 221, 255, 0.18);
            border-radius: 16px;
            background: rgba(8, 14, 25, 0.76);
            color: #d9eff9;
        }

        .design-project-state--error {
            border-color: rgba(255, 164, 61, 0.34);
            color: #ffd6b5;
        }

        .design-project-shell {
            display: grid;
            gap: 18px;
        }

        .design-project-hero,
        .design-project-card {
            padding: 20px 22px;
            border: 1px solid rgba(72, 221, 255, 0.14);
            border-radius: 20px;
            background:
                radial-gradient(circle at 0% 0%, rgba(72, 221, 255, 0.08), transparent 32%),
                radial-gradient(circle at 100% 0%, rgba(255, 164, 61, 0.08), transparent 28%),
                rgba(8, 14, 25, 0.8);
        }

        .design-project-hero {
            display: grid;
            grid-template-columns: minmax(0, 1fr) auto;
            gap: 18px;
        }

        .design-project-kicker,
        .design-project-card__eyebrow,
        .design-project-detail span {
            color: #84ffbe;
            font-size: 0.72rem;
            letter-spacing: 0.18em;
            text-transform: uppercase;
        }

        .design-project-hero h1 {
            margin: 8px 0 0;
            color: #edf8ff;
            font-size: clamp(1.35rem, 2.2vw, 2rem);
        }

        .design-project-hero p,
        .design-project-card__note {
            margin: 10px 0 0;
            color: rgba(223, 239, 248, 0.8);
            line-height: 1.45;
        }

        .design-project-badges {
            display: flex;
            flex-wrap: wrap;
            gap: 8px;
            align-content: start;
            justify-content: flex-end;
        }

        .design-project-badges span {
            padding: 7px 10px;
            border: 1px solid rgba(72, 221, 255, 0.16);
            border-radius: 999px;
            background: rgba(8, 18, 30, 0.72);
            color: #f1fbff;
            font-size: 0.76rem;
            letter-spacing: 0.08em;
            text-transform: uppercase;
        }

        .design-project-grid {
            display: grid;
            grid-template-columns: repeat(2, minmax(0, 1fr));
            gap: 18px;
        }

        .design-project-card {
            display: grid;
            gap: 14px;
        }

        .design-project-detail {
            display: grid;
            gap: 6px;
            padding: 12px 14px;
            border: 1px solid rgba(72, 221, 255, 0.12);
            border-radius: 14px;
            background: rgba(10, 18, 31, 0.48);
        }

        .design-project-detail strong {
            color: #f4fbff;
            font-weight: 600;
            overflow-wrap: anywhere;
        }

        .design-project-actions {
            display: flex;
            gap: 10px;
            flex-wrap: wrap;
        }

        .design-project-button[mat-flat-button] {
            background:
                linear-gradient(180deg, rgba(255, 140, 40, 0.9), rgba(255, 102, 40, 0.78)),
                rgba(255, 120, 50, 0.82);
            color: #fff7ef;
        }

        @media (max-width: 900px) {
            .design-project-hero,
            .design-project-grid {
                grid-template-columns: 1fr;
            }

            .design-project-badges {
                justify-content: flex-start;
            }
        }
    `]
})
export class DesignProjectPage implements OnInit {
    pageWorking = true
    errText = ''
    project: FirewireProjectSchema | null = null

    constructor(
        private readonly http: HttpClient,
        private readonly route: ActivatedRoute
    ) {}

    ngOnInit(): void {
        const projectId = this.route.snapshot.paramMap.get('projectId')
        if (!projectId) {
            this.errText = 'Project id is required.'
            this.pageWorking = false
            return
        }

        this.http.get<{ data?: FirewireProjectSchema }>(`/api/firewire/projects/firewire/${projectId}`).subscribe({
            next: (response) => {
                this.project = response?.data || null
                this.errText = this.project ? '' : 'Project not found.'
                this.pageWorking = false
            },
            error: (err: any) => {
                this.errText = err?.error?.message || err?.message || 'Unable to load design project.'
                this.pageWorking = false
            }
        })
    }

    toLocalDateString(input: string | null | undefined): string {
        if (!input) {
            return ''
        }

        const parsed = new Date(input)
        if (Number.isNaN(parsed.getTime())) {
            return ''
        }

        return new Intl.DateTimeFormat(undefined, { dateStyle: 'short' }).format(parsed)
    }

    formatSqFt(value: number | null | undefined): string {
        const parsed = Number(value || 0)
        return parsed > 0 ? parsed.toLocaleString() : 'Unavailable'
    }
}
