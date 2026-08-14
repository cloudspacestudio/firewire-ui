import { CommonModule } from '@angular/common'
import { ChangeDetectorRef, Component, OnDestroy, OnInit, inject } from '@angular/core'
import { FormsModule } from '@angular/forms'
import { MAT_DIALOG_DATA, MatDialogActions, MatDialogClose, MatDialogContent, MatDialogTitle } from '@angular/material/dialog'
import { MatButtonModule } from '@angular/material/button'
import { MatIconModule } from '@angular/material/icon'
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner'
import { MatProgressBarModule } from '@angular/material/progress-bar'
import { MatCheckboxModule } from '@angular/material/checkbox'
import { MatFormFieldModule } from '@angular/material/form-field'
import { MatInputModule } from '@angular/material/input'
import { MatSlideToggleModule } from '@angular/material/slide-toggle'
import { FirewireProjectSchema } from '../../schemas/firewire-project.schema'

import {
    DocumentAnalysisFinding,
    DocumentAnalysisBomProposal,
    DocumentAnalysisProjectDetailProposal,
    DocumentAnalysisRecord,
    DocumentAnalysisRequestError,
    DocumentAnalysisService,
    DocumentAnalysisSource
} from '../services/document-analysis.service'

export interface FirewireDocumentAnalysisDialogData {
    projectId: string
    workspaceKey: string
    fileId: string
    versionId: string
    sourceFilename: string
    onProjectUpdated?: (project: FirewireProjectSchema, targetFields: string[]) => void
}

interface DocumentDeviceQuickCapture {
    name: string
    shortName: string
    categoryName: string
    includeOnFloorplan: boolean
    floorplanLabelText: string
    defaultLabor: number
}

