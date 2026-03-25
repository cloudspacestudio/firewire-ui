import { CommonModule } from '@angular/common'
import { AfterViewInit, Component, ElementRef, ViewChild, inject } from '@angular/core'
import { FormsModule } from '@angular/forms'
import { MatButtonModule } from '@angular/material/button'
import { MAT_DIALOG_DATA, MatDialogActions, MatDialogClose, MatDialogContent, MatDialogTitle } from '@angular/material/dialog'
import { MatIconModule } from '@angular/material/icon'

export interface ContractSetupSheetData {
    firetrolJobNumber: string
    projectName: string
    projectAddress: string
    projectType: string
    jobType: string
    scopeType: string
    scopeOfWork: string
    salesperson: string
    date: string
    startDate: string
    completionDate: string
    contractPoNumber: string
    contractAmount: number
    estDeviceCount: number
    estSqFootage: number
    taxable: boolean
}

interface BinaryRow {
    label: string
    yes: boolean
    no: boolean
}

interface OptionRow {
    label: string
    checked: boolean
}

interface ChecklistRow {
    label: string
    checked: boolean
}

@Component({
    standalone: true,
    imports: [CommonModule, FormsModule, MatDialogTitle, MatDialogContent, MatDialogActions, MatDialogClose, MatButtonModule, MatIconModule],
    template: `
        <div mat-dialog-title class="contract-setup__titlebar">
            <div>
                <div class="contract-setup__kicker">Booking Output</div>
                <div class="contract-setup__title">Contract Set Up</div>
            </div>
            <button mat-icon-button type="button" aria-label="Close dialog" mat-dialog-close>
                <mat-icon>close</mat-icon>
            </button>
        </div>

        <mat-dialog-content class="contract-setup">
            <div class="contract-setup__toolbar">
                <div class="contract-setup__eyebrow">Operations Setup Preview</div>
            </div>

            <div class="contract-setup__paper">
                <div #printRoot class="contract-setup__paper-inner">
                    <div class="contract-setup__brand-row">
                        <div class="contract-setup__brand-block">
                            <img class="contract-setup__logo" src="/images/firetrol-logo.png" alt="Firetrol Protection Systems" />
                            <div class="contract-setup__brand-meta">
                                <div>4616 W. Howard Ln., Suite 700</div>
                                <div>Austin, TX 78728</div>
                                <div>Phone: (512) 687-0115</div>
                                <div>Fax: (512) 687-0120</div>
                            </div>
                        </div>
                        <div class="contract-setup__header-card">
                            <label class="contract-setup__mini-field">
                                <span>Firetrol Job #:</span>
                                <input class="contract-setup__input" [(ngModel)]="editable.firetrolJobNumber" />
                            </label>
                            <div class="contract-setup__sheet-name">CONTRACT SET UP</div>
                        </div>
                    </div>

                    <div class="contract-setup__top-grid">
                        <section class="contract-setup__panel">
                            <div class="contract-setup__section-title">Billing</div>
                            <div class="contract-setup__field-grid">
                                <label class="contract-setup__field">
                                    <span>Customer</span>
                                    <input class="contract-setup__input" [(ngModel)]="editable.customer" />
                                </label>
                                <label class="contract-setup__field contract-setup__field--full">
                                    <span>Address</span>
                                    <input class="contract-setup__input" [(ngModel)]="editable.billingAddress1" />
                                </label>
                                <label class="contract-setup__field">
                                    <span>City</span>
                                    <input class="contract-setup__input" [(ngModel)]="editable.billingCity" />
                                </label>
                                <label class="contract-setup__field">
                                    <span>State</span>
                                    <input class="contract-setup__input" [(ngModel)]="editable.billingState" />
                                </label>
                                <label class="contract-setup__field">
                                    <span>Zip</span>
                                    <input class="contract-setup__input" [(ngModel)]="editable.billingZip" />
                                </label>
                                <label class="contract-setup__field">
                                    <span>Phone</span>
                                    <input class="contract-setup__input" [(ngModel)]="editable.phone" />
                                </label>
                                <label class="contract-setup__field">
                                    <span>Fax</span>
                                    <input class="contract-setup__input" [(ngModel)]="editable.fax" />
                                </label>
                                <label class="contract-setup__field">
                                    <span>Date</span>
                                    <input class="contract-setup__input" [(ngModel)]="editable.date" />
                                </label>
                                <label class="contract-setup__field">
                                    <span>Salesman</span>
                                    <input class="contract-setup__input" [(ngModel)]="editable.salesman" />
                                </label>
                                <label class="contract-setup__field contract-setup__field--full">
                                    <span>Contract / PO #</span>
                                    <input class="contract-setup__input" [(ngModel)]="editable.contractPoNumber" />
                                </label>
                            </div>
                        </section>

                        <section class="contract-setup__panel">
                            <div class="contract-setup__field-grid">
                                <label class="contract-setup__field">
                                    <span>Job Name</span>
                                    <input class="contract-setup__input" [(ngModel)]="editable.projectName" />
                                </label>
                                <label class="contract-setup__field contract-setup__field--full">
                                    <span>Address</span>
                                    <input class="contract-setup__input" [(ngModel)]="editable.projectAddress" />
                                </label>
                                <label class="contract-setup__field">
                                    <span>City</span>
                                    <input class="contract-setup__input" [(ngModel)]="editable.projectCity" />
                                </label>
                                <label class="contract-setup__field">
                                    <span>State</span>
                                    <input class="contract-setup__input" [(ngModel)]="editable.projectState" />
                                </label>
                                <label class="contract-setup__field">
                                    <span>Zip Code</span>
                                    <input class="contract-setup__input" [(ngModel)]="editable.projectZip" />
                                </label>
                                <label class="contract-setup__field">
                                    <span>Contact Person</span>
                                    <input class="contract-setup__input" [(ngModel)]="editable.contactPerson" />
                                </label>
                                <label class="contract-setup__field">
                                    <span>Mobile #</span>
                                    <input class="contract-setup__input" [(ngModel)]="editable.mobilePhone" />
                                </label>
                                <label class="contract-setup__field">
                                    <span>Site Email</span>
                                    <input class="contract-setup__input" [(ngModel)]="editable.siteEmail" />
                                </label>
                                <label class="contract-setup__field">
                                    <span>Start Date</span>
                                    <input class="contract-setup__input" [(ngModel)]="editable.startDate" />
                                </label>
                                <label class="contract-setup__field">
                                    <span>Completion Date</span>
                                    <input class="contract-setup__input" [(ngModel)]="editable.completionDate" />
                                </label>
                            </div>
                        </section>
                    </div>

                    <div class="contract-setup__amount-row">
                        <div class="contract-setup__amount-label">Contract Amount $</div>
                        <div class="contract-setup__amount-value">{{editable.contractAmount}}</div>
                    </div>

                    <div class="contract-setup__checks-grid">
                        <section class="contract-setup__panel">
                            <div class="contract-setup__check-head"><span></span><strong>Yes</strong><strong>No</strong></div>
                            <div *ngFor="let row of leftChecks" class="contract-setup__check-row">
                                <span>{{row.label}}</span>
                                <input type="checkbox" [(ngModel)]="row.yes" />
                                <input type="checkbox" [(ngModel)]="row.no" />
                            </div>
                            <div class="contract-setup__mini-stats">
                                <label class="contract-setup__field">
                                    <span>Est Device Count</span>
                                    <input class="contract-setup__input" [(ngModel)]="editable.estDeviceCount" />
                                </label>
                                <label class="contract-setup__field">
                                    <span>Est Sq Footage</span>
                                    <input class="contract-setup__input" [(ngModel)]="editable.estSqFootage" />
                                </label>
                            </div>
                        </section>

                        <section class="contract-setup__panel">
                            <div class="contract-setup__check-head"><span></span><strong>Yes</strong><strong>No</strong></div>
                            <div *ngFor="let row of rightChecks" class="contract-setup__check-row">
                                <span>{{row.label}}</span>
                                <input type="checkbox" [(ngModel)]="row.yes" />
                                <input type="checkbox" [(ngModel)]="row.no" />
                            </div>
                            <label class="contract-setup__field contract-setup__field--full">
                                <span>Job Classification</span>
                                <input class="contract-setup__input" [(ngModel)]="editable.jobClassification" />
                            </label>
                        </section>
                    </div>

                    <section class="contract-setup__scope">
                        <div class="contract-setup__section-title">Scope of Work</div>
                        <textarea
                            #scopeInput
                            class="contract-setup__input contract-setup__input--multiline"
                            [(ngModel)]="editable.scopeOfWork"
                            (input)="autosizeScope()"></textarea>
                    </section>

                    <section class="contract-setup__options-block">
                        <div class="contract-setup__section-title">System Type</div>
                        <div class="contract-setup__option-grid">
                            <label *ngFor="let row of systemTypes" class="contract-setup__option-row">
                                <input type="checkbox" [(ngModel)]="row.checked" />
                                <span>{{row.label}}</span>
                            </label>
                        </div>
                    </section>

                    <section class="contract-setup__options-block">
                        <div class="contract-setup__section-title">Building Type</div>
                        <div class="contract-setup__option-grid contract-setup__option-grid--wide">
                            <label *ngFor="let row of buildingTypes" class="contract-setup__option-row">
                                <input type="checkbox" [(ngModel)]="row.checked" />
                                <span>{{row.label}}</span>
                            </label>
                        </div>
                    </section>

                    <div class="contract-setup__office-grid">
                        <section class="contract-setup__panel">
                            <div class="contract-setup__section-title">Checklist</div>
                            <ng-container *ngFor="let item of checklistItems">
                                <label class="contract-setup__task-check">
                                    <input type="checkbox" [(ngModel)]="item.checked" />
                                    <span>{{item.label}}</span>
                                </label>
                                <label *ngIf="item.label === 'Contract reviewed by'" class="contract-setup__field contract-setup__field--compact contract-setup__field--inline">
                                    <span>Reviewer</span>
                                    <input class="contract-setup__input contract-setup__input--line" [(ngModel)]="editable.contractReviewedBy" />
                                </label>
                            </ng-container>
                        </section>

                        <section class="contract-setup__panel">
                            <div class="contract-setup__section-title">Billing Requirements</div>
                            <label class="contract-setup__field contract-setup__field--compact">
                                <span>Billing due by</span>
                                <input class="contract-setup__input contract-setup__input--line" [(ngModel)]="editable.billingDueBy" />
                            </label>
                            <label class="contract-setup__task-check" *ngFor="let item of billingCheckboxItems">
                                <input type="checkbox" [(ngModel)]="item.checked" />
                                <span>{{item.label}}</span>
                            </label>
                            <div class="contract-setup__section-title contract-setup__section-title--sub">Other Items Listed Below</div>
                            <label class="contract-setup__task-check" *ngFor="let item of otherItems">
                                <input type="checkbox" [(ngModel)]="item.checked" />
                                <span [innerHTML]="item.label"></span>
                            </label>
                        </section>
                    </div>
                </div>
            </div>
        </mat-dialog-content>

        <mat-dialog-actions align="end" class="contract-setup__footer">
            <button mat-flat-button type="button" (click)="downloadPdf()">
                <mat-icon fontIcon="description"></mat-icon>
                Create Sheet
            </button>
            <button mat-button type="button" mat-dialog-close>Close</button>
        </mat-dialog-actions>
    `,
    styles: [`
        .contract-setup__titlebar{display:flex;align-items:center;justify-content:space-between;padding:18px 22px 10px;border-bottom:1px solid rgba(72,221,255,.12);background:radial-gradient(circle at 0% 0%,rgba(72,221,255,.08),transparent 34%),radial-gradient(circle at 100% 0%,rgba(255,164,61,.08),transparent 32%),#0a1019}
        .contract-setup__kicker,.contract-setup__eyebrow{color:rgba(177,213,228,.72);font-size:.72rem;letter-spacing:.16em;text-transform:uppercase}
        .contract-setup__title{margin-top:6px;color:#f4fbff;font-size:1.08rem;font-weight:700;letter-spacing:.08em;text-transform:uppercase}
        .contract-setup{width:100%;display:grid;gap:16px;padding:10px 0 0;box-sizing:border-box;overflow-x:hidden;background:linear-gradient(180deg,rgba(255,255,255,.02),rgba(255,255,255,0)),#0b111b}
        .contract-setup__toolbar{padding:8px 0 0 12px}
        .contract-setup__paper{border:1px solid rgba(72,221,255,.16);border-radius:0;background:#fff;overflow:auto;box-shadow:0 18px 40px rgba(0,0,0,.36),0 0 0 1px rgba(72,221,255,.08)}
        .contract-setup__paper-inner{padding:18px 22px 24px;background:linear-gradient(rgba(120,130,140,.16) 1px,transparent 1px),linear-gradient(90deg,rgba(120,130,140,.16) 1px,transparent 1px),#fff;background-size:38px 22px,38px 22px,auto;font-family:Arial,sans-serif;color:#101820}
        .contract-setup__brand-row{display:grid;grid-template-columns:1.4fr .95fr;gap:16px;align-items:start}
        .contract-setup__brand-block{display:flex;gap:14px;align-items:flex-start}
        .contract-setup__logo{display:block;width:220px;max-width:100%;height:auto;object-fit:contain}
        .contract-setup__brand-meta{display:grid;gap:2px;font-size:12px;font-weight:700}
        .contract-setup__header-card{display:grid;gap:8px}
        .contract-setup__mini-field{display:grid;grid-template-columns:132px 1fr;gap:8px;align-items:center}
        .contract-setup__mini-field span{font-size:12px;font-weight:700}
        .contract-setup__sheet-name{padding:8px 10px;border:1px solid #101820;text-align:center;font-size:18px;font-weight:700;letter-spacing:.06em}
        .contract-setup__top-grid,.contract-setup__checks-grid,.contract-setup__office-grid{display:grid;grid-template-columns:1fr 1fr;gap:16px;margin-top:14px}
        .contract-setup__panel{display:grid;gap:8px;align-content:start}
        .contract-setup__section-title{font-size:12px;font-weight:700;text-transform:uppercase}
        .contract-setup__section-title--sub{margin-top:10px}
        .contract-setup__field-grid,.contract-setup__mini-stats{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:8px 10px}
        .contract-setup__field{display:grid;gap:2px;min-width:0}
        .contract-setup__field span{font-size:11px;font-weight:700;text-transform:uppercase}
        .contract-setup__field--full{grid-column:1/-1}
        .contract-setup__field--compact{max-width:190px}
        .contract-setup__field--inline{margin-left:28px}
        .contract-setup__input{width:100%;border:0;outline:0;padding:2px 4px;background:rgba(245,242,148,.88);color:#101820;font:inherit;box-sizing:border-box}
        .contract-setup__input:focus{background:rgba(255,247,176,.98);box-shadow:inset 0 0 0 1px #7a93b4}
        .contract-setup__input--multiline{min-height:84px;resize:none;overflow:hidden;line-height:1.35}
        .contract-setup__input--line{background:transparent;border-bottom:1px solid rgba(16,24,32,.24);padding:0;height:20px}
        .contract-setup__amount-row{display:grid;grid-template-columns:220px 180px;gap:0;align-items:stretch;margin-top:14px}
        .contract-setup__amount-label,.contract-setup__amount-value{border:1px solid #101820;padding:6px 10px;font-size:16px;font-weight:700}
        .contract-setup__amount-value{text-align:center;background:rgba(245,242,148,.88)}
        .contract-setup__check-head,.contract-setup__check-row{display:grid;grid-template-columns:1fr 42px 42px;gap:8px;align-items:center}
        .contract-setup__check-head strong{text-align:center;font-size:12px;text-transform:uppercase}
        .contract-setup__check-row{min-height:24px}
        .contract-setup__check-row span{font-size:12px}
        .contract-setup__check-row input[type='checkbox'],.contract-setup__option-row input[type='checkbox']{width:16px;height:16px;margin:0 auto;accent-color:#d9d36e}
        .contract-setup__scope{margin-top:14px}
        .contract-setup__options-block{margin-top:14px}
        .contract-setup__option-grid{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:6px 12px}
        .contract-setup__option-grid--wide{grid-template-columns:repeat(4,minmax(0,1fr))}
        .contract-setup__option-row{display:grid;grid-template-columns:20px 1fr;gap:8px;align-items:center;font-size:12px}
        .contract-setup__task-check{display:grid;grid-template-columns:20px 1fr;gap:8px;align-items:center;min-height:24px;font-size:12px}
        .contract-setup__task-check input[type='checkbox']{width:16px;height:16px;margin:0;accent-color:#d9d36e}
        .contract-setup__footer{padding:8px 22px 18px;border-top:1px solid rgba(72,221,255,.08);background:#0a1019}
        .contract-setup__footer button[mat-flat-button]{background:linear-gradient(180deg,rgba(255,140,40,.9),rgba(255,102,40,.78)),rgba(255,120,50,.82);color:#fff7ef;margin-right:8px}
        @media (max-width:900px){.contract-setup__brand-row,.contract-setup__top-grid,.contract-setup__checks-grid,.contract-setup__office-grid,.contract-setup__option-grid,.contract-setup__option-grid--wide,.contract-setup__field-grid,.contract-setup__mini-stats{grid-template-columns:1fr}.contract-setup__amount-row{grid-template-columns:1fr}.contract-setup__brand-block{display:grid}.contract-setup__mini-field{grid-template-columns:1fr}.contract-setup__titlebar{padding:16px 16px 10px}.contract-setup__paper-inner{padding:16px}.contract-setup__footer{padding:8px 16px 16px}}
    `]
})
export class ContractSetupDialog implements AfterViewInit {
    data: ContractSetupSheetData = inject(MAT_DIALOG_DATA)
    @ViewChild('printRoot') private printRoot?: ElementRef<HTMLElement>
    @ViewChild('scopeInput') private scopeInput?: ElementRef<HTMLTextAreaElement>

