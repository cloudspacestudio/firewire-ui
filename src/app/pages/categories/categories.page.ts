import { Component, OnInit, AfterViewInit, ViewChild } from "@angular/core"
import { RouterLink } from "@angular/router"

import { HttpClient } from "@angular/common/http"
import { CommonModule } from "@angular/common"

import { MatButtonModule } from "@angular/material/button"
import { MatIconModule } from "@angular/material/icon"
import {PageEvent, MatPaginator, MatPaginatorModule} from '@angular/material/paginator';
import {MatSort, MatSortModule, Sort, SortDirection} from '@angular/material/sort';
import {MatTableDataSource, MatTableModule} from '@angular/material/table';
import {MatInputModule} from '@angular/material/input';
import {MatFormFieldModule} from '@angular/material/form-field';

import { PageToolbar } from '../../common/components/page-toolbar';
import { Category } from "../../schemas/category.schema"
import { NavToolbar } from "../../common/components/nav-toolbar"

interface ReconciledCategory extends Category {
    referencedByDeviceParts?: boolean
    devicePartReferenceCount?: number
    sourceVendors?: string[]
    createdByReconcile?: boolean
}

@Component({
    standalone: true,
    selector: 'categories-page',
    imports: [CommonModule, MatButtonModule, 
        RouterLink, 
        MatPaginatorModule, MatSortModule,
        MatTableModule, MatInputModule,
        MatFormFieldModule,
        MatIconModule, PageToolbar, NavToolbar],
    providers: [HttpClient],
    templateUrl: './categories.page.html',
    styleUrls: ['./categories.page.scss']
})
export class CategoriesPage implements OnInit, AfterViewInit  {
    readonly baseDisplayedColumns: string[] = ['name', 'shortName', 'handle', 'includeOnFloorplan', 'actions'];

    @ViewChild(MatPaginator) paginator?: MatPaginator;
    @ViewChild(MatSort) sort?: MatSort;

    pageWorking = true
    categories: ReconciledCategory[] = []
    navItems = NavToolbar.DeviceNavItems
    errText?: string
    statusText = ''
    reconcileWorking = false
    hasReconciled = false
    textFilter = ''
    currentSortActive = 'name'
    currentSortDirection: SortDirection = 'asc'
    pageSize = 10

    datasource: MatTableDataSource<ReconciledCategory> = new MatTableDataSource(this.categories);
    
    constructor(private http: HttpClient) {}

    ngOnInit(): void {
        this.textFilter = this.readStoredFilter()
        const storedSort = this.readStoredSort()
        this.currentSortActive = storedSort.active
        this.currentSortDirection = storedSort.direction
        this.pageSize = this.readStoredPageSize()
        this.loadCategories()
    }

    loadCategories() {
        this.categories = []
        this.pageWorking = true
        this.http.get<{ rows?: ReconciledCategory[] }>('/api/firewire/categories').subscribe({
            next: (s: any) => {
                if (s && s.rows) {
                    this.categories = this.sortCategoriesForDisplay([...s.rows])
                    this.datasource = new MatTableDataSource(this.categories);
                    this.datasource.paginator = this.paginator||null;
                    this.datasource.sort = this.sort||null;
                    this.applyStoredSortState()
                    this.applyStoredFilterState()
                    this.pageWorking = false
                    return
                } else {
                    this.categories = []
                    this.pageWorking = false
                }
            },
            error: (err: Error) => {
                this.errText = err.message
                this.pageWorking = false
            }
        })
    }

    ngAfterViewInit(): void {
        this.datasource.paginator = this.paginator||null;
        this.datasource.sort = this.sort||null;
        this.applyStoredSortState()
        if (this.paginator) {
            this.paginator.pageSize = this.pageSize
        }
    }

