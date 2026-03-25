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

export interface EstimateFaceSheetData {
    date: string
    firetrolJobNumber: string
    projectName: string
    estimator: string
    projectAddress: string
    contractor: string
    billingAddress: string
    descriptionOfWork: string
    materialBuyout: number
    rentalTotal: number
    fieldLaborHours: number
    fieldLaborRate: number
    fieldLaborBaseCost: number
    fieldLaborCost: number
    permitsTotal: number
    subcontractTotal: number
    otherTotal: number
    contractCost: number
    contractGainPercent: number
    contractGainAmount: number
    contractTotalWithoutTax: number
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
        <div mat-dialog-title class="estimate-face-sheet__titlebar">
            <div>
                <div class="estimate-face-sheet__title-kicker">Bidding Output</div>
                <div class="estimate-face-sheet__title">Estimate Face Sheet</div>
            </div>
            <button mat-icon-button type="button" aria-label="Close dialog" mat-dialog-close>
                <mat-icon>close</mat-icon>
            </button>
        </div>
        <mat-dialog-content class="estimate-face-sheet">
            <div class="estimate-face-sheet__toolbar">
                <div class="estimate-face-sheet__eyebrow">Estimator Package</div>
            </div>

            <div class="estimate-face-sheet__paper">
                <div #printRoot class="estimate-face-sheet__paper-inner">
                    <div class="estimate-face-sheet__paper-brand-row">
                        <img class="estimate-face-sheet__paper-logo" src="/images/firetrol-logo.png" alt="Firetrol Protection Systems" />
                    </div>
                    <div class="estimate-face-sheet__paper-title">Estimate Face Sheet</div>

                    <table class="estimate-face-sheet__table">
                        <tbody>
                            <tr>
                                <th>Date</th>
                                <td><input class="estimate-face-sheet__paper-input" [(ngModel)]="editable.date" /></td>
                                <th>Job No.</th>
                                <td><input class="estimate-face-sheet__paper-input" [(ngModel)]="editable.firetrolJobNumber" /></td>
                            </tr>
                            <tr>
                                <th>Job Name</th>
                                <td><input class="estimate-face-sheet__paper-input" [(ngModel)]="editable.projectName" /></td>
                                <th>Estimator</th>
                                <td><input class="estimate-face-sheet__paper-input" [(ngModel)]="editable.estimator" /></td>
                            </tr>
                            <tr>
                                <th>Address</th>
                                <td><input class="estimate-face-sheet__paper-input" [(ngModel)]="editable.projectAddress" /></td>
                                <th>Contractor</th>
                                <td><input class="estimate-face-sheet__paper-input" [(ngModel)]="editable.contractor" /></td>
                            </tr>
                            <tr>
                                <th>Billing Address</th>
                                <td><input class="estimate-face-sheet__paper-input" [(ngModel)]="editable.billingAddress" /></td>
                                <th>Contract Cost</th>
                                <td><input class="estimate-face-sheet__paper-input" [(ngModel)]="editable.contractCost" /></td>
                            </tr>
                        </tbody>
                    </table>

                    <div class="estimate-face-sheet__section">
                        <div class="estimate-face-sheet__section-title">Description of Work</div>
                        <textarea
                            #descriptionOfWorkInput
                            class="estimate-face-sheet__paper-input estimate-face-sheet__paper-input--multiline"
                            [(ngModel)]="editable.descriptionOfWork"
                            (input)="autosizeDescriptionOfWork()"></textarea>
                    </div>

                    <div class="estimate-face-sheet__cost-grid">
                        <div class="estimate-face-sheet__cost-card">
                            <div class="estimate-face-sheet__section-title">Materials / Equipment</div>
                            <table class="estimate-face-sheet__table estimate-face-sheet__table--compact">
                                <tbody>
                                    <tr>
                                        <td>Materials-Buyout</td>
                                        <td class="estimate-face-sheet__code-cell">20-80-00</td>
                                        <td class="estimate-face-sheet__value-cell"><input class="estimate-face-sheet__paper-input is-right" [(ngModel)]="editable.materialBuyout" /></td>
                                    </tr>
                                    <tr>
                                        <td>Rental</td>
                                        <td class="estimate-face-sheet__code-cell">30-10-00</td>
                                        <td class="estimate-face-sheet__value-cell"><input class="estimate-face-sheet__paper-input is-right" [(ngModel)]="editable.rentalTotal" /></td>
                                    </tr>
                                    <tr>
                                        <td>Permits</td>
                                        <td class="estimate-face-sheet__code-cell">70-10-00</td>
                                        <td class="estimate-face-sheet__value-cell"><input class="estimate-face-sheet__paper-input is-right" [(ngModel)]="editable.permitsTotal" /></td>
                                    </tr>
                                </tbody>
                            </table>
                        </div>

