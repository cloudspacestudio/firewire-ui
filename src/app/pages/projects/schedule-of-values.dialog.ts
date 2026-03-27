import { CommonModule } from '@angular/common'
import { Component, ElementRef, ViewChild, inject } from '@angular/core'
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

interface ScheduleOfValuesRow {
    itemNo: string
    description: string
    scheduledValue: number
    previousApplication: number
    thisPeriod: number
    materialsPresentlyStored: number
    percentGc: number
}

export interface ScheduleOfValuesDialogData {
    defaultFileName?: string
    createSheet?: (fileName: string, html: string) => Promise<void> | void
    applicationNumber: string
    applicationDate: string
    periodTo: string
    firetrolContractNo: string
    projectName: string
    rows: ScheduleOfValuesRow[]
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
        <div mat-dialog-title class="sov__titlebar">
            <div>
                <div class="sov__title-kicker">Booking Output</div>
                <div class="sov__title">Schedule Of Values</div>
            </div>
            <button mat-icon-button type="button" aria-label="Close dialog" mat-dialog-close>
                <mat-icon>close</mat-icon>
            </button>
        </div>
        <mat-dialog-content class="sov">
            <div class="sov__eyebrow">Application And Certificate For Payment</div>
            <div class="sov__paper">
                <div #printRoot class="sov__paper-inner">
                    <div class="sov__header-band">
                        <div class="sov__doc-title">AIA DOCUMENT G703</div>
                        <div class="sov__doc-page">PAGE 1</div>
                    </div>

                    <div class="sov__meta-grid">
                        <div class="sov__meta-copy">
                            <div>AIA Document G702, APPLICATION AND CERTIFICATE FOR PAYMENT,</div>
                            <div>containing Contractor's signed Certification, is attached.</div>
                            <div>In tabulations below, amounts are stated to the nearest dollar.</div>
                            <div>Use Column I on Contracts where variable retainage for line items may apply.</div>
                        </div>
                        <div class="sov__meta-fields">
                            <label><span>Application Number:</span><input class="sov__input" [(ngModel)]="editable.applicationNumber" /></label>
                            <label><span>Application Date:</span><input class="sov__input" [(ngModel)]="editable.applicationDate" /></label>
                            <label><span>Period To:</span><input class="sov__input" [(ngModel)]="editable.periodTo" /></label>
                            <label><span>Firetrol Contract No.:</span><input class="sov__input" [(ngModel)]="editable.firetrolContractNo" /></label>
                            <label><span>Project Name:</span><input class="sov__input" [(ngModel)]="editable.projectName" /></label>
                        </div>
                    </div>

