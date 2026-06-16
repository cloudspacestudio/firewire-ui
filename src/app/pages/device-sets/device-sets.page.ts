import { AfterViewInit, Component, Inject, OnInit, ViewChild } from "@angular/core"
import { CommonModule } from "@angular/common"
import { Router, RouterLink } from "@angular/router"
import { HttpClient } from "@angular/common/http"
import { FormsModule } from "@angular/forms"

import { MatButtonModule } from "@angular/material/button"
import { MAT_DIALOG_DATA, MatDialog, MatDialogActions, MatDialogClose, MatDialogContent, MatDialogRef, MatDialogTitle } from "@angular/material/dialog"
import { MatFormFieldModule } from "@angular/material/form-field"
import { MatIconModule } from "@angular/material/icon"
import { MatInputModule } from "@angular/material/input"
import { MatPaginator, MatPaginatorModule, PageEvent } from "@angular/material/paginator"
import { MatSelectModule } from "@angular/material/select"
import { MatSort, MatSortModule, Sort, SortDirection } from "@angular/material/sort"
import { MatTableDataSource, MatTableModule } from "@angular/material/table"

import { NavToolbar } from "../../common/components/nav-toolbar"
import { PageToolbar } from "../../common/components/page-toolbar"
import { ViewPreferencesService } from "../../common/services/view-preferences.service"
import { DeviceSetSummary } from "../../schemas/device-set.schema"

interface DeviceSetVisibilityOption {
    value: string
    label: string
}

interface DeviceSetFilterCriteria {
    text: string
    visibility: string[]
}

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
        MatSelectModule,
        MatSortModule,
        MatTableModule,
        FormsModule,
        PageToolbar,
        NavToolbar
    ],
    providers: [HttpClient],
    templateUrl: './device-sets.page.html',
    styleUrls: ['./device-sets.page.scss']
})
export class DeviceSetsPage implements OnInit, AfterViewInit {
    displayedColumns: string[] = ['name', 'visibility', 'vendors', 'deviceCount', 'updateat', 'actions']
    readonly visibilityOptions: DeviceSetVisibilityOption[] = [
        { value: 'all-users', label: 'All Users' },
        { value: 'current-user', label: 'Just Me' },
        { value: 'fire-alarm', label: 'Fire Alarm' },
        { value: 'sprinkler', label: 'Sprinkler' },
        { value: 'security', label: 'Security' }
    ]

    @ViewChild(MatPaginator) paginator?: MatPaginator
    @ViewChild(MatSort) sort?: MatSort

    pageWorking = true
    errText?: string
    statusText = ''
    textFilter = ''
    selectedVisibilityFilters: string[] = []
    currentSortActive = 'name'
    currentSortDirection: SortDirection = 'asc'
    pageSize = 25
    deviceSets: DeviceSetSummary[] = []
    datasource = new MatTableDataSource<DeviceSetSummary>(this.deviceSets)
    navItems = NavToolbar.DeviceNavItems

    private readonly preferenceKeys = {
        textFilter: 'firewire.device-sets.filter',
        visibility: 'firewire.device-sets.visibility',
        sort: 'firewire.device-sets.sort',
        pageSize: 'firewire.device-sets.pageSize'
    }

    constructor(
        private http: HttpClient,
        private dialog: MatDialog,
        private router: Router,
        private viewPreferences: ViewPreferencesService
    ) {}

    ngOnInit(): void {
        this.textFilter = this.viewPreferences.readText(this.preferenceKeys.textFilter)
        this.selectedVisibilityFilters = this.readStoredVisibilityFilters()
        const storedSort = this.viewPreferences.readSort(this.preferenceKeys.sort, { active: 'name', direction: 'asc' })
        this.currentSortActive = storedSort.active
        this.currentSortDirection = storedSort.direction || 'asc'
        this.pageSize = this.viewPreferences.readNumber(this.preferenceKeys.pageSize, 25, [5, 10, 25, 100])
        this.loadDeviceSets()
    }

