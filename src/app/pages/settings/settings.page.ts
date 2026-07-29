import { Component, OnInit, ChangeDetectionStrategy } from "@angular/core"


import { HttpClient } from "@angular/common/http"

import { RouterLink } from "@angular/router"

import { MatButtonModule } from "@angular/material/button"
import { MatIconModule } from "@angular/material/icon"

import { Utils } from "../../common/utils"
import { PageToolbar } from '../../common/components/page-toolbar';
import { NavToolbar } from "../../common/components/nav-toolbar";

@Component({
    standalone: true,
    selector: 'settings-page',
    imports: [PageToolbar, NavToolbar, RouterLink, MatButtonModule, MatIconModule],
    providers: [HttpClient],
    templateUrl: './settings.page.html',
    changeDetection: ChangeDetectionStrategy.Eager,
    styleUrls: ['./settings.page.scss']
})
export class SettingsPage implements OnInit {
    navItems = NavToolbar.SettingsNavItems

    pageWorking = true

    constructor(private http: HttpClient) {}

    ngOnInit(): void {
        this.pageWorking = true

        this.http.get('/api/fieldwire/account/projects').subscribe({
            next: (s: any) => {
                if (s && s.rows) {
                    this.pageWorking = false
                    return
                }
                this.pageWorking = false
            },
            error: (err: Error) => {
                console.dir(err)
                this.pageWorking = false
            }
        })
    }

}
