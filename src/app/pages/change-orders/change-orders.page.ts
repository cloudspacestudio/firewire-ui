import { Component, ElementRef, Input, ViewChild, OnChanges, AfterViewInit, inject } from "@angular/core"
import { CommonModule } from "@angular/common"
import { HttpClient } from "@angular/common/http"
import { ActivatedRoute, RouterLink } from "@angular/router"
import { FormsModule } from "@angular/forms"
import { firstValueFrom } from "rxjs"

import { MatButtonModule } from "@angular/material/button"
import { MatIconModule } from "@angular/material/icon"
import { MatCardModule } from "@angular/material/card"
import {
    MAT_DIALOG_DATA,
    MatDialog,
    MatDialogActions,
    MatDialogClose,
    MatDialogContent,
    MatDialogRef,
    MatDialogTitle
} from "@angular/material/dialog"

import { PageToolbar } from "../../common/components/page-toolbar"
import { AuthService } from "../../auth/auth.service"
import { AccountProjectSchema } from "../../schemas/account.project.schema"
import { ProjectListItemSchema } from "../../schemas/project-list-item.schema"
import {
    ProjectDocLibraryFileRecord,
    ProjectDocLibraryWorkspaceState,
    ProjectDocLibraryStorageService
} from "../../common/services/project-doc-library-storage.service"

interface ChangeOrderListItem {
    id: string
    name: string
    amount: number
    status: string
    createdAt: string
    fileId: string
}

interface ChangeOrderDialogData {
    defaultFileName: string
    projectName: string
    contractorName: string
    contractNumber: string
    projectNumber: string
    firetrolJobNumber: string
    firetrolAcceptanceDate: string
    createdBy: string
    createSheet?: (fileName: string, html: string) => Promise<void> | void
}

@Component({
    standalone: true,
    selector: 'change-orders-page',
    imports: [
        CommonModule,
        FormsModule,
        RouterLink,
        MatButtonModule,
        MatIconModule,
        MatCardModule,
        PageToolbar
    ],
    providers: [HttpClient],
    templateUrl: './change-orders.page.html',
    styleUrls: ['./change-orders.page.scss']
})
export class ChangeOrdersPage implements OnChanges {
    @Input() projectId?: string

    private readonly route = inject(ActivatedRoute)
    private readonly dialog = inject(MatDialog)
    private readonly projectDocLibraryStorage = inject(ProjectDocLibraryStorageService)
    private readonly auth = inject(AuthService)

    pageWorking = true
    pageMessage = ''
    backLink = '/projects'
    detailsLink = '/projects'
    project?: AccountProjectSchema
    firewireProjectNbr = ''
    changeOrders: ChangeOrderListItem[] = []

    constructor(private http: HttpClient) {}

    ngOnChanges(): void {
        this.pageWorking = true
        this.pageMessage = ''
        this.project = undefined
        this.firewireProjectNbr = ''
        this.changeOrders = []
        this.backLink = '/projects'
        this.detailsLink = this.route.snapshot.queryParamMap.get('returnTo') || (this.projectId ? `/projects/fieldwire/${this.projectId}/project-details` : '/projects')

        if (!this.projectId) {
            this.pageMessage = 'Invalid project id.'
            this.pageWorking = false
            return
        }

        this.http.get(`/api/fieldwire/projects/${this.projectId}`).subscribe({
            next: async(response: any) => {
                this.project = response?.data ? { ...response.data } : undefined
                await this.loadLinkedFirewireProjectNumber()
                await this.loadChangeOrders()
                this.pageWorking = false
            },
            error: (err: any) => {
                this.pageMessage = err?.error?.message || err?.message || 'Unable to load project.'
                this.pageWorking = false
            }
        })
    }