                        <div class="estimate-face-sheet__cost-card">
                            <div class="estimate-face-sheet__section-title">Contract Labor / Subs</div>
                            <table class="estimate-face-sheet__table estimate-face-sheet__table--compact">
                                <tbody>
                                    <tr>
                                        <td>Field Labor Hours</td>
                                        <td class="estimate-face-sheet__code-cell">10-40-00</td>
                                        <td class="estimate-face-sheet__value-cell"><input class="estimate-face-sheet__paper-input is-right" [(ngModel)]="editable.fieldLaborHours" /></td>
                                    </tr>
                                    <tr>
                                        <td>Field Labor Rate</td>
                                        <td class="estimate-face-sheet__code-cell">10-40-00</td>
                                        <td class="estimate-face-sheet__value-cell"><input class="estimate-face-sheet__paper-input is-right" [(ngModel)]="editable.fieldLaborRate" /></td>
                                    </tr>
                                    <tr>
                                        <td>Sub Contract</td>
                                        <td class="estimate-face-sheet__code-cell">40-10-00</td>
                                        <td class="estimate-face-sheet__value-cell"><input class="estimate-face-sheet__paper-input is-right" [(ngModel)]="editable.subcontractTotal" /></td>
                                    </tr>
                                    <tr>
                                        <td>Other</td>
                                        <td class="estimate-face-sheet__code-cell">40-90-00</td>
                                        <td class="estimate-face-sheet__value-cell"><input class="estimate-face-sheet__paper-input is-right" [(ngModel)]="editable.otherTotal" /></td>
                                    </tr>
                                </tbody>
                            </table>
                        </div>
                    </div>

                    <div class="estimate-face-sheet__metrics">
                        <div class="estimate-face-sheet__metric-card">
                            <span>Contract Gain</span>
                            <input class="estimate-face-sheet__paper-input" [(ngModel)]="editable.contractGain" />
                        </div>
                        <div class="estimate-face-sheet__metric-card">
                            <span>Contract Total without Tax</span>
                            <input class="estimate-face-sheet__paper-input" [(ngModel)]="editable.contractTotalWithoutTax" />
                        </div>
                        <div class="estimate-face-sheet__metric-card">
                            <span>Total Heads</span>
                            <input class="estimate-face-sheet__paper-input" [(ngModel)]="editable.totalHeads" />
                        </div>
                    </div>

                    <div class="estimate-face-sheet__section-title">Price Analysis Factors</div>
                    <div class="estimate-face-sheet__analysis-grid">
                        <div class="estimate-face-sheet__analysis-row"><span>Square Footage</span><input class="estimate-face-sheet__paper-input is-right" [(ngModel)]="editable.squareFootage" /></div>
                        <div class="estimate-face-sheet__analysis-row"><span>Inside Hours per Head</span><input class="estimate-face-sheet__paper-input is-right" [(ngModel)]="editable.insideHoursPerHead" /></div>
                        <div class="estimate-face-sheet__analysis-row"><span>Dollars per Head</span><input class="estimate-face-sheet__paper-input is-right" [(ngModel)]="editable.dollarsPerHead" /></div>
                        <div class="estimate-face-sheet__analysis-row"><span>Dollars per Square Foot</span><input class="estimate-face-sheet__paper-input is-right" [(ngModel)]="editable.dollarsPerSquareFoot" /></div>
                    </div>
                </div>
            </div>
        </mat-dialog-content>
        <mat-dialog-actions align="end" class="estimate-face-sheet__footer">
            <button mat-flat-button color="primary" type="button" (click)="downloadPdf()">
                <mat-icon fontIcon="description"></mat-icon>
                Create Sheet
            </button>
            <button mat-button type="button" mat-dialog-close>Close</button>
        </mat-dialog-actions>
    `,
    styles: [`
        .estimate-face-sheet__titlebar {
            display: flex;
            align-items: center;
            justify-content: space-between;
            padding: 18px 22px 10px;
            border-bottom: 1px solid rgba(72, 221, 255, 0.12);
            background:
                radial-gradient(circle at 0% 0%, rgba(72, 221, 255, 0.08), transparent 34%),
                radial-gradient(circle at 100% 0%, rgba(255, 164, 61, 0.08), transparent 32%),
                rgba(7, 11, 19, 0.96);
        }

