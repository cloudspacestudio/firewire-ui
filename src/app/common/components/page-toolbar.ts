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
        <mat-toolbar class="page-toolbar" color="accent">
            <button mat-icon-button [mat-menu-trigger-for]="navMenu" style="margin-right: 8px;">
                <mat-icon fontIcon="menu"></mat-icon>
            </button>
            <mat-menu #navMenu>
                <button mat-menu-item [routerLink]="'/root'">Home</button>
                <button mat-menu-item [routerLink]="'/projects'">Projects</button>
                <button mat-menu-item [routerLink]="'/devices'">Devices</button>
                <button mat-menu-item [routerLink]="'/settings'">Settings</button>
            </mat-menu>

            <span style="cursor: pointer;" [routerLink]="'/root'">FIREWIRE</span>
            <span *ngIf="title">:{{title}}</span>

            <ng-content></ng-content>
            
            <span class="spacer"></span>
            
            <button [mat-menu-trigger-for]="userMenu" class="circle-btn">SS</button>
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