    async createChangeOrder(): Promise<void> {
        const profile = this.auth.getUserProfile()
        const dialogRef = this.dialog.open(ChangeOrderDialog, {
            width: '1080px',
            maxWidth: '96vw',
            minWidth: '0',
            panelClass: 'job-cost-sheet-dialog-pane',
            data: {
                defaultFileName: this.buildChangeOrderFileName(),
                projectName: this.project?.name || '',
                contractorName: '',
                contractNumber: '',
                projectNumber: this.firewireProjectNbr || this.project?.code || '',
                firetrolJobNumber: this.project?.code || '',
                firetrolAcceptanceDate: this.formatToday(),
                createdBy: profile?.name || 'Current User',
                createSheet: (fileName: string, html: string) => this.saveChangeOrderSheet(fileName, html)
            } as ChangeOrderDialogData
        })

        const result = await firstValueFrom(dialogRef.afterClosed())
        if (result === 'created') {
            await this.loadChangeOrders()
        }
    }

    async downloadChangeOrder(item: ChangeOrderListItem): Promise<void> {
        const workspace = await this.loadWorkspace()
        const file = workspace.files.find((entry) => entry.id === item.fileId)
        const latestVersion = file?.versions?.[file.versions.length - 1]
        if (!latestVersion) {
            return
        }

        const blob = this.dataUrlToBlob(latestVersion.dataUrl)
        const objectUrl = URL.createObjectURL(blob)
        const anchor = document.createElement('a')
        anchor.href = objectUrl
        anchor.download = latestVersion.sourceFileName || file?.name || item.name
        anchor.click()
        URL.revokeObjectURL(objectUrl)
    }

    private async loadChangeOrders(): Promise<void> {
        const workspace = await this.loadWorkspace()
        this.changeOrders = workspace.files
            .filter((file) => file.folderId === 'change-orders')
            .map((file) => {
                const latestVersion = file.versions[file.versions.length - 1]
                return {
                    id: file.id,
                    fileId: file.id,
                    name: file.name.replace(/\.html$/i, ''),
                    amount: this.extractChangeOrderAmount(latestVersion?.dataUrl || ''),
                    status: file.versions.length > 1 ? `Version ${file.versions.length}` : 'Created',
                    createdAt: latestVersion?.uploadedAt || file.createdAt
                }
            })
            .sort((left, right) => String(right.createdAt).localeCompare(String(left.createdAt)))
    }

    private async saveChangeOrderSheet(fileName: string, html: string): Promise<void> {
        const workspace = await this.loadWorkspace()
        const normalizedFileName = this.ensureHtmlFileName(fileName)
        const now = new Date().toISOString()
        const dataUrl = this.textToDataUrl(html, 'text/html')
        const existing = workspace.files.find((file) =>
            file.folderId === 'change-orders'
            && file.name.toLowerCase() === normalizedFileName.toLowerCase())

        if (existing) {
            existing.versions.push({
                id: this.createId(),
                versionNumber: existing.versions.length + 1,
                uploadedAt: now,
                uploadedBy: 'Current User',
                sourceFileName: normalizedFileName,
                sizeBytes: new Blob([html], { type: 'text/html' }).size,
                mimeType: 'text/html',
                lastModified: Date.now(),
                dataUrl
            })
            existing.updatedAt = now
        } else {
            workspace.files.push({
                id: this.createId(),
                folderId: 'change-orders',
                name: normalizedFileName,
                extension: 'html',
                createdAt: now,
                updatedAt: now,
                versions: [
                    {
                        id: this.createId(),
                        versionNumber: 1,
                        uploadedAt: now,
                        uploadedBy: 'Current User',
                        sourceFileName: normalizedFileName,
                        sizeBytes: new Blob([html], { type: 'text/html' }).size,
                        mimeType: 'text/html',
                        lastModified: Date.now(),
                        dataUrl
                    }
                ]
            })
        }

        await this.projectDocLibraryStorage.saveWorkspace(this.getStorageKey(), workspace)
    }

    private getStorageKey(): string {
        return this.getStorageKeys()[0] || 'UNASSIGNED'
    }

    private getStorageKeys(): string[] {
        const candidates = [
            this.projectId,
            this.project?.id,
            this.firewireProjectNbr
        ]

        const seen = new Set<string>()
        return candidates
            .map((value) => String(value || '').trim())
            .filter((value) => {
                if (!value || seen.has(value)) {
                    return false
                }
                seen.add(value)
                return true
            })
    }

