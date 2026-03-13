import { CommonModule } from '@angular/common'
import { AfterViewInit, Component, ElementRef, ViewChild, inject } from '@angular/core'
import { FormsModule } from '@angular/forms'
import { MatButtonModule } from '@angular/material/button'
import { MAT_DIALOG_DATA, MatDialogActions, MatDialogClose, MatDialogContent, MatDialogTitle } from '@angular/material/dialog'
import { MatIconModule } from '@angular/material/icon'

export interface JobCostSheetData {
    firetrolJobNumber: string
    projectName: string
    projectAddress: string
    salesperson: string
    startDate: string
    completionDate: string
    contractAmount: number
    estDeviceCount: number
    estSqFootage: number
    jobType: string
    projectScope: string
    scopeOfWork: string
}

interface CheckRow {
    label: string
    yes: boolean
    no: boolean
}

interface OptionRow {
    label: string
    checked: boolean
}

@Component({
    standalone: true,
    imports: [CommonModule, FormsModule, MatDialogTitle, MatDialogContent, MatDialogActions, MatDialogClose, MatButtonModule, MatIconModule],
    template: `
        <div mat-dialog-title class="sheet-titlebar">
            <div>
                <div class="sheet-kicker">Proposal Output</div>
                <div class="sheet-title">Job Cost Project Set Up Sheet</div>
            </div>
        </div>
        <mat-dialog-content class="sheet-shell">
            <div class="sheet-kicker">Proposal Package</div>
            <div class="sheet-paper">
                <div #printRoot class="sheet-paper__inner">
                    <div class="sheet-paper__brand-row">
                        <img class="sheet-paper__logo" src="/images/firetrol-logo.png" alt="Firetrol Protection Systems" />
                        <div class="sheet-paper__rev">Rev 1.0.A</div>
                    </div>
                    <div class="sheet-paper__title">Job Cost Project Set Up Sheet</div>

                    <div class="sheet-grid">
                        <div class="sheet-panel">
                            <div class="sheet-section">Billing</div>
                            <div class="field-grid">
                                <label class="field"><span>Customer</span><input class="paper-input" [(ngModel)]="editable.customer" /></label>
                                <label class="field field--full"><span>Address</span><input class="paper-input" [(ngModel)]="editable.billingAddress1" /></label>
                                <label class="field field--full"><span>Address 2</span><input class="paper-input" [(ngModel)]="editable.billingAddress2" /></label>
                                <label class="field"><span>City</span><input class="paper-input" [(ngModel)]="editable.billingCity" /></label>
                                <label class="field"><span>State</span><input class="paper-input" [(ngModel)]="editable.billingState" /></label>
                                <label class="field"><span>Zip</span><input class="paper-input" [(ngModel)]="editable.billingZip" /></label>
                                <label class="field"><span>Phone</span><input class="paper-input" [(ngModel)]="editable.phone" /></label>
                                <label class="field"><span>Fax</span><input class="paper-input" [(ngModel)]="editable.fax" /></label>
                                <label class="field"><span>Date</span><input class="paper-input" [(ngModel)]="editable.date" /></label>
                                <label class="field"><span>Salesperson</span><input class="paper-input" [(ngModel)]="editable.salesperson" /></label>
                                <label class="field field--full"><span>Contract / PO #</span><input class="paper-input" [(ngModel)]="editable.contractPoNumber" /></label>
                                <label class="field field--full"><span>Contract Amount</span><input class="paper-input" [(ngModel)]="editable.contractAmount" /></label>
                            </div>
                        </div>

                        <div class="sheet-panel">
                            <div class="field-grid">
                                <label class="field"><span>Firetrol Job Number</span><input class="paper-input" [(ngModel)]="editable.firetrolJobNumber" /></label>
                                <label class="field"><span>Project Name</span><input class="paper-input" [(ngModel)]="editable.projectName" /></label>
                                <label class="field field--full"><span>Address</span><input class="paper-input" [(ngModel)]="editable.projectAddress" /></label>
                                <label class="field"><span>City</span><input class="paper-input" [(ngModel)]="editable.projectCity" /></label>
                                <label class="field"><span>State</span><input class="paper-input" [(ngModel)]="editable.projectState" /></label>
                                <label class="field"><span>ZIP CODE</span><input class="paper-input" [(ngModel)]="editable.projectZip" /></label>
                                <label class="field"><span>Supt Name</span><input class="paper-input" [(ngModel)]="editable.suptName" /></label>
                                <label class="field"><span>Mobile #</span><input class="paper-input" [(ngModel)]="editable.mobilePhone" /></label>
                                <label class="field"><span>Site Phone</span><input class="paper-input" [(ngModel)]="editable.sitePhone" /></label>
                                <label class="field"><span>Start Date</span><input class="paper-input" [(ngModel)]="editable.startDate" /></label>
                                <label class="field"><span>Completion Date</span><input class="paper-input" [(ngModel)]="editable.completionDate" /></label>
                            </div>
                        </div>
                    </div>

                    <div class="sheet-grid sheet-grid--checks">
                        <div class="sheet-panel">
                            <div class="check-head"><span></span><strong>YES</strong><strong>NO</strong></div>
                            <div *ngFor="let row of leftChecks" class="check-row">
                                <span>{{row.label}}</span>
                                <input type="checkbox" [(ngModel)]="row.yes" />
                                <input type="checkbox" [(ngModel)]="row.no" />
                            </div>
                            <div class="field-grid field-grid--compact">
                                <label class="field"><span>Liquidated Damages</span><input class="paper-input" [(ngModel)]="editable.liquidatedDamages" /></label>
                                <label class="field"><span>Invoicing Portal</span><input class="paper-input" [(ngModel)]="editable.invoicingPortal" /></label>
                                <label class="field"><span>Est Device count</span><input class="paper-input" [(ngModel)]="editable.estDeviceCount" /></label>
                                <label class="field"><span>Est Sq Footage</span><input class="paper-input" [(ngModel)]="editable.estSqFootage" /></label>
                                <label class="field"><span>HUB Participation</span><input class="paper-input" [(ngModel)]="editable.hubParticipation" /></label>
                                <label class="field"><span>Sprinkler</span><input class="paper-input" [(ngModel)]="editable.sprinkler" /></label>
                                <label class="field"><span>A & D</span><input class="paper-input" [(ngModel)]="editable.ad" /></label>
                                <label class="field"><span>SVC / LFPS / CON</span><input class="paper-input" [(ngModel)]="editable.sprinklerServiceType" /></label>
                            </div>
                        </div>
                        <div class="sheet-panel">
                            <div class="check-head"><span></span><strong>YES</strong><strong>NO</strong></div>
                            <div *ngFor="let row of rightChecks" class="check-row">
                                <span>{{row.label}}</span>
                                <input type="checkbox" [(ngModel)]="row.yes" />
                                <input type="checkbox" [(ngModel)]="row.no" />
                            </div>
                            <div class="field-grid field-grid--compact">
                                <label class="field"><span>Retention</span><input class="paper-input" [(ngModel)]="editable.retention" /></label>
                                <label class="field"><span>Reason</span><input class="paper-input" [(ngModel)]="editable.reason" /></label>
                            </div>
                        </div>
                    </div>

                    <div class="sheet-section">Scope of Work</div>
                    <textarea
                        #scopeOfWorkInput
                        class="paper-input paper-input--multiline"
                        [(ngModel)]="editable.scopeOfWork"
                        (input)="autosizeScopeOfWork()"></textarea>

                    <div class="sheet-section">System Type (check all that apply)</div>
                    <div class="option-grid">
                        <label *ngFor="let row of systemTypes" class="option-row"><input type="checkbox" [(ngModel)]="row.checked" /><span>{{row.label}}</span></label>
                    </div>

                    <div class="sheet-section">Job Type (check all that apply)</div>
                    <div class="option-grid">
                        <label *ngFor="let row of jobTypes" class="option-row"><input type="checkbox" [(ngModel)]="row.checked" /><span>{{row.label}}</span></label>
                    </div>

                    <div class="approval-grid">
                        <label class="field"><span>DGM Approval</span><input class="paper-input" [(ngModel)]="editable.dgmApproval" /></label>
                        <label class="field"><span>Date</span><input class="paper-input" [(ngModel)]="editable.dgmApprovalDate" /></label>
                    </div>
                </div>
            </div>
        </mat-dialog-content>
        <mat-dialog-actions align="end" class="sheet-footer">
            <button mat-flat-button type="button" (click)="downloadPdf()">
                <mat-icon fontIcon="description"></mat-icon>
                Create Sheet
            </button>
            <button mat-button type="button" mat-dialog-close>Close</button>
        </mat-dialog-actions>
    `,
    styles: [`
        .sheet-titlebar{display:flex;align-items:center;padding:18px 22px 10px;border-bottom:1px solid rgba(72,221,255,.12);background:radial-gradient(circle at 0% 0%,rgba(72,221,255,.08),transparent 34%),radial-gradient(circle at 100% 0%,rgba(255,164,61,.08),transparent 32%),rgba(7,11,19,.96)}
        .sheet-kicker{color:rgba(177,213,228,.72);font-size:.72rem;letter-spacing:.16em;text-transform:uppercase}
        .sheet-title{margin-top:6px;color:#f4fbff;font-size:1.08rem;font-weight:700;letter-spacing:.08em;text-transform:uppercase}
        .sheet-shell{width:100%;display:grid;gap:16px;padding:10px 0 0;box-sizing:border-box;overflow-x:hidden;background:linear-gradient(180deg,rgba(255,255,255,.02),rgba(255,255,255,0)),rgba(8,12,21,.96)}
        .sheet-paper{border:1px solid rgba(72,221,255,.16);border-radius:0;background:#fff;overflow:auto;box-shadow:0 18px 40px rgba(0,0,0,.36),0 0 0 1px rgba(72,221,255,.08)}
        .sheet-paper__inner{padding:20px 24px 24px;background:linear-gradient(rgba(120,130,140,.16) 1px,transparent 1px),linear-gradient(90deg,rgba(120,130,140,.16) 1px,transparent 1px),#fff;background-size:38px 22px,38px 22px,auto;font-family:Arial,sans-serif;color:#101820}
        .sheet-paper__brand-row{display:flex;justify-content:space-between;align-items:flex-start}.sheet-paper__logo{display:block;width:220px;max-width:100%;height:auto;object-fit:contain}.sheet-paper__rev{font-size:11px;color:#5d6770}.sheet-paper__title{margin:8px 0 16px;font-size:18px;font-weight:700;text-align:center}
        .sheet-grid{display:grid;grid-template-columns:1fr 1fr;gap:18px;margin-bottom:14px}.sheet-grid--checks{align-items:start}
        .sheet-section{margin:0 0 6px;font-size:12px;font-weight:700}.field-grid,.approval-grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:8px 10px}.field-grid--compact{margin-top:10px}.field{display:grid;gap:2px;min-width:0}.field span{font-size:11px;font-weight:700}.field--full{grid-column:1/-1}
        .paper-input{width:100%;border:0;outline:0;padding:2px 4px;background:rgba(245,242,148,.88);color:#101820;font:inherit;box-sizing:border-box}.paper-input:focus{background:rgba(255,247,176,.98);box-shadow:inset 0 0 0 1px #7a93b4}.paper-input--multiline{min-height:110px;overflow:hidden;resize:none;line-height:1.35}
        .check-head,.check-row{display:grid;grid-template-columns:1fr 42px 42px;gap:8px;align-items:center}.check-head strong{text-align:center;font-size:12px}.check-row{min-height:24px}.check-row span{font-size:12px}
        .check-row input[type='checkbox'],.option-row input[type='checkbox']{width:16px;height:16px;margin:0 auto;accent-color:#d9d36e}
        .option-grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:6px 12px;margin-bottom:14px}.option-row{display:grid;grid-template-columns:20px 1fr;gap:8px;align-items:center;font-size:12px}
        .sheet-footer{padding:8px 22px 18px;border-top:1px solid rgba(72,221,255,.08);background:rgba(7,11,19,.96)} .sheet-footer button[mat-flat-button]{background:linear-gradient(180deg,rgba(255,140,40,.9),rgba(255,102,40,.78)),rgba(255,120,50,.82);color:#fff7ef;margin-right:8px}
        @media (max-width:720px){.sheet-titlebar{padding:16px 16px 10px}.sheet-paper__inner{padding:16px}.sheet-grid,.option-grid,.approval-grid,.field-grid{grid-template-columns:1fr}.sheet-footer{padding:8px 16px 16px}}
    `]
})
export class JobCostSheetDialog implements AfterViewInit {
    data: JobCostSheetData = inject(MAT_DIALOG_DATA)
    @ViewChild('printRoot') private printRoot?: ElementRef<HTMLElement>
    @ViewChild('scopeOfWorkInput') private scopeOfWorkInput?: ElementRef<HTMLTextAreaElement>

