import { CommonModule } from '@angular/common'
import { AfterViewInit, Component, ElementRef, ViewChild, inject } from '@angular/core'
import { FormsModule } from '@angular/forms'
import { MatButtonModule } from '@angular/material/button'
import {
    MAT_DIALOG_DATA,
    MatDialogActions,
    MatDialogClose,
    MatDialogContent,
    MatDialogTitle
} from '@angular/material/dialog'
import { MatIconModule } from '@angular/material/icon'

export interface BookingFaceSheetData {
    date: string
    firetrolJobNumber: string
    projectName: string
    estimator: string
    projectStreet: string
    projectCity: string
    projectState: string
    projectZip: string
    contractor: string
    phone: string
    fax: string
    billingStreet: string
    billingCity: string
    billingState: string
    billingZip: string
    descriptionOfWork: string
    materialsBuyout: number
    materialOther: number
    rentalInside: number
    fieldLaborHours: number
    fieldLaborRate: number
    fieldLaborCost: number
    permitsTotal: number
    subcontractTotal: number
    otherTotal: number
    contractCost: number
    contractGainPercent: number
    contractGainAmount: number
    contractTotal: number
    totalHeads: number
    squareFootage: number
    insideHoursPerHead: number
    dollarsPerHead: number
    dollarsPerSquareFoot: number
}

