import { Component, Input } from "@angular/core";
import { NgIf } from "@angular/common";
import { RouterLink } from "@angular/router";

import { MatToolbarModule } from '@angular/material/toolbar'
import { MatButtonModule } from '@angular/material/button'
import { MatIconModule } from '@angular/material/icon'
import { MatMenuModule } from '@angular/material/menu'

@Component({
    selector: 'page-toolbar',
    imports: [NgIf, RouterLink, MatButtonModule, MatIconModule, MatMenuModule, MatToolbarModule],
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
            
            <button [mat-menu-trigger-for]="userMenu" class="circle-btn fw-toolbar__user-btn" aria-label="Open user menu">SS</button>
            <mat-menu #userMenu>
                <button mat-menu-item>Preferences</button>
                <button mat-menu-item>About</button>
                <button mat-menu-item>Sign Out</button>
            </mat-menu>
        </mat-toolbar>
    `
})
export class PageToolbar {
    @Input() title?: string
}
