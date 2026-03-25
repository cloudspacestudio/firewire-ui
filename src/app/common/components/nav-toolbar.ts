import { Component, Input, inject } from "@angular/core";
import { NgIf } from "@angular/common";
import { Router, RouterLink } from "@angular/router";

import { MatToolbarModule } from '@angular/material/toolbar'
import { MatButtonModule } from '@angular/material/button'
import { MatIconModule } from '@angular/material/icon'
import { MatMenuModule } from '@angular/material/menu'

@Component({
    selector: 'nav-toolbar',
    imports: [NgIf, RouterLink, MatButtonModule, MatIconModule, MatMenuModule, MatToolbarModule],
    styles: [`
        :host {
            display: flex;
            align-items: center;
        }

        .button-bar {
            display: flex;
            gap: 3px;
            margin: 0 0 0 6px;
            align-items: center;
            flex-wrap: wrap;
        }

        .button-bar button {
            margin-right: 0 !important;
            border-radius: var(--fw-control-radius) !important;
            min-height: 38px;
            min-width: 0;
            padding-inline: 12px;
            letter-spacing: 0.12em;
            font-size: 0.72rem;
            text-transform: uppercase;
        }

        .button-bar button.active {
            border: 1px solid rgba(255, 164, 61, 0.72);
            background:
                linear-gradient(180deg, rgba(255, 170, 72, 0.34), rgba(255, 132, 28, 0.14)),
                rgba(10, 18, 32, 0.95) !important;
            color: #ffe2b2 !important;
            box-shadow: 0 0 0 1px rgba(255, 164, 61, 0.28), 0 0 22px rgba(255, 140, 40, 0.22);
        }

        .button-bar button.inactive {
            border: 1px solid rgba(72, 221, 255, 0.20);
            background:
                linear-gradient(180deg, rgba(72, 221, 255, 0.10), rgba(72, 221, 255, 0.03)),
                rgba(10, 18, 32, 0.94) !important;
            color: var(--fw-text) !important;
        }
    `],
    template: `
    <div class="button-bar">
        @for (item of navItems; track item) {
        <button *ngIf="isActiveItem(item)" mat-flat-button class="active">{{item.caption}}</button>
        <button *ngIf="!isActiveItem(item)" mat-raised-button class="inactive" [routerLink]="item.route" [queryParams]="item.queryParams || null">{{item.caption}}</button>
        }
    </div>

    `
})
export class NavToolbar {
    private router = inject(Router)

    @Input() navItems?: NavItem[] = []
    @Input() selectedItem: string = 'devices'
    @Input() disableRouteMatch = false

    isActiveItem(item: NavItem): boolean {
        if (this.disableRouteMatch) {
            return item.id === this.selectedItem
        }

        const currentUrl = this.router.url.split('?')[0].split('#')[0]
        const matchedItem = this.getBestRouteMatch(currentUrl)
        if (matchedItem) {
            return matchedItem.id === item.id
        }

        return item.id === this.selectedItem
    }

    private getBestRouteMatch(currentUrl: string): NavItem | null {
        if (!this.navItems || this.navItems.length <= 0) {
            return null
        }

        const matches = this.navItems.filter((item) => {
            if (typeof item.route !== 'string') {
                return false
            }
            return currentUrl === item.route || currentUrl.startsWith(`${item.route}/`)
        })

        if (matches.length <= 0) {
            return null
        }

        return matches.sort((left, right) => right.route.length - left.route.length)[0]
    }

    static DeviceNavItems = [
        {id: 'devices', caption: 'DEVICES', route: `/devices`},
        //{id: 'materials', caption: 'MATERIALS', route: `/materials`},
        {id: 'parts', caption: 'PARTS', route: `/parts`},
        {id: 'categories', caption: 'CATEGORIES', route: `/categories`},
        {id: 'vendors', caption: 'VENDORS', route: `/vendors`}
    ]

    static ProjectNavItems = [
        {id: 'projects', caption: 'PROJECTS', route: `/projects`},
        {id: 'awaiting-project-nbr', caption: 'AWAITING PROJECT NBR', route: `/projects/awaiting-project-nbr`},
        {id: 'fieldwire-projects', caption: 'FIELDWIRE ONLY', route: `/projects/fieldwire-list`},
        {id: 'administration', caption: 'ADMIN', route: `/admin`}
    ]
}

export interface NavItem {
    id: string
    caption: string
    route: string | any[]
    queryParams?: Record<string, string> | null
}