    private async loadWorkspace(): Promise<ProjectDocLibraryWorkspaceState> {
        const workspaces = await Promise.all(this.getStorageKeys().map((key) => this.projectDocLibraryStorage.loadWorkspace(key)))
        return {
            files: this.mergeFiles(workspaces.flatMap((workspace) => workspace.files || []))
        }
    }

    private mergeFiles(files: ProjectDocLibraryFileRecord[]): ProjectDocLibraryFileRecord[] {
        const byKey = new Map<string, ProjectDocLibraryFileRecord>()

        for (const file of files) {
            const fileKey = `${String(file.folderId || '').toLowerCase()}::${String(file.name || '').toLowerCase()}`
            const existing = byKey.get(fileKey)
            if (!existing) {
                byKey.set(fileKey, {
                    ...file,
                    versions: [...(file.versions || [])]
                })
                continue
            }

            const mergedVersions = [...(existing.versions || []), ...(file.versions || [])]
            const seenVersionIds = new Set<string>()
            existing.versions = mergedVersions.filter((version) => {
                const versionKey = String(version?.id || `${version?.uploadedAt || ''}:${version?.sourceFileName || ''}:${version?.versionNumber || ''}`)
                if (seenVersionIds.has(versionKey)) {
                    return false
                }
                seenVersionIds.add(versionKey)
                return true
            }).sort((left, right) => Number(left?.versionNumber || 0) - Number(right?.versionNumber || 0))

            existing.createdAt = String(existing.createdAt || '') <= String(file.createdAt || '') ? existing.createdAt : file.createdAt
            existing.updatedAt = String(existing.updatedAt || '') >= String(file.updatedAt || '') ? existing.updatedAt : file.updatedAt
        }

        return [...byKey.values()]
    }

    private buildChangeOrderFileName(): string {
        const projectKey = (this.firewireProjectNbr || this.project?.code || this.project?.name || 'Project').trim()
        return `${projectKey} - Change Order.html`
    }

    private async loadLinkedFirewireProjectNumber(): Promise<void> {
        if (!this.projectId) {
            this.firewireProjectNbr = ''
            return
        }

        try {
            const response = await firstValueFrom(this.http.get<{ rows?: ProjectListItemSchema[] }>('/api/firewire/projects'))
            const match = (response?.rows || []).find((row) => String(row.fieldwireProjectId || '') === String(this.projectId || ''))
            this.firewireProjectNbr = String(match?.projectNbr || '').trim()
        } catch {
            this.firewireProjectNbr = ''
        }
    }

    private formatToday(): string {
        return new Date().toLocaleDateString()
    }

    private ensureHtmlFileName(fileName: string): string {
        const trimmed = (fileName || '').trim() || 'Change Order.html'
        return trimmed.toLowerCase().endsWith('.html') ? trimmed : `${trimmed}.html`
    }

    private textToDataUrl(content: string, mimeType: string): string {
        const utf8 = encodeURIComponent(content).replace(/%([0-9A-F]{2})/g, (_, hex: string) =>
            String.fromCharCode(parseInt(hex, 16)))
        return `data:${mimeType};base64,${btoa(utf8)}`
    }

    private dataUrlToBlob(dataUrl: string): Blob {
        const commaIndex = dataUrl.indexOf(',')
        const header = commaIndex >= 0 ? dataUrl.slice(0, commaIndex) : ''
        const base64 = commaIndex >= 0 ? dataUrl.slice(commaIndex + 1) : dataUrl
        const mimeTypeMatch = header.match(/data:(.*?);base64/)
        const mimeType = mimeTypeMatch ? mimeTypeMatch[1] : 'application/octet-stream'
        const binary = atob(base64)
        const bytes = new Uint8Array(binary.length)
        for (let i = 0; i < binary.length; i += 1) {
            bytes[i] = binary.charCodeAt(i)
        }
        return new Blob([bytes], { type: mimeType })
    }