    editable = {
        customer: '',
        billingAddress1: '',
        billingAddress2: '',
        billingCity: '',
        billingState: '',
        billingZip: '',
        phone: '',
        fax: '',
        date: '',
        salesperson: '',
        contractPoNumber: '',
        contractAmount: '',
        firetrolJobNumber: '',
        projectName: '',
        projectAddress: '',
        projectCity: '',
        projectState: '',
        projectZip: '',
        suptName: '',
        mobilePhone: '',
        sitePhone: '',
        startDate: '',
        completionDate: '',
        liquidatedDamages: '',
        invoicingPortal: '',
        estDeviceCount: '',
        estSqFootage: '',
        hubParticipation: '',
        sprinkler: '',
        ad: '',
        sprinklerServiceType: '',
        retention: '10%',
        reason: '',
        scopeOfWork: '',
        dgmApproval: '',
        dgmApprovalDate: ''
    }

    leftChecks: CheckRow[] = [
        { label: 'Pre-Bid Checklist Attached', yes: false, no: false },
        { label: 'Estimates Attached', yes: false, no: false },
        { label: 'Schedule of Values Attached', yes: false, no: false },
        { label: 'Signed Proposal/Contract Attached', yes: false, no: false }
    ]

    rightChecks: CheckRow[] = [
        { label: 'Certified Payroll', yes: false, no: false },
        { label: 'OCIP', yes: false, no: false },
        { label: 'Bonds', yes: false, no: false },
        { label: 'New Ground Up Construction?', yes: false, no: false },
        { label: 'Tenant Finish Out Project?', yes: false, no: false },
        { label: 'Service/Repair/Remodel job?', yes: false, no: false },
        { label: 'Taxable?', yes: false, no: false },
        { label: 'Tax Resale Certificate?', yes: false, no: false },
        { label: 'Tax Exempt Certificate?', yes: false, no: false }
    ]

