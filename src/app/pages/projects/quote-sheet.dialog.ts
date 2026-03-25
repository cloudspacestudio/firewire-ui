import { CommonModule } from '@angular/common'
import { AfterViewInit, Component, ElementRef, QueryList, ViewChild, ViewChildren, inject } from '@angular/core'
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

export interface QuoteSheetLineItem {
    id: string
    description: string
    qty: number
    amount: number
}

export interface QuoteSheetData {
    projectName: string
    projectAddress: string
    projectCityStateZip: string
    phone: string
    fax: string
    customer: string
    department: string
    scopeOfWork: string
    specifications: string
    addenda: string
    plans: string
    deviations: string
    proposalNarrative: string
    lineItems: QuoteSheetLineItem[]
    subtotal: number
    taxRatePercent: number
    salesTaxAmount: number
    shippingHandling: number
    total: number
    signatureName: string
    signatureDate: string
    termsAndConditions: string
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
        <div mat-dialog-title class="quote-sheet__titlebar">
            <div>
                <div class="quote-sheet__title-kicker">Proposal Output</div>
                <div class="quote-sheet__title">Quotation</div>
            </div>
            <button mat-icon-button type="button" aria-label="Close dialog" mat-dialog-close>
                <mat-icon>close</mat-icon>
            </button>
        </div>
        <mat-dialog-content class="quote-sheet">
            <div class="quote-sheet__toolbar">
                <div class="quote-sheet__eyebrow">Customer Quote Preview</div>
            </div>

            <div class="quote-sheet__paper">
                <div #printRoot class="quote-sheet__paper-inner">
                    <div class="quote-sheet__paper-header">
                        <img class="quote-sheet__paper-logo" src="/images/firetrol-logo.png" alt="Firetrol Protection Systems" />
                        <div class="quote-sheet__paper-title">Quotation</div>
                    </div>

                    <div class="quote-sheet__top-grid">
                        <section class="quote-sheet__info-card">
                            <div class="quote-sheet__info-card-title">Project</div>
                            <div class="quote-sheet__info-row"><span>Project name</span><input class="quote-sheet__paper-input" [(ngModel)]="editable.projectName" /></div>
                            <div class="quote-sheet__info-row"><span>Project address</span><input class="quote-sheet__paper-input" [(ngModel)]="editable.projectAddress" /></div>
                            <div class="quote-sheet__info-row"><span>Project City, State, Zip</span><input class="quote-sheet__paper-input" [(ngModel)]="editable.projectCityStateZip" /></div>
                            <div class="quote-sheet__info-row"><span>Phone</span><input class="quote-sheet__paper-input" [(ngModel)]="editable.phone" /></div>
                            <div class="quote-sheet__info-row"><span>Fax</span><input class="quote-sheet__paper-input" [(ngModel)]="editable.fax" /></div>
                        </section>
                        <section class="quote-sheet__info-card">
                            <div class="quote-sheet__info-card-title">Customer</div>
                            <div class="quote-sheet__info-row"><span>Customer</span><input class="quote-sheet__paper-input" [(ngModel)]="editable.customer" /></div>
                            <div class="quote-sheet__info-row"><span>Department</span><input class="quote-sheet__paper-input" [(ngModel)]="editable.department" /></div>
                        </section>
                    </div>

                    <section class="quote-sheet__section">
                        <div class="quote-sheet__section-title">Scope of Work</div>
                        <textarea
                            #autosizeInput
                            class="quote-sheet__paper-input quote-sheet__paper-input--multiline"
                            [(ngModel)]="editable.scopeOfWork"
                            (input)="autosizeFromElement(autosizeInput)"></textarea>
                    </section>

