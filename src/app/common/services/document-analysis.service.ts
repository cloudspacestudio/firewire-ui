import { Injectable, inject } from '@angular/core'
import { HttpClient, HttpErrorResponse } from '@angular/common/http'
import { firstValueFrom, timeout, TimeoutError } from 'rxjs'
import { FirewireProjectSchema } from '../../schemas/firewire-project.schema'

const INSPECTION_LOOKUP_TIMEOUT_MS = 15000
const INSPECTION_REQUEST_TIMEOUT_MS = 210000

export type DocumentAnalysisEvidenceType = 'DOCUMENT_FACT' | 'AI_INTERPRETATION' | 'ASSUMPTION' | 'UNRESOLVED_QUESTION'
export type DocumentAnalysisCodeStatus = 'DOCUMENT-STATED' | 'JURISDICTION-VERIFIED' | 'POTENTIALLY-APPLICABLE'
export type DocumentAnalysisRiskSeverity = 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL'

export interface DocumentAnalysisSource {
    filename: string
    page: string
    section: string
    location: string
}

export interface DocumentAnalysisFinding {
    evidenceType: DocumentAnalysisEvidenceType
    text: string
    confidence: number
    source: DocumentAnalysisSource
}

export interface DocumentAnalysisCodeFinding {
    code: string
    edition: string
    status: DocumentAnalysisCodeStatus
    verificationRequired: boolean
    explanation: string
    source: DocumentAnalysisSource
}

export interface DocumentAnalysisRisk {
    severity: DocumentAnalysisRiskSeverity
    category: string
    description: string
    basis: string
    potentialImpact: string
    recommendedAction: string
    source: DocumentAnalysisSource
}

export interface DocumentAnalysisProjectDetailProposal {
    actionType: 'UPDATE_PROJECT_DETAIL'
    targetField: string
    fieldLabel: string
    valueType: 'TEXT' | 'NUMBER' | 'DATE'
    currentValue: string
    proposedValue: string
    evidenceType: DocumentAnalysisEvidenceType
    confidence: number
    rationale: string
    source: DocumentAnalysisSource
}

export interface DocumentAnalysisBomProposal {
    proposalId: string
    actionType: 'ADD_BOM_DEVICE'
    deviceType: string
    symbolLabel: string
    manufacturer: string
    modelNumber: string
    partNumber: string
    description: string
    scheduleQuantityFound: boolean
    scheduleQuantity: number
    drawingQuantityFound: boolean
    drawingQuantity: number
    quantityStatus: 'MATCHED' | 'SCHEDULE_ONLY' | 'DRAWING_ONLY' | 'LEGEND_ONLY' | 'CONFLICT' | 'UNKNOWN'
    reconciledQuantity: number
    floorplanSymbolFound: boolean
    floorplanPlacementTarget: number
    quantityRationale: string
    evidenceType: DocumentAnalysisEvidenceType
    confidence: number
    scheduleSource: DocumentAnalysisSource
    drawingSource: DocumentAnalysisSource
    catalogMatch: {
        status: 'NOT_EVALUATED' | 'MATCHED' | 'POSSIBLE' | 'NOT_FOUND'
        entityType: 'NONE' | 'DEVICE' | 'PART'
        deviceId: string
        deviceName: string
        partId: string
        partNumber: string
        vendorName: string
        confidence: number
        rationale: string
    }
    projectBomMatch?: {
        status: 'NOT_EVALUATED' | 'NOT_ON_BOM' | 'ALREADY_ON_BOM' | 'DUPLICATE_PROPOSAL'
        bomRowId: string
        bomSectionTitle: string
        quantity: number
        rationale: string
    }
}

export interface DocumentAnalysisFloorplanSymbolPlacement {
    placementId: string
    bomProposalId: string
    deviceType: string
    symbolLabel: string
    manufacturer: string
    modelNumber: string
    partNumber: string
    xRatio: number
    yRatio: number
    confidence: number
    source: DocumentAnalysisSource
}

export interface DocumentAnalysisFloorplanProposal {
    proposalId: string
    actionType: 'CREATE_FLOORPLAN'
    name: string
    pageNumber: number
    region: DocumentAnalysisRegionBounds
    evidenceType: DocumentAnalysisEvidenceType
    confidence: number
    rationale: string
    source: DocumentAnalysisSource
    symbolPlacements: DocumentAnalysisFloorplanSymbolPlacement[]
    floorplanMatch?: {
        status: 'NOT_EVALUATED' | 'MISSING' | 'ALREADY_EXISTS' | 'CREATED'
        floorplanFileId: string
        rationale: string
    }
}

