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
    template: `
        <mat-toolbar color="accent">
            <span style="cursor: pointer;" [routerLink]="'/home'">INFERNO</span>
            <span *ngIf="title">:{{title}}</span>
            <ng-content></ng-content>
            <span class="spacer"></span>
            <button mat-flat-button [mat-menu-trigger-for]="userMenu">SS</button>
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