        .estimate-face-sheet__title-kicker,
        .estimate-face-sheet__eyebrow {
            color: rgba(177, 213, 228, 0.72);
            font-size: 0.72rem;
            letter-spacing: 0.16em;
            text-transform: uppercase;
        }

        .estimate-face-sheet__title {
            margin-top: 6px;
            color: #f4fbff;
            font-size: 1.08rem;
            font-weight: 700;
            letter-spacing: 0.08em;
            text-transform: uppercase;
        }

        .estimate-face-sheet {
            width: 100%;
            max-width: none;
            min-width: 0;
            display: grid;
            gap: 16px;
            padding: 10px 0 0;
            box-sizing: border-box;
            overflow-x: hidden;
            background:
                linear-gradient(180deg, rgba(255,255,255,0.02), rgba(255,255,255,0)),
                rgba(8, 12, 21, 0.96);
        }

        .estimate-face-sheet__toolbar {
            display: flex;
            align-items: center;
            justify-content: space-between;
            gap: 14px;
            flex-wrap: wrap;
            min-width: 0;
            padding: 0;
        }

        .estimate-face-sheet__paper {
            border: 1px solid rgba(72, 221, 255, 0.16);
            border-radius: 0;
            background: #ffffff;
            min-width: 0;
            overflow-x: hidden;
            overflow-y: auto;
            box-shadow:
                0 18px 40px rgba(0, 0, 0, 0.36),
                0 0 0 1px rgba(72, 221, 255, 0.08);
            box-sizing: border-box;
        }

        .estimate-face-sheet__paper-inner {
            padding: 24px;
            width: 100%;
            min-width: 0;
            box-sizing: border-box;
            font-family: Arial, sans-serif;
            color: #101820;
            background: #ffffff;
        }

        .estimate-face-sheet__paper-brand-row {
            display: flex;
            justify-content: flex-start;
            align-items: flex-start;
        }

        .estimate-face-sheet__paper-logo {
            display: block;
            width: 220px;
            max-width: 100%;
            height: auto;
            object-fit: contain;
        }

        .estimate-face-sheet__paper-title {
            margin-top: 6px;
            margin-bottom: 18px;
            font-size: 24px;
            font-weight: 700;
            color: #101820;
            text-transform: uppercase;
        }

        .estimate-face-sheet__section,
        .estimate-face-sheet__cost-card {
            margin-top: 22px;
        }

        .estimate-face-sheet__section-title {
            margin-bottom: 10px;
            font-weight: 700;
            font-size: 12px;
            text-transform: uppercase;
            color: #101820;
        }

        .estimate-face-sheet__table {
            width: 100%;
            border-collapse: collapse;
            table-layout: fixed;
            color: #101820;
            font-family: Arial, sans-serif;
            font-size: 13px;
        }

        .estimate-face-sheet__table th,
        .estimate-face-sheet__table td {
            border: 1px solid #a9b8c8 !important;
            padding: 8px 10px !important;
            text-align: left !important;
            vertical-align: top !important;
            color: #101820 !important;
            background: #ffffff !important;
            font-family: Arial, sans-serif !important;
        }

        .estimate-face-sheet__table th {
            width: 18%;
            background: #eef4fb !important;
            font-size: 12px;
            text-transform: uppercase;
            letter-spacing: 0.06em;
        }

        .estimate-face-sheet__code-cell {
            width: 100px;
            color: #5a6c7d !important;
        }

        .estimate-face-sheet__value-cell {
            width: 132px;
        }

        .estimate-face-sheet__cost-grid {
            display: grid;
            grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
            gap: 18px;
        }