export interface DocumentAnalysisRegionBounds { xRatio: number; yRatio: number; widthRatio: number; heightRatio: number }
export interface DocumentAnalysisDrawingRegion { regionId: string; pageNumber: number; name: string; drawingNumber: string; regionType: string; floor: string; bounds: DocumentAnalysisRegionBounds; confidence: number; source: DocumentAnalysisSource }
export interface DocumentAnalysisLegendItem { legendItemId: string; symbolLabel: string; description: string; manufacturer: string; modelNumber: string; partNumber: string; mountingHeight: string; backbox: string; backboxSupplier: string; furnishBy: string; installBy: string; wireBy: string; testBy: string; floorplanEligible: boolean; byOthers: boolean; symbolBounds: DocumentAnalysisRegionBounds; confidence: number; source: DocumentAnalysisSource }
export interface DocumentAnalysisDeviceInstance { instanceId: string; legendItemId: string; regionId: string; deviceType: string; symbolLabel: string; partNumber: string; floor: string; room: string; circuit: string; address: string; candela: string; configuration: string; xRatio: number; yRatio: number; confidence: number; source: DocumentAnalysisSource }
export interface DocumentAnalysisCircuit { circuitId: string; name: string; circuitType: string; panel: string; floor: string; wireType: string; deviceCount: number; source: DocumentAnalysisSource }
export interface DocumentAnalysisResponsibility { responsibilityId: string; item: string; furnishBy: string; backboxBy: string; installBy: string; wireBy: string; programBy: string; testBy: string; notes: string; source: DocumentAnalysisSource }
export interface DocumentAnalysisCoordinationItem { coordinationId: string; itemType: string; title: string; description: string; suggestedOwner: string; priority: string; source: DocumentAnalysisSource }
export interface DocumentAnalysisEstimateCheck { checkId: string; category: string; status: string; title: string; explanation: string; recommendedAction: string; source: DocumentAnalysisSource }
export interface DocumentAnalysisTakeoffManifest {
    scannedFloorplanProposalIds: string[]
    drawingRegions: DocumentAnalysisDrawingRegion[]
    legendItems: DocumentAnalysisLegendItem[]
    deviceInstances: DocumentAnalysisDeviceInstance[]
    circuits: DocumentAnalysisCircuit[]
    topologyNodes: Array<{ nodeId: string; nodeType: string; label: string; partNumber: string; source: DocumentAnalysisSource }>
    topologyEdges: Array<{ fromNodeId: string; toNodeId: string; relationship: string; circuit: string; source: DocumentAnalysisSource }>
    responsibilities: DocumentAnalysisResponsibility[]
    coordinationItems: DocumentAnalysisCoordinationItem[]
    estimateChecks: DocumentAnalysisEstimateCheck[]
    coverage: { legendItemCount: number; seenOnPlanCount: number; countedCount: number; catalogResolvedCount: number; floorplanReadyCount: number; unresolvedCount: number; completenessPercent: number; rows: Array<{ legendItemId: string; description: string; symbolLabel: string; seenOnPlan: boolean; countedQuantity: number; bomProposalId: string; catalogStatus: string; bomStatus: string; placementCount: number; status: string }> }
    revisionChanges: Array<{ changeType: string; category: string; description: string; previousValue: string; currentValue: string; impact: string; source: DocumentAnalysisSource }>
}

export interface DocumentAnalysisActionApplication {
    id: string
    appliedAt: string
    appliedBy: string
    targetFields: string[]
    changes: Array<{
        targetField: string
        fieldLabel: string
        previousValue: string
        appliedValue: string
    }>
}

export interface DocumentAnalysisApplyResult {
    analysisId: string
    application: DocumentAnalysisActionApplication
    applicationRecorded: boolean
    project: FirewireProjectSchema
}

export interface DocumentAnalysisBomActionApplication {
    id: string
    appliedAt: string
    appliedBy: string
    proposalIds: string[]
    sectionKey: string
    rows: Array<{
        proposalId: string
        bomRowId: string
        entityType: 'DEVICE' | 'PART'
        deviceId: string
        partId: string
        quantity: number
        floorplanQuantityTarget: number
    }>
}

export interface DocumentAnalysisBomApplyResult {
    analysisId: string
    application: DocumentAnalysisBomActionApplication
    applicationRecorded: boolean
    alreadyApplied: boolean
    project: FirewireProjectSchema
}