@Component({
    standalone: true,
    selector: 'firewire-document-analysis-dialog',
    imports: [
        CommonModule,
        FormsModule,
        MatButtonModule,
        MatCheckboxModule,
        MatDialogActions,
        MatDialogClose,
        MatDialogContent,
        MatDialogTitle,
        MatIconModule,
        MatFormFieldModule,
        MatInputModule,
        MatProgressBarModule,
        MatProgressSpinnerModule,
        MatSlideToggleModule
    ],
    template: `
        <div mat-dialog-title class="fw-dialog-titlebar">
          <span class="fw-dialog-titlebar__text">Document Findings</span>
          <button mat-icon-button type="button" class="fw-dialog-titlebar__close" aria-label="Close document findings" mat-dialog-close>
            <mat-icon fontIcon="close"></mat-icon>
          </button>
        </div>

        <mat-dialog-content class="document-analysis">
          <div class="document-analysis__source">
            <mat-icon fontIcon="description"></mat-icon>
            <div>
              <div class="document-analysis__eyebrow">Source Document</div>
              <strong>{{data.sourceFilename}}</strong>
            </div>
          </div>

          @if (working) {
            <div class="document-analysis__working">
              <mat-spinner diameter="42"></mat-spinner>
              <div>
                <strong>Inspecting document</strong>
                <span>{{progressMessage}}</span>
                <span class="document-analysis__elapsed">{{progressPercent}}% stage progress · {{elapsedLabel}}</span>
              </div>
            </div>
            <mat-progress-bar mode="determinate" [value]="progressPercent"></mat-progress-bar>
            <div class="document-analysis__working-note">
              OpenAI analysis time depends on PDF page count and complexity, not only file size. The analysis stage may remain at the same percentage while the model reads the document.
            </div>
          } @else if (errorMessage) {
            <div class="document-analysis__error" role="alert">
              <mat-icon fontIcon="error_outline"></mat-icon>
              <div>
                <strong>{{record?.status === 'cancelled' ? 'Inspection canceled' : record?.status === 'failed' ? 'Previous inspection failed' : 'Inspection unavailable'}}</strong>
                <span>{{errorMessage}}</span>
                @if (record?.status === 'failed' && record?.completedAt) {
                  <span class="document-analysis__attempt-time">Attempt completed {{record?.completedAt | date:'medium'}}. Re-inspect starts a new API request.</span>
                }
              </div>
            </div>
            @if (!retryAllowed) {
              <div class="document-analysis__error-note">Inspection can be retried after the OpenAI account configuration is corrected.</div>
            }
          } @else if (record?.result; as result) {
            <div class="document-analysis__meta">
              <div><span>Type</span><strong>{{result.document.documentType || 'Not found'}}</strong></div>
              <div><span>Discipline</span><strong>{{result.document.discipline || 'Not found'}}</strong></div>
              <div><span>Revision</span><strong>{{result.document.revision || 'Not found'}}</strong></div>
              <div><span>Analyzed</span><strong>{{record?.completedAt | date:'short'}}</strong></div>
            </div>

            <section class="document-analysis__summary">
              <div class="document-analysis__eyebrow">Executive Summary</div>
              <p>{{result.executiveSummary || result.document.summary || 'No summary was returned.'}}</p>
            </section>

            @if (getProposedBomActions().length > 0) {
              <section class="document-analysis__section document-analysis__bom-actions">
                <div class="document-analysis__actions-heading">
                  <h3>Proposed BOM Actions <span>{{getProposedBomActions().length}}</span></h3>
                  <span class="document-analysis__review-only">User approval required · Select matched rows</span>
                </div>
                <div class="document-analysis__list">
                  @for (action of getProposedBomActions(); track action.proposalId) {
                    <article class="document-analysis__finding document-analysis__bom-action" [class.is-applied]="isBomActionApplied(action)">
                      <div class="document-analysis__finding-head">
                        <div>
                          <mat-checkbox
                            [checked]="isBomActionSelected(action)"
                            [disabled]="working || bomApplying || !isBomActionEligible(action)"
                            (change)="setBomActionSelected(action, $event.checked)"
                            [attr.aria-label]="'Select BOM action for ' + (action.deviceType || action.description || 'device')">
                          </mat-checkbox>
                          <strong>{{action.deviceType || action.description || 'Unidentified device'}}</strong>
                          @if (action.symbolLabel) {
                            <span class="document-analysis__symbol-label">Symbol {{action.symbolLabel}}</span>
                          }
                        </div>
                        <div class="document-analysis__action-badges">
                          @if (isBomActionApplied(action)) {
                            <span class="document-analysis__badge" data-tone="fact">APPLIED</span>
                          } @else if (!isBomActionEligible(action)) {
                            <span class="document-analysis__badge" data-tone="warning">REVIEW REQUIRED</span>
                          }
                          <span class="document-analysis__badge" [attr.data-tone]="getQuantityTone(action.quantityStatus)">{{action.quantityStatus}}</span>
                          <span class="document-analysis__badge" [attr.data-tone]="getCatalogTone(action.catalogMatch.status)">{{action.catalogMatch.status}}</span>
                          <span>{{getConfidenceLabel(action.confidence)}}</span>
                        </div>
                      </div>

                      <div class="document-analysis__quantity-grid">
                        <div>
                          <span>Schedule</span>
                          <strong>{{action.scheduleQuantityFound ? action.scheduleQuantity : 'Not found'}}</strong>
                        </div>
                        <div>
                          <span>Drawing symbols</span>
                          <strong>{{action.drawingQuantityFound ? action.drawingQuantity : 'Not counted'}}</strong>
                        </div>
                        <div>
                          <span>Proposed BOM</span>
                          <strong [class.is-blocked]="action.quantityStatus === 'CONFLICT'">{{action.quantityStatus === 'CONFLICT' ? 'Blocked' : action.reconciledQuantity}}</strong>
                        </div>
                        <div>
                          <span>Placement target</span>
                          <strong [class.is-blocked]="action.floorplanPlacementTarget === 0">{{action.floorplanPlacementTarget > 0 ? action.floorplanPlacementTarget + ' symbols' : 'Requires review'}}</strong>
                        </div>
                      </div>

                      <p>{{action.quantityRationale}}</p>
                      <dl class="document-analysis__bom-details">
                        @if (action.manufacturer || action.modelNumber || action.partNumber) {
                          <div><dt>Document equipment</dt><dd>{{getDocumentEquipmentLabel(action)}}</dd></div>
                        }
                        <div>
                          <dt>Firewire catalog</dt>
                          <dd>
                            @if ((action.catalogMatch.entityType === 'DEVICE' || (!action.catalogMatch.entityType && action.catalogMatch.deviceId)) && action.catalogMatch.deviceId) {
                              Device: {{action.catalogMatch.deviceName}}{{action.catalogMatch.partNumber ? ' · ' + action.catalogMatch.partNumber : ''}} · {{getConfidenceLabel(action.catalogMatch.confidence)}}
                            } @else if (action.catalogMatch.entityType === 'PART' && action.catalogMatch.partId) {
                              Master part: {{action.catalogMatch.partNumber}}{{action.catalogMatch.vendorName ? ' · ' + action.catalogMatch.vendorName : ''}} · {{getConfidenceLabel(action.catalogMatch.confidence)}}
                            } @else {
                              No catalog device or master part selected
                            }
                          </dd>
                        </div>
                        @if (action.catalogMatch.entityType === 'PART' && action.catalogMatch.status === 'MATCHED') {
                          <div><dt>Device readiness</dt><dd>This part exists in the master catalog but still needs a Firewire device selection or device definition before floorplan placement.</dd></div>
                        }
                        <div><dt>Match basis</dt><dd>{{action.catalogMatch.rationale}}</dd></div>
                      </dl>
                      @if (canCreateDeviceForBomAction(action) && deviceCaptureProposalId !== action.proposalId) {
                        <div class="document-analysis__device-resolution">
                          <div>
                            <strong>Floorplan device missing</strong>
                            <span>Create a reusable Firewire device from the displayed master part, then apply this row to the BOM.</span>
                          </div>
                          <button mat-stroked-button type="button" [disabled]="deviceCreating" (click)="beginDeviceCapture(action)">
                            Create Missing Device
                          </button>
                        </div>
                      }
                      @if (deviceCaptureProposalId === action.proposalId && deviceCapture) {
                        <div class="document-analysis__device-capture">
                          <div class="document-analysis__device-capture-heading">
                            <div>
                              <strong>Create Device From {{action.catalogMatch.partNumber}}</strong>
                              <span>This confirms the displayed {{action.catalogMatch.vendorName || 'master catalog'}} part and creates reusable catalog data.</span>
                            </div>
                            <button mat-button type="button" [disabled]="deviceCreating" (click)="cancelDeviceCapture()">Cancel</button>
                          </div>
                          <div class="document-analysis__device-capture-grid">
                            <mat-form-field>
                              <mat-label>Device Name</mat-label>
                              <input matInput maxlength="200" [(ngModel)]="deviceCapture.name" />
                            </mat-form-field>
                            <mat-form-field>
                              <mat-label>Short Name</mat-label>
                              <input matInput maxlength="50" [(ngModel)]="deviceCapture.shortName" />
                            </mat-form-field>
                            <mat-form-field>
                              <mat-label>Category</mat-label>
                              <input matInput maxlength="120" [(ngModel)]="deviceCapture.categoryName" />
                            </mat-form-field>
                            <mat-form-field>
                              <mat-label>Floorplan Label</mat-label>
                              <input matInput maxlength="4" [(ngModel)]="deviceCapture.floorplanLabelText" />
                              <mat-hint>1–4 characters from the document legend</mat-hint>
                            </mat-form-field>
                            <mat-form-field>
                              <mat-label>Default Labor Cost</mat-label>
                              <input matInput type="number" min="0" step="1" [(ngModel)]="deviceCapture.defaultLabor" />
                            </mat-form-field>
                            <div class="document-analysis__device-floorplan-toggle">
                              <mat-slide-toggle [(ngModel)]="deviceCapture.includeOnFloorplan">Include on Floorplan</mat-slide-toggle>
                              <span>The legend label will be used as a bubble until symbol artwork is captured or an icon is assigned.</span>
                            </div>
                          </div>
                          @if (action.catalogMatch.status === 'POSSIBLE') {
                            <div class="document-analysis__device-warning">
                              <mat-icon fontIcon="warning_amber"></mat-icon>
                              <span>This was a possible match. Creating the device explicitly confirms {{action.catalogMatch.partNumber}} as the intended master part.</span>
                            </div>
                          }
                          @if (deviceCaptureMessage) {
                            <div class="document-analysis__apply-status" [attr.data-tone]="deviceCaptureError ? 'danger' : 'fact'" role="status">
                              <mat-icon [fontIcon]="deviceCaptureError ? 'error_outline' : 'info'"></mat-icon>
                              <span>{{deviceCaptureMessage}}</span>
                            </div>
                          }
                          <div class="document-analysis__device-capture-actions">
                            <button mat-flat-button color="primary" type="button" [disabled]="!canSubmitDeviceCapture() || deviceCreating" (click)="createDeviceForBomAction(action)">
                              {{deviceCreating ? 'Creating Device...' : 'Create Device & Resolve Match'}}
                            </button>
                          </div>
                        </div>
                      }
                      @if (action.scheduleQuantityFound) {
                        <div class="document-analysis__citation">Schedule: {{getSourceLabel(action.scheduleSource)}}</div>
                      }
                      @if (action.drawingQuantityFound || action.floorplanSymbolFound) {
                        <div class="document-analysis__citation">Drawing: {{getSourceLabel(action.drawingSource)}}</div>
                      }
                    </article>
                  }
                </div>
                @if (bomApplyMessage) {
                  <div class="document-analysis__apply-status" [attr.data-tone]="bomApplyError ? 'danger' : 'fact'" role="status">
                    <mat-icon [fontIcon]="bomApplyError ? 'error_outline' : 'check_circle'"></mat-icon>
                    <span>{{bomApplyMessage}}</span>
                  </div>
                }
                <div class="document-analysis__quantity-law">
                  <mat-icon fontIcon="balance"></mat-icon>
                  <span>A future BOM row will retain this placement target. Symbol automation must create exactly the same number of annotations linked by that row's stable BOM ID.</span>
                </div>
              </section>
            }

            @if (getProposedActions().length > 0) {
              <section class="document-analysis__section document-analysis__actions">
                <div class="document-analysis__actions-heading">
                  <h3>Proposed Project Actions <span>{{getProposedActions().length}}</span></h3>
                  <span class="document-analysis__review-only">Review only · Nothing has been applied</span>
                </div>
                <div class="document-analysis__list">
                  @for (action of getProposedActions(); track action.targetField) {
                    <article class="document-analysis__finding document-analysis__action" [class.is-applied]="isActionApplied(action)">
                      <div class="document-analysis__finding-head">
                        <div class="document-analysis__action-select">
                          <mat-checkbox
                            [checked]="isActionSelected(action)"
                            [disabled]="applying || isActionApplied(action)"
                            (change)="setActionSelected(action, $event.checked)"
                            [attr.aria-label]="'Select proposed update for ' + action.fieldLabel">
                          </mat-checkbox>
                          <strong>{{action.fieldLabel}}</strong>
                        </div>
                        <div class="document-analysis__action-badges">
                          <span class="document-analysis__badge" [attr.data-tone]="isActionApplied(action) ? 'fact' : 'warning'">{{isActionApplied(action) ? 'APPLIED' : 'PROPOSED'}}</span>
                          <span class="document-analysis__badge" [attr.data-tone]="getEvidenceTone(action.evidenceType)">{{getEvidenceLabel(action.evidenceType)}}</span>
                          <span>{{getConfidenceLabel(action.confidence)}}</span>
                        </div>
                      </div>
                      <div class="document-analysis__change">
                        <div>
                          <span>Current</span>
                          <strong [class.is-empty]="!action.currentValue">{{formatActionValue(action.currentValue)}}</strong>
                        </div>
                        <mat-icon fontIcon="arrow_forward" aria-hidden="true"></mat-icon>
                        <div>
                          <span>Proposed</span>
                          <strong>{{formatActionValue(action.proposedValue)}}</strong>
                        </div>
                      </div>
                      <p>{{action.rationale}}</p>
                      <div class="document-analysis__citation">{{getSourceLabel(action.source)}}</div>
                    </article>
                  }
                </div>
                @if (applyMessage) {
                  <div class="document-analysis__apply-status" [attr.data-tone]="applyError ? 'danger' : 'fact'" role="status">
                    <mat-icon [fontIcon]="applyError ? 'error_outline' : 'check_circle'"></mat-icon>
                    <span>{{applyMessage}}</span>
                  </div>
                }
              </section>
            }

            @for (section of getFindingSections(); track section.label) {
              @if (section.findings.length > 0) {
                <section class="document-analysis__section">
                  <h3>{{section.label}} <span>{{section.findings.length}}</span></h3>
                  <div class="document-analysis__list">
                    @for (finding of section.findings; track $index) {
                      <article class="document-analysis__finding">
                        <div class="document-analysis__finding-head">
                          <span class="document-analysis__badge" [attr.data-tone]="getEvidenceTone(finding.evidenceType)">{{getEvidenceLabel(finding.evidenceType)}}</span>
                          <span>{{getConfidenceLabel(finding.confidence)}}</span>
                        </div>
                        <p>{{finding.text}}</p>
                        <div class="document-analysis__citation">{{getSourceLabel(finding.source)}}</div>
                      </article>
                    }
                  </div>
                </section>
              }
            }

            @if (result.codes.length > 0) {
              <section class="document-analysis__section">
                <h3>Codes and Standards <span>{{result.codes.length}}</span></h3>
                <div class="document-analysis__list">
                  @for (code of result.codes; track $index) {
                    <article class="document-analysis__finding">
                      <div class="document-analysis__finding-head">
                        <strong>{{code.code}}{{code.edition ? ' — ' + code.edition : ''}}</strong>
                        <span class="document-analysis__badge" [attr.data-tone]="code.status === 'DOCUMENT-STATED' ? 'fact' : 'warning'">{{code.status}}</span>
                      </div>
                      <p>{{code.explanation}}</p>
                      @if (code.verificationRequired) {
                        <div class="document-analysis__verification">Requires jurisdiction/AHJ verification</div>
                      }
                      <div class="document-analysis__citation">{{getSourceLabel(code.source)}}</div>
                    </article>
                  }
                </div>
              </section>
            }

            @if (result.risks.length > 0) {
              <section class="document-analysis__section">
                <h3>Risks <span>{{result.risks.length}}</span></h3>
                <div class="document-analysis__list">
                  @for (risk of result.risks; track $index) {
                    <article class="document-analysis__finding">
                      <div class="document-analysis__finding-head">
                        <strong>{{risk.category}}</strong>
                        <span class="document-analysis__badge" [attr.data-tone]="getRiskTone(risk.severity)">{{risk.severity}}</span>
                      </div>
                      <p>{{risk.description}}</p>
                      <dl>
                        <div><dt>Basis</dt><dd>{{risk.basis}}</dd></div>
                        <div><dt>Potential impact</dt><dd>{{risk.potentialImpact}}</dd></div>
                        <div><dt>Recommended action</dt><dd>{{risk.recommendedAction}}</dd></div>
                      </dl>
                      <div class="document-analysis__citation">{{getSourceLabel(risk.source)}}</div>
                    </article>
                  }
                </div>
              </section>
            }

            @if (getProposedBomActions().length === 0 && getProposedActions().length === 0 && getFindingSections().every(section => section.findings.length === 0) && result.codes.length === 0 && result.risks.length === 0) {
              <div class="document-analysis__empty">No material findings were identified in this document.</div>
            }
          }
        </mat-dialog-content>

        <mat-dialog-actions align="end">
          <button mat-button type="button" mat-dialog-close>Close</button>
          @if (working && record?.status === 'running') {
            <button mat-button type="button" [disabled]="cancelling" (click)="cancelInspection()">
              {{cancelling ? 'Cancelling...' : 'Cancel inspection'}}
            </button>
          }
          @if (getProposedActions().length > 0) {
            <button mat-flat-button type="button" color="primary" [disabled]="working || applying || selectedActionCount === 0" (click)="applySelectedActions()">
              {{applying ? 'Applying...' : 'Apply Selected (' + selectedActionCount + ')'}}
            </button>
          }
          @if (getProposedBomActions().length > 0) {
            <button mat-flat-button type="button" color="primary" [disabled]="working || applying || bomApplying || selectedBomActionCount === 0" (click)="applySelectedBomActions()">
              {{bomApplying ? 'Applying BOM...' : 'Apply BOM (' + selectedBomActionCount + ')'}}
            </button>
          }
          <button mat-flat-button type="button" color="primary" [disabled]="working || record?.status === 'running'" (click)="runInspection()" [title]="record?.status === 'failed' ? 'Start a new inspection attempt' : ''">
            {{record ? 'Re-inspect' : 'Inspect'}}
          </button>
        </mat-dialog-actions>
    `,
    styleUrls: ['./firewire-document-analysis.dialog.scss']
})
export class FirewireDocumentAnalysisDialog implements OnInit, OnDestroy {
    readonly data = inject<FirewireDocumentAnalysisDialogData>(MAT_DIALOG_DATA)
    private readonly analysis = inject(DocumentAnalysisService)
    private readonly changeDetector = inject(ChangeDetectorRef)

