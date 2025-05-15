import { Component, OnInit } from "@angular/core"
import { NgIf, NgFor } from "@angular/common"
import { RouterLink } from "@angular/router"

import { HttpClient } from "@angular/common/http"
import { CommonModule } from "@angular/common"

import { MatButtonModule } from "@angular/material/button"
import { MatIconModule } from "@angular/material/icon"

import { Utils } from "../../common/utils"
import { PageToolbar } from '../../common/components/page-toolbar';

@Component({
    standalone: true,
    selector: 'devices-page',
    imports: [CommonModule, MatButtonModule, 
        RouterLink, 
        MatIconModule, PageToolbar],
    providers: [HttpClient],
    templateUrl: './devices.page.html'
})
export class DevicesPage implements OnInit {

    pageWorking = true
    devices: any[] = []
    deviceKeys: string[] = []

    constructor(private http: HttpClient) {}

    ngOnInit(): void {
        this.pageWorking = true
        this.devices = []
        this.deviceKeys = []

        this.http.get('/api/fieldwire/devices').subscribe({
            next: (s: any) => {
                if (s && s.rows) {
                    this.devices = [...s.rows]
                    if (this.devices.length > 0) {
                        this.deviceKeys = Object.keys(this.devices[0])
                    }
                    this.pageWorking = false
                    return
                }
            },
            error: (err: Error) => {
                console.dir(err)
            }
        })
    }

}