    private createId(): string {
        if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
            return crypto.randomUUID()
        }
        return `${Date.now()}-${Math.random().toString(16).slice(2)}`
    }

    private extractChangeOrderAmount(dataUrl: string): number {
        if (!dataUrl) {
            return 0
        }

        try {
            const commaIndex = dataUrl.indexOf(',')
            const base64 = commaIndex >= 0 ? dataUrl.slice(commaIndex + 1) : dataUrl
            const decoded = atob(base64)
            const amountMatch = decoded.match(/Change Order Total<\/span>\s*<input[^>]*value=\"([^\"]*)\"/i)
            const rawAmount = amountMatch?.[1]?.replace(/[^0-9.-]+/g, '') || ''
            const parsed = Number(rawAmount)
            return Number.isFinite(parsed) ? parsed : 0
        } catch {
            return 0
        }
    }
}

@Component({
    standalone: true,
    selector: 'change-order-dialog',
    imports: [
        CommonModule,
        FormsModule,
        MatDialogTitle,
        MatDialogContent,
        MatDialogActions,
        MatDialogClose,
        MatButtonModule,
        MatIconModule
    ],
    template: `
        <div mat-dialog-title class="change-order-dialog__titlebar">
            <div>
                <div class="change-order-dialog__kicker">Project Forms</div>
                <div class="change-order-dialog__title">Change Order</div>
            </div>
            <button mat-icon-button type="button" aria-label="Close dialog" mat-dialog-close>
                <mat-icon>close</mat-icon>
            </button>
        </div>
        <mat-dialog-content class="change-order-dialog">
            <div class="change-order-dialog__toolbar">
                <div class="change-order-dialog__eyebrow">Change Order Preview</div>
            </div>

            <div class="change-order-paper">
                <div #printRoot class="change-order-paper__inner">
                    <div class="change-order-paper__brand">
                        <div class="change-order-paper__heading">Change Order</div>
                        <div>FireTrol Protection Systems</div>
                        <div>11111 Landmark 35 Drive</div>
                        <div>San Antonio, Texas 78233</div>
                    </div>

                    <div class="change-order-paper__top-grid">
                        <div class="change-order-paper__panel">
                            <label class="change-order-paper__field change-order-paper__field--full"><span>Project Name</span><input [(ngModel)]="editable.projectName" /></label>
                            <label class="change-order-paper__field"><span>County</span><input [(ngModel)]="editable.county" /></label>
                            <label class="change-order-paper__field"><span>Contractor Name</span><input [(ngModel)]="editable.contractorName" /></label>
                        </div>
                        <div class="change-order-paper__panel">
                            <div class="change-order-paper__field-grid">
                                <label class="change-order-paper__field"><span>Contract No.</span><input [(ngModel)]="editable.contractNumber" /></label>
                                <label class="change-order-paper__field"><span>Project No.</span><input [(ngModel)]="editable.projectNumber" /></label>
                                <label class="change-order-paper__field"><span>Change Order No.</span><input [(ngModel)]="editable.changeOrderNumber" /></label>
                                <label class="change-order-paper__field"><span>Phase</span><input [(ngModel)]="editable.phase" /></label>
                                <label class="change-order-paper__field"><span>I.D. No.</span><input [(ngModel)]="editable.idNumber" /></label>
                                <label class="change-order-paper__field"><span>Firetrol Job#</span><input [(ngModel)]="editable.firetrolJobNumber" /></label>
                            </div>
                        </div>
                    </div>

                    <div class="change-order-paper__section">
                        <div class="change-order-paper__section-title">Basis Of Change Order</div>
                        <div class="change-order-paper__checkbox-grid">
                            <label><input type="checkbox" [(ngModel)]="editable.errorOmission" /> Error/Omission</label>
                            <label><input type="checkbox" [(ngModel)]="editable.differingCondition" /> Differing Condition</label>
                            <label><input type="checkbox" [(ngModel)]="editable.ownerRequest" /> Owner Request</label>
                            <label><input type="checkbox" [(ngModel)]="editable.fieldResolution" /> Field Resolution</label>
                            <label><input type="checkbox" [(ngModel)]="editable.valueEngineering" /> Value Engineering</label>
                            <label><input type="checkbox" [(ngModel)]="editable.otherSelected" /> Other</label>
                        </div>
                    </div>

                    <div class="change-order-paper__mid-grid">
                        <div class="change-order-paper__panel">
                            <label class="change-order-paper__field"><span>Current Completion Date</span><input [(ngModel)]="editable.currentCompletionDate" /></label>
                            <label class="change-order-paper__field"><span>Contract Days Changed</span><input [(ngModel)]="editable.contractDaysChanged" /></label>
                            <label class="change-order-paper__field"><span>Revised Completion Date</span><input [(ngModel)]="editable.revisedCompletionDate" /></label>
                        </div>
                        <div class="change-order-paper__panel">
                            <label class="change-order-paper__field"><span>Type of Contract</span><input [(ngModel)]="editable.contractType" /></label>
                            <label class="change-order-paper__field"><span>Encumbrance Number</span><input [(ngModel)]="editable.encumbranceNumber" /></label>
                            <label class="change-order-paper__field"><span>Change Order Total</span><input [(ngModel)]="editable.changeOrderTotal" /></label>
                        </div>
                    </div>

                    <div class="change-order-paper__section">
                        <div class="change-order-paper__section-title">Description / Justification</div>
                        <textarea class="change-order-paper__textarea" [(ngModel)]="editable.description"></textarea>
                    </div>

                    <div class="change-order-paper__acceptance">
                        <div class="change-order-paper__acceptance-panel">
                            <div class="change-order-paper__section-title">Contractor Acceptance</div>
                            <label class="change-order-paper__field"><span>Name</span><input [(ngModel)]="editable.contractorAcceptanceName" /></label>
                            <label class="change-order-paper__field"><span>Address</span><input [(ngModel)]="editable.contractorAcceptanceAddress" /></label>
                            <label class="change-order-paper__field"><span>Signature</span><input [(ngModel)]="editable.contractorAcceptanceSignature" /></label>
                            <label class="change-order-paper__field"><span>Date</span><input [(ngModel)]="editable.contractorAcceptanceDate" /></label>
                        </div>
                        <div class="change-order-paper__acceptance-panel">
                            <div class="change-order-paper__section-title">Firetrol Protection Systems</div>
                            <label class="change-order-paper__field"><span>Name</span><input [(ngModel)]="editable.firetrolAcceptanceName" /></label>
                            <label class="change-order-paper__field"><span>Address</span><input [(ngModel)]="editable.firetrolAcceptanceAddress" /></label>
                            <label class="change-order-paper__field"><span>Signature</span><input [(ngModel)]="editable.firetrolAcceptanceSignature" /></label>
                            <label class="change-order-paper__field"><span>Date</span><input [(ngModel)]="editable.firetrolAcceptanceDate" /></label>
                        </div>
                    </div>
                </div>
            </div>
        </mat-dialog-content>
        <mat-dialog-actions align="end" class="change-order-dialog__footer">
            <div class="change-order-dialog__footer-status" *ngIf="statusText">{{statusText}}</div>
            <button mat-flat-button type="button" (click)="createSheet()" [disabled]="saveWorking">
                <mat-icon fontIcon="description"></mat-icon>
                {{saveWorking ? 'Saving...' : 'Create Change Order'}}
            </button>
            <button mat-stroked-button type="button" (click)="printSheet()">
                <mat-icon fontIcon="print"></mat-icon>
                Print Sheet
            </button>
            <button mat-button type="button" mat-dialog-close>Close</button>
        </mat-dialog-actions>
    `,
    styles: [`
        .change-order-dialog__titlebar{display:flex;align-items:center;justify-content:space-between;padding:18px 22px 10px;border-bottom:1px solid rgba(72,221,255,.12);background:radial-gradient(circle at 0% 0%,rgba(72,221,255,.08),transparent 34%),radial-gradient(circle at 100% 0%,rgba(255,164,61,.08),transparent 32%),#0a1019}
        .change-order-dialog__kicker,.change-order-dialog__eyebrow{color:rgba(177,213,228,.72);font-size:.72rem;letter-spacing:.16em;text-transform:uppercase}
        .change-order-dialog__title{margin-top:6px;color:#f4fbff;font-size:1.08rem;font-weight:700;letter-spacing:.08em;text-transform:uppercase}
        .change-order-dialog{width:100%;display:grid;gap:16px;padding:10px 0 0;box-sizing:border-box;overflow-x:hidden;background:linear-gradient(180deg,rgba(255,255,255,.02),rgba(255,255,255,0)),#0b111b}
        .change-order-dialog__toolbar{display:flex;align-items:center;justify-content:space-between;gap:14px}
        .change-order-paper{border:1px solid rgba(72,221,255,.16);border-radius:0;background:#fff;overflow:auto;box-shadow:0 18px 40px rgba(0,0,0,.36),0 0 0 1px rgba(72,221,255,.08)}
        .change-order-paper__inner{padding:20px 24px 24px;background:#fff;font-family:Arial,sans-serif;color:#101820}
        .change-order-paper__brand{display:grid;gap:2px;margin-bottom:16px;padding-bottom:8px;border-bottom:2px solid #101820}
        .change-order-paper__heading{font-size:22px;font-weight:700}
        .change-order-paper__top-grid,.change-order-paper__mid-grid,.change-order-paper__acceptance{display:grid;grid-template-columns:1fr 1fr;gap:20px;margin-bottom:16px}
        .change-order-paper__panel,.change-order-paper__section,.change-order-paper__acceptance-panel{display:grid;gap:10px}
        .change-order-paper__field-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:10px}
        .change-order-paper__field{display:grid;gap:4px}
        .change-order-paper__field--full{grid-column:1/-1}
        .change-order-paper__field span,.change-order-paper__section-title{font-size:12px;font-weight:700}
        .change-order-paper__field input,.change-order-paper__textarea{width:100%;border:0;outline:0;padding:6px 8px;background:rgba(250,247,156,.88);color:#101820;font:inherit;box-sizing:border-box;border-bottom:1px dotted #101820}
        .change-order-paper__textarea{min-height:150px;resize:vertical;line-height:1.35;border:1px solid #8ea0b4}
        .change-order-paper__checkbox-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:8px 18px}
        .change-order-paper__checkbox-grid label{display:flex;align-items:center;gap:8px;font-size:13px}
        .change-order-dialog__footer{padding:8px 22px 18px;border-top:1px solid rgba(72,221,255,.08);background:#0a1019}
        .change-order-dialog__footer-status{margin-right:auto;color:rgba(167,228,255,.82);font-size:.82rem;letter-spacing:.04em}
        .change-order-dialog__footer button[mat-flat-button]{background:linear-gradient(180deg,rgba(255,140,40,.9),rgba(255,102,40,.78)),rgba(255,120,50,.82);color:#fff7ef;margin-right:8px}
        @media (max-width:900px){.change-order-paper__top-grid,.change-order-paper__mid-grid,.change-order-paper__acceptance,.change-order-paper__field-grid,.change-order-paper__checkbox-grid{grid-template-columns:1fr}.change-order-paper__inner{padding:16px}}
    `]
})
export class ChangeOrderDialog implements AfterViewInit {
    readonly data = inject<ChangeOrderDialogData>(MAT_DIALOG_DATA)
    private readonly dialogRef = inject(MatDialogRef<ChangeOrderDialog>)
    @ViewChild('printRoot') private printRoot?: ElementRef<HTMLElement>

