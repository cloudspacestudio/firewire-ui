import { Component, DestroyRef, Input, OnInit, inject } from "@angular/core";
import { NgIf } from "@angular/common";
import { Router, RouterLink } from "@angular/router";
import { takeUntilDestroyed } from "@angular/core/rxjs-interop";

import { MatToolbarModule } from '@angular/material/toolbar'
import { MatButtonModule } from '@angular/material/button'
import { MatIconModule } from '@angular/material/icon'
import { MatMenuModule } from '@angular/material/menu'
import { MatDividerModule } from '@angular/material/divider'
import { AuthService } from "../../auth/auth.service";
import { UserPreferencesService } from "../services/user-preferences.service";

@Component({
    selector: 'page-toolbar',
    imports: [NgIf, RouterLink, MatButtonModule, MatIconModule, MatMenuModule, MatToolbarModule, MatDividerModule],
    styles: [`
        :host {
            display: block;
            position: relative;
        }

        .fw-toolbar.page-toolbar {
            position: relative;
            z-index: 2;
            min-height: 58px;
            gap: 6px;
            border-bottom: 1px solid rgba(72, 221, 255, 0.12);
            background:
                linear-gradient(180deg, rgba(10, 18, 32, 0.88), rgba(10, 18, 32, 0.62)),
                rgba(10, 18, 32, 0.72);
            backdrop-filter: blur(8px);
            color: var(--fw-text);
            box-shadow: inset 0 -1px 0 rgba(255, 255, 255, 0.02);
        }

        .fw-toolbar.page-toolbar.page-toolbar--transparent {
            position: absolute;
            inset: 0 0 auto 0;
            min-height: 56px;
            border-bottom: 0;
            background: transparent;
            backdrop-filter: none;
            box-shadow: none;
        }

        .fw-toolbar::before {
            content: "";
            position: absolute;
            inset: 0;
            pointer-events: none;
            opacity: 0.14;
            background-image:
                linear-gradient(rgba(72, 221, 255, 0.05) 1px, transparent 1px),
                linear-gradient(90deg, rgba(72, 221, 255, 0.05) 1px, transparent 1px);
            background-size: 28px 28px;
        }

        .fw-toolbar.page-toolbar.page-toolbar--transparent::before {
            display: none;
        }

        .fw-toolbar > * {
            position: relative;
            z-index: 1;
        }

        .fw-toolbar__menu-btn {
            margin-right: 8px;
            color: var(--fw-text);
            border: 1px solid rgba(72, 221, 255, 0.18);
            border-radius: var(--fw-control-radius);
            background:
                linear-gradient(180deg, rgba(72, 221, 255, 0.10), rgba(72, 221, 255, 0.03)),
                rgba(10, 18, 32, 0.92);
        }

        .fw-toolbar__menu-btn:hover {
            border-color: rgba(72, 221, 255, 0.45);
            box-shadow: 0 0 0 1px rgba(72, 221, 255, 0.2), 0 0 20px rgba(72, 221, 255, 0.12);
        }

        .fw-toolbar__brand {
            cursor: pointer;
            color: var(--fw-accent-2);
            letter-spacing: 0.18em;
            text-transform: uppercase;
            font-weight: 700;
            font-size: 0.85rem;
            padding: 0 2px;
        }

        .fw-toolbar__title {
            color: var(--fw-muted);
            letter-spacing: 0.08em;
            text-transform: uppercase;
            font-size: 0.76rem;
        }

        .fw-toolbar__user-btn {
            width: 38px;
            height: 38px;
            max-width: 38px;
            min-width: 38px;
            border-radius: 50%;
            font-size: 0.75rem;
            letter-spacing: 0.08em;
            padding: 0;
            overflow: hidden;
        }

        .fw-toolbar__avatar {
            width: 100%;
            height: 100%;
            object-fit: cover;
            display: block;
        }

        :host ::ng-deep .fw-user-menu .mat-mdc-menu-item.fw-user-menu-meta {
            --mdc-list-list-item-one-line-container-height: 20px;
            min-height: 20px;
            height: 20px;
            line-height: 20px;
            padding-top: 0;
            padding-bottom: 0;
            font-size: 0.75rem;
            opacity: 0.86;
        }

        :host ::ng-deep .fw-user-menu .mat-mdc-menu-item.fw-user-menu-meta .mdc-list-item__primary-text {
            line-height: 20px;
        }

        :host ::ng-deep .fw-user-menu .mat-mdc-menu-content {
            padding-top: 4px;
            padding-bottom: 4px;
        }

        :host ::ng-deep .fw-nav-menu {
            padding: 0 !important;
            overflow: hidden;
            border-radius: 0;
        }

        :host ::ng-deep .fw-nav-menu .mat-mdc-menu-content {
            padding: 0;
            display: grid;
            gap: 0;
            background:
                linear-gradient(180deg, rgba(8, 14, 25, 0.96), rgba(9, 18, 32, 0.92)),
                rgba(8, 14, 25, 0.96);
        }

        :host ::ng-deep .fw-nav-menu .mat-mdc-menu-item {
            --mdc-list-list-item-one-line-container-height: auto;
            --mat-menu-item-hover-state-layer-color: rgba(255, 144, 46, 0.22);
            min-height: 84px;
            height: auto;
            padding: 0;
            border-radius: 0;
            overflow: hidden;
            border: 0;
            border-bottom: 1px solid rgba(88, 228, 255, 0.12);
            background: rgba(8, 14, 25, 0.86);
        }

        :host ::ng-deep .fw-nav-menu .mat-mdc-menu-item:last-child {
            border-bottom: 0;
        }

        :host ::ng-deep .fw-nav-menu .mat-mdc-menu-item .mdc-list-item__primary-text {
            width: 100%;
            margin: 0;
        }

        :host ::ng-deep .fw-nav-menu .mat-mdc-menu-item:hover {
            background: linear-gradient(90deg, rgba(255, 140, 40, 0.26), rgba(8, 14, 25, 0.86) 28%);
        }

        .fw-nav-item {
            position: relative;
            display: flex;
            align-items: end;
            width: 100%;
            min-height: 84px;
            padding: 14px 16px;
            background-position: center;
            background-repeat: no-repeat;
            background-size: cover;
            isolation: isolate;
        }

        .fw-nav-item::before,
        .fw-nav-item::after {
            content: "";
            position: absolute;
            inset: 0;
            pointer-events: none;
        }

        .fw-nav-item::before {
            background:
                linear-gradient(180deg, rgba(4, 10, 17, 0.14) 0%, rgba(4, 10, 17, 0.24) 34%, rgba(4, 10, 17, 0.84) 76%, rgba(4, 10, 17, 0.98) 100%),
                linear-gradient(135deg, rgba(88, 228, 255, 0.1), transparent 46%, rgba(132, 255, 190, 0.08));
            z-index: -1;
        }

        .fw-nav-item::after {
            box-shadow:
                inset 0 1px 0 rgba(255, 255, 255, 0.03),
                inset 0 -1px 0 rgba(88, 228, 255, 0.08);
            z-index: -1;
        }

        .fw-nav-item__content {
            display: grid;
            gap: 3px;
            width: 100%;
        }

        .fw-nav-item__title {
            color: #f4fbff;
            font-size: 1rem;
            font-weight: 700;
            letter-spacing: 0.08em;
            text-transform: uppercase;
            text-shadow: 0 3px 16px rgba(0, 0, 0, 0.72);
        }

        .fw-nav-item__subtitle {
            color: rgba(232, 243, 250, 0.88);
            font-size: 0.72rem;
            line-height: 1.35;
            text-shadow: 0 2px 12px rgba(0, 0, 0, 0.72);
        }

        .fw-nav-item--home {
            background-image:
                linear-gradient(135deg, rgba(9, 20, 31, 0.78), rgba(9, 20, 31, 0.42)),
                url('/images/videos/ps3.mp4');
            background-image:
                linear-gradient(135deg, rgba(9, 20, 31, 0.78), rgba(9, 20, 31, 0.42)),
                radial-gradient(circle at 30% 30%, rgba(88, 228, 255, 0.22), transparent 42%),
                linear-gradient(180deg, #0a1420, #08111b);
        }

        .fw-nav-item--projects {
            background-image: url('/images/projects.jpg');
        }

        .fw-nav-item--devices {
            background-image: url('/images/devices.jpg');
        }

        .fw-nav-item--design {
            background-image: url('/images/design.jpg');
        }

        .fw-nav-item--install {
            background-image: url('/images/install.jpg');
        }

        .fw-nav-item--sales {
            background-image: url('/images/sales.jpg');
        }

        .fw-nav-item--settings {
            background-image: url('/images/settings.jpg');
        }

        @media (max-width: 720px) {
            .fw-toolbar__brand {
                letter-spacing: 0.12em;
                font-size: 0.78rem;
            }

            .fw-toolbar__title {
                max-width: 34vw;
                overflow: hidden;
                text-overflow: ellipsis;
                white-space: nowrap;
            }
        }
    `],
    template: `
        <mat-toolbar class="page-toolbar fw-toolbar" [class.page-toolbar--transparent]="transparent">
            <button *ngIf="!hideMenu" mat-icon-button class="fw-toolbar__menu-btn" [mat-menu-trigger-for]="navMenu" aria-label="Open navigation">
                <mat-icon fontIcon="menu"></mat-icon>
            </button>
            <mat-menu #navMenu="matMenu" panelClass="fw-nav-menu">
                <button *ngIf="false" mat-menu-item [routerLink]="'/root'">
                    <span class="fw-nav-item fw-nav-item--home">
                        <span class="fw-nav-item__content">
                            <span class="fw-nav-item__title">Home</span>
                            <span class="fw-nav-item__subtitle">Return to the command overview</span>
                        </span>
                    </span>
                </button>
                <button *ngIf="!isCurrentRoute('/sales')" mat-menu-item [routerLink]="'/sales'">
                    <span class="fw-nav-item fw-nav-item--sales">
                        <span class="fw-nav-item__content">
                            <span class="fw-nav-item__title">Sales</span>
                            <span class="fw-nav-item__subtitle">Placeholder for upcoming sales tools and workflows</span>
                        </span>
                    </span>
                </button>
                <button *ngIf="!isCurrentRoute('/design')" mat-menu-item [routerLink]="'/design'">
                    <span class="fw-nav-item fw-nav-item--design">
                        <span class="fw-nav-item__content">
                            <span class="fw-nav-item__title">Design</span>
                            <span class="fw-nav-item__subtitle">Coordinate design deliverables and drawing workflows</span>
                        </span>
                    </span>
                </button>
                <button *ngIf="!isCurrentRoute('/install')" mat-menu-item [routerLink]="'/install'">
                    <span class="fw-nav-item fw-nav-item--install">
                        <span class="fw-nav-item__content">
                            <span class="fw-nav-item__title">Install</span>
                            <span class="fw-nav-item__subtitle">Track field execution and installation operations</span>
                        </span>
                    </span>
                </button>
                <button *ngIf="!isCurrentRoute('/projects')" mat-menu-item [routerLink]="'/projects'">
                    <span class="fw-nav-item fw-nav-item--projects">
                        <span class="fw-nav-item__content">
                            <span class="fw-nav-item__title">Projects</span>
                            <span class="fw-nav-item__subtitle">View and manage projects in Firewire</span>
                        </span>
                    </span>
                </button>
                <button *ngIf="!isCurrentRoute('/devices')" mat-menu-item [routerLink]="'/devices'">
                    <span class="fw-nav-item fw-nav-item--devices">
                        <span class="fw-nav-item__content">
                            <span class="fw-nav-item__title">Devices</span>
                            <span class="fw-nav-item__subtitle">View and manage devices and materials</span>
                        </span>
                    </span>
                </button>
                <button *ngIf="!isCurrentRoute('/settings')" mat-menu-item [routerLink]="'/settings'">
                    <span class="fw-nav-item fw-nav-item--settings">
                        <span class="fw-nav-item__content">
                            <span class="fw-nav-item__title">Settings</span>
                            <span class="fw-nav-item__subtitle">Administer preferences and platform settings</span>
                        </span>
                    </span>
                </button>
            </mat-menu>

            <span class="fw-toolbar__brand" [routerLink]="'/root'">FIREWIRE</span>
            <span *ngIf="title" class="fw-toolbar__title">:{{title}}</span>

            <ng-content></ng-content>
            
            <span class="spacer"></span>
            
            <button [mat-menu-trigger-for]="userMenu" class="circle-btn fw-toolbar__user-btn" aria-label="Open user menu">
                <img *ngIf="userAvatarUrl; else initialsTpl" [src]="userAvatarUrl" (error)="onAvatarError()" alt="User avatar" class="fw-toolbar__avatar" />
                <ng-template #initialsTpl>{{userInitials}}</ng-template>
            </button>
            <mat-menu #userMenu="matMenu" panelClass="fw-user-menu">
                <button mat-menu-item disabled class="fw-user-menu-meta">{{userName}}</button>
                <button mat-menu-item disabled class="fw-user-menu-meta" *ngIf="userEmail">{{userEmail}}</button>
                <mat-divider></mat-divider>
                <button mat-menu-item [routerLink]="'/preferences'">Preferences</button>
                <button mat-menu-item>About</button>
                <mat-divider></mat-divider>
                <button mat-menu-item (click)="onSignOut()">Sign Out</button>
            </mat-menu>
        </mat-toolbar>
    `
})
export class PageToolbar implements OnInit {
    private readonly auth = inject(AuthService)
    private readonly userPreferences = inject(UserPreferencesService)
    private readonly destroyRef = inject(DestroyRef)
    private readonly router = inject(Router)

