import { EddyPricelist } from "./eddypricelist.schema"

export interface VendorImportConfig {
    partsVendorKey: string
    sourceLabel: string
    targetTable: string
    filePattern?: string
    expectedHeaders: string[]
    headerMap: Record<string, keyof EddyPricelist>
    columnTypes: Partial<Record<keyof EddyPricelist, 'string' | 'money' | 'int' | 'date'>>
    normalizationSteps: string[]
    analysisSummary: string[]
    verifiedSampleFile?: string
    verifiedOn?: string
    replaceMode?: 'truncate-and-load'
    snapshotTable?: string
}

export interface VendorImportPreview {
    valid: boolean
    vendorId: string
    fileName: string
    targetTable: string
    rowCount: number
    actualHeaders: string[]
    missingHeaders: string[]
    unexpectedHeaders: string[]
    issues: string[]
    sampleErrors: string[]
    sampleRows: EddyPricelist[]
    snapshotStrategy: string
}

export interface VendorImportSnapshot {
    snapshotId: string
    vendorId: string
    targetTable: string
    fileName: string
    rowCount: number
    createdAt: string
    createdBy: string
    summary?: Record<string, unknown> | null
}

export interface VendorImportRun {
    runId: string
    vendorId: string
    targetTable: string
    fileName: string
    snapshotId?: string | null
    action: string
    rowCount: number
    importedAt: string
    createdBy: string
    notes?: Record<string, unknown> | null
}