    systemTypes: OptionRow[] = [
        { label: 'Sprinkler', checked: false },
        { label: 'Fire Alarm & Detection', checked: true },
        { label: 'Security - BA', checked: false },
        { label: 'Security - Card Access', checked: false },
        { label: 'Security - CCTV', checked: false },
        { label: 'Intercom / Sound', checked: false },
        { label: 'Suppression - Engineered Systems', checked: false },
        { label: 'Suppression - Extinguisher', checked: false },
        { label: 'Other', checked: false }
    ]

    jobTypes: OptionRow[] = [
        { label: 'Commercial', checked: true },
        { label: 'Education', checked: false },
        { label: 'GSA-Bid Market', checked: false },
        { label: 'GSA-Exec Agency', checked: false },
        { label: 'GSA-Other User', checked: false },
        { label: 'Healthcare', checked: false },
        { label: 'High Rise', checked: false },
        { label: 'Hotel', checked: false },
        { label: 'Industrial', checked: false },
        { label: 'Security', checked: false },
        { label: 'Parking Structure', checked: false },
        { label: 'Residential', checked: false },
        { label: 'Retail', checked: false },
        { label: 'TXMAS', checked: false },
        { label: 'Warehouse', checked: false }
    ]

    constructor() {
        const parsedAddress = this.parseUsAddress(this.data.projectAddress)
        this.editable.firetrolJobNumber = this.data.firetrolJobNumber || ''
        this.editable.projectName = this.data.projectName || ''
        this.editable.projectAddress = parsedAddress.street
        this.editable.projectCity = parsedAddress.city
        this.editable.projectState = parsedAddress.state
        this.editable.projectZip = parsedAddress.zip
        this.editable.salesperson = this.data.salesperson || ''
        this.editable.date = this.data.startDate || ''
        this.editable.startDate = this.data.startDate || ''
        this.editable.completionDate = this.data.completionDate || ''
        this.editable.contractAmount = this.formatCurrency(this.data.contractAmount)
        this.editable.estDeviceCount = `${this.data.estDeviceCount || 0}`
        this.editable.estSqFootage = `${this.data.estSqFootage || 0}`
        this.editable.scopeOfWork = this.data.scopeOfWork || ''
        this.jobTypes.forEach((row) => row.checked = row.label === this.data.jobType)
    }