export interface DocumentAnalysisDeviceCreationApplication {
    id: string
    createdAt: string
    createdBy: string
    proposalId: string
    partId: string
    deviceId: string
    created: boolean
    name: string
    shortName: string
    categoryName: string
    includeOnFloorplan: boolean
    floorplanLabelText: string
    symbolSource?: DocumentAnalysisSource
    symbolBounds?: DocumentAnalysisRegionBounds
}

export interface DocumentAnalysisFloorplanApplication {
    id: string
    appliedAt: string
    appliedBy: string
    proposalId: string
    floorplanFileId: string
    floorplanName: string
    pageNumber: number
}

export interface DocumentAnalysisFloorplanPlacementApplication {
    id: string
    appliedAt: string
    appliedBy: string
    proposalId: string
    floorplanFileId: string
    placementIds: string[]
    annotationIds: string[]
}

export interface DocumentAnalysisCoordinationApplication { id: string; recordedAt: string; recordedBy: string; coordinationId: string; status: 'OPEN' | 'RESOLVED' | 'DISMISSED'; owner: string; dueDate: string; notes: string }

export interface DocumentAnalysisCreateDeviceInput {
    name: string
    shortName: string
    categoryName: string
    includeOnFloorplan: boolean
    floorplanLabelText: string
    defaultLabor: number
}

export interface DocumentAnalysisCreateDeviceResult {
    record: DocumentAnalysisRecord
    proposal: DocumentAnalysisBomProposal
    device: {
        deviceId: string
        name: string
        shortName?: string
        categoryName?: string
        includeOnFloorplan?: boolean
        floorplanLabelText?: string
        partNumber?: string
    }
    application: DocumentAnalysisDeviceCreationApplication
}

export interface DocumentInspectionResult {
    document: {
        originalFilename: string
        documentType: string
        discipline: string
        title: string
        documentNumber: string
        revision: string
        documentDate: string
        issuingOrganization: string
        summary: string
    }
    projectDetails: DocumentAnalysisFinding[]
    scope: {
        inclusions: DocumentAnalysisFinding[]
        exclusions: DocumentAnalysisFinding[]
        assumptions: DocumentAnalysisFinding[]
        customerResponsibilities: DocumentAnalysisFinding[]
        otherTradeResponsibilities: DocumentAnalysisFinding[]
        specificInstructions: DocumentAnalysisFinding[]
        limitations: DocumentAnalysisFinding[]
        alternates: DocumentAnalysisFinding[]
    }
    requirements: DocumentAnalysisFinding[]
    codes: DocumentAnalysisCodeFinding[]
    risks: DocumentAnalysisRisk[]
    openQuestions: DocumentAnalysisFinding[]
    proposedActions?: DocumentAnalysisProjectDetailProposal[]
    proposedBomActions?: DocumentAnalysisBomProposal[]
    proposedFloorplanActions?: DocumentAnalysisFloorplanProposal[]
    takeoffManifest?: DocumentAnalysisTakeoffManifest
    executiveSummary: string
}

export interface DocumentAnalysisRecord {
    id: string
    projectId: string
    workspaceKey: string
    documentId: string
    versionId: string
    sourceFilename: string
    status: 'running' | 'completed' | 'failed' | 'cancelled'
    schemaVersion: number
    model: string
    requestedAt: string
    requestedBy: string
    completedAt: string
    result: DocumentInspectionResult | null
    error: string
    errorCode: string
    errorRetryable: boolean
    progress?: {
        stage: string
        message: string
        percent: number
        updatedAt: string
    }
    actionApplications?: DocumentAnalysisActionApplication[]
    bomActionApplications?: DocumentAnalysisBomActionApplication[]
    deviceCreationApplications?: DocumentAnalysisDeviceCreationApplication[]
    floorplanApplications?: DocumentAnalysisFloorplanApplication[]
    floorplanPlacementApplications?: DocumentAnalysisFloorplanPlacementApplication[]
    coordinationApplications?: DocumentAnalysisCoordinationApplication[]
}

export class DocumentAnalysisRequestError extends Error {
    constructor(
        message: string,
        readonly status: number,
        readonly code: string,
        readonly retryable: boolean
    ) {
        super(message)
    }
}

@Injectable({ providedIn: 'root' })
export class DocumentAnalysisService {
    private readonly http = inject(HttpClient)