    working = true
    errorMessage = ''
    retryAllowed = true
    cancelling = false
    record: DocumentAnalysisRecord | null = null
    private inspectionInFlight = false
    private cancellationRequested = false
    private progressGeneration = 0
    private progressStartedAt = 0
    private progressTimer: ReturnType<typeof setInterval> | null = null
    private localProgress: DocumentAnalysisRecord['progress'] = undefined
    elapsedSeconds = 0
    applying = false
    applyMessage = ''
    applyError = false
    bomApplying = false
    bomApplyMessage = ''
    bomApplyError = false
    deviceCreating = false
    deviceCaptureProposalId = ''
    deviceCapture: DocumentDeviceQuickCapture | null = null
    deviceCaptureMessage = ''
    deviceCaptureError = false
    private readonly selectedActionFields = new Set<string>()
    private readonly selectedBomProposalIds = new Set<string>()

    async ngOnInit(): Promise<void> {
        const openedAt = new Date().toISOString()
        this.localProgress = {
            stage: 'checking',
            message: 'Checking for an existing inspection result.',
            percent: 1,
            updatedAt: openedAt
        }
        this.beginProgressTracking(openedAt)
        console.info('[document-inspection-ui] Findings dialog opened.', {
            documentId: this.data.fileId,
            versionId: this.data.versionId
        })
        try {
            this.record = await this.analysis.getInspection(
                this.data.projectId,
                this.data.workspaceKey,
                this.data.fileId,
                this.data.versionId
            )
            this.changeDetector.markForCheck()
            if (!this.record) {
                console.info('[document-inspection-ui] No completed result is available; starting a fresh inspection.', {
                    documentId: this.data.fileId,
                    versionId: this.data.versionId,
                    previousStatus: 'not-found',
                    previousRequestedAt: ''
                })
                await this.runInspection()
                return
            }
            if (this.record.status === 'failed' || this.record.status === 'cancelled') {
                this.errorMessage = this.record.error || (this.record.status === 'cancelled'
                    ? 'Inspection canceled by the user.'
                    : 'Document inspection failed.')
                this.retryAllowed = this.record.errorRetryable !== false
                this.localProgress = undefined
                this.working = false
                this.stopProgressTracking()
                this.changeDetector.markForCheck()
                return
            }
            if (this.record.status === 'running') {
                this.localProgress = undefined
                this.working = true
                const generation = this.beginProgressTracking(this.record.requestedAt)
                await this.pollProgress(generation)
                return
            }
            if (!this.record.result) {
                this.errorMessage = 'The completed inspection did not contain a result.'
            }
            this.selectAvailableActions()
            this.selectAvailableBomActions()
            this.localProgress = undefined
            this.working = false
            this.stopProgressTracking()
            this.changeDetector.markForCheck()
        } catch (error) {
            this.errorMessage = error instanceof Error ? error.message : 'Unable to load document inspection.'
            this.working = false
            this.stopProgressTracking()
            this.changeDetector.markForCheck()
        }
    }