    editable = {
        firetrolJobNumber: '',
        customer: '',
        billingAddress1: '',
        billingCity: '',
        billingState: '',
        billingZip: '',
        phone: '',
        fax: '',
        date: '',
        salesman: '',
        contractPoNumber: '',
        projectName: '',
        projectAddress: '',
        projectCity: '',
        projectState: '',
        projectZip: '',
        contactPerson: '',
        mobilePhone: '',
        siteEmail: '',
        startDate: '',
        completionDate: '',
        billingDueBy: '',
        contractReviewedBy: '',
        contractAmount: '',
        estDeviceCount: '',
        estSqFootage: '',
        jobClassification: '',
        scopeOfWork: ''
    }

    leftChecks: BinaryRow[] = [
        { label: 'Estimate Face Sheet Attached', yes: false, no: true },
        { label: 'Schedule of Values Attached', yes: false, no: true },
        { label: 'Signed Proposal/Contract Attached', yes: true, no: false },
        { label: 'Letter of Intent Attached', yes: false, no: true }
    ]

    rightChecks: BinaryRow[] = [
        { label: 'Certified Payroll', yes: false, no: true },
        { label: 'OCIP', yes: false, no: true },
        { label: 'Bonds', yes: false, no: true },
        { label: 'Taxable', yes: false, no: true }
    ]