    ngAfterViewInit() {
        this.autosizeScopeOfWork()
    }

    autosizeScopeOfWork() {
        const textarea = this.scopeOfWorkInput?.nativeElement
        if (!textarea) {
            return
        }

        textarea.style.height = 'auto'
        textarea.style.height = `${textarea.scrollHeight}px`
    }

    downloadPdf() {
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
                if (source instanceof HTMLInputElement && source.type === 'checkbox' && target instanceof HTMLInputElement) {
                    target.checked = source.checked
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
                if (source.style.height) {
                    target.style.height = source.style.height
                }
            })
        }

        const html = clone?.outerHTML || ''
        return `<!doctype html>
<html>
<head>
    <title>Job Cost Sheet</title>
    <style>
        body{margin:0;padding:0;background:#ffffff}
        .sheet-paper__inner{padding:20px 24px 24px;background:linear-gradient(rgba(120,130,140,.16) 1px,transparent 1px),linear-gradient(90deg,rgba(120,130,140,.16) 1px,transparent 1px),#fff;background-size:38px 22px,38px 22px,auto;font-family:Arial,sans-serif;color:#101820}
        .sheet-paper__brand-row{display:flex;justify-content:space-between;align-items:flex-start}
        .sheet-paper__logo{display:block;width:220px;max-width:100%;height:auto;object-fit:contain}
        .sheet-paper__rev{font-size:11px;color:#5d6770}
        .sheet-paper__title{margin:8px 0 16px;font-size:18px;font-weight:700;text-align:center}
        .sheet-grid{display:grid;grid-template-columns:1fr 1fr;gap:18px;margin-bottom:14px}
        .sheet-grid--checks{align-items:start}
        .sheet-section{margin:0 0 6px;font-size:12px;font-weight:700}
        .field-grid,.approval-grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:8px 10px}
        .field-grid--compact{margin-top:10px}
        .field{display:grid;gap:2px;min-width:0}
        .field span{font-size:11px;font-weight:700}
        .field--full{grid-column:1/-1}
        .paper-input{width:100%;border:0;outline:0;padding:2px 4px;background:rgba(245,242,148,.88);color:#101820;font:inherit;box-sizing:border-box}
        .paper-input--multiline{min-height:110px;overflow:hidden;resize:none;line-height:1.35}
        .check-head,.check-row{display:grid;grid-template-columns:1fr 42px 42px;gap:8px;align-items:center}
        .check-head strong{text-align:center;font-size:12px}
        .check-row{min-height:24px}
        .check-row span{font-size:12px}
        .check-row input[type='checkbox'],.option-row input[type='checkbox']{width:16px;height:16px;margin:0 auto;accent-color:#d9d36e}
        .option-grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:6px 12px;margin-bottom:14px}
        .option-row{display:grid;grid-template-columns:20px 1fr;gap:8px;align-items:center;font-size:12px}
    </style>
</head>
<body>${html}</body>
</html>`
    }

    private formatCurrency(value: number): string {
        return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(Number(value || 0))
    }

    private parseUsAddress(value: string | null | undefined): { street: string, city: string, state: string, zip: string } {
        const input = String(value || '').trim()
        if (!input) {
            return { street: '', city: '', state: '', zip: '' }
        }

        const normalized = input.replace(/\r?\n/g, ', ').replace(/\s+/g, ' ').trim()
        const match = /^(.*?)(?:,\s*|\s+)([A-Za-z .'-]+?)(?:,\s*|\s+)([A-Z]{2})\s+(\d{5}(?:-\d{4})?)$/i.exec(normalized)
        if (!match) {
            return { street: input, city: '', state: '', zip: '' }
        }

        return {
            street: match[1].trim(),
            city: match[2].trim(),
            state: match[3].toUpperCase(),
            zip: match[4].trim()
        }
    }

    private escapeHtml(value: string): string {
        return String(value || '')
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#39;')
    }
}