    ngOnDestroy(): void {
        this.stopProgressTracking()
    }

    async runInspection(): Promise<void> {
        if (this.inspectionInFlight) {
            return
        }
        this.inspectionInFlight = true
        this.cancellationRequested = false
        this.cancelling = false
        this.working = true
        this.errorMessage = ''
        this.retryAllowed = true
        this.applyMessage = ''
        this.applyError = false
        this.bomApplyMessage = ''
        this.bomApplyError = false
        this.cancelDeviceCapture()
        this.selectedActionFields.clear()
        this.selectedBomProposalIds.clear()
        this.record = null
        const requestedAt = new Date().toISOString()
        this.localProgress = {
            stage: 'submitting',
            message: 'Submitting the inspection request to Firewire.',
            percent: 2,
            updatedAt: requestedAt
        }
        const generation = this.beginProgressTracking(requestedAt)
        void this.pollProgress(generation)
        try {
            this.record = await this.analysis.inspect(
                this.data.projectId,
                this.data.workspaceKey,
                this.data.fileId,
                this.data.versionId
            )
            this.selectAvailableActions()
            this.selectAvailableBomActions()
        } catch (error) {
            this.errorMessage = this.cancellationRequested
                ? 'Inspection canceled by the user.'
                : error instanceof Error ? error.message : 'Document inspection failed.'
            this.retryAllowed = this.cancellationRequested
                || !(error instanceof DocumentAnalysisRequestError)
                || error.retryable
        } finally {
            this.inspectionInFlight = false
            this.working = false
            this.stopProgressTracking()
            this.changeDetector.markForCheck()
        }
    }

