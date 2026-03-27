import { Component, OnInit, AfterViewInit, ViewChild, inject } from "@angular/core"
import { RouterLink } from "@angular/router"
import { FormsModule } from "@angular/forms"
import { firstValueFrom } from "rxjs"

import { HttpClient } from "@angular/common/http"
import { CommonModule } from "@angular/common"

import { MatButtonModule } from "@angular/material/button"
import { MatDialog, MAT_DIALOG_DATA, MatDialogActions, MatDialogClose, MatDialogContent, MatDialogTitle } from "@angular/material/dialog"
import { MatIconModule } from "@angular/material/icon"
import {MatPaginator, MatPaginatorModule} from '@angular/material/paginator';
import {MatSort, MatSortModule} from '@angular/material/sort';
import {MatTableDataSource, MatTableModule} from '@angular/material/table';
import {MatInputModule} from '@angular/material/input';
import {MatFormFieldModule} from '@angular/material/form-field';

import { PageToolbar } from '../../common/components/page-toolbar';
import { Vendor } from "../../schemas/vendor.schema"
import { NavToolbar } from "../../common/components/nav-toolbar"
import { VendorImportConfig } from "../../schemas/vendor-import-config.schema"

@Component({
    standalone: true,
    selector: 'vendors-page',
    imports: [CommonModule, FormsModule, MatButtonModule, 
        RouterLink, 
        MatPaginatorModule, MatSortModule,
        MatTableModule, MatInputModule,
        MatFormFieldModule,
        MatIconModule, PageToolbar, NavToolbar],
    providers: [HttpClient],
    templateUrl: './vendors.page.html',
    styleUrls: ['./vendors.page.scss']
})
export class VendorsPage implements OnInit, AfterViewInit  {
    displayedColumns: string[] = ['logo', 'name', 'desc', 'link', 'actions'];

    @ViewChild(MatPaginator) paginator?: MatPaginator;
    @ViewChild(MatSort) sort?: MatSort;

    pageWorking = true
    vendors: Vendor[] = []
    navItems = NavToolbar.DeviceNavItems
    errText?: string
    statusText = ''
    editingVendorId: string | null = null
    saveWorking = false
    editModel: Vendor = this.createEmptyVendor()

    datasource: MatTableDataSource<Vendor> = new MatTableDataSource(this.vendors);
    
    constructor(private http: HttpClient, private dialog: MatDialog) {}