    systemTypes: OptionRow[] = [
        { label: 'Fire Alarm & Detection', checked: false },
        { label: 'Sprinkler', checked: false },
        { label: 'Security', checked: false },
        { label: 'Intercom / Sound', checked: false },
        { label: 'Suppression', checked: false },
        { label: 'Other', checked: false }
    ]

    buildingTypes: OptionRow[] = [
        { label: 'Commercial - High Rise', checked: false },
        { label: 'Commercial - Low Rise', checked: false },
        { label: 'Commercial - Warehouse', checked: false },
        { label: 'Commercial - Public Shops', checked: false },
        { label: 'Education - Colleges', checked: false },
        { label: 'Education - Universities', checked: false },
        { label: 'Education - Primary', checked: false },
        { label: 'Education - Private', checked: false },
        { label: 'Education - Dormitories', checked: false },
        { label: 'Gov - Fed Facilities', checked: false },
        { label: 'Gov - State/Local', checked: false },
        { label: 'Gov - Military Bases', checked: false },
        { label: 'Health - Hospitals', checked: false },
        { label: 'Health - Treatment Centers', checked: false },
        { label: 'Health - Assisted Living', checked: false },
        { label: 'Merch - Stores/Shops', checked: false },
        { label: 'Residential', checked: false },
        { label: 'Industrial', checked: false },
        { label: 'Parking Structure', checked: false },
        { label: 'Other', checked: false }
    ]