    async cancelInspection(): Promise<void> {
        if (!this.record || this.record.status !== 'running' || this.cancelling) {
            return
        }
        this.cancelling = true
        this.cancellationRequested = true
        try {
            this.record = await this.analysis.cancelInspection(
                this.data.projectId,
                this.data.workspaceKey,
                this.data.fileId,
                this.data.versionId,
                this.record.id
            )
            this.errorMessage = this.record.error || 'Inspection canceled by the user.'
            this.retryAllowed = true
            this.working = false
            this.stopProgressTracking()
        } catch (error) {
            this.errorMessage = error instanceof Error ? error.message : 'Unable to cancel the document inspection.'
        } finally {
            this.cancelling = false
            this.changeDetector.markForCheck()
        }
    }

    get progressMessage(): string {
        return this.localProgress?.message || this.record?.progress?.message || 'Preparing the inspection request.'
    }

    get progressPercent(): number {
        return Math.max(0, Math.min(100, Number(this.localProgress?.percent ?? this.record?.progress?.percent ?? 0)))
    }

    get elapsedLabel(): string {
        const minutes = Math.floor(this.elapsedSeconds / 60)
        const seconds = this.elapsedSeconds % 60
        return minutes > 0 ? `${minutes}m ${seconds}s elapsed` : `${seconds}s elapsed`
    }