                    <div class="quote-sheet__meta-grid">
                        <div class="quote-sheet__meta-column">
                            <div class="quote-sheet__meta-title">Specifications</div>
                            <textarea
                                #autosizeInput
                                class="quote-sheet__paper-input quote-sheet__paper-input--multiline quote-sheet__paper-input--small"
                                [(ngModel)]="editable.specifications"
                                (input)="autosizeFromElement(autosizeInput)"></textarea>
                        </div>
                        <div class="quote-sheet__meta-column">
                            <div class="quote-sheet__meta-title">Addenda</div>
                            <textarea
                                #autosizeInput
                                class="quote-sheet__paper-input quote-sheet__paper-input--multiline quote-sheet__paper-input--small"
                                [(ngModel)]="editable.addenda"
                                (input)="autosizeFromElement(autosizeInput)"></textarea>
                        </div>
                        <div class="quote-sheet__meta-column">
                            <div class="quote-sheet__meta-title">Plans</div>
                            <textarea
                                #autosizeInput
                                class="quote-sheet__paper-input quote-sheet__paper-input--multiline quote-sheet__paper-input--small"
                                [(ngModel)]="editable.plans"
                                (input)="autosizeFromElement(autosizeInput)"></textarea>
                        </div>
                    </div>

                    <section class="quote-sheet__section">
                        <div class="quote-sheet__section-title quote-sheet__section-title--alert">Not Included or Deviated from Specification</div>
                        <textarea
                            #autosizeInput
                            class="quote-sheet__paper-input quote-sheet__paper-input--multiline"
                            [(ngModel)]="editable.deviations"
                            (input)="autosizeFromElement(autosizeInput)"></textarea>
                    </section>

                    <section class="quote-sheet__section">
                        <div class="quote-sheet__section-title quote-sheet__section-title--accent">Proposal Narrative</div>
                        <textarea
                            #autosizeInput
                            class="quote-sheet__paper-input quote-sheet__paper-input--multiline"
                            [(ngModel)]="editable.proposalNarrative"
                            (input)="autosizeFromElement(autosizeInput)"></textarea>
                    </section>

                    <table class="quote-sheet__table">
                        <thead>
                            <tr>
                                <th>ID</th>
                                <th>Description</th>
                                <th>Qty</th>
                                <th>Amount</th>
                                <th>Total</th>
                            </tr>
                        </thead>
                        <tbody>
                            <tr *ngFor="let row of editable.lineItems; let index = index">
                                <td><input class="quote-sheet__paper-input" [(ngModel)]="row.id" [name]="'quote-id-' + index" /></td>
                                <td><input class="quote-sheet__paper-input" [(ngModel)]="row.description" [name]="'quote-description-' + index" /></td>
                                <td><input class="quote-sheet__paper-input is-right" type="number" min="0" [(ngModel)]="row.qty" [name]="'quote-qty-' + index" /></td>
                                <td><input class="quote-sheet__paper-input is-right" type="number" min="0" step="0.01" [(ngModel)]="row.amount" [name]="'quote-amount-' + index" /></td>
                                <td class="is-right">{{getLineItemTotal(row) | currency}}</td>
                            </tr>
                        </tbody>
                    </table>

                    <div class="quote-sheet__foot-grid">
                        <div class="quote-sheet__signature-panel">
                            <div class="quote-sheet__thankyou">THANK YOU FOR YOUR BUSINESS!</div>
                            <label class="quote-sheet__signature-label">
                                <span>Signature</span>
                                <input class="quote-sheet__paper-input quote-sheet__paper-input--signature" [(ngModel)]="editable.signatureName" />
                            </label>
                            <label class="quote-sheet__signature-label">
                                <span>P.O.</span>
                                <input class="quote-sheet__paper-input" />
                            </label>
                            <label class="quote-sheet__signature-label">
                                <span>Date</span>
                                <input class="quote-sheet__paper-input" [(ngModel)]="editable.signatureDate" />
                            </label>
                        </div>
                        <div class="quote-sheet__totals-panel">
                            <div class="quote-sheet__total-row"><span>Subtotal</span><strong>{{getSubtotal() | currency}}</strong></div>
                            <div class="quote-sheet__total-row"><span>Tax Rate</span><strong>{{editable.taxRatePercent.toFixed(2)}}%</strong></div>
                            <div class="quote-sheet__total-row"><span>Sales Tax if applicable</span><strong>{{getSalesTaxAmount() | currency}}</strong></div>
                            <div class="quote-sheet__total-row"><span>Shipping and Handling</span><strong>{{editable.shippingHandling | currency}}</strong></div>
                            <div class="quote-sheet__total-row quote-sheet__total-row--grand"><span>Total</span><strong>{{getGrandTotal() | currency}}</strong></div>
                        </div>
                    </div>

