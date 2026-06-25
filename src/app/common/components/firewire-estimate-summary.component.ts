import { CommonModule } from '@angular/common'
import { Component, Input } from '@angular/core'

export interface FirewireEstimateSummaryRow {
    label: string
    hours?: number
    overtimeHours?: number
    cost: number
}

export interface FirewireEstimateSummaryModel {
    projectSupport: FirewireEstimateSummaryRow[]
    installationLabor: FirewireEstimateSummaryRow[]
    costs: FirewireEstimateSummaryRow[]
    installationMaterialTotal: number
    equipmentMaterialTotal: number
    materialTaxAmount: number
    totalCost: number
    preTax: number
    marginAmount: number
    quotedPrice: number
    quotedPriceWithTax: number
    scopeLabel: string
    deviceCount: number
    totalSqFt: number
    engineeringHours: number
    engineeringDollars: number
    fieldHours: number
    fieldDollars: number
}

@Component({
    standalone: true,
    selector: 'firewire-estimate-summary',
    imports: [CommonModule],
    templateUrl: './firewire-estimate-summary.component.html',
    styleUrls: ['./firewire-estimate-summary.component.scss']
})
export class FirewireEstimateSummaryComponent {
    @Input({ required: true }) summary!: FirewireEstimateSummaryModel
    @Input() eyebrow = 'Estimate Consolidation'
    @Input() title = 'Summary'

    get totalMaterial(): number {
        return Number(this.summary?.installationMaterialTotal || 0) + Number(this.summary?.equipmentMaterialTotal || 0)
    }

    get laborTotal(): FirewireEstimateSummaryRow {
        return this.totalRow(this.summary?.installationLabor || [], 'Labor Total')
    }

    get projectSupportTotal(): FirewireEstimateSummaryRow {
        return this.totalRow(this.summary?.projectSupport || [], 'Labor Total')
    }

    percentOfTotal(value: number): number {
        const total = Number(this.summary?.totalCost || 0)
        return total > 0 ? (Number(value || 0) / total) * 100 : 0
    }

    perDevice(value: number): number {
        const count = Number(this.summary?.deviceCount || 0)
        return count > 0 ? Number(value || 0) / count : 0
    }

    perSqFt(value: number): number {
        const sqft = Number(this.summary?.totalSqFt || 0)
        return sqft > 0 ? Number(value || 0) / sqft : 0
    }

    private totalRow(rows: FirewireEstimateSummaryRow[], label: string): FirewireEstimateSummaryRow {
        return rows.reduce((total, row) => ({
            label,
            hours: Number(total.hours || 0) + Number(row.hours || 0),
            overtimeHours: Number(total.overtimeHours || 0) + Number(row.overtimeHours || 0),
            cost: Number(total.cost || 0) + Number(row.cost || 0)
        }), { label, hours: 0, overtimeHours: 0, cost: 0 })
    }
}