    private beginProgressTracking(requestedAt: string): number {
        this.stopProgressTracking()
        const parsed = new Date(requestedAt).getTime()
        this.progressStartedAt = Number.isFinite(parsed) ? parsed : Date.now()
        this.updateElapsed()
        this.progressTimer = setInterval(() => this.updateElapsed(), 1000)
        return this.progressGeneration
    }

    private stopProgressTracking(): void {
        this.progressGeneration += 1
        if (this.progressTimer) {
            clearInterval(this.progressTimer)
            this.progressTimer = null
        }
    }

    private updateElapsed(): void {
        this.elapsedSeconds = Math.max(0, Math.floor((Date.now() - this.progressStartedAt) / 1000))
        this.changeDetector.markForCheck()
    }

    private async pollProgress(generation: number): Promise<void> {
        while (this.working && generation === this.progressGeneration) {
            await new Promise((resolve) => setTimeout(resolve, 1000))
            if (!this.working || generation !== this.progressGeneration) {
                return
            }
            try {
                const record = await this.analysis.getInspection(
                    this.data.projectId,
                    this.data.workspaceKey,
                    this.data.fileId,
                    this.data.versionId
                )
                if (!record) {
                    continue
                }
                const recordRequestedAt = new Date(record.requestedAt).getTime()
                if (Number.isFinite(recordRequestedAt) && recordRequestedAt < this.progressStartedAt) {
                    continue
                }
                this.record = record
                this.localProgress = undefined
                this.changeDetector.markForCheck()
                if (record.status === 'failed' || record.status === 'cancelled') {
                    this.errorMessage = record.error || 'Document inspection failed.'
                    this.retryAllowed = record.errorRetryable !== false
                    this.working = false
                    this.stopProgressTracking()
                } else if (record.status === 'completed') {
                    this.working = false
                    this.stopProgressTracking()
                }
            } catch {
                // The primary POST reports terminal errors; a transient polling failure should not interrupt it.
            }
        }
    }

    getFindingSections(): Array<{ label: string, findings: DocumentAnalysisFinding[] }> {
        const result = this.record?.result
        if (!result) {
            return []
        }
        return [
            { label: 'Project and Customer Details', findings: result.projectDetails },
            { label: 'Inclusions', findings: result.scope.inclusions },
            { label: 'Exclusions', findings: result.scope.exclusions },
            { label: 'Assumptions', findings: result.scope.assumptions },
            { label: 'Customer Responsibilities', findings: result.scope.customerResponsibilities },
            { label: 'Other-Trade Responsibilities', findings: result.scope.otherTradeResponsibilities },
            { label: 'Specific Instructions', findings: result.scope.specificInstructions },
            { label: 'Limitations', findings: result.scope.limitations },
            { label: 'Alternates', findings: result.scope.alternates },
            { label: 'Technical Requirements', findings: result.requirements },
            { label: 'Open Questions', findings: result.openQuestions }
        ]
    }

    getProposedActions(): DocumentAnalysisProjectDetailProposal[] {
        return this.record?.result?.proposedActions || []
    }

    getProposedBomActions(): DocumentAnalysisBomProposal[] {
        return this.record?.result?.proposedBomActions || []
    }

    getQuantityTone(status: DocumentAnalysisBomProposal['quantityStatus']): string {
        if (status === 'MATCHED') return 'fact'
        if (status === 'CONFLICT') return 'danger'
        return 'warning'
    }

    getCatalogTone(status: DocumentAnalysisBomProposal['catalogMatch']['status']): string {
        if (status === 'MATCHED') return 'fact'
        if (status === 'NOT_FOUND') return 'danger'
        return 'warning'
    }

