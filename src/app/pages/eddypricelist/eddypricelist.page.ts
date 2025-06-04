import { Component, OnInit, AfterViewInit, ViewChild } from "@angular/core"
import { RouterLink } from "@angular/router"

import { HttpClient } from "@angular/common/http"
import { CommonModule } from "@angular/common"

import { MatButtonModule } from "@angular/material/button"
import { MatIconModule } from "@angular/material/icon"
import { MatMenuModule } from "@angular/material/menu"
import {MatPaginator, MatPaginatorModule} from '@angular/material/paginator';
import {MatSort, MatSortModule} from '@angular/material/sort';
import {MatTableDataSource, MatTableModule} from '@angular/material/table';
import {MatInputModule} from '@angular/material/input';
import {MatFormFieldModule} from '@angular/material/form-field';

import { PageToolbar } from '../../common/components/page-toolbar';
import { EddyPricelist } from "../../schemas/eddypricelist.schema"
import { NavToolbar } from "../../common/components/nav-toolbar"
import { VwEddyPricelist } from "../../schemas/vwEddyPricelist"

@Component({
    standalone: true,
    selector: 'devices-page',
    imports: [CommonModule, MatButtonModule, 
        RouterLink, MatMenuModule,
        MatPaginatorModule, MatSortModule,
        MatTableModule, MatInputModule,
        MatFormFieldModule,
        MatIconModule, PageToolbar, NavToolbar],
    providers: [HttpClient],
    templateUrl: './eddypricelist.page.html'
})
export class EddyPricelistPage implements OnInit, AfterViewInit  {
    displayedColumns: string[] = [
        'LongDescription',
        'PartNumber',
        'ParentCategory',
        'Category',
        'MSRPPrice',
        'MinOrderQuantity',
        //'ProductStatus',
        'UPC',
        //'SalesPrice',
        //'FuturePrice',
        //'FutureEffectiveDate',
        //'FutureSalesPrice',
        //'FutureSalesEffectiveDate',
        //'Agency',
        //'CountryOfOrigin',
        'actions'
    ];

    @ViewChild(MatPaginator) paginator?: MatPaginator;
    @ViewChild(MatSort) sort?: MatSort;

    pageWorking = true
    eddypricelists: VwEddyPricelist[] = []
    navItems = NavToolbar.DeviceNavItems
    errText?: string

    datasource: MatTableDataSource<VwEddyPricelist> = new MatTableDataSource(this.eddypricelists);
    
    constructor(private http: HttpClient) {}

    ngOnInit(): void {
        this.eddypricelists = []

        this.http.get('/api/fieldwire/vweddypricelist').subscribe({
            next: (s: any) => {
                if (s && s.rows) {
                    this.eddypricelists = [...s.rows]
                    this.datasource = new MatTableDataSource(this.eddypricelists);
                    this.datasource.paginator = this.paginator||null;
                    this.datasource.sort = this.sort||null;
                    console.dir(this.eddypricelists)
                    this.pageWorking = false
                    return
                } else {
                    this.eddypricelists = []
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

}