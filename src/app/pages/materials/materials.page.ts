import { Component, OnInit, AfterViewInit, ViewChild } from "@angular/core"
import { RouterLink } from "@angular/router"

import { HttpClient } from "@angular/common/http"
import { CommonModule } from "@angular/common"

import { MatButtonModule } from "@angular/material/button"
import { MatIconModule } from "@angular/material/icon"
import {MatPaginator, MatPaginatorModule, PageEvent} from '@angular/material/paginator';
import {MatSort, MatSortModule, Sort, SortDirection} from '@angular/material/sort';
import {MatTableDataSource, MatTableModule} from '@angular/material/table';
import {MatInputModule} from '@angular/material/input';
import {MatFormFieldModule} from '@angular/material/form-field';

import { PageToolbar } from '../../common/components/page-toolbar';
import { VwMaterial } from "../../schemas/vwmaterial.schema"
import { NavToolbar } from "../../common/components/nav-toolbar"

@Component({
    standalone: true,
    selector: 'materials-page',
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
    errText?: string
    textFilter = ''
    currentSortActive = 'name'
    currentSortDirection: SortDirection = 'asc'
    pageSize = 25

    datasource: MatTableDataSource<VwMaterial> = new MatTableDataSource(this.materials);
    
    constructor(private http: HttpClient) {}

    ngOnInit(): void {
        this.materials = []
        this.textFilter = this.readStoredFilter()
        const storedSort = this.readStoredSort()
        this.currentSortActive = storedSort.active
        this.currentSortDirection = storedSort.direction
        this.pageSize = this.readStoredPageSize()

        this.http.get('/api/firewire/vwmaterials').subscribe({
            next: (s: any) => {
                if (s && s.rows) {
                    this.materials = [...s.rows]
                    this.datasource = new MatTableDataSource(this.materials);
                    this.datasource.paginator = this.paginator||null;
                    this.datasource.sort = this.sort||null;
                    this.applyStoredSortState()
                    this.applyStoredPageSizeState()
                    this.applyStoredFilterState()
                    this.pageWorking = false
                    return
                } else {
                    this.materials = []
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
        this.applyStoredSortState()
        this.applyStoredPageSizeState()
    }

    applyFilter(event: Event) {
        this.textFilter = (event.target as HTMLInputElement).value || ''
        this.datasource.filter = this.textFilter.trim().toLowerCase();
        this.storeFilter()

        if (this.datasource.paginator) {
            this.datasource.paginator.firstPage();
        }
    }

    onSortChange(sort: Sort) {
        this.currentSortActive = sort.active || 'name'
        this.currentSortDirection = sort.direction || 'asc'
        this.storeSort()
    }

    onPageChange(event: PageEvent) {
        this.pageSize = Number(event.pageSize || 25)
        this.storePageSize()
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

    private applyStoredFilterState() {
        this.datasource.filter = this.textFilter.trim().toLowerCase()
    }

    private applyStoredSortState() {
        if (!this.sort) {
            return
        }
        this.sort.active = this.currentSortActive
        this.sort.direction = this.currentSortDirection
    }

    private applyStoredPageSizeState() {
        if (this.paginator) {
            this.paginator.pageSize = this.pageSize
        }
    }

    private storeFilter() {
        if (typeof localStorage === 'undefined') {
            return
        }
        try {
            localStorage.setItem('firewire.materials.filter', this.textFilter)
        } catch {}
    }

    private readStoredFilter(): string {
        if (typeof localStorage === 'undefined') {
            return ''
        }
        try {
            return localStorage.getItem('firewire.materials.filter') || ''
        } catch {
            return ''
        }
    }

    private storeSort() {
        if (typeof localStorage === 'undefined') {
            return
        }
        try {
            localStorage.setItem('firewire.materials.sort', JSON.stringify({
                active: this.currentSortActive,
                direction: this.currentSortDirection
            }))
        } catch {}
    }

    private readStoredSort(): { active: string, direction: SortDirection } {
        if (typeof localStorage === 'undefined') {
            return { active: 'name', direction: 'asc' }
        }
        try {
            const parsed = JSON.parse(localStorage.getItem('firewire.materials.sort') || '{}') as { active?: unknown, direction?: unknown }
            const active = typeof parsed.active === 'string' && parsed.active.trim() ? parsed.active.trim() : 'name'
            const direction = parsed.direction === 'asc' || parsed.direction === 'desc' ? parsed.direction : 'asc'
            return { active, direction }
        } catch {
            return { active: 'name', direction: 'asc' }
        }
    }

    private storePageSize() {
        if (typeof localStorage === 'undefined') {
            return
        }
        try {
            localStorage.setItem('firewire.materials.pageSize', String(this.pageSize))
        } catch {}
    }

    private readStoredPageSize(): number {
        if (typeof localStorage === 'undefined') {
            return 25
        }
        try {
            const raw = Number(localStorage.getItem('firewire.materials.pageSize') || '25')
            return [5, 10, 25, 100].includes(raw) ? raw : 25
        } catch {
            return 25
        }
    }

}