    getDocumentEquipmentLabel(action: DocumentAnalysisBomProposal): string {
        return [action.manufacturer, action.modelNumber, action.partNumber]
            .map((value) => String(value || '').trim())
            .filter(Boolean)
            .join(' · ')
    }

    get selectedActionCount(): number {
        return this.selectedActionFields.size
    }

    get selectedBomActionCount(): number {
        return this.selectedBomProposalIds.size
    }

    isBomActionApplied(action: DocumentAnalysisBomProposal): boolean {
        return (this.record?.bomActionApplications || []).some((application) =>
            application.proposalIds.includes(action.proposalId))
    }

    isBomActionEligible(action: DocumentAnalysisBomProposal): boolean {
        const entityType = action.catalogMatch.entityType
        return !this.isBomActionApplied(action)
            && action.quantityStatus !== 'CONFLICT'
            && Number(action.reconciledQuantity) > 0
            && action.catalogMatch.status === 'MATCHED'
            && (entityType === 'DEVICE' || entityType === 'PART')
            && !!(entityType === 'DEVICE' ? action.catalogMatch.deviceId : action.catalogMatch.partId)
    }

    canCreateDeviceForBomAction(action: DocumentAnalysisBomProposal): boolean {
        return !this.isBomActionApplied(action)
            && action.quantityStatus !== 'CONFLICT'
            && Number(action.reconciledQuantity) > 0
            && action.catalogMatch.entityType === 'PART'
            && !!action.catalogMatch.partId
            && action.catalogMatch.status !== 'NOT_FOUND'
    }

    beginDeviceCapture(action: DocumentAnalysisBomProposal): void {
        if (!this.canCreateDeviceForBomAction(action)) {
            return
        }
        const partNumber = String(action.catalogMatch.partNumber || action.partNumber || action.modelNumber || '').trim()
        this.deviceCaptureProposalId = action.proposalId
        this.deviceCapture = {
            name: String(action.deviceType || action.description || partNumber || 'Fire Alarm Device').trim().slice(0, 200),
            shortName: String(partNumber || action.symbolLabel || 'Device').trim().slice(0, 50),
            categoryName: String(action.deviceType || 'Fire Alarm Device').trim().slice(0, 120),
            includeOnFloorplan: true,
            floorplanLabelText: String(action.symbolLabel || '').trim().slice(0, 4),
            defaultLabor: 112
        }
        this.deviceCaptureMessage = ''
        this.deviceCaptureError = false
    }

    cancelDeviceCapture(): void {
        if (this.deviceCreating) {
            return
        }
        this.deviceCaptureProposalId = ''
        this.deviceCapture = null
        this.deviceCaptureMessage = ''
        this.deviceCaptureError = false
    }

    canSubmitDeviceCapture(): boolean {
        const capture = this.deviceCapture
        return !!capture
            && !!capture.name.trim()
            && !!capture.shortName.trim()
            && Number.isFinite(Number(capture.defaultLabor))
            && Number(capture.defaultLabor) >= 0
    }

    async createDeviceForBomAction(action: DocumentAnalysisBomProposal): Promise<void> {
        if (!this.record || !this.deviceCapture || this.deviceCreating || !this.canSubmitDeviceCapture()) {
            return
        }
        this.deviceCreating = true
        this.deviceCaptureMessage = 'Creating the reusable device and linking the confirmed master part.'
        this.deviceCaptureError = false
        try {
            const result = await this.analysis.createDeviceForBomProposal(
                this.data.projectId,
                this.data.workspaceKey,
                this.data.fileId,
                this.data.versionId,
                this.record.id,
                action.proposalId,
                {
                    ...this.deviceCapture,
                    name: this.deviceCapture.name.trim(),
                    shortName: this.deviceCapture.shortName.trim(),
                    categoryName: this.deviceCapture.categoryName.trim(),
                    floorplanLabelText: this.deviceCapture.floorplanLabelText.trim().slice(0, 4),
                    defaultLabor: Number(this.deviceCapture.defaultLabor)
                }
            )
            this.record = result.record
            this.selectedBomProposalIds.add(action.proposalId)
            this.deviceCaptureProposalId = ''
            this.deviceCapture = null
            this.deviceCaptureMessage = ''
            this.bomApplyError = false
            this.bomApplyMessage = result.application.created
                ? `${result.device.name} was created, linked to ${result.proposal.catalogMatch.partNumber}, and selected for BOM application.`
                : `${result.device.name} already existed and is now selected for BOM application.`
        } catch (error) {
            this.deviceCaptureError = true
            this.deviceCaptureMessage = error instanceof Error ? error.message : 'Unable to create the Firewire device.'
        } finally {
            this.deviceCreating = false
            this.changeDetector.markForCheck()
        }
    }

    isBomActionSelected(action: DocumentAnalysisBomProposal): boolean {
        return this.selectedBomProposalIds.has(action.proposalId)
    }

    setBomActionSelected(action: DocumentAnalysisBomProposal, selected: boolean): void {
        if (selected && this.isBomActionEligible(action)) {
            this.selectedBomProposalIds.add(action.proposalId)
        } else {
            this.selectedBomProposalIds.delete(action.proposalId)
        }
    }