    async getInspection(projectId: string, workspaceKey: string, fileId: string, versionId: string): Promise<DocumentAnalysisRecord | null> {
        try {
            const response = await firstValueFrom(
                this.http.get<{ data: DocumentAnalysisRecord | null }>(
                    this.getUrl(projectId, fileId, versionId),
                    { params: { workspaceKey } }
                ).pipe(timeout({ first: INSPECTION_LOOKUP_TIMEOUT_MS }))
            )
            if (!response.data) {
                return null
            }
            if (response.data.status !== 'running') {
                console.info('[document-inspection-ui] Loaded terminal inspection status.', {
                    documentId: fileId,
                    versionId,
                    status: response.data.status,
                    requestedAt: response.data.requestedAt
                })
            }
            return response.data
        } catch (error) {
            if (error instanceof HttpErrorResponse && error.status === 404) {
                return null
            }
            throw new Error(this.getErrorMessage(error, 'Unable to load document inspection.'))
        }
    }

    async inspect(projectId: string, workspaceKey: string, fileId: string, versionId: string): Promise<DocumentAnalysisRecord> {
        try {
            console.info('[document-inspection-ui] Starting a new inspection request.', { documentId: fileId, versionId })
            const response = await firstValueFrom(
                this.http.post<{ data: DocumentAnalysisRecord }>(
                    this.getUrl(projectId, fileId, versionId),
                    { workspaceKey }
                ).pipe(timeout({ first: INSPECTION_REQUEST_TIMEOUT_MS }))
            )
            console.info('[document-inspection-ui] Inspection request completed.', {
                documentId: fileId,
                versionId,
                status: response.data.status,
                requestedAt: response.data.requestedAt
            })
            return response.data
        } catch (error) {
            console.error('[document-inspection-ui] Inspection request failed.', {
                documentId: fileId,
                versionId,
                message: this.getErrorMessage(error, 'Document inspection failed.')
            })
            throw this.toRequestError(error, 'Document inspection failed.')
        }
    }

    async cancelInspection(
        projectId: string,
        workspaceKey: string,
        fileId: string,
        versionId: string,
        analysisId: string
    ): Promise<DocumentAnalysisRecord> {
        try {
            const response = await firstValueFrom(this.http.post<{ data: DocumentAnalysisRecord }>(
                `${this.getUrl(projectId, fileId, versionId)}/cancel`,
                { workspaceKey, analysisId }
            ).pipe(timeout({ first: INSPECTION_LOOKUP_TIMEOUT_MS })))
            return response.data
        } catch (error) {
            throw new Error(this.getErrorMessage(error, 'Unable to cancel the document inspection.'))
        }
    }

    async applyProjectActions(
        projectId: string,
        workspaceKey: string,
        fileId: string,
        versionId: string,
        analysisId: string,
        targetFields: string[]
    ): Promise<DocumentAnalysisApplyResult> {
        try {
            const response = await firstValueFrom(this.http.post<{ data: DocumentAnalysisApplyResult }>(
                `${this.getUrl(projectId, fileId, versionId)}/actions/apply`,
                { workspaceKey, analysisId, targetFields }
            ).pipe(timeout({ first: INSPECTION_LOOKUP_TIMEOUT_MS })))
            return response.data
        } catch (error) {
            throw new Error(this.getErrorMessage(error, 'Unable to apply the selected project actions.'))
        }
    }

    async applyBomActions(
        projectId: string,
        workspaceKey: string,
        fileId: string,
        versionId: string,
        analysisId: string,
        proposalIds: string[]
    ): Promise<DocumentAnalysisBomApplyResult> {
        try {
            const response = await firstValueFrom(this.http.post<{ data: DocumentAnalysisBomApplyResult }>(
                `${this.getUrl(projectId, fileId, versionId)}/actions/bom/apply`,
                { workspaceKey, analysisId, proposalIds }
            ).pipe(timeout({ first: INSPECTION_LOOKUP_TIMEOUT_MS })))
            return response.data
        } catch (error) {
            throw new Error(this.getErrorMessage(error, 'Unable to apply the selected BOM actions.'))
        }
    }

    async createDeviceForBomProposal(
        projectId: string,
        workspaceKey: string,
        fileId: string,
        versionId: string,
        analysisId: string,
        proposalId: string,
        input: DocumentAnalysisCreateDeviceInput
    ): Promise<DocumentAnalysisCreateDeviceResult> {
        try {
            const response = await firstValueFrom(this.http.post<{ data: DocumentAnalysisCreateDeviceResult }>(
                `${this.getUrl(projectId, fileId, versionId)}/actions/bom/proposals/${encodeURIComponent(proposalId)}/create-device`,
                { workspaceKey, analysisId, ...input }
            ).pipe(timeout({ first: INSPECTION_LOOKUP_TIMEOUT_MS })))
            return response.data
        } catch (error) {
            throw new Error(this.getErrorMessage(error, 'Unable to create the Firewire device.'))
        }
    }

