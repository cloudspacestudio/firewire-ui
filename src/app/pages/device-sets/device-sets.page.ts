import { AfterViewInit, Component, Inject, OnInit, ViewChild } from "@angular/core"
import { CommonModule } from "@angular/common"
import { Router, RouterLink } from "@angular/router"
import { HttpClient } from "@angular/common/http"
import { FormsModule } from "@angular/forms"

import { MatButtonModule } from "@angular/material/button"
import { MAT_DIALOG_DATA, MatDialog, MatDialogActions, MatDialogClose, MatDialogContent, MatDialogTitle } from "@angular/material/dialog"
import { MatFormFieldModule } from "@angular/material/form-field"
import { MatIconModule } from "@angular/material/icon"
import { MatInputModule } from "@angular/material/input"
import { MatPaginator, MatPaginatorModule } from "@angular/material/paginator"
import { MatSort, MatSortModule, Sort, SortDirection } from "@angular/material/sort"
import { MatTableDataSource, MatTableModule } from "@angular/material/table"

import { NavToolbar } from "../../common/components/nav-toolbar"
import { PageToolbar } from "../../common/components/page-toolbar"
import { DeviceSetSummary } from "../../schemas/device-set.schema"

@Component({
    standalone: true,
    selector: 'device-sets-page',
    imports: [
        CommonModule,
        RouterLink,
        MatButtonModule,
        MatFormFieldModule,
        MatIconModule,
        MatInputModule,
        MatPaginatorModule,
        MatSortModule,
        MatTableModule,
        PageToolbar,
        NavToolbar
    ],
    providers: [HttpClient],
    templateUrl: './device-sets.page.html',
    styleUrls: ['./device-sets.page.scss']
})
export class DeviceSetsPage implements OnInit, AfterViewInit {
    displayedColumns: string[] = ['name', 'vendors', 'deviceCount', 'updateat', 'actions']

    @ViewChild(MatPaginator) paginator?: MatPaginator
    @ViewChild(MatSort) sort?: MatSort

    pageWorking = true
    errText?: string
    statusText = ''
    textFilter = ''
    currentSortActive = 'name'
    currentSortDirection: SortDirection = 'asc'
    deviceSets: DeviceSetSummary[] = []
    datasource = new MatTableDataSource<DeviceSetSummary>(this.deviceSets)
    navItems = NavToolbar.DeviceNavItems

    constructor(private http: HttpClient, private dialog: MatDialog, private router: Router) {}

    ngOnInit(): void {
        this.textFilter = this.readStoredFilter()
        const storedSort = this.readStoredSort()
        this.currentSortActive = storedSort.active
        this.currentSortDirection = storedSort.direction
        this.loadDeviceSets()
    }

    ngAfterViewInit(): void {
        this.datasource.paginator = this.paginator || null
        this.datasource.sort = this.sort || null
        this.applyStoredSortState()
    }

    loadDeviceSets() {
        this.pageWorking = true
        this.errText = undefined
        this.http.get<{ rows?: DeviceSetSummary[] }>('/api/firewire/device-sets').subscribe({
            next: (response) => {
                this.deviceSets = Array.isArray(response?.rows) ? response.rows : []
                this.datasource = new MatTableDataSource(this.deviceSets)
                this.datasource.paginator = this.paginator || null
                this.datasource.sort = this.sort || null
                this.datasource.filterPredicate = (row, filter) => {
                    const haystack = [
                        row.name,
                        ...(Array.isArray(row.vendors) ? row.vendors : [])
                    ].join(' ').toLowerCase()
                    return haystack.includes(filter)
                }
                this.applyStoredSortState()
                this.applyStoredFilterState()
                this.pageWorking = false
            },
            error: (err: Error) => {
                this.errText = err.message
                this.pageWorking = false
            }
        })
    }

    applyFilter(event: Event) {
        this.textFilter = (event.target as HTMLInputElement).value || ''
        this.datasource.filter = this.textFilter.trim().toLowerCase()
        this.storeFilter()
        if (this.datasource.paginator) {
            this.datasource.paginator.firstPage()
        }
    }

    onSortChange(sort: Sort) {
        this.currentSortActive = sort.active || 'name'
        this.currentSortDirection = sort.direction || 'asc'
        this.storeSort()
    }

    async createDeviceSet() {
        const dialogRef = this.dialog.open(CreateDeviceSetDialog, {
            width: '420px',
            maxWidth: '94vw'
        })
        const result = await dialogRef.afterClosed().toPromise()
        const name = String(result?.name || '').trim()
        if (!name) {
            return
        }
        this.statusText = 'Creating device set...'
        this.http.post<{ data?: DeviceSetSummary }>(
            '/api/firewire/device-sets',
            { name }
        ).subscribe({
            next: (response) => {
                const deviceSetId = String((response as any)?.data?.deviceSetId || '').trim()
                this.statusText = 'Device set created.'
                if (deviceSetId) {
                    this.router.navigate(['/device-sets', deviceSetId])
                    return
                }
                this.loadDeviceSets()
            },
            error: (err: any) => {
                this.statusText = err?.error?.message || err?.message || 'Unable to create device set.'
            }
        })
    }

