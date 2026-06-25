import { CommonModule } from '@angular/common'
import { Component, Input } from '@angular/core'

export type FirewireTakeoffValue = number | null

export interface FirewireTakeoffMatrix {
    title: string
    rows: string[]
    rowLabels?: Record<string, string>
    values: Record<string, Record<string, FirewireTakeoffValue>>
}

export interface FirewireTakeoffColumnDefinition {
    key: string
    label: string
    sourceQty?: number
}

@Component({
    standalone: true,
    selector: 'firewire-takeoff-matrix',
    imports: [CommonModule],
    templateUrl: './firewire-takeoff-matrix.component.html',
    styleUrls: ['./firewire-takeoff-matrix.component.scss']
})
export class FirewireTakeoffMatrixComponent {
    @Input({ required: true }) matrix!: FirewireTakeoffMatrix
    @Input() columns: FirewireTakeoffColumnDefinition[] = []
    @Input() emptyMessage = 'Upload a floorplan to start takeoff.'

    get matrixTotal(): number {
        return this.matrix?.rows?.reduce((sum, rowKey) => sum + this.getRowTotal(rowKey), 0) || 0
    }

    getCellValue(rowKey: string, columnKey: string): string {
        const value = this.matrix?.values?.[rowKey]?.[columnKey]
        return value === null || typeof value === 'undefined' ? '' : `${value}`
    }

    getNumericCellValue(rowKey: string, columnKey: string): number {
        return Number(this.matrix?.values?.[rowKey]?.[columnKey] || 0)
    }

    getRowTotal(rowKey: string): number {
        return this.columns.reduce((sum, column) => sum + this.getNumericCellValue(rowKey, column.key), 0)
    }

    getRowLabel(rowKey: string): string {
        return this.matrix?.rowLabels?.[rowKey] || rowKey
    }

    getColumnTotal(columnKey: string): number {
        return (this.matrix?.rows || []).reduce((sum, rowKey) => sum + this.getNumericCellValue(rowKey, columnKey), 0)
    }
}
