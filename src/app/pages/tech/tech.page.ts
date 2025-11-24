import { Component, OnInit } from "@angular/core"
import { NgIf, NgFor } from "@angular/common"

import { HttpClient } from "@angular/common/http"
import { CommonModule } from "@angular/common"
import { RouterLink } from "@angular/router"

import { MatButtonModule } from "@angular/material/button"
import { MatIconModule } from "@angular/material/icon"
import {MatAutocompleteModule} from '@angular/material/autocomplete';
import { MatFormFieldModule } from "@angular/material/form-field"

import { Utils } from "../../common/utils"
import { PageToolbar } from '../../common/components/page-toolbar';
import {FormControl, FormsModule, ReactiveFormsModule} from '@angular/forms';

@Component({
    standalone: true,
    selector: 'tech-page',
    imports: [CommonModule, PageToolbar,
        RouterLink, MatButtonModule,
        MatIconModule, MatAutocompleteModule,
        MatFormFieldModule,
        FormsModule, ReactiveFormsModule
    ],
    providers: [HttpClient],
    templateUrl: './tech.page.html'
})
export class TechPage implements OnInit {
    myControl = new FormControl('')
    pageWorking = true
    checkedIn = false
    nowDate = new Date()
    deviceSamples = [
        'Router Model X100', 'Network Router', 'Model X100', 'FW-123456', 'Online',
        'Switch Model S200', 'Network Switch', 'Model S200', 'FW-654321', 'Offline',
        'Firewall Model F300', 'Network Firewall', 'Model F300', 'FW-112233', 'Online',
        'Access Point Model A400', 'Wireless Access Point', 'Model A400', 'FW-445566',
        'Server Model SV500', 'Application Server', 'Model SV500', 'FW-778899', 'Maintenance'
    ]
    
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
        setInterval(() => {
            this.nowDate = new Date()
        }, 1000)
    }

    getNowDate(): string {
        return this.nowDate.toLocaleDateString() + ' ' + this.nowDate.toLocaleTimeString()
    }

}