    ngOnInit(): void {
        this.loadVendors()
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

    isEditing(row: Vendor): boolean {
        return this.editingVendorId === row.vendorId
    }

    startEdit(row: Vendor) {
        if (this.saveWorking) {
            return
        }

        this.editingVendorId = row.vendorId
        this.editModel = { ...row }
        this.statusText = ''
    }

    cancelEdit() {
        if (this.saveWorking) {
            return
        }

        this.editingVendorId = null
        this.editModel = this.createEmptyVendor()
        this.statusText = ''
    }

    async saveEdit() {
        if (!this.editingVendorId || this.saveWorking) {
            return
        }

        this.saveWorking = true
        this.statusText = `Saving ${this.editModel.name || 'vendor'}...`

        const vendorId = this.editingVendorId
        const payload = {
            vendorId,
            name: this.editModel.name,
            desc: this.editModel.desc,
            link: this.editModel.link
        }

        const attempts: Array<() => Promise<unknown>> = [
            () => firstValueFrom(this.http.patch(`/api/firewire/vendors/${vendorId}`, payload)),
            () => firstValueFrom(this.http.patch(`/api/firewire/vendor/${vendorId}`, payload)),
            () => firstValueFrom(this.http.put(`/api/firewire/vendors/${vendorId}`, payload)),
            () => firstValueFrom(this.http.put(`/api/firewire/vendor/${vendorId}`, payload))
        ]

        let lastError: any = null

        for (const attempt of attempts) {
            try {
                await attempt()
                const index = this.vendors.findIndex((row) => row.vendorId === this.editingVendorId)
                if (index >= 0) {
                    this.vendors[index] = { ...this.editModel }
                    this.datasource.data = [...this.vendors]
                }
                this.saveWorking = false
                this.statusText = `${this.editModel.name || 'Vendor'} saved.`
                this.editingVendorId = null
                this.editModel = this.createEmptyVendor()
                return
            } catch (err: any) {
                lastError = err
                if (err?.status !== 404) {
                    break
                }
            }
        }

        this.saveWorking = false
        this.statusText = lastError?.error?.message || lastError?.message || 'Unable to save vendor.'
    }

    async openImportConfig(row: Vendor) {
        if (this.saveWorking) {
            return
        }

        try {
            const response = await firstValueFrom(this.http.get<{ data?: VendorImportConfig }>(`/api/firewire/vendors/${row.vendorId}/import-config`))
            const dialogRef = this.dialog.open(VendorImportConfigDialog, {
                width: '820px',
                maxWidth: '96vw',
                data: {
                    vendor: row,
                    config: response?.data || null
                }
            })
            const result = await firstValueFrom(dialogRef.afterClosed())
            if (!result) {
                return
            }

            this.statusText = `Saving import config for ${row.name}...`
            await firstValueFrom(this.http.patch(`/api/firewire/vendors/${row.vendorId}/import-config`, {
                config: result
            }))
            this.statusText = `${row.name} import config saved.`
            this.loadVendors()
        } catch (err: any) {
            this.statusText = err?.error?.message || err?.message || 'Unable to update import config.'
        }
    }

    async onLogoSelected(row: Vendor, event: Event) {
        const input = event.target as HTMLInputElement
        const file = input.files && input.files.length > 0 ? input.files[0] : null
        if (!file) {
            return
        }

        this.statusText = `Uploading logo for ${row.name}...`

        try {
            const formData = new FormData()
            formData.append('file', file)
            const response = await firstValueFrom(this.http.post<{ data?: { logoFileName?: string | null, logoDataUrl?: string | null } }>(`/api/firewire/vendors/${row.vendorId}/logo`, formData))
            const index = this.vendors.findIndex((vendor) => vendor.vendorId === row.vendorId)
            if (index >= 0) {
                this.vendors[index] = {
                    ...this.vendors[index],
                    logoFileName: response?.data?.logoFileName ?? file.name,
                    logoDataUrl: response?.data?.logoDataUrl ?? this.vendors[index].logoDataUrl ?? null
                }
                this.datasource.data = [...this.vendors]
            }
            this.statusText = `${row.name} logo uploaded.`
        } catch (err: any) {
            this.statusText = err?.error?.message || err?.message || 'Unable to upload vendor logo.'
        } finally {
            input.value = ''
        }
    }

    private loadVendors() {
        this.vendors = []
        this.pageWorking = true
        this.errText = undefined

        this.http.get('/api/firewire/vendors').subscribe({
            next: (s: any) => {
                if (s && s.rows) {
                    this.vendors = [...s.rows]
                    this.datasource = new MatTableDataSource(this.vendors)
                    this.datasource.paginator = this.paginator || null
                    this.datasource.sort = this.sort || null
                    this.pageWorking = false
                    return
                }

                this.vendors = []
                this.datasource.data = []
                this.pageWorking = false
            },
            error: (err: Error) => {
                this.errText = err.message
                console.dir(err)
                this.pageWorking = false
            }
        })
    }

    private createEmptyVendor(): Vendor {
        return {
            vendorId: '',
            name: '',
            desc: '',
            link: '',
            logoFileName: null,
            logoDataUrl: null
        }
    }
}

interface VendorImportConfigDialogData {
    vendor: Vendor
    config: VendorImportConfig | null
}

@Component({
    standalone: true,
    imports: [CommonModule, FormsModule, MatButtonModule, MatDialogActions, MatDialogClose, MatDialogContent, MatDialogTitle, MatFormFieldModule, MatInputModule],
    template: `
        <div mat-dialog-title>Import Config</div>
        <mat-dialog-content>
            <div class="vendor-import-config__stack">
                <p class="vendor-import-config__intro">{{data.vendor.name}} import rules are stored with the vendor so future CSV loads can be verified and normalized consistently.</p>
                <mat-form-field>
                    <mat-label>Vendor Key</mat-label>
                    <input matInput [(ngModel)]="partsVendorKey" />
                </mat-form-field>
                <mat-form-field>
                    <mat-label>Source Label</mat-label>
                    <input matInput [(ngModel)]="sourceLabel" />
                </mat-form-field>
                <mat-form-field>
                    <mat-label>Target Table</mat-label>
                    <input matInput [(ngModel)]="targetTable" />
                </mat-form-field>
                <mat-form-field>
                    <mat-label>File Pattern</mat-label>
                    <input matInput [(ngModel)]="filePattern" />
                </mat-form-field>
                <mat-form-field>
                    <mat-label>Expected Headers</mat-label>
                    <textarea matInput rows="6" [(ngModel)]="expectedHeadersText"></textarea>
                </mat-form-field>
                <mat-form-field>
                    <mat-label>Header Map JSON</mat-label>
                    <textarea matInput rows="10" [(ngModel)]="headerMapText"></textarea>
                </mat-form-field>
                <mat-form-field>
                    <mat-label>Column Types JSON</mat-label>
                    <textarea matInput rows="8" [(ngModel)]="columnTypesText"></textarea>
                </mat-form-field>
                <mat-form-field>
                    <mat-label>Normalization Steps</mat-label>
                    <textarea matInput rows="6" [(ngModel)]="normalizationStepsText"></textarea>
                </mat-form-field>
                <mat-form-field>
                    <mat-label>Analysis Summary</mat-label>
                    <textarea matInput rows="6" [(ngModel)]="analysisSummaryText"></textarea>
                </mat-form-field>
                <mat-form-field>
                    <mat-label>Verified Sample File</mat-label>
                    <input matInput [(ngModel)]="verifiedSampleFile" />
                </mat-form-field>
                <mat-form-field>
                    <mat-label>Verified On</mat-label>
                    <input matInput [(ngModel)]="verifiedOn" />
                </mat-form-field>
                <div *ngIf="parseError" class="vendor-import-config__error">{{parseError}}</div>
            </div>
        </mat-dialog-content>
        <mat-dialog-actions align="end">
            <button mat-button mat-dialog-close type="button">Cancel</button>
            <button mat-flat-button type="button" [mat-dialog-close]="getResult()" [disabled]="!canSave()">Save Config</button>
        </mat-dialog-actions>
    `,
    styles: [`
        .vendor-import-config__stack { display: grid; gap: 12px; min-width: min(720px, 100%); }
        .vendor-import-config__intro { margin: 0; color: var(--fw-muted); }
        .vendor-import-config__error { color: #ff9d9d; font-size: 0.84rem; }
    `]
})
export class VendorImportConfigDialog {
    readonly data = inject<VendorImportConfigDialogData>(MAT_DIALOG_DATA)