    checklistItems: ChecklistRow[] = [
        { label: 'Contract received', checked: false },
        { label: 'Contract reviewed by', checked: false },
        { label: 'Revisions needed?', checked: false },
        { label: 'Revisions accepted?', checked: false },
        { label: 'Executed Contract Sent', checked: false },
        { label: 'W-9 Sent', checked: false },
        { label: 'Cert of Ins ordered', checked: false },
        { label: 'Cert of Ins received', checked: false },
        { label: 'Executed Contract on file', checked: false }
    ]

    billingCheckboxItems: ChecklistRow[] = [
        { label: 'Online Portal Billing?', checked: false },
        { label: 'GC Pay Apps required?', checked: false },
        { label: 'GC Pay Apps copied?', checked: false },
        { label: 'Certified Payroll info sent?', checked: false },
        { label: 'Tax cert on file?', checked: false }
    ]

    otherItems: ChecklistRow[] = [
        { label: '<s>Scan to Supervisor</s> Save to Firewire', checked: false },
        { label: 'Attach Doc in GP', checked: false }
    ]

    constructor() {
        const parsedAddress = this.parseUsAddress(this.data.projectAddress)
        this.editable.firetrolJobNumber = this.data.firetrolJobNumber || ''
        this.editable.projectName = this.data.projectName || ''
        this.editable.projectAddress = parsedAddress.street
        this.editable.projectCity = parsedAddress.city
        this.editable.projectState = parsedAddress.state
        this.editable.projectZip = parsedAddress.zip
        this.editable.customer = this.data.projectName || ''
        this.editable.billingAddress1 = parsedAddress.street
        this.editable.billingCity = parsedAddress.city
        this.editable.billingState = parsedAddress.state
        this.editable.billingZip = parsedAddress.zip
        this.editable.date = this.data.date || ''
        this.editable.salesman = this.data.salesperson || ''
        this.editable.contactPerson = this.data.salesperson || ''
        this.editable.startDate = this.data.startDate || ''
        this.editable.completionDate = this.data.completionDate || ''
        this.editable.contractPoNumber = this.data.contractPoNumber || ''
        this.editable.contractAmount = this.formatCurrency(this.data.contractAmount)
        this.editable.estDeviceCount = `${this.data.estDeviceCount || 0}`
        this.editable.estSqFootage = `${this.data.estSqFootage || 0}`
        this.editable.jobClassification = this.resolveJobClassification()
        this.editable.scopeOfWork = this.data.scopeOfWork || ''

        this.rightChecks = this.rightChecks.map((row) => row.label === 'Taxable'
            ? { ...row, yes: this.data.taxable, no: !this.data.taxable }
            : row)

        const selectedSystemType = this.resolveSystemTypeSelection(this.data.projectType)
        this.systemTypes.forEach((row) => row.checked = row.label === selectedSystemType)

        const selectedBuildingType = this.resolveBuildingTypeSelection(this.data.jobType)
        this.buildingTypes.forEach((row) => row.checked = row.label === selectedBuildingType)
    }

