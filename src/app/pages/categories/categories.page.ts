import { Component, OnInit, AfterViewInit, ViewChild } from "@angular/core"
import { RouterLink } from "@angular/router"

import { HttpClient } from "@angular/common/http"
import { CommonModule } from "@angular/common"

import { MatButtonModule } from "@angular/material/button"
import { MatIconModule } from "@angular/material/icon"
import {MatPaginator, MatPaginatorModule} from '@angular/material/paginator';
import {MatSort, MatSortModule} from '@angular/material/sort';
import {MatTableDataSource, MatTableModule} from '@angular/material/table';
import {MatInputModule} from '@angular/material/input';
import {MatFormFieldModule} from '@angular/material/form-field';

import { PageToolbar } from '../../common/components/page-toolbar';
import { VwMaterial } from "../../schemas/vwmaterial.schema"
import { Category } from "../../schemas/category.schema"

@Component({
    standalone: true,
    selector: 'devices-page',
    imports: [CommonModule, MatButtonModule, 
        RouterLink, 
        MatPaginatorModule, MatSortModule,
        MatTableModule, MatInputModule,
        MatFormFieldModule,
        MatIconModule, PageToolbar],
    providers: [HttpClient],
    templateUrl: './categories.page.html'
})
export class CategoriesPage implements OnInit, AfterViewInit  {
    displayedColumns: string[] = ['name', 'shortName', 'handle'];

    @ViewChild(MatPaginator) paginator?: MatPaginator;
    @ViewChild(MatSort) sort?: MatSort;

    pageWorking = true
    categories: Category[] = []

    datasource: MatTableDataSource<Category> = new MatTableDataSource(this.categories);
    
    constructor(private http: HttpClient) {}

    ngOnInit(): void {
        this.categories = []

        this.http.get('/api/fieldwire/categories').subscribe({
            next: (s: any) => {
                if (s && s.rows) {
                    this.categories = [...s.rows]
                    this.datasource = new MatTableDataSource(this.categories);
                    this.datasource.paginator = this.paginator||null;
                    this.datasource.sort = this.sort||null;
                    console.dir(this.categories)
                    this.pageWorking = false
                    return
                } else {
                    this.categories = []
                }
            },
            error: (err: Error) => {
                console.dir(err)
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

}