        .estimate-face-sheet__metrics {
            margin-top: 22px;
            display: grid;
            grid-template-columns: repeat(3, minmax(0, 1fr));
            gap: 12px;
        }

        .estimate-face-sheet__metric-card {
            border: 1px solid #a9b8c8;
            padding: 12px;
            background: #f7fbff;
        }

        .estimate-face-sheet__metric-card span {
            display: block;
            font-size: 11px;
            text-transform: uppercase;
            letter-spacing: 0.08em;
            color: #5a6c7d;
        }

        .estimate-face-sheet__analysis-grid {
            display: grid;
            grid-template-columns: repeat(2, minmax(0, 1fr));
            gap: 10px 18px;
        }

        .estimate-face-sheet__analysis-row {
            display: flex;
            justify-content: space-between;
            gap: 12px;
            padding: 8px 10px;
            border: 1px solid #d2dde9;
            background: #fbfdff;
        }

        .estimate-face-sheet__paper-input {
            width: 100%;
            border: 0;
            outline: 0;
            padding: 0;
            margin: 0;
            background: transparent;
            color: #101820;
            font: inherit;
            box-sizing: border-box;
        }

        .estimate-face-sheet__paper-input.is-right {
            text-align: right;
        }

        .estimate-face-sheet__paper-input--multiline {
            min-height: 110px;
            overflow: hidden;
            resize: none;
            border: 1px solid #a9b8c8;
            padding: 10px 12px;
            line-height: 1.35;
        }

        .estimate-face-sheet__paper-input:focus {
            background: rgba(232, 242, 255, 0.9);
            box-shadow: inset 0 -1px 0 #6da4d6;
        }

        .estimate-face-sheet__paper-input--multiline:focus {
            box-shadow: inset 0 0 0 1px #6da4d6;
        }

        .estimate-face-sheet__footer {
            padding: 8px 22px 18px;
            border-top: 1px solid rgba(72, 221, 255, 0.08);
            background: rgba(7, 11, 19, 0.96);
        }

        .estimate-face-sheet__footer button[mat-flat-button] {
            background:
                linear-gradient(180deg, rgba(255, 140, 40, 0.9), rgba(255, 102, 40, 0.78)),
                rgba(255, 120, 50, 0.82);
            color: #fff7ef;
            margin-right: 8px;
        }