    ngAfterViewInit() {
        this.autosizeScope()
    }

    autosizeScope() {
        const textarea = this.scopeInput?.nativeElement
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

    private resolveJobClassification(): string {
        const parts = [this.data.projectType, this.data.scopeType].filter((value) => `${value || ''}`.trim())
        parts.push(this.data.taxable ? 'Taxable' : 'Non-Taxable')
        return parts.join(' / ')
    }

    private resolveSystemTypeSelection(projectType: string): string {
        const normalized = `${projectType || ''}`.trim().toLowerCase()
        if (normalized === 'sprinkler') {
            return 'Sprinkler'
        }
        if (normalized === 'security') {
            return 'Security'
        }
        return 'Fire Alarm & Detection'
    }

    private resolveBuildingTypeSelection(jobType: string): string {
        const normalized = this.normalizeJobType(jobType)
        if (!normalized) {
            return ''
        }

        const exact = this.buildingTypes.find((row) => this.normalizeJobType(row.label) === normalized)
        if (exact) {
            return exact.label
        }

        const mapped = this.jobTypeSelectionMap[normalized]
        return mapped || ''
    }

    private normalizeJobType(input: string | null | undefined): string {
        return `${input || ''}`
            .trim()
            .toLowerCase()
            .replace(/&/g, 'and')
            .replace(/[^a-z0-9]+/g, ' ')
            .replace(/\s+/g, ' ')
            .trim()
    }

    private readonly jobTypeSelectionMap: Record<string, string> = {
        'educational': 'Education - Primary',
        'health care': 'Health - Hospitals',
        'high rise': 'Commercial - High Rise',
        'hotel and dormitories': 'Education - Dormitories',
        'industrial': 'Industrial',
        'mercantile': 'Merch - Stores/Shops',
        'storage': 'Commercial - Warehouse',
        'supermarket': 'Merch - Stores/Shops',
        'mall': 'Merch - Stores/Shops',
        'shopping center': 'Merch - Stores/Shops',
        'business': 'Commercial - Low Rise',
        'assembly': 'Commercial - Low Rise',
        'ambulatory': 'Health - Treatment Centers',
        'day care': 'Education - Private',
        'detention and correctional': 'Gov - State/Local',
        'lodging or rooming houses': 'Residential',
        'apartment buildings': 'Residential',
        'residential board and care': 'Residential',
        'one and two family dwelling': 'Residential',
        'parking structure': 'Parking Structure'
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
    <title>Contract Set Up</title>
    <style>
        body{margin:0;padding:0;background:#ffffff}
        .contract-setup__paper-inner{padding:18px 22px 24px;background:linear-gradient(rgba(120,130,140,.16) 1px,transparent 1px),linear-gradient(90deg,rgba(120,130,140,.16) 1px,transparent 1px),#fff;background-size:38px 22px,38px 22px,auto;font-family:Arial,sans-serif;color:#101820}
        .contract-setup__brand-row{display:grid;grid-template-columns:1.4fr .95fr;gap:16px;align-items:start}
        .contract-setup__brand-block{display:flex;gap:14px;align-items:flex-start}
        .contract-setup__logo{display:block;width:220px;max-width:100%;height:auto;object-fit:contain}
        .contract-setup__brand-meta{display:grid;gap:2px;font-size:12px;font-weight:700}
        .contract-setup__header-card{display:grid;gap:8px}
        .contract-setup__mini-field{display:grid;grid-template-columns:132px 1fr;gap:8px;align-items:center}
        .contract-setup__mini-field span{font-size:12px;font-weight:700}
        .contract-setup__sheet-name{padding:8px 10px;border:1px solid #101820;text-align:center;font-size:18px;font-weight:700;letter-spacing:.06em}
        .contract-setup__top-grid,.contract-setup__checks-grid,.contract-setup__office-grid{display:grid;grid-template-columns:1fr 1fr;gap:16px;margin-top:14px}
        .contract-setup__panel{display:grid;gap:8px;align-content:start}
        .contract-setup__section-title{font-size:12px;font-weight:700;text-transform:uppercase}
        .contract-setup__section-title--sub{margin-top:10px}
        .contract-setup__field-grid,.contract-setup__mini-stats{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:8px 10px}
        .contract-setup__field{display:grid;gap:2px;min-width:0}
        .contract-setup__field span{font-size:11px;font-weight:700;text-transform:uppercase}
        .contract-setup__field--full{grid-column:1/-1}
        .contract-setup__input{width:100%;border:0;outline:0;padding:2px 4px;background:rgba(245,242,148,.88);color:#101820;font:inherit;box-sizing:border-box}
        .contract-setup__input--multiline{min-height:84px;resize:none;overflow:hidden;line-height:1.35}
        .contract-setup__input--line{background:transparent;border-bottom:1px solid rgba(16,24,32,.24);padding:0;height:20px}
        .contract-setup__amount-row{display:grid;grid-template-columns:220px 180px;gap:0;align-items:stretch;margin-top:14px}
        .contract-setup__amount-label,.contract-setup__amount-value{border:1px solid #101820;padding:6px 10px;font-size:16px;font-weight:700}
        .contract-setup__amount-value{text-align:center;background:rgba(245,242,148,.88)}
        .contract-setup__check-head,.contract-setup__check-row{display:grid;grid-template-columns:1fr 42px 42px;gap:8px;align-items:center}
        .contract-setup__check-head strong{text-align:center;font-size:12px;text-transform:uppercase}
        .contract-setup__check-row{min-height:24px}
        .contract-setup__check-row span{font-size:12px}
        .contract-setup__option-grid{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:6px 12px}
        .contract-setup__option-row{display:grid;grid-template-columns:20px 1fr;gap:8px;align-items:center;font-size:12px}
        .contract-setup__task-row{display:grid;grid-template-columns:1.4fr 1fr;gap:10px;align-items:center;min-height:24px}
        .contract-setup__task-row span{font-size:12px}
    </style>
</head>
<body>${html}</body>
</html>`
    }

    private parseUsAddress(value: string | null | undefined): { street: string, city: string, state: string, zip: string } {
        const input = String(value || '').trim()
        if (!input) {
            return { street: '', city: '', state: '', zip: '' }
        }

        const normalized = input.replace(/\r?\n/g, ', ').replace(/\s+/g, ' ').trim()
        const withoutCountry = normalized.replace(/(?:,\s*|\s+)(usa|united states|united states of america)$/i, '').trim()
        const match = /^(.*?)(?:,\s*|\s+)([A-Za-z .'-]+?)(?:,\s*|\s+)([A-Z]{2})\s+(\d{5}(?:-\d{4})?)$/i.exec(withoutCountry)
        if (match) {
            return {
                street: match[1]?.trim() || '',
                city: match[2]?.trim() || '',
                state: match[3]?.trim() || '',
                zip: match[4]?.trim() || ''
            }
        }

        const parts = withoutCountry.split(',').map((part) => part.trim()).filter((part) => part)
        if (parts.length >= 2) {
            const trailingSegment = parts[parts.length - 1] || ''
            const trailingMatch = /^([A-Z]{2})(?:\s+(\d{5}(?:-\d{4})?))?$/i.exec(trailingSegment)
                || /([A-Z]{2})\s+(\d{5}(?:-\d{4})?)$/i.exec(trailingSegment)
            const cityIndex = trailingMatch ? parts.length - 2 : -1
            return {
                street: parts[0] || '',
                city: cityIndex > 0 ? parts[cityIndex] || '' : parts.slice(1, -1).join(', '),
                state: trailingMatch?.[1] || '',
                zip: trailingMatch?.[2] || ''
            }
        }

        return { street: withoutCountry, city: '', state: '', zip: '' }
    }

    private formatCurrency(value: number | null | undefined): string {
        return Number(value || 0).toLocaleString(undefined, {
            style: 'currency',
            currency: 'USD',
            minimumFractionDigits: 2,
            maximumFractionDigits: 2
        })
    }
}
