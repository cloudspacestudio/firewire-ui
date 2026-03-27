import { Component, Inject, OnInit } from "@angular/core"
import { CommonModule } from "@angular/common"
import { ActivatedRoute, Router, RouterLink } from "@angular/router"
import { FormsModule } from "@angular/forms"
import { firstValueFrom } from "rxjs"

import { HttpClient } from "@angular/common/http"

import { MatButtonModule } from "@angular/material/button"
import { MAT_DIALOG_DATA, MatDialog, MatDialogActions, MatDialogClose, MatDialogContent, MatDialogTitle } from "@angular/material/dialog"
import { MatFormFieldModule } from "@angular/material/form-field"
import { MatIconModule } from "@angular/material/icon"
import { MatInputModule } from "@angular/material/input"
import { MatSelectModule } from "@angular/material/select"
import { MatSlideToggleModule } from "@angular/material/slide-toggle"

import { PageToolbar } from "../../common/components/page-toolbar"
import { NavToolbar } from "../../common/components/nav-toolbar"
import { Category } from "../../schemas/category.schema"
import { VwDevice } from "../../schemas/vwdevice.schema"

interface ConfirmCategoryDeleteDialogData {
    name: string
}

interface CategoryDevicesDialogData {
    categoryName: string
    devices: VwDevice[]
}

@Component({
    standalone: true,
    selector: 'category-page',
    imports: [
        CommonModule,
        FormsModule,
        RouterLink,
        MatButtonModule,
        MatFormFieldModule,
        MatIconModule,
        MatInputModule,
        MatSelectModule,
        MatSlideToggleModule,
        PageToolbar,
        NavToolbar
    ],
    providers: [HttpClient],
    templateUrl: './category.page.html',
    styleUrls: ['./category.page.scss']
})
export class CategoryPage implements OnInit {
    pageWorking = true
    saveWorking = false
    deleteWorking = false
    errText?: string
    statusText = ''
    navItems = NavToolbar.DeviceNavItems
    categoryId = ''
    category: Category | null = null
    categoryDevices: VwDevice[] = []
    readonly slcOptions = [
        { value: '', label: 'None' },
        { value: 'One', label: 'One' },
        { value: 'Two', label: 'Two' },
        { value: 'MAC Address', label: 'MAC Address' }
    ]
    readonly booleanAddressOptions = [
        { value: '', label: 'No' },
        { value: 'n/a', label: 'Yes' }
    ]
    model = {
        name: '',
        shortName: '',
        handle: '',
        defaultLabor: null as number | null,
        includeOnFloorplan: false,
        slcAddress: '',
        speakerAddress: '',
        strobeAddress: ''
    }

    constructor(
        private route: ActivatedRoute,
        private http: HttpClient,
        private router: Router,
        private dialog: MatDialog
    ) {}

    ngOnInit(): void {
        this.categoryId = String(this.route.snapshot.paramMap.get('categoryId') || '').trim()
        this.loadCategory()
    }

    loadCategory() {
        if (!this.categoryId) {
            this.errText = 'Missing category id.'
            this.pageWorking = false
            return
        }

        this.pageWorking = true
        this.errText = undefined
        Promise.all([
            firstValueFrom(this.http.get<{ data?: Category }>(`/api/firewire/categories/${this.categoryId}`)),
            firstValueFrom(this.http.get<{ rows?: VwDevice[] }>(`/api/firewire/categories/${this.categoryId}/devices`))
        ]).then(([categoryResponse, devicesResponse]) => {
            this.category = categoryResponse?.data || null
            this.categoryDevices = Array.isArray(devicesResponse?.rows) ? devicesResponse.rows : []
            this.model = {
                name: String(this.category?.name || ''),
                shortName: String(this.category?.shortName || ''),
                handle: String(this.category?.handle || ''),
                defaultLabor: typeof this.category?.defaultLabor === 'number' ? Number(this.category.defaultLabor) : null,
                includeOnFloorplan: !!this.category?.includeOnFloorplan,
                slcAddress: String(this.category?.slcAddress || ''),
                speakerAddress: String(this.category?.speakerAddress || ''),
                strobeAddress: String(this.category?.strobeAddress || '')
            }
            this.pageWorking = false
        }).catch((err: any) => {
            this.errText = err?.error?.message || err?.message || 'Unable to load category.'
            this.pageWorking = false
        })
    }

