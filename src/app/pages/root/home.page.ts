import { Component, OnInit } from "@angular/core"

import { HttpClient } from "@angular/common/http"
import { CommonModule } from "@angular/common"
import { RouterLink } from "@angular/router"

import { MatCardModule } from "@angular/material/card"
import { MatButtonModule } from "@angular/material/button"

import { PageToolbar } from '../../common/components/page-toolbar';

@Component({
    standalone: true,
    selector: 'home-page',
    imports: [CommonModule, MatButtonModule, MatCardModule, PageToolbar, RouterLink],
    providers: [HttpClient],
    templateUrl: './home.page.html'
})
export class HomePage implements OnInit {

    constructor() {}

    ngOnInit(): void {
    }

}