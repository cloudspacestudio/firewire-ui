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
import { NavToolbar } from "../../common/components/nav-toolbar"

@Component({
    standalone: true,
    selector: 'devices-page',
    imports: [CommonModule, MatButtonModule, 
        RouterLink, 
        MatPaginatorModule, MatSortModule,
        MatTableModule, MatInputModule,
        MatFormFieldModule,
        MatIconModule, PageToolbar, NavToolbar],
    providers: [HttpClient],
    templateUrl: './materials.page.html'
})
export class MaterialsPage implements OnInit, AfterViewInit  {
    displayedColumns: string[] = ['name', 'partNumber', 'shortName', 'cost', 'vendorName'];

    @ViewChild(MatPaginator) paginator?: MatPaginator;
    @ViewChild(MatSort) sort?: MatSort;

    pageWorking = true
    materials: VwMaterial[] = []
    navItems = NavToolbar.DeviceNavItems

    datasource: MatTableDataSource<VwMaterial> = new MatTableDataSource(this.materials);
    
    constructor(private http: HttpClient) {}

    ngOnInit(): void {
        this.materials = []

        this.http.get('/api/fieldwire/vwmaterials').subscribe({
            next: (s: any) => {
                if (s && s.rows) {
                    this.materials = [...s.rows]
                    this.datasource = new MatTableDataSource(this.materials);
                    this.datasource.paginator = this.paginator||null;
                    this.datasource.sort = this.sort||null;
                    console.dir(this.materials)
                    this.pageWorking = false
                    return
                } else {
                    this.materials = []
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