    ngAfterViewInit(): void {
        this.datasource.paginator = this.paginator || null
        this.datasource.sort = this.sort || null
        this.applyStoredSortState()
        this.applyStoredPageSizeState()
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
                    const criteria = this.parseFilterCriteria(filter)
                    const haystack = [
                        row.name,
                        this.getVisibilitySummary(row),
                        ...(Array.isArray(row.vendors) ? row.vendors : [])
                    ].join(' ').toLowerCase()
                    const matchesText = !criteria.text || haystack.includes(criteria.text)
                    const rowVisibility = this.getEffectiveVisibility(row)
                    const matchesVisibility = criteria.visibility.length <= 0
                        || criteria.visibility.some((value) => rowVisibility.includes(value))
                    return matchesText && matchesVisibility
                }
                this.applyStoredSortState()
                this.applyStoredPageSizeState()
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
        this.viewPreferences.writeText(this.preferenceKeys.textFilter, this.textFilter)
        this.applyStoredFilterState(true)
    }

    onVisibilityFilterChange() {
        this.selectedVisibilityFilters = this.normalizeVisibility(this.selectedVisibilityFilters)
        this.viewPreferences.writeJson(this.preferenceKeys.visibility, this.selectedVisibilityFilters)
        this.applyStoredFilterState(true)
    }

    onSortChange(sort: Sort) {
        this.currentSortActive = sort.active || 'name'
        this.currentSortDirection = sort.direction || 'asc'
        this.viewPreferences.writeSort(this.preferenceKeys.sort, {
            active: this.currentSortActive,
            direction: this.currentSortDirection
        })
    }

    onPageChange(event: PageEvent) {
        this.pageSize = Number(event.pageSize || 25)
        this.viewPreferences.writeNumber(this.preferenceKeys.pageSize, this.pageSize)
    }

    async createDeviceSet() {
        this.releaseFocusedElementBeforeDialog()
        const dialogRef = this.dialog.open(CreateDeviceSetDialog, {
            maxWidth: '94vw',
            panelClass: 'fw-fit-content-dialog-pane',
            data: {
                visibilityOptions: this.visibilityOptions
            }
        })
        const result = await dialogRef.afterClosed().toPromise()
        const name = String(result?.name || '').trim()
        if (!name) {
            return
        }
        this.statusText = 'Creating device set...'
        this.http.post<{ data?: DeviceSetSummary }>(
            '/api/firewire/device-sets',
            { name, visibility: this.normalizeVisibility(result?.visibility) }
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
        this.releaseFocusedElementBeforeDialog()
        const dialogRef = this.dialog.open(ConfirmDeviceSetDeleteDialog, {
            maxWidth: '92vw',
            panelClass: 'fw-confirmation-dialog-pane',
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

    getVisibilitySummary(row: DeviceSetSummary): string {
        return this.getEffectiveVisibility(row)
            .map((value) => this.visibilityOptions.find((option) => option.value === value)?.label || value)
            .join(', ')
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

    private applyStoredFilterState(resetPage = false) {
        this.datasource.filter = JSON.stringify({
            text: this.textFilter.trim().toLowerCase(),
            visibility: this.selectedVisibilityFilters
        } satisfies DeviceSetFilterCriteria)
        if (this.datasource.paginator && (resetPage || this.datasource.filter)) {
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

    private applyStoredPageSizeState() {
        if (this.paginator) {
            this.paginator.pageSize = this.pageSize
        }
    }

    private getEffectiveVisibility(row: DeviceSetSummary): string[] {
        return this.normalizeVisibility(row.visibility)
    }

    private normalizeVisibility(value: unknown): string[] {
        const allowed = new Set(this.visibilityOptions.map((option) => option.value))
        const source = Array.isArray(value) ? value : []
        const normalized = Array.from(new Set(source
            .map((item) => String(item || '').trim().toLowerCase())
            .filter((item) => allowed.has(item))))
        return normalized.length > 0 ? normalized : ['all-users']
    }

    private readStoredVisibilityFilters(): string[] {
        return this.viewPreferences.readJson<string[]>(this.preferenceKeys.visibility, [], (value) => {
            if (!Array.isArray(value)) {
                return []
            }
            const allowed = new Set(this.visibilityOptions.map((option) => option.value))
            return Array.from(new Set(value
                .map((item) => String(item || '').trim().toLowerCase())
                .filter((item) => allowed.has(item))))
        })
    }

    private parseFilterCriteria(filter: string): DeviceSetFilterCriteria {
        try {
            const parsed = JSON.parse(filter || '{}') as Partial<DeviceSetFilterCriteria>
            return {
                text: String(parsed.text || '').trim().toLowerCase(),
                visibility: this.normalizeVisibilityForFilter(parsed.visibility)
            }
        } catch {
            return {
                text: String(filter || '').trim().toLowerCase(),
                visibility: []
            }
        }
    }

    private normalizeVisibilityForFilter(value: unknown): string[] {
        if (!Array.isArray(value)) {
            return []
        }
        const allowed = new Set(this.visibilityOptions.map((option) => option.value))
        return Array.from(new Set(value
            .map((item) => String(item || '').trim().toLowerCase())
            .filter((item) => allowed.has(item))))
    }

    private releaseFocusedElementBeforeDialog(): void {
        const active = document.activeElement
        if (active instanceof HTMLElement) {
            active.blur()
        }
    }
}

interface CreateDeviceSetDialogData {
    visibilityOptions: DeviceSetVisibilityOption[]
}

@Component({
    standalone: true,
    selector: 'create-device-set-dialog',
    imports: [CommonModule, FormsModule, MatButtonModule, MatDialogActions, MatDialogClose, MatDialogContent, MatDialogTitle, MatFormFieldModule, MatIconModule, MatInputModule, MatSelectModule],
    template: `
        <div class="fw-dialog-titlebar" mat-dialog-title>
            <div class="fw-dialog-titlebar__text">New Device Set</div>
            <button mat-icon-button type="button" class="fw-dialog-titlebar__close" aria-label="Cancel new device set" mat-dialog-close>
                <mat-icon>close</mat-icon>
            </button>
        </div>
        <mat-dialog-content class="create-device-set-dialog">
            <mat-form-field appearance="outline" class="create-device-set-dialog__field">
                <mat-label>Set Name</mat-label>
                <input matInput maxlength="120" [(ngModel)]="name" />
            </mat-form-field>
            <mat-form-field appearance="outline" class="create-device-set-dialog__field">
                <mat-label>Visibility</mat-label>
                <mat-select multiple [(ngModel)]="visibility">
                    <mat-option *ngFor="let option of data.visibilityOptions" [value]="option.value">{{option.label}}</mat-option>
                </mat-select>
            </mat-form-field>
        </mat-dialog-content>
        <mat-dialog-actions align="end">
            <button mat-stroked-button mat-dialog-close type="button">Cancel</button>
            <button mat-flat-button [mat-dialog-close]="{ name: name, visibility: visibility }" [disabled]="!name.trim()" type="button">Create</button>
        </mat-dialog-actions>
    `,
    styles: [`
        .create-device-set-dialog {
            width: min(520px, 88vw);
            padding-top: 12px;
        }

        .create-device-set-dialog__field {
            display: block;
            width: 100%;
            margin-bottom: 12px;
        }
    `]
})
class CreateDeviceSetDialog {
    name = ''
    visibility = ['all-users']

    constructor(
        @Inject(MAT_DIALOG_DATA) public data: CreateDeviceSetDialogData,
        public dialogRef: MatDialogRef<CreateDeviceSetDialog>
    ) {}
}

@Component({
    standalone: true,
    selector: 'confirm-device-set-delete-dialog',
    imports: [CommonModule, MatButtonModule, MatDialogActions, MatDialogClose, MatDialogContent, MatDialogTitle, MatIconModule],
    template: `
        <div class="fw-dialog-titlebar" mat-dialog-title>
            <div class="fw-dialog-titlebar__text">Delete Device Set</div>
            <button mat-icon-button type="button" class="fw-dialog-titlebar__close" aria-label="Cancel delete device set" mat-dialog-close>
                <mat-icon>close</mat-icon>
            </button>
        </div>
        <mat-dialog-content class="fw-confirmation-dialog">
            Delete <strong>{{data.name}}</strong>? This only removes the set definition and its membership list.
        </mat-dialog-content>
        <mat-dialog-actions align="end">
            <button mat-stroked-button mat-dialog-close type="button">Cancel</button>
            <button mat-flat-button color="warn" class="fw-danger-button" [mat-dialog-close]="true" type="button">Delete</button>
        </mat-dialog-actions>
    `
})
class ConfirmDeviceSetDeleteDialog {
    constructor(@Inject(MAT_DIALOG_DATA) public data: DeviceSetSummary) {}
}