    saveChanges() {
        const name = String(this.model.name || '').trim()
        const shortName = String(this.model.shortName || '').trim()
        const handle = String(this.model.handle || '').trim()
        if (!this.categoryId || !name || !shortName || !handle) {
            this.statusText = 'Name, short name, and handle are required.'
            return
        }

        this.saveWorking = true
        this.statusText = `Saving ${name}...`
        this.http.patch(`/api/firewire/categories/${this.categoryId}`, {
            categoryId: this.categoryId,
            name,
            shortName,
            handle,
            defaultLabor: this.model.defaultLabor,
            includeOnFloorplan: this.model.includeOnFloorplan,
            slcAddress: this.model.slcAddress,
            speakerAddress: this.model.speakerAddress,
            strobeAddress: this.model.strobeAddress
        }).subscribe({
            next: () => {
                this.statusText = `${name} saved.`
                this.saveWorking = false
                this.loadCategory()
            },
            error: (err: any) => {
                this.saveWorking = false
                this.statusText = err?.error?.message || err?.message || 'Unable to save category.'
            }
        })
    }

    resetChanges() {
        this.statusText = 'Resetting unsaved changes...'
        this.loadCategory()
    }

    async deleteCategory() {
        if (!this.category) {
            return
        }
        if (this.categoryDevices.length > 0) {
            this.statusText = `Delete blocked: ${this.category.name} is still assigned to ${this.categoryDevices.length} device${this.categoryDevices.length === 1 ? '' : 's'}.`
            return
        }

        const dialogRef = this.dialog.open(ConfirmCategoryDeleteDialog, {
            width: '360px',
            maxWidth: '88vw',
            panelClass: 'fw-compact-dialog-pane',
            data: {
                name: this.category.name
            }
        })
        const confirmed = await firstValueFrom(dialogRef.afterClosed())
        if (!confirmed) {
            return
        }

        this.deleteWorking = true
        this.statusText = `Deleting ${this.category.name}...`
        this.http.delete(`/api/firewire/categories/${this.categoryId}`).subscribe({
            next: () => {
                this.router.navigate(['/categories'])
            },
            error: (err: any) => {
                this.deleteWorking = false
                this.statusText = err?.error?.message || err?.message || 'Unable to delete category.'
            }
        })
    }

    openDevicesDialog() {
        this.dialog.open(CategoryDevicesDialog, {
            width: '760px',
            maxWidth: '96vw',
            data: {
                categoryName: this.category?.name || 'Category',
                devices: this.categoryDevices
            } satisfies CategoryDevicesDialogData
        })
    }
}

@Component({
    standalone: true,
    selector: 'confirm-category-delete-dialog',
    imports: [CommonModule, MatButtonModule, MatDialogActions, MatDialogClose, MatDialogContent, MatDialogTitle],
    template: `
        <h2 mat-dialog-title>Delete Category</h2>
        <mat-dialog-content>
            Delete <strong>{{data.name}}</strong>? This cannot be undone.
        </mat-dialog-content>
        <mat-dialog-actions align="end">
            <button mat-stroked-button mat-dialog-close type="button">Cancel</button>
            <button mat-flat-button color="warn" [mat-dialog-close]="true" type="button">Delete</button>
        </mat-dialog-actions>
    `
})
class ConfirmCategoryDeleteDialog {
    constructor(@Inject(MAT_DIALOG_DATA) public data: ConfirmCategoryDeleteDialogData) {}
}

@Component({
    standalone: true,
    selector: 'category-devices-dialog',
    imports: [CommonModule, MatButtonModule, MatDialogActions, MatDialogClose, MatDialogContent, MatDialogTitle],
    template: `
        <h2 mat-dialog-title>Devices Using {{data.categoryName}}</h2>
        <mat-dialog-content>
            <div class="category-devices-dialog__list" *ngIf="data.devices.length > 0; else noDevices">
                <div class="category-devices-dialog__row" *ngFor="let row of data.devices">
                    <div class="category-devices-dialog__title">{{row.name}}</div>
                    <div class="category-devices-dialog__meta">{{row.partNumber}} · {{row.vendorName}}</div>
                </div>
            </div>
            <ng-template #noDevices>
                <div>No devices are currently using this category.</div>
            </ng-template>
        </mat-dialog-content>
        <mat-dialog-actions align="end">
            <button mat-stroked-button mat-dialog-close type="button">Close</button>
        </mat-dialog-actions>
    `,
    styles: [`
        .category-devices-dialog__list {
            display: grid;
            gap: 10px;
            min-width: min(680px, 100%);
        }

        .category-devices-dialog__row {
            padding: 10px 12px;
            border: 1px solid rgba(72, 221, 255, 0.16);
            border-radius: 14px;
            background: linear-gradient(180deg, rgba(17, 37, 58, 0.7), rgba(10, 19, 33, 0.92));
        }

        .category-devices-dialog__meta {
            color: var(--fw-muted);
        }
    `]
})
class CategoryDevicesDialog {
    constructor(@Inject(MAT_DIALOG_DATA) public data: CategoryDevicesDialogData) {}
}
