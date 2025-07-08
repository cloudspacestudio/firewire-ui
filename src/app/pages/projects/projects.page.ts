import { Component, OnInit, AfterViewInit, ViewChild } from "@angular/core"
import { NgIf, NgFor } from "@angular/common"

import { HttpClient } from "@angular/common/http"
import { CommonModule } from "@angular/common"
import { RouterLink } from "@angular/router"

import { Utils } from "../../common/utils"
import { PageToolbar } from '../../common/components/page-toolbar';
import { AccountProjectSchema, AccountProjectAttributes } from "../../schemas/account.project.schema"
import { NavToolbar } from "../../common/components/nav-toolbar"

import { MatButtonModule } from "@angular/material/button"
import { MatIconModule } from "@angular/material/icon"
import {MatPaginator, MatPaginatorModule} from '@angular/material/paginator';
import {MatSort, MatSortModule} from '@angular/material/sort';
import {MatTableDataSource, MatTableModule} from '@angular/material/table';
import {MatInputModule} from '@angular/material/input';
import {MatFormFieldModule} from '@angular/material/form-field';

@Component({
    standalone: true,
    selector: 'projects-page',
    imports: [CommonModule, RouterLink, 
        MatButtonModule, MatIconModule, 
        MatPaginatorModule, MatSortModule,
        MatTableModule, MatInputModule,
        MatFormFieldModule,
        PageToolbar, NavToolbar],
    providers: [HttpClient],
    templateUrl: './projects.page.html'
})
export class ProjectsPage implements OnInit, AfterViewInit {
    displayedColumns: string[] = ['name', 'code', 'address', 'actions'];

    @ViewChild(MatPaginator) paginator?: MatPaginator;
    @ViewChild(MatSort) sort?: MatSort;

    pageWorking = true
    projects: AccountProjectSchema[] = []
    navItems = NavToolbar.ProjectNavItems
    errText?: string

    datasource: MatTableDataSource<AccountProjectSchema> = new MatTableDataSource(this.projects);

    constructor(private http: HttpClient) {}

    ngOnInit(): void {
        this.projects = []

        this.http.get('/api/fieldwire/account/projects').subscribe({
            next: (s: any) => {
                if (s && s.rows) {
                    this.projects = [...s.rows]
                    this.datasource = new MatTableDataSource(this.projects)
                    this.datasource.paginator = this.paginator || null
                    this.datasource.sort = this.sort || null
                    console.dir(this.projects)
                    this.pageWorking = false
                    return
                } else {
                    this.projects = []
                    this.pageWorking = false
                }
            },
            error: (err: Error) => {
                this.errText = err.message
                console.dir(err)
                this.pageWorking = false
            }
        })

    }

    ngAfterViewInit(): void {
        this.datasource.paginator = this.paginator||null;
        this.datasource.sort = this.sort||null;
    }

    applyFilter(event: Event) {
        const filterValue = (event.target as HTMLInputElement).value;
        this.datasource.filter = filterValue.trim().toLowerCase();

        if (this.datasource.paginator) {
            this.datasource.paginator.firstPage();
        }
    }

    getNoDataRowText(filterValue: string) {
        if (this.pageWorking) {
            return "Loading, please wait..."
        }
        if (this.errText) {
            return this.errText
        }
        if (!filterValue) {
            return "No Data Found"
        }
        return `No data matching the filter "${filterValue}"`
    }

    toLocalDateTimeString(input: Date|string) {
        return Utils.toLocalString(input)
    }

    getProjectAttrs(input: AccountProjectSchema) {
        if (!input || !input.project_attributes || input.project_attributes.length <= 0) {
            return ''
        }
        const output = input.project_attributes.map((attr: AccountProjectAttributes) => {
            return attr.name
        })
        return output.join(', ')
    }

    getGoogleMapLink(line: string) {
        return Utils.getGoogleMapLink(line)
    }

    jsonify(input: any) {
        if (!input) {
            return ``
        }
        return JSON.stringify(input, null, 1)
    }

}