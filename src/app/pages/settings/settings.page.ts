import { Component, OnInit } from "@angular/core"
import { NgIf, NgFor } from "@angular/common"

import { HttpClient } from "@angular/common/http"
import { CommonModule } from "@angular/common"
import { RouterLink } from "@angular/router"

import { MatButtonModule } from "@angular/material/button"
import { MatIconModule } from "@angular/material/icon"

import { Utils } from "../../common/utils"
import { PageToolbar } from '../../common/components/page-toolbar';

@Component({
    standalone: true,
    selector: 'devices-page',
    imports: [CommonModule, PageToolbar,
        RouterLink, MatButtonModule,
        MatIconModule
    ],
    providers: [HttpClient],
    templateUrl: './settings.page.html'
})
export class SettingsPage implements OnInit {

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