                    <table class="sov__table">
                        <thead>
                            <tr>
                                <th>A<br />Item No.</th>
                                <th>B<br />Description of Work</th>
                                <th>C<br />Scheduled Value</th>
                                <th>D<br />From Previous Application</th>
                                <th>E<br />This Period</th>
                                <th>F<br />Materials Presently Stored</th>
                                <th>G<br />Total Completed And Stored To Date</th>
                                <th>% (GC)</th>
                                <th>H<br />Balance To Finish</th>
                                <th>I<br />Retainage</th>
                            </tr>
                        </thead>
                        <tbody>
                            <tr *ngFor="let row of editable.rows">
                                <td><input class="sov__input" [(ngModel)]="row.itemNo" /></td>
                                <td><input class="sov__input" [(ngModel)]="row.description" /></td>
                                <td><input class="sov__input is-right" [(ngModel)]="row.scheduledValueDisplay" /></td>
                                <td><input class="sov__input is-right" [(ngModel)]="row.previousApplicationDisplay" /></td>
                                <td><input class="sov__input is-right" [(ngModel)]="row.thisPeriodDisplay" /></td>
                                <td><input class="sov__input is-right" [(ngModel)]="row.materialsPresentlyStoredDisplay" /></td>
                                <td class="is-right">{{row.totalCompletedAndStoredDisplay}}</td>
                                <td><input class="sov__input is-right" [(ngModel)]="row.percentGcDisplay" /></td>
                                <td class="is-right">{{row.balanceToFinishDisplay}}</td>
                                <td class="is-right">{{row.retainageDisplay}}</td>
                            </tr>
                            <tr *ngFor="let row of fillerRows">
                                <td>{{row}}</td>
                                <td></td>
                                <td class="is-right"></td>
                                <td class="is-right">0.00</td>
                                <td class="is-right">0.00</td>
                                <td class="is-right">0.00</td>
                                <td class="is-right">0.00</td>
                                <td class="is-right">0%</td>
                                <td class="is-right">0.00</td>
                                <td class="is-right">0.00</td>
                            </tr>
                            <tr class="sov__total-row">
                                <td colspan="2">Page Total</td>
                                <td class="is-right">{{pageTotalDisplay}}</td>
                                <td class="is-right">{{previousApplicationTotalDisplay}}</td>
                                <td class="is-right">{{thisPeriodTotalDisplay}}</td>
                                <td class="is-right">{{materialsStoredTotalDisplay}}</td>
                                <td class="is-right">{{completedAndStoredTotalDisplay}}</td>
                                <td class="is-right"></td>
                                <td class="is-right">{{balanceToFinishTotalDisplay}}</td>
                                <td class="is-right">{{retainageTotalDisplay}}</td>
                            </tr>
                            <tr class="sov__total-row">
                                <td colspan="2">Schedule Total</td>
                                <td class="is-right">{{pageTotalDisplay}}</td>
                                <td colspan="7"></td>
                            </tr>
                        </tbody>
                    </table>
                </div>
            </div>
        </mat-dialog-content>
        <mat-dialog-actions align="end" class="sov__footer">
            <div class="sov__footer-status" *ngIf="statusText">{{statusText}}</div>
            <button mat-flat-button type="button" (click)="createSheet()" [disabled]="saveWorking">
                <mat-icon fontIcon="description"></mat-icon>
                Create Sheet
            </button>
            <button mat-stroked-button type="button" (click)="printSheet()">
                <mat-icon fontIcon="print"></mat-icon>
                Print Sheet
            </button>
            <button mat-button type="button" mat-dialog-close>Close</button>
        </mat-dialog-actions>
    `,
    styles: [`
        .sov__titlebar{display:flex;align-items:center;justify-content:space-between;padding:18px 22px 10px;border-bottom:1px solid rgba(72,221,255,.12);background:radial-gradient(circle at 0% 0%,rgba(72,221,255,.08),transparent 34%),radial-gradient(circle at 100% 0%,rgba(255,164,61,.08),transparent 32%),rgba(7,11,19,.96)}
        .sov__title-kicker,.sov__eyebrow{color:rgba(177,213,228,.72);font-size:.72rem;letter-spacing:.16em;text-transform:uppercase}
        .sov__title{margin-top:6px;color:#f4fbff;font-size:1.08rem;font-weight:700;letter-spacing:.08em;text-transform:uppercase}
        .sov{display:grid;gap:14px;padding:10px 0 0;background:linear-gradient(180deg,rgba(255,255,255,.02),rgba(255,255,255,0)),rgba(8,12,21,.96)}
        .sov__paper{border:1px solid rgba(72,221,255,.16);border-radius:0;background:#fff;overflow:auto;box-shadow:0 18px 40px rgba(0,0,0,.36),0 0 0 1px rgba(72,221,255,.08)}
        .sov__paper-inner{padding:0;background:linear-gradient(rgba(120,130,140,.16) 1px,transparent 1px),linear-gradient(90deg,rgba(120,130,140,.16) 1px,transparent 1px),#fff;background-size:38px 22px,38px 22px,auto;font-family:Arial,sans-serif;color:#101820}
        .sov__header-band{display:grid;grid-template-columns:1fr auto 1fr;align-items:center;border-bottom:2px solid #101820}
        .sov__doc-title{grid-column:2;text-align:center;font-style:italic;padding:6px 8px}
        .sov__doc-page{justify-self:end;padding:6px 10px}
        .sov__meta-grid{display:grid;grid-template-columns:1.5fr .9fr;gap:10px;padding:8px 8px 0}
        .sov__meta-copy{display:grid;gap:2px;font-size:12px}
        .sov__meta-fields{display:grid;gap:2px}
        .sov__meta-fields label{display:grid;grid-template-columns:170px 1fr;gap:8px;align-items:center;font-size:12px}
        .sov__meta-fields span{text-transform:uppercase}
        .sov__table{width:100%;border-collapse:collapse;table-layout:fixed;font-size:12px}
        .sov__table th,.sov__table td{border:1px solid #101820;padding:2px 4px;vertical-align:top;background:transparent}
        .sov__table th{
            background:rgba(247,249,252,.96);
            color:#09131c;
            font-size:12px;
            font-weight:700;
            line-height:1.22;
            text-transform:uppercase;
            text-align:center;
            letter-spacing:.02em;
        }
        .sov__table td{
            background:rgba(255,255,255,.9);
            color:#08131d;
            font-size:12px;
            line-height:1.25;
        }
        .sov__table th:nth-child(1){width:44px}
        .sov__table th:nth-child(2){width:235px}
        .sov__table th:nth-child(3){width:88px}
        .sov__table th:nth-child(4),.sov__table th:nth-child(5),.sov__table th:nth-child(6),.sov__table th:nth-child(7),.sov__table th:nth-child(9),.sov__table th:nth-child(10){width:90px}
        .sov__table th:nth-child(8){width:42px}
        .sov__input{width:100%;border:0;outline:0;background:rgba(185,244,244,.62);padding:0 2px;margin:0;font:inherit;color:#08131d;box-sizing:border-box}
        .sov__input.is-right,.sov__table .is-right{text-align:right}
        .sov__total-row td{font-weight:700;background:rgba(255,248,184,.58)}
        .sov__footer{padding:8px 22px 18px;border-top:1px solid rgba(72,221,255,.08);background:rgba(7,11,19,.96)}.sov__footer-status{margin-right:auto;color:rgba(167,228,255,.82);font-size:.82rem;letter-spacing:.04em}
        .sov__footer button[mat-flat-button]{background:linear-gradient(180deg,rgba(255,140,40,.9),rgba(255,102,40,.78)),rgba(255,120,50,.82);color:#fff7ef;margin-right:8px}
    `]
})
export class ScheduleOfValuesDialog {
    data: ScheduleOfValuesDialogData = inject(MAT_DIALOG_DATA)
    @ViewChild('printRoot') private printRoot?: ElementRef<HTMLElement>
    saveWorking = false
    statusText = ''

    fillerRows = Array.from({ length: 27 }, (_, index) => String(index + 3).padStart(2, '0'))

    editable = {
        applicationNumber: '',
        applicationDate: '',
        periodTo: '',
        firetrolContractNo: '',
        projectName: '',
        rows: [] as Array<{
            itemNo: string
            description: string
            scheduledValueDisplay: string
            previousApplicationDisplay: string
            thisPeriodDisplay: string
            materialsPresentlyStoredDisplay: string
            totalCompletedAndStoredDisplay: string
            percentGcDisplay: string
            balanceToFinishDisplay: string
            retainageDisplay: string
        }>
    }

    constructor() {
        this.editable.applicationNumber = this.data.applicationNumber || ''
        this.editable.applicationDate = this.data.applicationDate || ''
        this.editable.periodTo = this.data.periodTo || ''
        this.editable.firetrolContractNo = this.data.firetrolContractNo || ''
        this.editable.projectName = this.data.projectName || ''
        this.editable.rows = (this.data.rows || []).map((row) => {
            const totalCompletedAndStored = row.previousApplication + row.thisPeriod + row.materialsPresentlyStored
            const balanceToFinish = row.scheduledValue - totalCompletedAndStored
            const retainage = 0
            return {
                itemNo: row.itemNo,
                description: row.description,
                scheduledValueDisplay: this.formatAmount(row.scheduledValue),
                previousApplicationDisplay: this.formatAmount(row.previousApplication),
                thisPeriodDisplay: this.formatAmount(row.thisPeriod),
                materialsPresentlyStoredDisplay: this.formatAmount(row.materialsPresentlyStored),
                totalCompletedAndStoredDisplay: this.formatAmount(totalCompletedAndStored),
                percentGcDisplay: `${Math.round(row.percentGc)}%`,
                balanceToFinishDisplay: this.formatAmount(balanceToFinish),
                retainageDisplay: this.formatAmount(retainage)
            }
        })
    }

    get pageTotalDisplay(): string {
        return this.formatAmount(this.sumRows((row) => this.parseAmount(row.scheduledValueDisplay)))
    }

    get previousApplicationTotalDisplay(): string {
        return this.formatAmount(this.sumRows((row) => this.parseAmount(row.previousApplicationDisplay)))
    }

    get thisPeriodTotalDisplay(): string {
        return this.formatAmount(this.sumRows((row) => this.parseAmount(row.thisPeriodDisplay)))
    }

    get materialsStoredTotalDisplay(): string {
        return this.formatAmount(this.sumRows((row) => this.parseAmount(row.materialsPresentlyStoredDisplay)))
    }

    get completedAndStoredTotalDisplay(): string {
        return this.formatAmount(this.sumRows((row) => this.parseAmount(row.totalCompletedAndStoredDisplay)))
    }

    get balanceToFinishTotalDisplay(): string {
        return this.formatAmount(this.sumRows((row) => this.parseAmount(row.balanceToFinishDisplay)))
    }

    get retainageTotalDisplay(): string {
        return this.formatAmount(this.sumRows((row) => this.parseAmount(row.retainageDisplay)))
    }

    async createSheet() {
        if (!this.data.createSheet) {
            return
        }

        this.saveWorking = true
        this.statusText = ''
        try {
            await Promise.resolve(this.data.createSheet(this.data.defaultFileName || 'Schedule Of Values.html', this.renderPrintableDocument()))
            this.statusText = 'Saved to Estimating documents.'
        } catch (err: any) {
            this.statusText = err?.message || 'Unable to create sheet.'
        } finally {
            this.saveWorking = false
        }
    }

    printSheet() {
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

    private sumRows(selector: (row: typeof this.editable.rows[number]) => number): number {
        return this.editable.rows.reduce((sum, row) => sum + selector(row), 0)
    }

    private parseAmount(input: string): number {
        const value = Number(String(input || '').replace(/[^0-9.-]/g, ''))
        return Number.isFinite(value) ? value : 0
    }

    private formatAmount(value: number): string {
        return Number(value || 0).toLocaleString(undefined, {
            minimumFractionDigits: 2,
            maximumFractionDigits: 2
        })
    }

    private renderPrintableDocument(): string {
        const clone = this.printRoot?.nativeElement.cloneNode(true) as HTMLElement | undefined
        if (clone) {
            const sourceInputs = this.printRoot?.nativeElement.querySelectorAll('input') || []
            const cloneInputs = clone.querySelectorAll('input')
            sourceInputs.forEach((sourceElement, index) => {
                const source = sourceElement as HTMLInputElement
                const target = cloneInputs[index] as HTMLInputElement | undefined
                if (!target) {
                    return
                }
                target.setAttribute('value', source.value)
            })
        }

        const html = clone?.outerHTML || ''
        return `<!doctype html><html><head><title>Schedule Of Values</title><style>
        body{margin:0;padding:0;background:#fff}
        .sov__paper-inner{padding:0;background:linear-gradient(rgba(120,130,140,.16) 1px,transparent 1px),linear-gradient(90deg,rgba(120,130,140,.16) 1px,transparent 1px),#fff;background-size:38px 22px,38px 22px,auto;font-family:Arial,sans-serif;color:#101820}
        .sov__header-band{display:grid;grid-template-columns:1fr auto 1fr;align-items:center;border-bottom:2px solid #101820}
        .sov__doc-title{grid-column:2;text-align:center;font-style:italic;padding:6px 8px}
        .sov__doc-page{justify-self:end;padding:6px 10px}
        .sov__meta-grid{display:grid;grid-template-columns:1.5fr .9fr;gap:10px;padding:8px 8px 0}
        .sov__meta-copy{display:grid;gap:2px;font-size:12px}
        .sov__meta-fields{display:grid;gap:2px}
        .sov__meta-fields label{display:grid;grid-template-columns:170px 1fr;gap:8px;align-items:center;font-size:12px}
        .sov__table{width:100%;border-collapse:collapse;table-layout:fixed;font-size:12px}
        .sov__table th,.sov__table td{border:1px solid #101820;padding:2px 4px;vertical-align:top;background:transparent}
        .sov__table th{background:rgba(247,249,252,.96);color:#09131c;font-size:12px;font-weight:700;line-height:1.22;text-transform:uppercase;text-align:center;letter-spacing:.02em}
        .sov__table td{background:rgba(255,255,255,.9);color:#08131d;font-size:12px;line-height:1.25}
        .sov__input{width:100%;border:0;outline:0;background:rgba(185,244,244,.62);padding:0 2px;margin:0;font:inherit;color:#08131d;box-sizing:border-box}
        .is-right{text-align:right}
        .sov__total-row td{font-weight:700;background:rgba(255,248,184,.58)}
        </style></head><body>${html}</body></html>`
    }
}