    saveWorking = false
    statusText = ''
    editable = {
        projectName: this.data.projectName || '',
        county: '',
        contractorName: this.data.contractorName || '',
        contractNumber: this.data.contractNumber || '',
        projectNumber: this.data.projectNumber || '',
        changeOrderNumber: '',
        phase: '',
        idNumber: '',
        firetrolJobNumber: this.data.firetrolJobNumber || '',
        errorOmission: false,
        differingCondition: false,
        ownerRequest: false,
        fieldResolution: false,
        valueEngineering: false,
        otherSelected: false,
        currentCompletionDate: '',
        contractDaysChanged: '',
        revisedCompletionDate: '',
        contractType: '',
        encumbranceNumber: '',
        changeOrderTotal: '',
        description: '',
        contractorAcceptanceName: '',
        contractorAcceptanceAddress: '',
        contractorAcceptanceSignature: '',
        contractorAcceptanceDate: '',
        firetrolAcceptanceName: this.data.createdBy || 'Current User',
        firetrolAcceptanceAddress: '11111 Landmark 35 Drive\nSan Antonio, Tx 78233',
        firetrolAcceptanceSignature: '',
        firetrolAcceptanceDate: this.data.firetrolAcceptanceDate || ''
    }

    ngAfterViewInit(): void {}