                    <section class="quote-sheet__section quote-sheet__section--terms">
                        <div class="quote-sheet__terms-title">Terms and Conditions</div>
                        <textarea
                            #termsInput
                            class="quote-sheet__paper-input quote-sheet__paper-input--multiline quote-sheet__paper-input--terms"
                            [(ngModel)]="editable.termsAndConditions"
                            (input)="autosizeFromElement(termsInput)"></textarea>
                    </section>
                </div>
            </div>
        </mat-dialog-content>
        <mat-dialog-actions align="end" class="quote-sheet__footer">
            <button mat-flat-button type="button" (click)="downloadPdf()">
                <mat-icon fontIcon="description"></mat-icon>
                Create Sheet
            </button>
            <button mat-button type="button" mat-dialog-close>Close</button>
        </mat-dialog-actions>
    `,
    styles: [`
        .quote-sheet__titlebar{display:flex;align-items:center;justify-content:space-between;padding:18px 22px 10px;border-bottom:1px solid rgba(72,221,255,.12);background:radial-gradient(circle at 0% 0%,rgba(72,221,255,.08),transparent 34%),radial-gradient(circle at 100% 0%,rgba(255,164,61,.08),transparent 32%),rgba(7,11,19,.96)}
        .quote-sheet__title-kicker,.quote-sheet__eyebrow{color:rgba(177,213,228,.72);font-size:.72rem;letter-spacing:.16em;text-transform:uppercase}
        .quote-sheet__title{margin-top:6px;color:#f4fbff;font-size:1.08rem;font-weight:700;letter-spacing:.08em;text-transform:uppercase}
        .quote-sheet{width:100%;display:grid;gap:16px;padding:10px 0 0;box-sizing:border-box;overflow-x:hidden;background:linear-gradient(180deg,rgba(255,255,255,.02),rgba(255,255,255,0)),rgba(8,12,21,.96)}
        .quote-sheet__toolbar{padding:8px 0 0 12px}
        .quote-sheet__paper{border:1px solid rgba(72,221,255,.16);border-radius:0;background:#fff;overflow:auto;box-shadow:0 18px 40px rgba(0,0,0,.36),0 0 0 1px rgba(72,221,255,.08)}
        .quote-sheet__paper-inner{padding:18px 22px 24px;background:#fff;font-family:Arial,sans-serif;color:#101820}
        .quote-sheet__paper-header{display:flex;align-items:flex-start;justify-content:space-between;gap:20px}
        .quote-sheet__paper-logo{display:block;width:220px;max-width:100%;height:auto;object-fit:contain}
        .quote-sheet__paper-title{font-size:2.6rem;font-weight:700;line-height:1;color:#2f3440}
        .quote-sheet__top-grid{display:grid;grid-template-columns:1fr 1fr;gap:14px;margin-top:16px}
        .quote-sheet__info-card{border:1px solid #aab7c6;background:#f7f7f7}
        .quote-sheet__info-card-title{padding:5px 10px;border-bottom:1px solid #aab7c6;text-align:center;font-size:.92rem;font-weight:700;letter-spacing:.08em;text-transform:uppercase;color:#344b63}
        .quote-sheet__info-row{display:grid;grid-template-columns:180px 1fr;gap:10px;padding:4px 10px;align-items:center}
        .quote-sheet__info-row span{font-weight:700}
        .quote-sheet__section{margin-top:14px}
        .quote-sheet__section-title{margin-bottom:6px;font-size:1rem;font-weight:700;text-transform:uppercase;color:#101820}
        .quote-sheet__section-title--alert{color:#d21919}
        .quote-sheet__section-title--accent{color:#d21919}
        .quote-sheet__paper-input{width:100%;border:0;outline:0;padding:0;margin:0;background:transparent;color:#101820;font:inherit;box-sizing:border-box}
        .quote-sheet__paper-input.is-right{text-align:right}
        .quote-sheet__paper-input--multiline{min-height:96px;overflow:hidden;resize:none;border:1px solid #aab7c6;background:#fff;padding:10px 12px;line-height:1.38}
        .quote-sheet__paper-input--small{min-height:72px}
        .quote-sheet__paper-input--terms{min-height:300px;overflow:visible;border:0;background:transparent;padding:0;font-size:.92rem;line-height:1.45}
        .quote-sheet__paper-input--signature{font-family:"Segoe Script","Brush Script MT",cursive;font-size:2rem;line-height:1.1}
        .quote-sheet__paper-input:focus{background:rgba(232,242,255,.72)}
        .quote-sheet__paper-input--multiline:focus{box-shadow:inset 0 0 0 1px #6da4d6}
        .quote-sheet__meta-grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:18px;margin-top:14px}
        .quote-sheet__meta-title{margin-bottom:4px;font-weight:700;color:#d21919}
        .quote-sheet__table{width:100%;margin-top:18px;border-collapse:collapse;table-layout:fixed;font-size:13px}
        .quote-sheet__table th,.quote-sheet__table td{border:1px solid #aab7c6;padding:6px 8px;vertical-align:top}
        .quote-sheet__table th{background:#f1f3f5;text-transform:uppercase;color:#344b63}
        .quote-sheet__table th:nth-child(1){width:48px}
        .quote-sheet__table th:nth-child(3){width:72px}
        .quote-sheet__table th:nth-child(4),.quote-sheet__table th:nth-child(5){width:110px}
        .quote-sheet__foot-grid{display:grid;grid-template-columns:1.4fr .8fr;gap:18px;margin-top:12px}
        .quote-sheet__thankyou{font-weight:700;margin-bottom:10px}
        .quote-sheet__signature-panel,.quote-sheet__totals-panel{padding:10px 0}
        .quote-sheet__signature-label{display:grid;gap:4px;margin-bottom:12px}
        .quote-sheet__signature-label span{font-weight:700}
        .quote-sheet__signature-label input{border-bottom:1px solid #101820;padding:3px 0}
        .quote-sheet__totals-panel{display:grid;gap:8px}
        .quote-sheet__total-row{display:flex;justify-content:space-between;gap:12px;padding:4px 0;border-bottom:1px solid #d7dbe0;font-weight:700}
        .quote-sheet__total-row--grand{font-size:1.08rem;border-top:2px solid #101820;border-bottom:2px solid #101820;padding:8px 0}
        .quote-sheet__section--terms{margin-top:18px;border-top:2px solid #324fbf;padding-top:12px}
        .quote-sheet__terms-title{text-align:center;font-family:Georgia,"Times New Roman",serif;font-size:2rem;font-weight:700;text-transform:uppercase;margin-bottom:10px}
        .quote-sheet__footer{padding:8px 22px 18px;border-top:1px solid rgba(72,221,255,.08);background:rgba(7,11,19,.96)}
        .quote-sheet__footer button[mat-flat-button]{background:linear-gradient(180deg,rgba(255,140,40,.9),rgba(255,102,40,.78)),rgba(255,120,50,.82);color:#fff7ef;margin-right:8px}
        @media (max-width:900px){.quote-sheet__paper-title{font-size:2rem}.quote-sheet__top-grid,.quote-sheet__meta-grid,.quote-sheet__foot-grid{grid-template-columns:1fr}.quote-sheet__info-row{grid-template-columns:1fr}.quote-sheet__terms-title{font-size:1.5rem}}
    `]
})
export class QuoteSheetDialog implements AfterViewInit {
    data: QuoteSheetData = inject(MAT_DIALOG_DATA)
    @ViewChild('printRoot') private printRoot?: ElementRef<HTMLElement>
    @ViewChild('termsInput') private termsInput?: ElementRef<HTMLTextAreaElement>
    @ViewChildren('autosizeInput') private autosizeInputs?: QueryList<ElementRef<HTMLTextAreaElement>>

    editable = {
        projectName: '',
        projectAddress: '',
        projectCityStateZip: '',
        phone: '',
        fax: '',
        customer: '',
        department: '',
        scopeOfWork: '',
        specifications: '',
        addenda: '',
        plans: '',
        deviations: '',
        proposalNarrative: '',
        lineItems: [] as QuoteSheetLineItem[],
        taxRatePercent: 0,
        shippingHandling: 0,
        signatureName: '',
        signatureDate: '',
        termsAndConditions: ''
    }

    constructor() {
        this.editable = {
            projectName: this.data.projectName || '',
            projectAddress: this.data.projectAddress || '',
            projectCityStateZip: this.data.projectCityStateZip || '',
            phone: this.data.phone || '',
            fax: this.data.fax || '',
            customer: this.data.customer || '',
            department: this.data.department || '',
            scopeOfWork: this.data.scopeOfWork || '',
            specifications: this.data.specifications || '',
            addenda: this.data.addenda || '',
            plans: this.data.plans || '',
            deviations: this.data.deviations || '',
            proposalNarrative: this.data.proposalNarrative || '',
            lineItems: this.data.lineItems?.map((row) => ({ ...row })) || [],
            taxRatePercent: Number(this.data.taxRatePercent || 0),
            shippingHandling: Number(this.data.shippingHandling || 0),
            signatureName: this.data.signatureName || '',
            signatureDate: this.data.signatureDate || '',
            termsAndConditions: this.data.termsAndConditions || ''
        }
    }

    ngAfterViewInit() {
        this.autosizeInputs?.forEach((input) => this.autosizeFromElement(input))
        this.autosizeTerms()
    }

    autosizeFromElement(target: ElementRef<HTMLTextAreaElement> | HTMLTextAreaElement) {
        const element = target instanceof ElementRef ? target.nativeElement : target
        if (!element) {
            return
        }

        element.style.height = 'auto'
        element.style.height = `${element.scrollHeight}px`
    }

    private autosizeTerms() {
        if (!this.termsInput) {
            return
        }

        this.autosizeFromElement(this.termsInput)
        setTimeout(() => this.autosizeFromElement(this.termsInput!), 0)
    }

    getLineItemTotal(row: QuoteSheetLineItem): number {
        return Number(row.qty || 0) * Number(row.amount || 0)
    }

    getSubtotal(): number {
        return this.editable.lineItems.reduce((sum, row) => sum + this.getLineItemTotal(row), 0)
    }

    getSalesTaxAmount(): number {
        return this.getSubtotal() * (Number(this.editable.taxRatePercent || 0) / 100)
    }

    getGrandTotal(): number {
        return this.getSubtotal() + this.getSalesTaxAmount() + Number(this.editable.shippingHandling || 0)
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
    <title>Quotation</title>
    <style>
        body{margin:0;padding:0;background:#ffffff}
        .quote-sheet__paper-inner{padding:18px 22px 24px;background:#fff;font-family:Arial,sans-serif;color:#101820}
        .quote-sheet__paper-header{display:flex;align-items:flex-start;justify-content:space-between;gap:20px}
        .quote-sheet__paper-logo{display:block;width:220px;max-width:100%;height:auto;object-fit:contain}
        .quote-sheet__paper-title{font-size:2.6rem;font-weight:700;line-height:1;color:#2f3440}
        .quote-sheet__top-grid{display:grid;grid-template-columns:1fr 1fr;gap:14px;margin-top:16px}
        .quote-sheet__info-card{border:1px solid #aab7c6;background:#f7f7f7}
        .quote-sheet__info-card-title{padding:5px 10px;border-bottom:1px solid #aab7c6;text-align:center;font-size:.92rem;font-weight:700;letter-spacing:.08em;text-transform:uppercase;color:#344b63}
        .quote-sheet__info-row{display:grid;grid-template-columns:180px 1fr;gap:10px;padding:4px 10px;align-items:center}
        .quote-sheet__info-row span{font-weight:700}
        .quote-sheet__section{margin-top:14px}
        .quote-sheet__section-title{margin-bottom:6px;font-size:1rem;font-weight:700;text-transform:uppercase;color:#101820}
        .quote-sheet__section-title--alert,.quote-sheet__section-title--accent,.quote-sheet__meta-title{color:#d21919}
        .quote-sheet__paper-input{width:100%;border:0;outline:0;padding:0;margin:0;background:transparent;color:#101820;font:inherit;box-sizing:border-box}
        .quote-sheet__paper-input.is-right{text-align:right}
        .quote-sheet__paper-input--multiline{min-height:96px;overflow:hidden;resize:none;border:1px solid #aab7c6;background:#fff;padding:10px 12px;line-height:1.38}
        .quote-sheet__paper-input--small{min-height:72px}
        .quote-sheet__paper-input--terms{min-height:300px;overflow:visible;border:0;background:transparent;padding:0;font-size:.92rem;line-height:1.45}
        .quote-sheet__paper-input--signature{font-family:"Segoe Script","Brush Script MT",cursive;font-size:2rem;line-height:1.1}
        .quote-sheet__meta-grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:18px;margin-top:14px}
        .quote-sheet__table{width:100%;margin-top:18px;border-collapse:collapse;table-layout:fixed;font-size:13px}
        .quote-sheet__table th,.quote-sheet__table td{border:1px solid #aab7c6;padding:6px 8px;vertical-align:top}
        .quote-sheet__table th{background:#f1f3f5;text-transform:uppercase;color:#344b63}
        .quote-sheet__table th:nth-child(1){width:48px}
        .quote-sheet__table th:nth-child(3){width:72px}
        .quote-sheet__table th:nth-child(4),.quote-sheet__table th:nth-child(5){width:110px}
        .quote-sheet__foot-grid{display:grid;grid-template-columns:1.4fr .8fr;gap:18px;margin-top:12px}
        .quote-sheet__thankyou{font-weight:700;margin-bottom:10px}
        .quote-sheet__signature-label{display:grid;gap:4px;margin-bottom:12px}
        .quote-sheet__signature-label span{font-weight:700}
        .quote-sheet__signature-label input{border-bottom:1px solid #101820;padding:3px 0}
        .quote-sheet__totals-panel{display:grid;gap:8px}
        .quote-sheet__total-row{display:flex;justify-content:space-between;gap:12px;padding:4px 0;border-bottom:1px solid #d7dbe0;font-weight:700}
        .quote-sheet__total-row--grand{font-size:1.08rem;border-top:2px solid #101820;border-bottom:2px solid #101820;padding:8px 0}
        .quote-sheet__section--terms{margin-top:18px;border-top:2px solid #324fbf;padding-top:12px}
        .quote-sheet__terms-title{text-align:center;font-family:Georgia,"Times New Roman",serif;font-size:2rem;font-weight:700;text-transform:uppercase;margin-bottom:10px}
    </style>
</head>
<body>${html}</body>
</html>`
    }
}
