import { Component, OnInit, AfterViewInit, ViewChild } from "@angular/core"
import { NgIf, NgFor } from "@angular/common"
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
import { VwDevice } from "../../schemas/vwdevice.schema"
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
    templateUrl: './devices.page.html'
})
export class DevicesPage implements OnInit, AfterViewInit  {
    displayedColumns: string[] = ['name', 'partNumber', 'shortName', 'cost', 'attributeCount', 'subTaskCount', 'categoryName', 'actions'];

    @ViewChild(MatPaginator) paginator?: MatPaginator;
    @ViewChild(MatSort) sort?: MatSort;

    pageWorking = true
    errText?: string
    devices: VwDevice[] = []
    navItems = NavToolbar.DeviceNavItems

    datasource: MatTableDataSource<VwDevice> = new MatTableDataSource(this.devices);
    
    constructor(private http: HttpClient) {}

    ngOnInit(): void {
        this.devices = []

        this.http.get('/api/fieldwire/vwdevices').subscribe({
            next: (s: any) => {
                if (s && s.rows) {
                    this.devices = [...s.rows]
                    this.datasource = new MatTableDataSource(this.devices);
                    this.datasource.paginator = this.paginator||null;
                    this.datasource.sort = this.sort||null;
                    console.dir(this.devices)
                    this.pageWorking = false
                    return
                } else {
                    this.devices = []
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