    partsVendorKey = this.data.config?.partsVendorKey || ''
    sourceLabel = this.data.config?.sourceLabel || ''
    targetTable = this.data.config?.targetTable || 'EddyPricelist'
    filePattern = this.data.config?.filePattern || '*.csv'
    expectedHeadersText = (this.data.config?.expectedHeaders || []).join('\n')
    headerMapText = JSON.stringify(this.data.config?.headerMap || {}, null, 2)
    columnTypesText = JSON.stringify(this.data.config?.columnTypes || {}, null, 2)
    normalizationStepsText = (this.data.config?.normalizationSteps || []).join('\n')
    analysisSummaryText = (this.data.config?.analysisSummary || []).join('\n')
    verifiedSampleFile = this.data.config?.verifiedSampleFile || ''
    verifiedOn = this.data.config?.verifiedOn || ''
    parseError = ''

    canSave(): boolean {
        return !!this.partsVendorKey.trim() && !!this.sourceLabel.trim() && !!this.targetTable.trim()
    }

    getResult(): VendorImportConfig | null {
        if (!this.canSave()) {
            return null
        }

        try {
            this.parseError = ''
            return {
                partsVendorKey: this.partsVendorKey.trim(),
                sourceLabel: this.sourceLabel.trim(),
                targetTable: this.targetTable.trim(),
                filePattern: this.filePattern.trim() || '*.csv',
                expectedHeaders: this.expectedHeadersText.split('\n').map((value) => value.trim()).filter(Boolean),
                headerMap: JSON.parse(this.headerMapText || '{}'),
                columnTypes: JSON.parse(this.columnTypesText || '{}'),
                normalizationSteps: this.normalizationStepsText.split('\n').map((value) => value.trim()).filter(Boolean),
                analysisSummary: this.analysisSummaryText.split('\n').map((value) => value.trim()).filter(Boolean),
                verifiedSampleFile: this.verifiedSampleFile.trim() || undefined,
                verifiedOn: this.verifiedOn.trim() || undefined,
                replaceMode: 'truncate-and-load',
                snapshotTable: this.data.config?.snapshotTable || 'vendorImportSnapshots'
            }
        } catch (err: any) {
            this.parseError = err?.message || 'Invalid JSON in header map or column types.'
            return null
        }
    }
}
