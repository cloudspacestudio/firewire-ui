import { Component, DestroyRef, Input, OnInit, inject } from "@angular/core";
import { NgIf, NgStyle } from "@angular/common";
import { FormsModule } from "@angular/forms";
import { Router, RouterLink } from "@angular/router";
import { takeUntilDestroyed } from "@angular/core/rxjs-interop";
import { firstValueFrom } from "rxjs";

import { MatToolbarModule } from '@angular/material/toolbar'
import { MatButtonModule } from '@angular/material/button'
import { MatDialog } from '@angular/material/dialog'
import { MatIconModule } from '@angular/material/icon'
import { MatMenuModule } from '@angular/material/menu'
import { MatDividerModule } from '@angular/material/divider'
import { MatFormFieldModule } from '@angular/material/form-field'
import { MatInputModule } from '@angular/material/input'
import { AuthService } from "../../auth/auth.service";
import { UserPreferencesService } from "../services/user-preferences.service";
import { WorkspaceLockService } from "../services/workspace-lock.service";
import { WorkspacePinSetupDialog } from "./workspace-pin-setup.dialog";

@Component({
    selector: 'page-toolbar',
    imports: [NgIf, NgStyle, FormsModule, RouterLink, MatButtonModule, MatIconModule, MatMenuModule, MatToolbarModule, MatDividerModule, MatFormFieldModule, MatInputModule],
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

        .fw-lock-overlay {
            position: fixed;
            inset: 0;
            z-index: 2000;
            display: grid;
            place-items: center;
            padding: 32px;
            overflow: hidden;
            background: rgba(3, 8, 14, 0.98);
        }

        .fw-lock-overlay__media,
        .fw-lock-overlay__fallback,
        .fw-lock-overlay__scrim,
        .fw-lock-overlay__grid {
            position: absolute;
            inset: 0;
        }

        .fw-lock-overlay__media {
            width: 100%;
            height: 100%;
            object-fit: cover;
            filter: saturate(1) brightness(0.72);
        }

        .fw-lock-overlay__fallback {
            background-position: center;
            background-size: cover;
        }

        .fw-lock-overlay__scrim {
            background:
                radial-gradient(circle at 20% 20%, rgba(72, 221, 255, 0.08), transparent 28%),
                radial-gradient(circle at 80% 18%, rgba(255, 164, 61, 0.06), transparent 24%),
                linear-gradient(180deg, rgba(3, 8, 14, 0.42), rgba(4, 9, 17, 0.58)),
                rgba(3, 8, 14, 0.36);
            backdrop-filter: blur(4px);
        }

        .fw-lock-overlay__grid {
            opacity: 0.1;
            background-image:
                linear-gradient(rgba(72, 221, 255, 0.08) 1px, transparent 1px),
                linear-gradient(90deg, rgba(72, 221, 255, 0.08) 1px, transparent 1px);
            background-size: 32px 32px;
            pointer-events: none;
        }

        .fw-lock-card {
            position: relative;
            z-index: 1;
            width: min(520px, 100%);
            display: grid;
            gap: 18px;
            padding: 26px 28px 28px;
            border: 1px solid rgba(72, 221, 255, 0.22);
            border-radius: 22px;
            background:
                linear-gradient(180deg, rgba(10, 18, 32, 0.88), rgba(8, 14, 24, 0.94)),
                rgba(8, 14, 24, 0.94);
            box-shadow: 0 22px 60px rgba(0, 0, 0, 0.44), inset 0 0 0 1px rgba(255, 255, 255, 0.02);
        }

        .fw-lock-card__kicker {
            color: rgba(177, 213, 228, 0.76);
            font-size: 0.72rem;
            letter-spacing: 0.22em;
            text-transform: uppercase;
        }

        .fw-lock-card__title {
            color: #f4fbff;
            font-size: 1.9rem;
            font-weight: 700;
            letter-spacing: 0.08em;
            text-transform: uppercase;
        }

        .fw-lock-card__copy {
            color: rgba(232, 243, 250, 0.82);
            line-height: 1.55;
            max-width: 44ch;
        }

        .fw-lock-card__status {
            display: inline-flex;
            align-items: center;
            gap: 8px;
            padding: 7px 10px;
            border: 1px solid rgba(72, 221, 255, 0.18);
            border-radius: 999px;
            width: max-content;
            max-width: 100%;
            color: #9fe7ff;
            font-size: 0.76rem;
            letter-spacing: 0.12em;
            text-transform: uppercase;
            background: rgba(72, 221, 255, 0.06);
        }

        .fw-lock-card__actions {
            display: flex;
            align-items: center;
            gap: 12px;
            flex-wrap: wrap;
        }

        .fw-lock-card__error {
            color: #ffb180;
            font-weight: 600;
        }

        .fw-lock-card__hint {
            color: rgba(177, 213, 228, 0.74);
            font-size: 0.78rem;
            letter-spacing: 0.08em;
            text-transform: uppercase;
        }

        .fw-lock-card :is(.mat-mdc-form-field, .mdc-text-field) {
            width: 100%;
        }

        .fw-lock-card__actions .mdc-button {
            min-width: 210px;
            letter-spacing: 0.12em;
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
                <button mat-menu-item [routerLink]="'/sales'">
                    <span class="fw-nav-item fw-nav-item--sales">
                        <span class="fw-nav-item__content">
                            <span class="fw-nav-item__title">Sales</span>
                            <span class="fw-nav-item__subtitle">Placeholder for upcoming sales tools and workflows</span>
                        </span>
                    </span>
                </button>
                <button mat-menu-item [routerLink]="'/design'">
                    <span class="fw-nav-item fw-nav-item--design">
                        <span class="fw-nav-item__content">
                            <span class="fw-nav-item__title">Design</span>
                            <span class="fw-nav-item__subtitle">Coordinate design deliverables and drawing workflows</span>
                        </span>
                    </span>
                </button>
                <button mat-menu-item [routerLink]="'/install'">
                    <span class="fw-nav-item fw-nav-item--install">
                        <span class="fw-nav-item__content">
                            <span class="fw-nav-item__title">Install</span>
                            <span class="fw-nav-item__subtitle">Track field execution and installation operations</span>
                        </span>
                    </span>
                </button>
                <button mat-menu-item [routerLink]="'/projects'">
                    <span class="fw-nav-item fw-nav-item--projects">
                        <span class="fw-nav-item__content">
                            <span class="fw-nav-item__title">Projects</span>
                            <span class="fw-nav-item__subtitle">View and manage projects in Firewire</span>
                        </span>
                    </span>
                </button>
                <button mat-menu-item [routerLink]="'/devices'">
                    <span class="fw-nav-item fw-nav-item--devices">
                        <span class="fw-nav-item__content">
                            <span class="fw-nav-item__title">Devices</span>
                            <span class="fw-nav-item__subtitle">View and manage devices and materials</span>
                        </span>
                    </span>
                </button>
                <button mat-menu-item [routerLink]="'/settings'">
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
                <button mat-menu-item (click)="onLockWorkspace()">
                    <mat-icon fontIcon="lock"></mat-icon>
                    <span>Lock Workspace</span>
                </button>
                <button mat-menu-item [routerLink]="'/preferences'">Preferences</button>
                <button mat-menu-item [routerLink]="'/about'">About</button>
                <mat-divider></mat-divider>
                <button mat-menu-item (click)="onSignOut()">Sign Out</button>
            </mat-menu>
        </mat-toolbar>
        <div *ngIf="isWorkspaceLocked" class="fw-lock-overlay">
            <video
                *ngIf="lockBackgroundMode === 'video'"
                class="fw-lock-overlay__media"
                [src]="lockBackgroundVideoUrl"
                autoplay
                muted
                loop
                playsinline>
            </video>
            <div
                *ngIf="lockBackgroundMode !== 'video'"
                class="fw-lock-overlay__fallback"
                [ngStyle]="lockBackgroundStyle">
            </div>
            <div class="fw-lock-overlay__scrim"></div>
            <div class="fw-lock-overlay__grid"></div>
            <div class="fw-lock-card">
                <div class="fw-lock-card__kicker">Secure Session</div>
                <div class="fw-lock-card__title">Workspace Locked</div>
                <div class="fw-lock-card__copy">The Firewire command surface is sealed. Re-enter your personal PIN to restore access to the active workspace.</div>
                <div class="fw-lock-card__status">
                    <mat-icon fontIcon="lock"></mat-icon>
                    User Command Lock
                </div>
                <mat-form-field appearance="outline">
                    <mat-label>Workspace PIN</mat-label>
                    <input matInput type="password" inputmode="numeric" autocomplete="off" [(ngModel)]="unlockPin" (keyup.enter)="onUnlockWorkspace()" />
                </mat-form-field>
                <div *ngIf="lockErrorMessage" class="fw-lock-card__error">{{lockErrorMessage}}</div>
                <div class="fw-lock-card__actions">
                    <button mat-flat-button type="button" (click)="onUnlockWorkspace()" [disabled]="unlockWorking">
                        {{unlockWorking ? 'UNLOCKING...' : 'UNLOCK WORKSPACE'}}
                    </button>
                </div>
                <div class="fw-lock-card__hint">Use Preferences to rotate your PIN after unlock.</div>
            </div>
        </div>
    `
})
export class PageToolbar implements OnInit {
    private readonly auth = inject(AuthService)
    private readonly userPreferences = inject(UserPreferencesService)
    private readonly workspaceLock = inject(WorkspaceLockService)
    private readonly destroyRef = inject(DestroyRef)
    private readonly router = inject(Router)
    private readonly dialog = inject(MatDialog)

    @Input() title?: string
    @Input() hideMenu = false
    @Input() transparent = false

    userName = 'User'
    userEmail = ''
    userInitials = 'U'
    userAvatarUrl: string | null = null
    isWorkspaceLocked = false
    unlockPin = ''
    unlockWorking = false
    lockErrorMessage = ''
    lockBackgroundMode: 'video' | 'solid' | 'gradient' = 'video'
    lockBackgroundVideoUrl = this.userPreferences.getHomeVideoUrl('ps3.mp4')
    lockBackgroundStyle: Record<string, string> = {}

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
                this.applyLockBackgroundPreferences(preferences)
            })

        this.workspaceLock.locked$
            .pipe(takeUntilDestroyed(this.destroyRef))
            .subscribe((locked) => {
                this.isWorkspaceLocked = locked
                if (!locked) {
                    this.unlockPin = ''
                    this.lockErrorMessage = ''
                    this.unlockWorking = false
                }
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

    async onLockWorkspace(): Promise<void> {
        try {
            await this.userPreferences.load()
            if (!this.userPreferences.snapshot.workspaceLock.hasPin) {
                const dialogRef = this.dialog.open(WorkspacePinSetupDialog, {
                    width: '360px',
                    maxWidth: '88vw',
                    panelClass: 'fw-compact-dialog-pane'
                })
                const newPin = await firstValueFrom(dialogRef.afterClosed())
                if (!newPin) {
                    return
                }
                await this.userPreferences.saveWorkspacePin(String(newPin))
            }

            this.workspaceLock.lock()
        } catch (err: any) {
            console.error('Unable to initialize workspace lock.', err)
            this.lockErrorMessage = err?.error?.message || err?.message || 'Workspace lock could not be initialized.'
        }
    }

    async onUnlockWorkspace(): Promise<void> {
        if (!this.unlockPin.trim()) {
            this.lockErrorMessage = 'Enter your workspace PIN.'
            return
        }

        this.unlockWorking = true
        this.lockErrorMessage = ''
        try {
            const valid = await this.userPreferences.verifyWorkspacePin(this.unlockPin)
            if (!valid) {
                this.lockErrorMessage = 'PIN verification failed.'
                this.unlockWorking = false
                return
            }
            this.workspaceLock.unlock()
        } catch (err) {
            console.error('Workspace unlock failed.', err)
            this.lockErrorMessage = 'Unable to verify PIN right now.'
            this.unlockWorking = false
        }
    }

    onAvatarError(): void {
        this.userAvatarUrl = null
    }

    isCurrentRoute(route: string): boolean {
        const currentUrl = this.router.url.split('?')[0].split('#')[0]
        return currentUrl === route || currentUrl.startsWith(`${route}/`)
    }

    private applyLockBackgroundPreferences(preferences: {
        homePage: {
            backgroundMode: 'video' | 'solid' | 'gradient'
            backgroundVideo: string
            solidColor: string
            gradientFrom: string
            gradientTo: string
            gradientAngle: number
        }
    }): void {
        this.lockBackgroundMode = preferences.homePage.backgroundMode
        if (this.lockBackgroundMode === 'video') {
            this.lockBackgroundVideoUrl = this.userPreferences.getHomeVideoUrl(preferences.homePage.backgroundVideo)
            this.lockBackgroundStyle = {}
            return
        }
        if (this.lockBackgroundMode === 'solid') {
            this.lockBackgroundStyle = {
                background: preferences.homePage.solidColor
            }
            return
        }
        this.lockBackgroundStyle = {
            background: `linear-gradient(${preferences.homePage.gradientAngle}deg, ${preferences.homePage.gradientFrom}, ${preferences.homePage.gradientTo})`
        }
    }
}