    @Input() title?: string
    @Input() hideMenu = false
    @Input() transparent = false

    userName = 'User'
    userEmail = ''
    userInitials = 'U'
    userAvatarUrl: string | null = null

    ngOnInit(): void {
        const profile = this.auth.getUserProfile()
        if (profile) {
            this.userName = profile.name || this.userName
            this.userEmail = profile.email || this.userEmail
            this.userInitials = this.toInitials(this.userName || this.userEmail || this.userInitials)
            this.userAvatarUrl = profile.avatarUrl || null
        }

        this.userPreferences.preferences$
            .pipe(takeUntilDestroyed(this.destroyRef))
            .subscribe((preferences) => {
                const profileAvatar = this.auth.getUserProfile()?.avatarUrl || null
                this.userAvatarUrl = preferences.profile.avatarDataUrl || profileAvatar
            })

        this.userPreferences.load().catch((err) => {
            console.error('Failed to initialize toolbar preferences.', err)
        })
    }

    private toInitials(value: string): string {
        const parts = value
            .split(/\s+/)
            .map(part => part.trim())
            .filter(part => part.length > 0)

        if (parts.length <= 0) {
            return 'U'
        }
        if (parts.length === 1) {
            return parts[0].slice(0, 2).toUpperCase()
        }
        return `${parts[0][0]}${parts[1][0]}`.toUpperCase()
    }

    onSignOut(): void {
        this.auth.signOut().catch((err) => {
            console.error('Sign out failed', err)
        })
    }

    onAvatarError(): void {
        this.userAvatarUrl = null
    }

    isCurrentRoute(route: string): boolean {
        const currentUrl = this.router.url.split('?')[0].split('#')[0]
        return currentUrl === route || currentUrl.startsWith(`${route}/`)
    }
}