        @media (max-width: 720px) {
            .estimate-face-sheet__titlebar {
                padding: 16px 16px 10px;
            }

            .estimate-face-sheet__paper-inner {
                padding: 16px;
            }

            .estimate-face-sheet__cost-grid,
            .estimate-face-sheet__metrics,
            .estimate-face-sheet__analysis-grid {
                grid-template-columns: 1fr;
            }

            .estimate-face-sheet__footer {
                padding: 8px 16px 16px;
            }
        }
    `]
})
export class EstimateFaceSheetDialog implements AfterViewInit {
    data: EstimateFaceSheetData = inject(MAT_DIALOG_DATA)
    @ViewChild('printRoot') private printRoot?: ElementRef<HTMLElement>
    @ViewChild('descriptionOfWorkInput') private descriptionOfWorkInput?: ElementRef<HTMLTextAreaElement>

    editable = {
        date: '',
        firetrolJobNumber: '',
        projectName: '',
        estimator: '',
        projectAddress: '',
        contractor: '',
        billingAddress: '',
        descriptionOfWork: '',
        materialBuyout: '',
        rentalTotal: '',
        permitsTotal: '',
        fieldLaborHours: '',
        fieldLaborRate: '',
        subcontractTotal: '',
        otherTotal: '',
        contractCost: '',
        contractGain: '',
        contractTotalWithoutTax: '',
        totalHeads: '',
        squareFootage: '',
        insideHoursPerHead: '',
        dollarsPerHead: '',
        dollarsPerSquareFoot: ''
    }

    constructor() {
        this.editable = {
            date: this.data.date || '',
            firetrolJobNumber: this.data.firetrolJobNumber || '',
            projectName: this.data.projectName || '',
            estimator: this.data.estimator || '',
            projectAddress: this.data.projectAddress || '',
            contractor: this.data.contractor || '',
            billingAddress: this.data.billingAddress || '',
            descriptionOfWork: this.data.descriptionOfWork || '',
            materialBuyout: this.formatCurrency(this.data.materialBuyout),
            rentalTotal: this.formatCurrency(this.data.rentalTotal),
            permitsTotal: this.formatCurrency(this.data.permitsTotal),
            fieldLaborHours: this.data.fieldLaborHours.toFixed(2),
            fieldLaborRate: this.formatCurrency(this.data.fieldLaborRate),
            subcontractTotal: this.formatCurrency(this.data.subcontractTotal),
            otherTotal: this.formatCurrency(this.data.otherTotal),
            contractCost: this.formatCurrency(this.data.contractCost),
            contractGain: `${this.data.contractGainPercent.toFixed(2)}% / ${this.formatCurrency(this.data.contractGainAmount)}`,
            contractTotalWithoutTax: this.formatCurrency(this.data.contractTotalWithoutTax),
            totalHeads: `${this.data.totalHeads}`,
            squareFootage: `${this.data.squareFootage}`,
            insideHoursPerHead: this.data.insideHoursPerHead.toFixed(2),
            dollarsPerHead: this.formatCurrency(this.data.dollarsPerHead),
            dollarsPerSquareFoot: this.formatCurrency(this.data.dollarsPerSquareFoot)
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

    formatCurrency(value: number): string {
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
    <title>Estimate Face Sheet</title>
    <style>
        body{margin:0;padding:0;background:#ffffff}
        .estimate-face-sheet__paper-inner{padding:24px;width:100%;min-width:0;box-sizing:border-box;font-family:Arial,sans-serif;color:#101820;background:#ffffff}
        .estimate-face-sheet__paper-brand-row{display:flex;justify-content:flex-start;align-items:flex-start}
        .estimate-face-sheet__paper-logo{display:block;width:220px;max-width:100%;height:auto;object-fit:contain}
        .estimate-face-sheet__paper-title{margin-top:6px;margin-bottom:18px;font-size:24px;font-weight:700;color:#101820;text-transform:uppercase}
        .estimate-face-sheet__section,.estimate-face-sheet__cost-card{margin-top:22px}
        .estimate-face-sheet__section-title{margin-bottom:10px;font-weight:700;font-size:12px;text-transform:uppercase;color:#101820}
        .estimate-face-sheet__table{width:100%;border-collapse:collapse;table-layout:fixed;color:#101820;font-family:Arial,sans-serif;font-size:13px}
        .estimate-face-sheet__table th,.estimate-face-sheet__table td{border:1px solid #a9b8c8 !important;padding:8px 10px !important;text-align:left !important;vertical-align:top !important;color:#101820 !important;background:#ffffff !important;font-family:Arial,sans-serif !important}
        .estimate-face-sheet__table th{width:18%;background:#eef4fb !important;font-size:12px;text-transform:uppercase;letter-spacing:.06em}
        .estimate-face-sheet__code-cell{width:100px;color:#5a6c7d !important}
        .estimate-face-sheet__value-cell{width:132px}
        .estimate-face-sheet__cost-grid{display:grid;grid-template-columns:minmax(0,1fr) minmax(0,1fr);gap:18px}
        .estimate-face-sheet__metrics{margin-top:22px;display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:12px}
        .estimate-face-sheet__metric-card{border:1px solid #a9b8c8;padding:12px;background:#f7fbff}
        .estimate-face-sheet__metric-card span{display:block;font-size:11px;text-transform:uppercase;letter-spacing:.08em;color:#5a6c7d}
        .estimate-face-sheet__analysis-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:10px 18px}
        .estimate-face-sheet__analysis-row{display:flex;justify-content:space-between;gap:12px;padding:8px 10px;border:1px solid #d2dde9;background:#fbfdff}
        .estimate-face-sheet__paper-input{width:100%;border:0;outline:0;padding:0;margin:0;background:transparent;color:#101820;font:inherit;box-sizing:border-box}
        .estimate-face-sheet__paper-input.is-right{text-align:right}
        .estimate-face-sheet__paper-input--multiline{min-height:110px;overflow:hidden;resize:none;border:1px solid #a9b8c8;padding:10px 12px;line-height:1.35}
    </style>
</head>
<body>${html}</body>
</html>`
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