    async createSheet(): Promise<void> {
        if (!this.data.createSheet) {
            return
        }

        this.saveWorking = true
        this.statusText = ''
        try {
            await Promise.resolve(this.data.createSheet(this.data.defaultFileName || 'Change Order.html', this.renderPrintableDocument()))
            this.statusText = 'Saved to Change Orders.'
            this.dialogRef.close('created')
        } catch (err: any) {
            this.statusText = err?.message || 'Unable to create change order.'
        } finally {
            this.saveWorking = false
        }
    }

    printSheet(): void {
        const popup = window.open('', '_blank', 'width=1200,height=900')
        if (!popup) {
            return
        }

        popup.document.open()
        popup.document.write(this.renderPrintableDocument())
        popup.document.close()
        popup.focus()
        popup.print()
    }

    private renderPrintableDocument(): string {
        const clone = this.printRoot?.nativeElement.cloneNode(true) as HTMLElement | undefined
        if (clone) {
            const sourceInputs = this.printRoot?.nativeElement.querySelectorAll('input, textarea') || []
            const cloneInputs = clone.querySelectorAll('input, textarea')
            sourceInputs.forEach((sourceElement, index) => {
                const source = sourceElement as HTMLInputElement | HTMLTextAreaElement
                const target = cloneInputs[index] as HTMLInputElement | HTMLTextAreaElement | undefined
                if (!target) {
                    return
                }
                if (source instanceof HTMLInputElement && source.type === 'checkbox') {
                    if (source.checked) {
                        target.setAttribute('checked', 'checked')
                    } else {
                        target.removeAttribute('checked')
                    }
                    return
                }
                target.setAttribute('value', source.value)
                if (target instanceof HTMLTextAreaElement) {
                    target.textContent = source.value
                }
            })
        }

        const html = clone?.outerHTML || ''
        return `<!doctype html>
<html>
<head>
    <title>Change Order</title>
    <style>
        body{margin:0;padding:0;background:#ffffff}
        .change-order-paper__inner{padding:20px 24px 24px;background:#fff;font-family:Arial,sans-serif;color:#101820}
        .change-order-paper__brand{display:grid;gap:2px;margin-bottom:16px;padding-bottom:8px;border-bottom:2px solid #101820}
        .change-order-paper__heading{font-size:22px;font-weight:700}
        .change-order-paper__top-grid,.change-order-paper__mid-grid,.change-order-paper__acceptance{display:grid;grid-template-columns:1fr 1fr;gap:20px;margin-bottom:16px}
        .change-order-paper__panel,.change-order-paper__section,.change-order-paper__acceptance-panel{display:grid;gap:10px}
        .change-order-paper__field-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:10px}
        .change-order-paper__field{display:grid;gap:4px}
        .change-order-paper__field span,.change-order-paper__section-title{font-size:12px;font-weight:700}
        .change-order-paper__field input,.change-order-paper__textarea{width:100%;border:0;outline:0;padding:6px 8px;background:rgba(250,247,156,.88);color:#101820;font:inherit;box-sizing:border-box;border-bottom:1px dotted #101820}
        .change-order-paper__textarea{min-height:150px;resize:none;line-height:1.35;border:1px solid #8ea0b4}
        .change-order-paper__checkbox-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:8px 18px}
        .change-order-paper__checkbox-grid label{display:flex;align-items:center;gap:8px;font-size:13px}
    </style>
</head>
<body>${html}</body>
</html>`
    }
}