@Component({
    standalone: true,
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
        <div mat-dialog-title class="booking-face-sheet__titlebar">
            <div>
                <div class="booking-face-sheet__title-kicker">Booking Output</div>
                <div class="booking-face-sheet__title">Face Sheet</div>
            </div>
            <button mat-icon-button type="button" aria-label="Close dialog" mat-dialog-close>
                <mat-icon>close</mat-icon>
            </button>
        </div>
        <mat-dialog-content class="booking-face-sheet">
            <div class="booking-face-sheet__toolbar">
                <div class="booking-face-sheet__eyebrow">Operations Package</div>
            </div>

            <div class="booking-face-sheet__paper">
                <div #printRoot class="booking-face-sheet__paper-inner">
                    <div class="booking-face-sheet__sheet-head">
                        <div>FIRETROL PROTECTION SYSTEMS, INC.</div>
                        <div>ESTIMATE FACE SHEET</div>
                    </div>

                    <table class="booking-face-sheet__table booking-face-sheet__table--header">
                        <tbody>
                            <tr>
                                <th>Date</th>
                                <td><input class="booking-face-sheet__paper-input" [(ngModel)]="editable.date" /></td>
                                <th>Job No.</th>
                                <td><input class="booking-face-sheet__paper-input" [(ngModel)]="editable.firetrolJobNumber" /></td>
                            </tr>
                            <tr>
                                <th>Job Name</th>
                                <td><input class="booking-face-sheet__paper-input" [(ngModel)]="editable.projectName" /></td>
                                <th>Estimator</th>
                                <td><input class="booking-face-sheet__paper-input" [(ngModel)]="editable.estimator" /></td>
                            </tr>
                            <tr>
                                <th>Address</th>
                                <td><input class="booking-face-sheet__paper-input" [(ngModel)]="editable.projectStreet" /></td>
                                <th></th>
                                <td></td>
                            </tr>
                            <tr>
                                <th></th>
                                <td>
                                    <div class="booking-face-sheet__address-inline">
                                        <input class="booking-face-sheet__paper-input" [(ngModel)]="editable.projectCity" />
                                        <input class="booking-face-sheet__paper-input" [(ngModel)]="editable.projectState" />
                                        <input class="booking-face-sheet__paper-input" [(ngModel)]="editable.projectZip" />
                                    </div>
                                </td>
                                <th></th>
                                <td></td>
                            </tr>
                            <tr>
                                <th>Contractor</th>
                                <td><input class="booking-face-sheet__paper-input" [(ngModel)]="editable.contractor" /></td>
                                <th>Phone #</th>
                                <td><input class="booking-face-sheet__paper-input" [(ngModel)]="editable.phone" /></td>
                            </tr>
                            <tr>
                                <th>Billing Address</th>
                                <td><input class="booking-face-sheet__paper-input" [(ngModel)]="editable.billingStreet" /></td>
                                <th>Fax #</th>
                                <td><input class="booking-face-sheet__paper-input" [(ngModel)]="editable.fax" /></td>
                            </tr>
                            <tr>
                                <th></th>
                                <td>
                                    <div class="booking-face-sheet__address-inline">
                                        <input class="booking-face-sheet__paper-input" [(ngModel)]="editable.billingCity" />
                                        <input class="booking-face-sheet__paper-input" [(ngModel)]="editable.billingState" />
                                        <input class="booking-face-sheet__paper-input" [(ngModel)]="editable.billingZip" />
                                    </div>
                                </td>
                                <th></th>
                                <td></td>
                            </tr>
                        </tbody>
                    </table>

                    <div class="booking-face-sheet__section">
                        <div class="booking-face-sheet__section-title">Description of Work</div>
                        <textarea
                            #descriptionOfWorkInput
                            class="booking-face-sheet__paper-input booking-face-sheet__paper-input--multiline"
                            [(ngModel)]="editable.descriptionOfWork"
                            (input)="autosizeDescriptionOfWork()"></textarea>
                    </div>

                    <div class="booking-face-sheet__cost-shell">
                        <table class="booking-face-sheet__table">
                            <thead>
                                <tr>
                                    <th>Description</th>
                                    <th>Cost Code</th>
                                    <th>Hours</th>
                                    <th>Rate</th>
                                    <th>Cost</th>
                                    <th>Total</th>
                                </tr>
                            </thead>
                            <tbody>
                                <tr class="booking-face-sheet__section-row"><td colspan="6">Total Materials</td></tr>
                                <tr>
                                    <td>Materials-Buyout</td>
                                    <td>20-80-00</td>
                                    <td></td>
                                    <td></td>
                                    <td><input class="booking-face-sheet__paper-input is-right" [(ngModel)]="editable.materialsBuyout" /></td>
                                    <td><input class="booking-face-sheet__paper-input is-right" [(ngModel)]="editable.materialsBuyout" /></td>
                                </tr>
                                <tr>
                                    <td>Material Other</td>
                                    <td>20-70-00</td>
                                    <td></td>
                                    <td></td>
                                    <td><input class="booking-face-sheet__paper-input is-right" [(ngModel)]="editable.materialOther" /></td>
                                    <td><input class="booking-face-sheet__paper-input is-right" [(ngModel)]="editable.materialOther" /></td>
                                </tr>

                                <tr class="booking-face-sheet__section-row"><td colspan="6">Equipment</td></tr>
                                <tr>
                                    <td>Rental - Inside</td>
                                    <td>30-10-00</td>
                                    <td></td>
                                    <td></td>
                                    <td><input class="booking-face-sheet__paper-input is-right" [(ngModel)]="editable.rentalInside" /></td>
                                    <td><input class="booking-face-sheet__paper-input is-right" [(ngModel)]="editable.rentalInside" /></td>
                                </tr>

                                <tr class="booking-face-sheet__section-row"><td colspan="6">Contract Labor</td></tr>
                                <tr>
                                    <td>Field Labor</td>
                                    <td>10-40-00</td>
                                    <td><input class="booking-face-sheet__paper-input is-right" [(ngModel)]="editable.fieldLaborHours" /></td>
                                    <td><input class="booking-face-sheet__paper-input is-right" [(ngModel)]="editable.fieldLaborRate" /></td>
                                    <td><input class="booking-face-sheet__paper-input is-right" [(ngModel)]="editable.fieldLaborCost" /></td>
                                    <td><input class="booking-face-sheet__paper-input is-right" [(ngModel)]="editable.fieldLaborCost" /></td>
                                </tr>

                                <tr class="booking-face-sheet__section-row"><td colspan="6">Permits</td></tr>
                                <tr>
                                    <td>Engineering Permit</td>
                                    <td>70-10-00</td>
                                    <td></td>
                                    <td></td>
                                    <td><input class="booking-face-sheet__paper-input is-right" [(ngModel)]="editable.permitsTotal" /></td>
                                    <td><input class="booking-face-sheet__paper-input is-right" [(ngModel)]="editable.permitsTotal" /></td>
                                </tr>

                                <tr class="booking-face-sheet__section-row"><td colspan="6">Sub Contract</td></tr>
                                <tr>
                                    <td>Sub Contract</td>
                                    <td>40-10-00</td>
                                    <td></td>
                                    <td></td>
                                    <td><input class="booking-face-sheet__paper-input is-right" [(ngModel)]="editable.subcontractTotal" /></td>
                                    <td><input class="booking-face-sheet__paper-input is-right" [(ngModel)]="editable.subcontractTotal" /></td>
                                </tr>

                                <tr class="booking-face-sheet__section-row"><td colspan="6">Other</td></tr>
                                <tr>
                                    <td>Other</td>
                                    <td>40-90-00</td>
                                    <td></td>
                                    <td></td>
                                    <td><input class="booking-face-sheet__paper-input is-right" [(ngModel)]="editable.otherTotal" /></td>
                                    <td><input class="booking-face-sheet__paper-input is-right" [(ngModel)]="editable.otherTotal" /></td>
                                </tr>
                            </tbody>
                        </table>
                    </div>

                    <div class="booking-face-sheet__summary-grid">
                        <div class="booking-face-sheet__summary-card">
                            <div class="booking-face-sheet__summary-row"><span>Contract Cost</span><strong>{{editable.contractCost}}</strong></div>
                            <div class="booking-face-sheet__summary-row"><span>Contract Gain</span><strong>{{editable.contractGain}}</strong></div>
                            <div class="booking-face-sheet__summary-row booking-face-sheet__summary-row--grand"><span>Contract Total</span><strong>{{editable.contractTotal}}</strong></div>
                        </div>

                        <div class="booking-face-sheet__summary-card">
                            <div class="booking-face-sheet__summary-title">Price Analysis Factors</div>
                            <div class="booking-face-sheet__summary-row"><span>Total Heads</span><strong>{{editable.totalHeads}}</strong></div>
                            <div class="booking-face-sheet__summary-row"><span>Square Footage</span><strong>{{editable.squareFootage}}</strong></div>
                            <div class="booking-face-sheet__summary-row"><span>Inside Hours per Head</span><strong>{{editable.insideHoursPerHead}}</strong></div>
                            <div class="booking-face-sheet__summary-row"><span>Dollars per Head</span><strong>{{editable.dollarsPerHead}}</strong></div>
                            <div class="booking-face-sheet__summary-row"><span>Dollars per Square Foot</span><strong>{{editable.dollarsPerSquareFoot}}</strong></div>
                        </div>
                    </div>

                    <table class="booking-face-sheet__table booking-face-sheet__table--footer">
                        <tbody>
                            <tr>
                                <th>Job #</th>
                                <th>Start</th>
                                <th>End</th>
                                <th>P.M.</th>
                                <th>Approval</th>
                                <th>Date</th>
                            </tr>
                            <tr>
                                <td><input class="booking-face-sheet__paper-input" [(ngModel)]="editable.firetrolJobNumber" /></td>
                                <td><input class="booking-face-sheet__paper-input" [(ngModel)]="editable.startDate" /></td>
                                <td><input class="booking-face-sheet__paper-input" [(ngModel)]="editable.endDate" /></td>
                                <td><input class="booking-face-sheet__paper-input" [(ngModel)]="editable.projectManager" /></td>
                                <td><input class="booking-face-sheet__paper-input" [(ngModel)]="editable.approval" /></td>
                                <td><input class="booking-face-sheet__paper-input" [(ngModel)]="editable.approvalDate" /></td>
                            </tr>
                        </tbody>
                    </table>
                </div>
            </div>
        </mat-dialog-content>
        <mat-dialog-actions align="end" class="booking-face-sheet__footer">
            <button mat-flat-button type="button" (click)="downloadPdf()">
                <mat-icon fontIcon="description"></mat-icon>
                Create Sheet
            </button>
            <button mat-button type="button" mat-dialog-close>Close</button>
        </mat-dialog-actions>
    `,
    styles: [`
        .booking-face-sheet__titlebar{display:flex;align-items:center;justify-content:space-between;padding:18px 22px 10px;border-bottom:1px solid rgba(72,221,255,.12);background:radial-gradient(circle at 0% 0%,rgba(72,221,255,.08),transparent 34%),radial-gradient(circle at 100% 0%,rgba(255,164,61,.08),transparent 32%),rgba(7,11,19,.96)}
        .booking-face-sheet__title-kicker,.booking-face-sheet__eyebrow{color:rgba(177,213,228,.72);font-size:.72rem;letter-spacing:.16em;text-transform:uppercase}
        .booking-face-sheet__title{margin-top:6px;color:#f4fbff;font-size:1.08rem;font-weight:700;letter-spacing:.08em;text-transform:uppercase}
        .booking-face-sheet{width:100%;display:grid;gap:16px;padding:10px 0 0;box-sizing:border-box;overflow-x:hidden;background:linear-gradient(180deg,rgba(255,255,255,.02),rgba(255,255,255,0)),rgba(8,12,21,.96)}
        .booking-face-sheet__toolbar{padding:0}
        .booking-face-sheet__paper{border:1px solid rgba(72,221,255,.16);border-radius:0;background:#fff;overflow:auto;box-shadow:0 18px 40px rgba(0,0,0,.36),0 0 0 1px rgba(72,221,255,.08)}
        .booking-face-sheet__paper-inner{padding:18px 20px 24px;background:linear-gradient(rgba(120,130,140,.16) 1px,transparent 1px),linear-gradient(90deg,rgba(120,130,140,.16) 1px,transparent 1px),#fff;background-size:38px 22px,38px 22px,auto;font-family:Arial,sans-serif;color:#101820}
        .booking-face-sheet__sheet-head{display:grid;justify-items:center;font-size:12px;font-weight:700;text-transform:uppercase}
        .booking-face-sheet__table{width:100%;border-collapse:collapse;table-layout:fixed;font-size:12px}
        .booking-face-sheet__table th,.booking-face-sheet__table td{border:1px solid #a9b8c8;padding:4px 6px;vertical-align:middle;background:#fff;color:#101820}
        .booking-face-sheet__table--header th{width:16%;background:#f5f7fa;text-transform:uppercase}
        .booking-face-sheet__table--footer{margin-top:16px}
        .booking-face-sheet__table--footer th{text-transform:uppercase;background:#f5f7fa}
        .booking-face-sheet__address-inline{display:grid;grid-template-columns:minmax(0,1fr) 64px 84px;gap:6px}
        .booking-face-sheet__section{margin-top:14px}
        .booking-face-sheet__section-title{margin-bottom:6px;font-size:12px;font-weight:700;text-transform:uppercase}
        .booking-face-sheet__cost-shell{margin-top:14px}
        .booking-face-sheet__section-row td{background:#fff7a8;font-weight:700;text-transform:uppercase}
        .booking-face-sheet__summary-grid{display:grid;grid-template-columns:minmax(0,1fr) minmax(0,1fr);gap:18px;margin-top:16px}
        .booking-face-sheet__summary-card{border:1px solid #a9b8c8;padding:12px;background:#f9fbff}
        .booking-face-sheet__summary-title{margin-bottom:8px;font-weight:700;text-transform:uppercase}
        .booking-face-sheet__summary-row{display:flex;justify-content:space-between;gap:12px;padding:5px 0;border-bottom:1px solid #d8e1ea}
        .booking-face-sheet__summary-row:last-child{border-bottom:0}
        .booking-face-sheet__summary-row--grand{font-size:1.1rem;font-weight:700}
        .booking-face-sheet__paper-input{width:100%;border:0;outline:0;padding:0;margin:0;background:transparent;color:#101820;font:inherit;box-sizing:border-box}
        .booking-face-sheet__paper-input.is-right{text-align:right}
        .booking-face-sheet__paper-input--multiline{min-height:66px;overflow:hidden;resize:none;border:1px solid #a9b8c8;padding:8px 10px;line-height:1.35;background:rgba(255,255,210,.62)}
        .booking-face-sheet__paper-input:focus{background:rgba(232,242,255,.72)}
        .booking-face-sheet__paper-input--multiline:focus{box-shadow:inset 0 0 0 1px #6da4d6}
        .booking-face-sheet__footer{padding:8px 22px 18px;border-top:1px solid rgba(72,221,255,.08);background:rgba(7,11,19,.96)}
        .booking-face-sheet__footer button[mat-flat-button]{background:linear-gradient(180deg,rgba(255,140,40,.9),rgba(255,102,40,.78)),rgba(255,120,50,.82);color:#fff7ef;margin-right:8px}
        @media (max-width:720px){.booking-face-sheet__titlebar{padding:16px 16px 10px}.booking-face-sheet__paper-inner{padding:16px}.booking-face-sheet__summary-grid,.booking-face-sheet__address-inline{grid-template-columns:1fr}.booking-face-sheet__footer{padding:8px 16px 16px}}
    `]
})
export class BookingFaceSheetDialog implements AfterViewInit {
    data: BookingFaceSheetData = inject(MAT_DIALOG_DATA)
    @ViewChild('printRoot') private printRoot?: ElementRef<HTMLElement>
    @ViewChild('descriptionOfWorkInput') private descriptionOfWorkInput?: ElementRef<HTMLTextAreaElement>

    editable = {
        date: '',
        firetrolJobNumber: '',
        projectName: '',
        estimator: '',
        projectStreet: '',
        projectCity: '',
        projectState: '',
        projectZip: '',
        contractor: '',
        phone: '',
        fax: '',
        billingStreet: '',
        billingCity: '',
        billingState: '',
        billingZip: '',
        descriptionOfWork: '',
        materialsBuyout: '',
        materialOther: '',
        rentalInside: '',
        fieldLaborHours: '',
        fieldLaborRate: '',
        fieldLaborCost: '',
        permitsTotal: '',
        subcontractTotal: '',
        otherTotal: '',
        contractCost: '',
        contractGain: '',
        contractTotal: '',
        totalHeads: '',
        squareFootage: '',
        insideHoursPerHead: '',
        dollarsPerHead: '',
        dollarsPerSquareFoot: '',
        startDate: '',
        endDate: '',
        projectManager: '',
        approval: '',
        approvalDate: ''
    }

    constructor() {
        this.editable = {
            date: this.data.date || '',
            firetrolJobNumber: this.data.firetrolJobNumber || '',
            projectName: this.data.projectName || '',
            estimator: this.data.estimator || '',
            projectStreet: this.data.projectStreet || '',
            projectCity: this.data.projectCity || '',
            projectState: this.data.projectState || '',
            projectZip: this.data.projectZip || '',
            contractor: this.data.contractor || '',
            phone: this.data.phone || '',
            fax: this.data.fax || '',
            billingStreet: this.data.billingStreet || '',
            billingCity: this.data.billingCity || '',
            billingState: this.data.billingState || '',
            billingZip: this.data.billingZip || '',
            descriptionOfWork: this.data.descriptionOfWork || '',
            materialsBuyout: this.formatCurrency(this.data.materialsBuyout),
            materialOther: this.formatCurrency(this.data.materialOther),
            rentalInside: this.formatCurrency(this.data.rentalInside),
            fieldLaborHours: this.data.fieldLaborHours.toFixed(2),
            fieldLaborRate: this.formatCurrency(this.data.fieldLaborRate),
            fieldLaborCost: this.formatCurrency(this.data.fieldLaborCost),
            permitsTotal: this.formatCurrency(this.data.permitsTotal),
            subcontractTotal: this.formatCurrency(this.data.subcontractTotal),
            otherTotal: this.formatCurrency(this.data.otherTotal),
            contractCost: this.formatCurrency(this.data.contractCost),
            contractGain: `${this.data.contractGainPercent.toFixed(2)}% / ${this.formatCurrency(this.data.contractGainAmount)}`,
            contractTotal: this.formatCurrency(this.data.contractTotal),
            totalHeads: `${this.data.totalHeads}`,
            squareFootage: `${this.data.squareFootage}`,
            insideHoursPerHead: this.data.insideHoursPerHead.toFixed(2),
            dollarsPerHead: this.formatCurrency(this.data.dollarsPerHead),
            dollarsPerSquareFoot: this.formatCurrency(this.data.dollarsPerSquareFoot),
            startDate: '',
            endDate: '',
            projectManager: '',
            approval: '',
            approvalDate: this.data.date || ''
        }
    }

    ngAfterViewInit() {
        this.autosizeDescriptionOfWork()
    }

    autosizeDescriptionOfWork() {
        const textarea = this.descriptionOfWorkInput?.nativeElement
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

    private formatCurrency(value: number): string {
        return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(Number(value || 0))
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
    <title>Booking Face Sheet</title>
    <style>
        body{margin:0;padding:0;background:#ffffff}
        .booking-face-sheet__paper-inner{padding:18px 20px 24px;background:linear-gradient(rgba(120,130,140,.16) 1px,transparent 1px),linear-gradient(90deg,rgba(120,130,140,.16) 1px,transparent 1px),#fff;background-size:38px 22px,38px 22px,auto;font-family:Arial,sans-serif;color:#101820}
        .booking-face-sheet__sheet-head{display:grid;justify-items:center;font-size:12px;font-weight:700;text-transform:uppercase}
        .booking-face-sheet__table{width:100%;border-collapse:collapse;table-layout:fixed;font-size:12px}
        .booking-face-sheet__table th,.booking-face-sheet__table td{border:1px solid #a9b8c8;padding:4px 6px;vertical-align:middle;background:#fff;color:#101820}
        .booking-face-sheet__table--header th{width:16%;background:#f5f7fa;text-transform:uppercase}
        .booking-face-sheet__table--footer th{text-transform:uppercase;background:#f5f7fa}
        .booking-face-sheet__address-inline{display:grid;grid-template-columns:minmax(0,1fr) 64px 84px;gap:6px}
        .booking-face-sheet__section{margin-top:14px}
        .booking-face-sheet__section-title{margin-bottom:6px;font-size:12px;font-weight:700;text-transform:uppercase}
        .booking-face-sheet__cost-shell{margin-top:14px}
        .booking-face-sheet__section-row td{background:#fff7a8;font-weight:700;text-transform:uppercase}
        .booking-face-sheet__summary-grid{display:grid;grid-template-columns:minmax(0,1fr) minmax(0,1fr);gap:18px;margin-top:16px}
        .booking-face-sheet__summary-card{border:1px solid #a9b8c8;padding:12px;background:#f9fbff}
        .booking-face-sheet__summary-title{margin-bottom:8px;font-weight:700;text-transform:uppercase}
        .booking-face-sheet__summary-row{display:flex;justify-content:space-between;gap:12px;padding:5px 0;border-bottom:1px solid #d8e1ea}
        .booking-face-sheet__summary-row:last-child{border-bottom:0}
        .booking-face-sheet__summary-row--grand{font-size:1.1rem;font-weight:700}
        .booking-face-sheet__paper-input{width:100%;border:0;outline:0;padding:0;margin:0;background:transparent;color:#101820;font:inherit;box-sizing:border-box}
        .booking-face-sheet__paper-input.is-right{text-align:right}
        .booking-face-sheet__paper-input--multiline{min-height:66px;overflow:hidden;resize:none;border:1px solid #a9b8c8;padding:8px 10px;line-height:1.35;background:rgba(255,255,210,.62)}
    </style>
</head>
<body>${html}</body>
</html>`
    }
}