    async recordCoordinationItem(
        projectId: string,
        workspaceKey: string,
        fileId: string,
        versionId: string,
        analysisId: string,
        coordinationId: string,
        status: 'OPEN' | 'RESOLVED' | 'DISMISSED',
        owner = ''
    ): Promise<DocumentAnalysisRecord> {
        try {
            const response = await firstValueFrom(this.http.post<{ data: { record: DocumentAnalysisRecord } }>(
                `${this.getUrl(projectId, fileId, versionId)}/actions/coordination`,
                { workspaceKey, analysisId, coordinationId, status, owner }
            ).pipe(timeout({ first: INSPECTION_LOOKUP_TIMEOUT_MS })))
            return response.data.record
        } catch (error) {
            throw new Error(this.getErrorMessage(error, 'Unable to update the coordination item.'))
        }
    }

    async createFloorplan(
        projectId: string,
        workspaceKey: string,
        fileId: string,
        versionId: string,
        analysisId: string,
        proposalId: string
    ): Promise<any> {
        return this.applyFloorplanAction(projectId, workspaceKey, fileId, versionId, analysisId, proposalId, 'create')
    }

    async placeFloorplanSymbols(
        projectId: string,
        workspaceKey: string,
        fileId: string,
        versionId: string,
        analysisId: string,
        proposalId: string
    ): Promise<any> {
        return this.applyFloorplanAction(projectId, workspaceKey, fileId, versionId, analysisId, proposalId, 'place-symbols')
    }

    async locateFloorplanSymbols(
        projectId: string,
        workspaceKey: string,
        fileId: string,
        versionId: string,
        analysisId: string,
        proposalId: string,
        replaceExisting = false
    ): Promise<any> {
        return this.applyFloorplanAction(
            projectId,
            workspaceKey,
            fileId,
            versionId,
            analysisId,
            proposalId,
            'locate-symbols',
            { replaceExisting }
        )
    }

    private async applyFloorplanAction(
        projectId: string,
        workspaceKey: string,
        fileId: string,
        versionId: string,
        analysisId: string,
        proposalId: string,
        action: 'create' | 'locate-symbols' | 'place-symbols',
        extraBody: Record<string, unknown> = {}
    ): Promise<any> {
        try {
            const response = await firstValueFrom(this.http.post<{ data: any }>(
                `${this.getUrl(projectId, fileId, versionId)}/actions/floorplans/proposals/${encodeURIComponent(proposalId)}/${action}`,
                { workspaceKey, analysisId, ...extraBody }
            ).pipe(timeout({ first: action === 'locate-symbols' ? 600000 : INSPECTION_REQUEST_TIMEOUT_MS })))
            return response.data
        } catch (error) {
            const fallback = action === 'create'
                ? 'Unable to create the floorplan.'
                : action === 'locate-symbols'
                    ? 'Unable to locate device symbols on the floorplan.'
                    : 'Unable to place floorplan symbols.'
            throw new Error(this.getErrorMessage(error, fallback))
        }
    }

    private getUrl(projectId: string, fileId: string, versionId: string): string {
        return `/api/firewire/projects/${encodeURIComponent(projectId)}/document-analysis/files/${encodeURIComponent(fileId)}/versions/${encodeURIComponent(versionId)}`
    }

    private getErrorMessage(error: unknown, fallback: string): string {
        if (error instanceof TimeoutError) {
            return 'The document inspection request timed out before the server returned a result.'
        }
        if (error instanceof HttpErrorResponse) {
            return (typeof error.error === 'string' ? error.error : error.error?.message) || error.message || fallback
        }
        return error instanceof Error ? error.message : fallback
    }

    private toRequestError(error: unknown, fallback: string): DocumentAnalysisRequestError {
        if (error instanceof HttpErrorResponse) {
            return new DocumentAnalysisRequestError(
                this.getErrorMessage(error, fallback),
                error.status,
                String(error.error?.code || ''),
                error.error?.retryable !== false
            )
        }
        return new DocumentAnalysisRequestError(this.getErrorMessage(error, fallback), 0, '', true)
    }
}