    applyFilter(event: Event) {
        this.textFilter = (event.target as HTMLInputElement).value || '';
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
        this.pageSize = Number(event.pageSize || 10)
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

    reconcileCategories() {
        this.reconcileWorking = true
        this.statusText = 'Reconciling categories from device-linked vendor parts...'
        this.http.post<{ rows?: ReconciledCategory[], summary?: { createdCount?: number, referencedCategoryCount?: number, unreferencedCategoryCount?: number } }>('/api/firewire/categories/reconcile', {}).subscribe({
            next: (response) => {
                this.reconcileWorking = false
                this.categories = this.sortCategoriesForDisplay(Array.isArray(response?.rows) ? response.rows : [])
                this.datasource = new MatTableDataSource(this.categories)
                this.datasource.paginator = this.paginator||null
                this.datasource.sort = this.sort||null
                this.applyStoredSortState()
                this.applyStoredFilterState()
                this.datasource.paginator?.firstPage()
                this.hasReconciled = true
                const createdCount = Number(response?.summary?.createdCount || 0)
                const referencedCount = Number(response?.summary?.referencedCategoryCount || 0)
                const unreferencedCount = Number(response?.summary?.unreferencedCategoryCount || 0)
                this.statusText = `Reconciled ${referencedCount} device-backed categories. Created ${createdCount} new categories. ${unreferencedCount} existing categories are not represented by current device-linked vendor parts.`
            },
            error: (err: any) => {
                this.reconcileWorking = false
                this.statusText = err?.error?.message || err?.message || 'Unable to reconcile categories.'
            }
        })
    }

    get displayedColumns(): string[] {
        if (!this.hasReconciled) {
            return [...this.baseDisplayedColumns]
        }
        return ['name', 'shortName', 'handle', 'includeOnFloorplan', 'status', 'actions']
    }

    getCategoryStatus(row: ReconciledCategory): string {
        if (typeof row.referencedByDeviceParts !== 'boolean') {
            if (this.isReconcileCreated(row)) {
                return 'Created by reconcile'
            }
            return 'Not reconciled'
        }
        if (row.createdByReconcile || this.isReconcileCreated(row)) {
            return 'Created by reconcile'
        }
        if (row.referencedByDeviceParts) {
            return 'Used by device parts'
        }
        return 'Not seen on device parts'
    }

    getCategoryRowClass(row: ReconciledCategory): string {
        if (row.referencedByDeviceParts === false) {
            return 'categories-row--missing-source'
        }
        if (this.isReconcileCreated(row)) {
            return 'categories-row--created'
        }
        return ''
    }

    getIncludeOnFloorplan(row: ReconciledCategory): boolean {
        return !!row.includeOnFloorplan
    }

    private isReconcileCreated(row: ReconciledCategory): boolean {
        return String(row.createby || '').trim().toLowerCase() === 'category-reconcile'
    }

    private sortCategoriesForDisplay(rows: ReconciledCategory[]): ReconciledCategory[] {
        return [...rows].sort((a, b) => {
            const aCreated = this.isReconcileCreated(a) || !!a.createdByReconcile
            const bCreated = this.isReconcileCreated(b) || !!b.createdByReconcile
            if (aCreated !== bCreated) {
                return aCreated ? -1 : 1
            }
            return String(a.name || '').localeCompare(String(b.name || ''))
        })
    }

    private applyStoredFilterState() {
        this.datasource.filter = this.textFilter.trim().toLowerCase()
        if (this.datasource.paginator) {
            this.datasource.paginator.pageSize = this.pageSize
        }
    }

    private applyStoredSortState() {
        if (!this.sort) {
            return
        }
        this.sort.active = this.currentSortActive
        this.sort.direction = this.currentSortDirection
        this.sort.sortChange.emit({
            active: this.currentSortActive,
            direction: this.currentSortDirection
        })
    }

    private storeFilter() {
        if (typeof localStorage === 'undefined') {
            return
        }
        try {
            localStorage.setItem('firewire.categories.filter', this.textFilter)
        } catch {}
    }

    private readStoredFilter(): string {
        if (typeof localStorage === 'undefined') {
            return ''
        }
        try {
            return localStorage.getItem('firewire.categories.filter') || ''
        } catch {
            return ''
        }
    }

    private storeSort() {
        if (typeof localStorage === 'undefined') {
            return
        }
        try {
            localStorage.setItem('firewire.categories.sort', JSON.stringify({
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
            const parsed = JSON.parse(localStorage.getItem('firewire.categories.sort') || '{}') as { active?: unknown, direction?: unknown }
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
            localStorage.setItem('firewire.categories.pageSize', String(this.pageSize))
        } catch {}
    }

    private readStoredPageSize(): number {
        if (typeof localStorage === 'undefined') {
            return 10
        }
        try {
            const raw = Number(localStorage.getItem('firewire.categories.pageSize') || '10')
            return [5, 10, 25, 100].includes(raw) ? raw : 10
        } catch {
            return 10
        }
    }

}