    async deleteDeviceSet(row: DeviceSetSummary) {
        const dialogRef = this.dialog.open(ConfirmDeviceSetDeleteDialog, {
            width: '380px',
            maxWidth: '92vw',
            data: row
        })
        const confirmed = await dialogRef.afterClosed().toPromise()
        if (!confirmed) {
            return
        }
        this.statusText = `Deleting ${row.name}...`
        this.http.delete(`/api/firewire/device-sets/${row.deviceSetId}`).subscribe({
            next: () => {
                this.deviceSets = this.deviceSets.filter((item) => item.deviceSetId !== row.deviceSetId)
                this.datasource.data = [...this.deviceSets]
                this.statusText = `${row.name} deleted.`
            },
            error: (err: any) => {
                this.statusText = err?.error?.message || err?.message || `Unable to delete ${row.name}.`
            }
        })
    }

    getVendorSummary(row: DeviceSetSummary): string {
        if (!Array.isArray(row.vendors) || row.vendors.length <= 0) {
            return 'No devices linked'
        }
        return row.vendors.join(', ')
    }

    getNoDataRowText(filterValue: string) {
        if (this.pageWorking) {
            return 'Loading, please wait...'
        }
        if (this.errText) {
            return this.errText
        }
        if (!filterValue) {
            return 'No Device Sets Found'
        }
        return `No device sets matching the filter "${filterValue}"`
    }

    private applyStoredFilterState() {
        this.datasource.filter = this.textFilter.trim().toLowerCase()
        if (this.datasource.paginator && this.datasource.filter) {
            this.datasource.paginator.firstPage()
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
            localStorage.setItem('firewire.device-sets.filter', this.textFilter)
        } catch {}
    }

    private readStoredFilter(): string {
        if (typeof localStorage === 'undefined') {
            return ''
        }
        try {
            return localStorage.getItem('firewire.device-sets.filter') || ''
        } catch {
            return ''
        }
    }

    private storeSort() {
        if (typeof localStorage === 'undefined') {
            return
        }
        try {
            localStorage.setItem('firewire.device-sets.sort', JSON.stringify({
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
            const parsed = JSON.parse(localStorage.getItem('firewire.device-sets.sort') || '{}') as { active?: unknown, direction?: unknown }
            const active = typeof parsed.active === 'string' && parsed.active.trim() ? parsed.active.trim() : 'name'
            const direction = parsed.direction === 'asc' || parsed.direction === 'desc' ? parsed.direction : 'asc'
            return { active, direction }
        } catch {
            return { active: 'name', direction: 'asc' }
        }
    }
}

@Component({
    standalone: true,
    selector: 'create-device-set-dialog',
    imports: [CommonModule, FormsModule, MatButtonModule, MatDialogActions, MatDialogClose, MatDialogContent, MatDialogTitle, MatFormFieldModule, MatInputModule],
    template: `
        <h2 mat-dialog-title>New Device Set</h2>
        <mat-dialog-content>
            <mat-form-field appearance="outline" style="width: 100%;">
                <mat-label>Set Name</mat-label>
                <input matInput maxlength="120" [(ngModel)]="name" />
            </mat-form-field>
        </mat-dialog-content>
        <mat-dialog-actions align="end">
            <button mat-stroked-button mat-dialog-close type="button">Cancel</button>
            <button mat-flat-button [mat-dialog-close]="{ name: name }" [disabled]="!name.trim()" type="button">Create</button>
        </mat-dialog-actions>
    `
})
class CreateDeviceSetDialog {
    name = ''
}

@Component({
    standalone: true,
    selector: 'confirm-device-set-delete-dialog',
    imports: [CommonModule, MatButtonModule, MatDialogActions, MatDialogClose, MatDialogContent, MatDialogTitle],
    template: `
        <h2 mat-dialog-title>Delete Device Set</h2>
        <mat-dialog-content>
            Delete <strong>{{data.name}}</strong>? This only removes the set definition and its membership list.
        </mat-dialog-content>
        <mat-dialog-actions align="end">
            <button mat-stroked-button mat-dialog-close type="button">Cancel</button>
            <button mat-flat-button color="warn" [mat-dialog-close]="true" type="button">Delete</button>
        </mat-dialog-actions>
    `
})
class ConfirmDeviceSetDeleteDialog {
    constructor(@Inject(MAT_DIALOG_DATA) public data: DeviceSetSummary) {}
}
