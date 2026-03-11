import { Component, Input, OnInit, inject } from "@angular/core";
import { NgIf } from "@angular/common";
import { RouterLink } from "@angular/router";

import { MatToolbarModule } from '@angular/material/toolbar'
import { MatButtonModule } from '@angular/material/button'
import { MatIconModule } from '@angular/material/icon'
import { MatMenuModule } from '@angular/material/menu'
import { MatDividerModule } from '@angular/material/divider'
import { AuthService } from "../../auth/auth.service";

@Component({
    selector: 'page-toolbar',
    imports: [NgIf, RouterLink, MatButtonModule, MatIconModule, MatMenuModule, MatToolbarModule, MatDividerModule],
    styles: [`
        :host {
            display: block;
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
            border-radius: var(--fw-control-radius);
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
        <mat-toolbar class="page-toolbar fw-toolbar">
            <button mat-icon-button class="fw-toolbar__menu-btn" [mat-menu-trigger-for]="navMenu" aria-label="Open navigation">
                <mat-icon fontIcon="menu"></mat-icon>
            </button>
            <mat-menu #navMenu>
                <button mat-menu-item [routerLink]="'/root'">Home</button>
                <button mat-menu-item [routerLink]="'/projects'">Projects</button>
                <button mat-menu-item [routerLink]="'/devices'">Devices</button>
                <button mat-menu-item [routerLink]="'/settings'">Settings</button>
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
                <button mat-menu-item>Preferences</button>
                <button mat-menu-item>About</button>
                <mat-divider></mat-divider>
                <button mat-menu-item (click)="onSignOut()">Sign Out</button>
            </mat-menu>
        </mat-toolbar>
    `
})
export class PageToolbar implements OnInit {
    private readonly auth = inject(AuthService)

    @Input() title?: string

    userName = 'User'
    userEmail = ''
    userInitials = 'U'
    userAvatarUrl: string | null = null

    ngOnInit(): void {
        const profile = this.auth.getUserProfile()
        if (!profile) {
            return
        }
        this.userName = profile.name || this.userName
        this.userEmail = profile.email || this.userEmail
        this.userInitials = this.toInitials(this.userName || this.userEmail || this.userInitials)
        this.userAvatarUrl = profile.avatarUrl || null
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
}
