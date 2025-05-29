import { Component, Input } from "@angular/core";
import { NgIf } from "@angular/common";
import { RouterLink } from "@angular/router";

import { MatToolbarModule } from '@angular/material/toolbar'
import { MatButtonModule } from '@angular/material/button'
import { MatIconModule } from '@angular/material/icon'
import { MatMenuModule } from '@angular/material/menu'

@Component({
    selector: 'nav-toolbar',
    imports: [NgIf, RouterLink, MatButtonModule, MatIconModule, MatMenuModule, MatToolbarModule],
    template: `
    <div class="button-bar">
        @for (item of navItems; track item) {
        <button *ngIf="item.id===selectedItem" mat-flat-button class="active">{{item.caption}}</button>
        <button *ngIf="item.id!==selectedItem" mat-raised-button [routerLink]="item.route">{{item.caption}}</button>
        }
    </div>

    `
})
export class NavToolbar {
    @Input() navItems?: NavItem[] = []
    @Input() selectedItem: string = 'devices'

    static DeviceNavItems = [
        {id: 'devices', caption: 'DEVICES', route: `/devices`},
        //{id: 'materials', caption: 'MATERIALS', route: `/materials`},
        {id: 'parts', caption: 'PARTS', route: `/parts`},
        {id: 'categories', caption: 'CATEGORIES', route: `/categories`},
        {id: 'vendors', caption: 'VENDORS', route: `/vendors`}
    ]
}

export interface NavItem {
    id: string
    caption: string
    route: string
}