    async applySelectedBomActions(): Promise<void> {
        if (!this.record || this.bomApplying || this.selectedBomProposalIds.size === 0) {
            return
        }
        this.bomApplying = true
        this.bomApplyMessage = 'Validating matched catalog items and approved quantities.'
        this.bomApplyError = false
        try {
            const result = await this.analysis.applyBomActions(
                this.data.projectId,
                this.data.workspaceKey,
                this.data.fileId,
                this.data.versionId,
                this.record.id,
                [...this.selectedBomProposalIds]
            )
            this.record = {
                ...this.record,
                bomActionApplications: [
                    result.application,
                    ...(this.record.bomActionApplications || []).filter((application) => application.id !== result.application.id)
                ]
            }
            this.selectedBomProposalIds.clear()
            const rowCount = result.application.rows.length
            this.bomApplyError = !result.applicationRecorded
            this.bomApplyMessage = result.alreadyApplied
                ? `${rowCount} BOM row${rowCount === 1 ? '' : 's'} had already been applied.`
                : !result.applicationRecorded
                    ? `${rowCount} BOM row${rowCount === 1 ? '' : 's'} created, but the analysis audit history could not be updated.`
                : `${rowCount} BOM row${rowCount === 1 ? '' : 's'} created with preserved placement targets.`
            this.data.onProjectUpdated?.(result.project, ['worksheetData.bomSections'])
        } catch (error) {
            this.bomApplyError = true
            this.bomApplyMessage = error instanceof Error ? error.message : 'Unable to apply the selected BOM actions.'
        } finally {
            this.bomApplying = false
            this.changeDetector.markForCheck()
        }
    }

    isActionSelected(action: DocumentAnalysisProjectDetailProposal): boolean {
        return this.selectedActionFields.has(action.targetField)
    }

    setActionSelected(action: DocumentAnalysisProjectDetailProposal, selected: boolean): void {
        if (selected && !this.isActionApplied(action)) {
            this.selectedActionFields.add(action.targetField)
        } else {
            this.selectedActionFields.delete(action.targetField)
        }
    }

    isActionApplied(action: DocumentAnalysisProjectDetailProposal): boolean {
        return (this.record?.actionApplications || []).some((application) =>
            application.targetFields.includes(action.targetField))
    }

    async applySelectedActions(): Promise<void> {
        if (!this.record || this.applying || this.selectedActionFields.size === 0) {
            return
        }
        this.applying = true
        this.applyMessage = 'Validating the selected actions against the current project.'
        this.applyError = false
        try {
            const result = await this.analysis.applyProjectActions(
                this.data.projectId,
                this.data.workspaceKey,
                this.data.fileId,
                this.data.versionId,
                this.record.id,
                [...this.selectedActionFields]
            )
            this.record = {
                ...this.record,
                actionApplications: [result.application, ...(this.record.actionApplications || [])]
            }
            this.selectedActionFields.clear()
            this.applyMessage = result.applicationRecorded
                ? `${result.application.targetFields.length} project action${result.application.targetFields.length === 1 ? '' : 's'} applied and recorded.`
                : `${result.application.targetFields.length} project action${result.application.targetFields.length === 1 ? '' : 's'} applied. The project audit entry was saved, but analysis history could not be updated.`
            this.data.onProjectUpdated?.(result.project, result.application.targetFields)
        } catch (error) {
            this.applyError = true
            this.applyMessage = error instanceof Error ? error.message : 'Unable to apply the selected project actions.'
        } finally {
            this.applying = false
            this.changeDetector.markForCheck()
        }
    }

    private selectAvailableActions(): void {
        this.selectedActionFields.clear()
        for (const action of this.getProposedActions()) {
            if (!this.isActionApplied(action)) {
                this.selectedActionFields.add(action.targetField)
            }
        }
    }

    private selectAvailableBomActions(): void {
        this.selectedBomProposalIds.clear()
        for (const action of this.getProposedBomActions()) {
            if (this.isBomActionEligible(action)) {
                this.selectedBomProposalIds.add(action.proposalId)
            }
        }
    }

    formatActionValue(value: string): string {
        return String(value || '').trim() || 'Not provided'
    }

    getSourceLabel(source: DocumentAnalysisSource): string {
        const locations = [
            source.page ? `Page ${source.page}` : '',
            source.section ? `Section ${source.section}` : '',
            source.location
        ].filter(Boolean)
        return locations.length > 0
            ? `${source.filename || this.data.sourceFilename} · ${locations.join(' · ')}`
            : `${source.filename || this.data.sourceFilename} · Location not found`
    }

    getEvidenceLabel(value: string): string {
        return value.replaceAll('_', ' ')
    }

    getEvidenceTone(value: string): string {
        if (value === 'DOCUMENT_FACT') return 'fact'
        if (value === 'UNRESOLVED_QUESTION') return 'warning'
        return 'interpretation'
    }

    getRiskTone(value: string): string {
        return value === 'CRITICAL' || value === 'HIGH' ? 'danger' : value === 'MEDIUM' ? 'warning' : 'fact'
    }

    getConfidenceLabel(value: number): string {
        return `${Math.round(Math.max(0, Math.min(1, Number(value || 0))) * 100)}% confidence`
    }
}
