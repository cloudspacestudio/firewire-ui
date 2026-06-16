import { Component, EventEmitter, Input, OnChanges, Output, inject } from "@angular/core"
import { CommonModule } from "@angular/common"
import { FormsModule } from "@angular/forms"
import { firstValueFrom, from, map, Observable, of, switchMap } from "rxjs"

import { HttpClient } from "@angular/common/http"

import { MatButtonModule } from "@angular/material/button"
import { MAT_DIALOG_DATA, MatDialog, MatDialogActions, MatDialogClose, MatDialogContent, MatDialogRef, MatDialogTitle } from "@angular/material/dialog"
import { MatFormFieldModule } from "@angular/material/form-field"
import { MatIconModule } from "@angular/material/icon"
import { MatInputModule } from "@angular/material/input"
import { MatListModule } from "@angular/material/list"
import { MatSelectModule } from "@angular/material/select"
import { MatSlideToggleModule } from "@angular/material/slide-toggle"
import { MatTooltipModule } from "@angular/material/tooltip"

import { VwDevice } from "../../schemas/vwdevice.schema"
import { VwDeviceMaterial } from "../../schemas/vwdevicematerial.schema"
import { MaterialAttribute } from "../../schemas/materialattribute.schema"
import { MaterialSubTask } from "../../schemas/materialsubtask.schema"
import { Vendor } from "../../schemas/vendor.schema"
import { VwPart } from "../../schemas/vwpart.schema"
import { ConfirmFirewireNavigationDialog } from "../../pages/projects/confirm-firewire-navigation.dialog"

interface DeviceVendorLinkIssue {
    deviceId: string
    deviceName: string
    vendorId: string
    vendorName: string
    partNumber: string
    sourceKind: 'device' | 'material'
    sourceLabel: string
    ignored: boolean
    ignoreReason?: string | null
}

interface EditableAttribute {
    name: string
    statusId: string
    valueType: string
    defaultValue: string
    ordinal: number
    managed?: boolean
}

interface EditableSubTask {
    statusName: string
    taskNameFormat: string
    laborHours: number
    ordinal: number
}

type DeviceEditView = 'details' | 'vendor-parts'

interface LinkedPartDisplayRow {
    partNumber: string
    description: string
    category: string
    cost: number | null
    msrp: number | null
}

interface DeviceMediaFile {
    id: string
    fileName: string
    mimeType: string
    sizeBytes: number
    uploadedAt: string
    uploadedBy?: string
}

@Component({
    standalone: true,
    selector: 'device-detail',
    imports: [CommonModule, FormsModule, MatButtonModule, MatFormFieldModule, MatSelectModule, MatIconModule, MatInputModule, MatListModule, MatSlideToggleModule, MatTooltipModule],
    providers: [HttpClient],
    templateUrl: './devicedetail.component.html',
    styleUrls: ['./devicedetail.component.scss']
})
export class DeviceDetailComponent implements OnChanges {
    private readonly slcNoneValue = 'none'
    private readonly speakerFalseValue = 'false'
    private readonly strobeFalseValue = 'false'
    private readonly vendorPartLookupMinChars = 3
    private readonly defaultLaborRate = 56

    @Input() deviceId?: string
    @Output() deviceLoaded: EventEmitter<VwDevice> = new EventEmitter()
    @Output() deviceDeleted: EventEmitter<void> = new EventEmitter()

    readonly slcOptions = [
        { value: 'none', label: 'None' },
        { value: 'one', label: 'One' },
        { value: 'two', label: 'Two' },
        { value: 'mac', label: 'MAC Address' }
    ]
    readonly booleanAddressOptions = [
        { value: 'false', label: 'No' },
        { value: 'true', label: 'Yes' }
    ]
    readonly subTaskOptions = ['Install', 'Test', 'Trimout', 'Cable']

    device?: VwDevice
    deviceMaterials: VwDeviceMaterial[] = []
    deviceAttributes: MaterialAttribute[] = []
    deviceSubTasks: MaterialSubTask[] = []
    vendorLinkIssues: DeviceVendorLinkIssue[] = []
    vendors: Vendor[] = []
    deviceMediaFiles: DeviceMediaFile[] = []
    partlist: VwPart[] = []
    vendorPartRows: VwPart[] = []
    vendorPartResults: VwPart[] = []
    partImagePath = ''
    partImageFailed = false

    pageWorking = true
    editMode = false
    activeEditView: DeviceEditView = 'details'
    saveWorking = false
    vendorPartLookupWorking = false
    vendorPartLookupLoaded = false
    mediaUploadWorking = false
    statusText = ''

    editDevice: Partial<VwDevice> = {}
    editLinkedPartNumbers: string[] = []
    editAttributes: EditableAttribute[] = []
    editSubTasks: EditableSubTask[] = []
    vendorPartFilter = ''
    selectedVendorPartVendorId = ''
    selectedVendorPartCategories: string[] = []
    initialEditState = ''

    constructor(
        private http: HttpClient,
        private dialog: MatDialog
    ) {}

    ngOnChanges(): void {
        if (!this.deviceId) {
            return
        }
        void this.loadDetail()
    }

    async loadDetail() {
        if (!this.deviceId) {
            return
        }
        this.pageWorking = true
        this.editMode = false
        this.statusText = ''
        this.vendorPartRows = []
        this.vendorPartResults = []
        this.vendorPartLookupLoaded = false
        this.vendorPartLookupWorking = false
        this.vendorPartFilter = ''
        this.selectedVendorPartVendorId = ''
        this.selectedVendorPartCategories = []

        try {
            const [device, materials, attributes, subTasks, issuesResponse, vendorsResponse, mediaResponse] = await Promise.all([
                firstValueFrom(this.http.get<VwDevice>(`/api/firewire/devices/${this.deviceId}`)),
                firstValueFrom(this.http.get<{ rows?: VwDeviceMaterial[] }>(`/api/firewire/vwdevicematerials/${this.deviceId}`)),
                firstValueFrom(this.http.get<{ rows?: MaterialAttribute[] }>(`/api/firewire/devices/${this.deviceId}/attributes`)),
                firstValueFrom(this.http.get<{ rows?: MaterialSubTask[] }>(`/api/firewire/devices/${this.deviceId}/subtasks`)),
                firstValueFrom(this.http.get<{ rows?: DeviceVendorLinkIssue[] }>('/api/firewire/devices/vendor-link-issues', { params: { state: 'all' } })),
                firstValueFrom(this.http.get<{ rows?: Vendor[] }>('/api/firewire/vendors')),
                firstValueFrom(this.http.get<{ data?: { files?: DeviceMediaFile[] } }>(`/api/firewire/devices/${this.deviceId}/media`))
            ])

            this.device = device
            this.deviceLoaded.emit(device)
            this.deviceMaterials = Array.isArray(materials?.rows) ? materials.rows : []
            this.deviceAttributes = Array.isArray(attributes?.rows) ? attributes.rows : []
            this.deviceSubTasks = Array.isArray(subTasks?.rows) ? subTasks.rows : []
            this.vendors = (Array.isArray(vendorsResponse?.rows) ? vendorsResponse.rows : [])
                .sort((a, b) => String(a.name || '').localeCompare(String(b.name || '')))
            this.deviceMediaFiles = Array.isArray(mediaResponse?.data?.files) ? mediaResponse.data.files : []
            this.selectedVendorPartVendorId = this.resolveDefaultVendorPartVendorId(device)
            const allIssues = Array.isArray(issuesResponse?.rows) ? issuesResponse.rows : []
            this.vendorLinkIssues = allIssues.filter((issue) => issue.deviceId === this.deviceId)
            await this.loadPartPreview(device.partNumber)
        } catch (err: any) {
            this.statusText = err?.error?.message || err?.message || 'Unable to load device detail.'
        } finally {
            this.pageWorking = false
        }
    }

    startEdit() {
        this.startEditView('details')
    }

    startVendorPartsEdit() {
        void this.openVendorPartsDialog()
    }

    startEditView(view: DeviceEditView) {
        if (!this.device) {
            return
        }
        if (!this.editMode) {
            this.editMode = true
            this.statusText = ''
            this.editDevice = {
                ...this.device,
                serialNumber: this.readBooleanMode(this.device.serialNumber),
                slcAddress: this.readSlcMode(this.device.slcAddress),
                speakerAddress: this.readBooleanMode(this.device.speakerAddress),
                strobeAddress: this.readBooleanMode(this.device.strobeAddress),
                laborRate: this.getDeviceLaborRate()
            }
            this.editLinkedPartNumbers = this.deviceMaterials.map((row) => String(row.materialPartNumber || '').trim()).filter(Boolean)
            this.editAttributes = this.sortAttributes().map((attribute) => ({
                name: attribute.name,
                statusId: attribute.statusId,
                valueType: attribute.valueType || 'text',
                defaultValue: String(attribute.defaultValue || ''),
                ordinal: attribute.ordinal,
                managed: this.isManagedAttribute(attribute.name)
            }))
            this.editSubTasks = this.sortSubTasks().map((subTask) => ({
                statusName: subTask.statusName,
                taskNameFormat: subTask.taskNameFormat || '',
                laborHours: Number(subTask.laborHours || 0),
                ordinal: subTask.ordinal
            }))
            this.vendorPartFilter = ''
            this.selectedVendorPartVendorId = this.resolveDefaultVendorPartVendorId(this.device)
            this.selectedVendorPartCategories = []
            this.vendorPartResults = []
            this.syncDerivedAttributes()
            this.syncDeviceCostFromLinkedParts()
            this.captureInitialEditState()
        }
        this.activeEditView = view
    }

    setEditView(view: DeviceEditView) {
        if (!this.editMode) {
            this.startEditView(view)
            return
        }
        this.activeEditView = view
    }

    async openVendorPartsDialog(): Promise<void> {
        if (!this.device) {
            return
        }
        if (!this.editMode) {
            this.startEditView('details')
        }
        this.releaseFocusedElementBeforeDialog()
        const dialogRef = this.dialog.open(DeviceVendorPartsDialog, {
            width: '980px',
            maxWidth: 'calc(100vw - 48px)',
            maxHeight: 'calc(100vh - 48px)',
            disableClose: true,
            data: {
                vendors: this.vendors,
                initialPartNumbers: [...this.editLinkedPartNumbers],
                defaultVendorId: this.resolveDefaultVendorPartVendorId(this.device),
                deviceMaterials: this.deviceMaterials
            }
        })
        const result = await firstValueFrom(dialogRef.afterClosed())
        if (!result || !Array.isArray(result.partNumbers)) {
            this.activeEditView = 'details'
            return
        }
        const mergedParts = new Map<string, VwPart>()
        for (const row of this.vendorPartRows) {
            mergedParts.set(String(row.PartNumber || '').trim(), row)
        }
        for (const row of Array.isArray(result.parts) ? result.parts : []) {
            mergedParts.set(String(row.PartNumber || '').trim(), row)
        }
        this.vendorPartRows = [...mergedParts.values()].filter((row) => String(row.PartNumber || '').trim())
        this.editLinkedPartNumbers = result.partNumbers.map((value: unknown) => String(value || '').trim()).filter(Boolean)
        this.syncDeviceCostFromLinkedParts()
        this.activeEditView = 'details'
    }

    cancelEdit() {
        this.editMode = false
        this.activeEditView = 'details'
        this.statusText = ''
        this.vendorPartFilter = ''
        this.selectedVendorPartVendorId = this.resolveDefaultVendorPartVendorId(this.device)
        this.selectedVendorPartCategories = []
        this.vendorPartResults = []
        this.initialEditState = ''
    }

    async save() {
        await this.performSave()
    }

    async deleteDevice() {
        if (!this.deviceId || !this.device) {
            return
        }

        this.releaseFocusedElementBeforeDialog()
        const dialogRef = this.dialog.open(ConfirmDeviceDeleteDialog, {
            width: '360px',
            maxWidth: '88vw',
            panelClass: 'fw-compact-dialog-pane',
            data: {
                name: this.device.name
            }
        })
        const confirmed = await firstValueFrom(dialogRef.afterClosed())
        if (!confirmed) {
            return
        }

        this.saveWorking = true
        this.statusText = `Deleting ${this.device.name}...`
        try {
            await firstValueFrom(this.http.delete(`/api/firewire/devices/${this.deviceId}`))
            this.editMode = false
            this.initialEditState = ''
            this.statusText = `${this.device.name} deleted.`
            this.deviceDeleted.emit()
        } catch (err: any) {
            this.statusText = err?.error?.message || err?.message || 'Unable to delete device.'
        } finally {
            this.saveWorking = false
        }
    }

    canDeactivate(): boolean | Observable<boolean> {
        if (!this.isDirty()) {
            return true
        }

        this.releaseFocusedElementBeforeDialog()
        return this.dialog.open(ConfirmFirewireNavigationDialog, {
            width: '360px',
            maxWidth: '88vw',
            panelClass: 'fw-compact-dialog-pane',
            data: {
                title: 'Leave Device Detail?',
                message: 'You have unsaved device changes.',
                canSave: true
            }
        }).afterClosed().pipe(
            map((result) => result || 'stay'),
            switchMap((result) => {
                if (result === 'leave') {
                    return of(true)
                }
                if (result === 'save') {
                    return from(this.performSave())
                }
                return of(false)
            })
        )
    }

    isDirty(): boolean {
        return this.editMode && this.initialEditState !== '' && this.initialEditState !== this.buildEditStateSnapshot()
    }

    private async performSave(): Promise<boolean> {
        if (!this.deviceId || !this.device) {
            return false
        }

        this.saveWorking = true
        this.statusText = 'Saving device...'
        this.syncDerivedAttributes()
        const resolvedDefaultLabor = this.getResolvedDefaultLabor()

        const payload = {
            device: {
                ...this.editDevice,
                serialNumber: this.writeBooleanMode(this.editDevice.serialNumber),
                slcAddress: this.writeSlcMode(this.editDevice.slcAddress),
                speakerAddress: this.writeBooleanMode(this.editDevice.speakerAddress),
                strobeAddress: this.writeBooleanMode(this.editDevice.strobeAddress),
                defaultLabor: resolvedDefaultLabor,
                laborRate: this.getDeviceLaborRate()
            },
            partNumbers: [...this.editLinkedPartNumbers],
            attributes: this.editAttributes.map((attribute, index) => ({
                ...attribute,
                ordinal: index,
                valueType: 'text'
            })),
            subTasks: this.editSubTasks.map((subTask, index) => ({
                ...subTask,
                ordinal: index
            }))
        }

        try {
            await firstValueFrom(this.http.put(`/api/firewire/devices/${this.deviceId}/detail`, payload))
            this.editMode = false
            this.activeEditView = 'details'
            this.statusText = 'Device saved.'
            this.initialEditState = ''
            await this.loadDetail()
            return true
        } catch (err: any) {
            this.statusText = err?.error?.message || err?.message || 'Unable to save device.'
            return false
        } finally {
            this.saveWorking = false
        }
    }

    addLinkedPart(partNumber: string) {
        const normalizedPartNumber = String(partNumber || '').trim()
        if (!normalizedPartNumber) {
            return
        }
        if (!this.editLinkedPartNumbers.includes(normalizedPartNumber)) {
            this.editLinkedPartNumbers = [...this.editLinkedPartNumbers, normalizedPartNumber]
        }
        this.syncDeviceCostFromLinkedParts()
        this.applyVendorPartFilters()
    }

    removeLinkedPart(index: number) {
        this.editLinkedPartNumbers = this.editLinkedPartNumbers.filter((_, rowIndex) => rowIndex !== index)
        this.syncDeviceCostFromLinkedParts()
        this.applyVendorPartFilters()
    }

    addSubTask() {
        this.editSubTasks = [
            ...this.editSubTasks,
            {
                statusName: this.subTaskOptions[0],
                taskNameFormat: '',
                laborHours: 0,
                ordinal: this.editSubTasks.length
            }
        ]
    }

    removeSubTask(index: number) {
        this.editSubTasks = this.editSubTasks.filter((_, rowIndex) => rowIndex !== index)
    }

    addCustomAttribute() {
        this.editAttributes = [
            ...this.editAttributes,
            {
                name: '',
                statusId: '',
                valueType: 'text',
                defaultValue: '',
                ordinal: this.editAttributes.length,
                managed: false
            }
        ]
    }

    removeAttribute(index: number) {
        this.editAttributes = this.editAttributes.filter((_, rowIndex) => rowIndex !== index)
    }

    async ignoreIssue(issue: DeviceVendorLinkIssue) {
        await firstValueFrom(this.http.post('/api/firewire/devices/vendor-link-issues/ignore', {
            deviceId: issue.deviceId,
            vendorId: issue.vendorId,
            partNumber: issue.partNumber,
            sourceKind: issue.sourceKind
        }))
        await this.loadDetail()
    }

    async unignoreIssue(issue: DeviceVendorLinkIssue) {
        await firstValueFrom(this.http.post('/api/firewire/devices/vendor-link-issues/unignore', {
            deviceId: issue.deviceId,
            vendorId: issue.vendorId,
            partNumber: issue.partNumber,
            sourceKind: issue.sourceKind
        }))
        await this.loadDetail()
    }

    async loadPartPreview(partNumber: string): Promise<void> {
        this.partlist = []
        this.partImagePath = ''
        this.partImageFailed = false
        if (!partNumber) {
            return
        }
        try {
            const response = await firstValueFrom(this.http.get<{ rows?: VwPart[] }>(`/api/firewire/parts/${partNumber}`))
            this.partlist = Array.isArray(response?.rows) ? response.rows : []
            this.partImagePath = this.getPartImagePath()
            this.partImageFailed = !this.partImagePath
        } catch {
            this.partlist = []
            this.partImagePath = ''
            this.partImageFailed = true
        }
    }

    getPartImagePath() {
        if (this.partlist.length > 0 && this.partlist[0]?.PrimaryImage) {
            return `https://myeddie.edwardsfiresafety.com${this.partlist[0].PrimaryImage}`
        }
        return ''
    }

    onPartImageError() {
        this.partImageFailed = true
    }

    async onVendorPartFilterChanged(): Promise<void> {
        const filterValue = this.getNormalizedVendorPartFilter()
        if (filterValue.length < this.vendorPartLookupMinChars) {
            this.vendorPartResults = []
            return
        }
        await this.ensureVendorPartLookupLoaded()
        this.applyVendorPartFilters()
    }

    async onVendorPartCategoryFilterChanged(): Promise<void> {
        if (!this.vendorPartLookupLoaded && this.getNormalizedVendorPartFilter().length >= this.vendorPartLookupMinChars) {
            await this.ensureVendorPartLookupLoaded()
        }
        this.applyVendorPartFilters()
    }

    async onVendorPartCategoryOpened(opened: boolean): Promise<void> {
        if (opened && !this.vendorPartLookupLoaded) {
            await this.ensureVendorPartLookupLoaded()
        }
    }

    async onVendorPartVendorChanged(): Promise<void> {
        this.vendorPartRows = []
        this.vendorPartResults = []
        this.vendorPartLookupLoaded = false
        this.vendorPartLookupWorking = false
        this.selectedVendorPartCategories = []
        if (this.isVendorPartSearchReady()) {
            await this.ensureVendorPartLookupLoaded()
            this.applyVendorPartFilters()
        }
    }

    clearVendorPartCategoryFilter() {
        this.selectedVendorPartCategories = []
        this.applyVendorPartFilters()
    }

    getVendorPartCategoryOptions(): string[] {
        const categories = new Set<string>()
        for (const row of this.vendorPartRows) {
            const category = String(row.Category || '').trim()
            if (category) {
                categories.add(category)
            }
        }
        return [...categories].sort((a, b) => a.localeCompare(b))
    }

    isVendorPartSearchReady(): boolean {
        return this.getNormalizedVendorPartFilter().length >= this.vendorPartLookupMinChars
    }

    isLinkedPartSelected(partNumber: string): boolean {
        return this.editLinkedPartNumbers.includes(String(partNumber || '').trim())
    }

    getLinkedPartDisplayRow(partNumber: string): LinkedPartDisplayRow {
        const normalizedPartNumber = String(partNumber || '').trim()
        const linkedMaterial = this.deviceMaterials.find((row) => String(row.materialPartNumber || '').trim() === normalizedPartNumber)
        const vendorPart = this.vendorPartRows.find((row) => String(row.PartNumber || '').trim() === normalizedPartNumber)

        return {
            partNumber: normalizedPartNumber,
            description: String(linkedMaterial?.materialName || vendorPart?.LongDescription || '').trim(),
            category: String(vendorPart?.Category || vendorPart?.ParentCategory || linkedMaterial?.deviceCategoryName || '').trim(),
            cost: linkedMaterial?.materialCost ?? vendorPart?.SalesPrice ?? null,
            msrp: linkedMaterial?.materialMsrp ?? vendorPart?.MSRPPrice ?? null
        }
    }

    getVisibleVendorPartRows(): LinkedPartDisplayRow[] {
        if (this.editMode) {
            return this.editLinkedPartNumbers.map((partNumber) => this.getLinkedPartDisplayRow(partNumber))
        }
        return this.deviceMaterials.map((material) => ({
            partNumber: String(material.materialPartNumber || '').trim(),
            description: String(material.materialName || '').trim(),
            category: this.getVendorPartCategory(material),
            cost: Number.isFinite(Number(material.materialCost)) ? Number(material.materialCost) : null,
            msrp: Number.isFinite(Number(material.materialMsrp)) ? Number(material.materialMsrp) : null
        }))
    }

    getVendorPartCategory(material: VwDeviceMaterial): string {
        const row = material as VwDeviceMaterial & {
            materialCategoryName?: string
            materialCategoryShortName?: string
            categoryName?: string
            categoryShortName?: string
        }
        return String(
            row.materialCategoryName
            || row.materialCategoryShortName
            || row.categoryName
            || row.categoryShortName
            || row.deviceCategoryName
            || row.deviceCategoryShortName
            || ''
        ).trim()
    }

    openVendorPartDetail(material: VwDeviceMaterial) {
        this.releaseFocusedElementBeforeDialog()
        this.dialog.open(VendorPartDetailDialog, {
            width: '520px',
            maxWidth: '92vw',
            panelClass: 'fw-compact-dialog-pane',
            data: {
                material,
                category: this.getVendorPartCategory(material)
            }
        })
    }

    async onDeviceMediaSelected(event: Event): Promise<void> {
        const input = event.target as HTMLInputElement
        const file = input.files && input.files.length > 0 ? input.files[0] : null
        input.value = ''
        if (!file || !this.deviceId) {
            return
        }
        const formData = new FormData()
        formData.append('file', file)
        this.mediaUploadWorking = true
        this.statusText = `Uploading ${file.name}...`
        try {
            const response = await firstValueFrom(this.http.post<{ data?: { files?: DeviceMediaFile[] } }>(`/api/firewire/devices/${this.deviceId}/media`, formData))
            this.deviceMediaFiles = Array.isArray(response?.data?.files) ? response.data.files : []
            this.statusText = `${file.name} uploaded.`
        } catch (err: any) {
            this.statusText = err?.error?.message || err?.message || 'Unable to upload device media.'
        } finally {
            this.mediaUploadWorking = false
        }
    }

    async deleteDeviceMedia(file: DeviceMediaFile): Promise<void> {
        if (!this.deviceId || !file?.id) {
            return
        }
        this.mediaUploadWorking = true
        this.statusText = `Deleting ${file.fileName}...`
        try {
            const response = await firstValueFrom(this.http.delete<{ data?: { files?: DeviceMediaFile[] } }>(`/api/firewire/devices/${this.deviceId}/media/${encodeURIComponent(file.id)}`))
            this.deviceMediaFiles = Array.isArray(response?.data?.files) ? response.data.files : []
            this.statusText = `${file.fileName} deleted.`
        } catch (err: any) {
            this.statusText = err?.error?.message || err?.message || 'Unable to delete device media.'
        } finally {
            this.mediaUploadWorking = false
        }
    }

    getDeviceMediaContentUrl(file: DeviceMediaFile, disposition: 'inline' | 'attachment' = 'inline'): string {
        if (!this.deviceId || !file?.id) {
            return ''
        }
        const query = disposition === 'attachment' ? '?disposition=attachment' : ''
        return `/api/firewire/devices/${encodeURIComponent(this.deviceId)}/media/${encodeURIComponent(file.id)}/content${query}`
    }

    previewDeviceMedia(file: DeviceMediaFile): void {
        const url = this.getDeviceMediaContentUrl(file, 'inline')
        if (!url) {
            return
        }
        window.open(url, '_blank', 'noopener')
    }

    async downloadDeviceMedia(file: DeviceMediaFile): Promise<void> {
        const url = this.getDeviceMediaContentUrl(file, 'attachment')
        if (!url) {
            return
        }
        this.mediaUploadWorking = true
        this.statusText = `Downloading ${file.fileName}...`
        try {
            const blob = await firstValueFrom(this.http.get(url, { responseType: 'blob' }))
            const objectUrl = URL.createObjectURL(blob)
            const anchor = document.createElement('a')
            anchor.href = objectUrl
            anchor.download = file.fileName || 'device-media'
            document.body.appendChild(anchor)
            anchor.click()
            anchor.remove()
            URL.revokeObjectURL(objectUrl)
            this.statusText = `${file.fileName} downloaded.`
        } catch (err: any) {
            this.statusText = err?.error?.message || err?.message || 'Unable to download device media.'
        } finally {
            this.mediaUploadWorking = false
        }
    }

    formatFileSize(sizeBytes: number): string {
        const value = Number(sizeBytes || 0)
        if (!Number.isFinite(value) || value <= 0) {
            return '0 B'
        }
        const units = ['B', 'KB', 'MB', 'GB']
        let current = value
        let unitIndex = 0
        while (current >= 1024 && unitIndex < units.length - 1) {
            current = current / 1024
            unitIndex++
        }
        return `${current.toFixed(unitIndex === 0 ? 0 : 1)} ${units[unitIndex]}`
    }

    getVendorPartSearchHint(): string {
        if (!this.hasVendorPartLookup()) {
            return 'Select a vendor to search parts.'
        }
        if (this.vendorPartLookupWorking) {
            return 'Loading vendor parts...'
        }
        if (!this.isVendorPartSearchReady()) {
            return `Enter at least ${this.vendorPartLookupMinChars} characters to search vendor parts.`
        }
        if (this.vendorPartResults.length <= 0) {
            return 'No vendor parts match the current filter.'
        }
        if (this.vendorPartResults.length >= 100) {
            return 'Showing the first 100 matching parts.'
        }
        return `${this.vendorPartResults.length} matching parts found.`
    }

    isDetailsEditView(): boolean {
        return this.editMode && this.activeEditView === 'details'
    }

    isVendorPartsEditView(): boolean {
        return this.editMode && this.activeEditView === 'vendor-parts'
    }

    sortAttributes(): MaterialAttribute[] {
        return [...this.deviceAttributes].sort((a, b) => a.ordinal - b.ordinal)
    }

    sortSubTasks(): MaterialSubTask[] {
        return [...this.deviceSubTasks].sort((a, b) => a.ordinal - b.ordinal)
    }

    getManagedAttributeRows(): EditableAttribute[] {
        return this.editAttributes.filter((attribute) => attribute.managed)
    }

    getCustomAttributeRows(): EditableAttribute[] {
        return this.editAttributes.filter((attribute) => !attribute.managed)
    }

    getDefaultPartIssue(): DeviceVendorLinkIssue | null {
        return this.vendorLinkIssues.find((issue) => issue.sourceKind === 'device' && issue.partNumber === this.device?.partNumber) || null
    }

    getLinkedPartIssue(partNumber: string): DeviceVendorLinkIssue | null {
        return this.vendorLinkIssues.find((issue) => issue.sourceKind === 'material' && issue.partNumber === partNumber) || null
    }

    displaySetting(setting: string | undefined | null) {
        const value = String(setting || '').trim()
        if (!value) {
            return 'None'
        }
        if (value.toLowerCase() === 'n/a') {
            return 'Yes'
        }
        return value
    }

    getShowDefaultLabor(): boolean {
        return this.getSubTaskLaborTotal(this.editMode ? this.editSubTasks : this.deviceSubTasks) <= 0
    }

    getShowCalculatedLaborCost(): boolean {
        return !this.getShowDefaultLabor()
    }

    getCalculatedLaborCost(): number {
        const source = this.editMode ? this.editSubTasks : this.deviceSubTasks
        const laborRate = this.getDeviceLaborRate()
        return source.reduce((total, row) => {
            const laborHours = Number(row?.laborHours || 0)
            if (!Number.isFinite(laborHours) || laborHours <= 0) {
                return total
            }
            return total + (laborHours * laborRate)
        }, 0)
    }

    getDeviceLaborRate(): number {
        const value = Number(this.editMode ? this.editDevice.laborRate : this.device?.laborRate)
        return Number.isFinite(value) && value > 0 ? value : this.defaultLaborRate
    }

    getReadOnlyDefaultLabor(): number {
        return this.getSubTaskLaborTotal(this.deviceSubTasks) > 0
            ? this.getSubTaskLaborTotal(this.deviceSubTasks)
            : Number(this.device?.defaultLabor || 0)
    }

    getDisplayedDeviceCost(): number {
        return this.editMode
            ? Number(this.editDevice.cost || 0)
            : Number(this.device?.cost || 0)
    }

    getAttributeDisplayValue(attribute: MaterialAttribute): string {
        return String(attribute.defaultValue || '').trim()
    }

    onAddressSettingChanged() {
        this.syncDerivedAttributes()
    }

    private syncDerivedAttributes() {
        const custom = this.editAttributes.filter((attribute) => !attribute.managed)
        const nextManaged: EditableAttribute[] = []

        const slcMode = String(this.editDevice.slcAddress || this.slcNoneValue)
        if (String(this.editDevice.serialNumber || this.speakerFalseValue) === 'true') {
            nextManaged.push(this.createManagedAttribute('Serial Number'))
        }
        if (slcMode === 'one' || slcMode === 'two') {
            nextManaged.push(this.createManagedAttribute('SLC Channel 1'))
        }
        if (slcMode === 'two') {
            nextManaged.push(this.createManagedAttribute('SLC Channel 2'))
        }
        if (slcMode === 'mac') {
            nextManaged.push(this.createManagedAttribute('MAC Address'))
            nextManaged.push(this.createManagedAttribute('SLC Address'))
        }
        if (String(this.editDevice.speakerAddress || this.speakerFalseValue) === 'true') {
            nextManaged.push(this.createManagedAttribute('Speaker Address'))
        }
        if (String(this.editDevice.strobeAddress || this.strobeFalseValue) === 'true') {
            nextManaged.push(this.createManagedAttribute('Strobe Address'))
        }

        this.editAttributes = [
            ...nextManaged.map((attribute, index) => ({ ...attribute, ordinal: index })),
            ...custom.map((attribute, index) => ({ ...attribute, ordinal: nextManaged.length + index }))
        ]
    }

    private createManagedAttribute(name: string): EditableAttribute {
        const existing = this.editAttributes.find((attribute) => attribute.name === name)
        return {
            name,
            statusId: existing?.statusId || name,
            valueType: 'text',
            defaultValue: existing?.defaultValue || '',
            ordinal: existing?.ordinal || 0,
            managed: true
        }
    }

    private isManagedAttribute(name: string): boolean {
        return ['Serial Number', 'SLC Channel 1', 'SLC Channel 2', 'MAC Address', 'SLC Address', 'Speaker Address', 'Strobe Address'].includes(name)
    }

    private readSlcMode(raw: string | undefined | null): string {
        const value = String(raw || '').trim().toLowerCase()
        if (!value || value === 'none') {
            return this.slcNoneValue
        }
        if (value === 'mac address' || value === 'mac') {
            return 'mac'
        }
        if (value === 'two') {
            return 'two'
        }
        return 'one'
    }

    private writeSlcMode(raw: string | undefined | null): string {
        const value = String(raw || this.slcNoneValue)
        if (value === 'mac') {
            return 'MAC Address'
        }
        if (value === 'two') {
            return 'two'
        }
        if (value === 'one') {
            return 'one'
        }
        return ''
    }

    private readBooleanMode(raw: string | undefined | null): string {
        const value = String(raw || '').trim().toLowerCase()
        return value && value !== 'none' ? 'true' : this.speakerFalseValue
    }

    private writeBooleanMode(raw: string | undefined | null): string {
        return String(raw || this.speakerFalseValue) === 'true' ? 'n/a' : ''
    }

    private getResolvedDefaultLabor(): number {
        const subTaskTotal = this.getSubTaskLaborTotal(this.editSubTasks)
        if (subTaskTotal > 0) {
            return this.getCalculatedLaborCost()
        }
        return Number(this.editDevice.defaultLabor || 0)
    }

    private getSubTaskLaborTotal(source: Array<MaterialSubTask | EditableSubTask>): number {
        return source.reduce((total, row) => total + Number(row?.laborHours || 0), 0)
    }

    private syncDeviceCostFromLinkedParts() {
        if (!this.editMode) {
            return
        }
        const total = this.editLinkedPartNumbers.reduce((sum, partNumber) => sum + this.getLinkedPartUnitCost(partNumber), 0)
        this.editDevice.cost = Number(total.toFixed(2))
    }

    private captureInitialEditState() {
        this.initialEditState = this.buildEditStateSnapshot()
    }

    private buildEditStateSnapshot(): string {
        return JSON.stringify({
            device: {
                name: String(this.editDevice.name || '').trim(),
                shortName: String(this.editDevice.shortName || '').trim(),
                partNumber: String(this.editDevice.partNumber || '').trim(),
                categoryName: String(this.editDevice.categoryName || '').trim(),
                includeOnFloorplan: !!this.editDevice.includeOnFloorplan,
                cost: Number(this.editDevice.cost || 0),
                defaultLabor: Number(this.editDevice.defaultLabor || 0),
                laborRate: this.getDeviceLaborRate(),
                serialNumber: String(this.editDevice.serialNumber || '').trim(),
                slcAddress: String(this.editDevice.slcAddress || '').trim(),
                speakerAddress: String(this.editDevice.speakerAddress || '').trim(),
                strobeAddress: String(this.editDevice.strobeAddress || '').trim()
            },
            partNumbers: [...this.editLinkedPartNumbers],
            attributes: this.editAttributes.map((attribute) => ({
                name: String(attribute.name || '').trim(),
                statusId: String(attribute.statusId || '').trim(),
                valueType: String(attribute.valueType || '').trim(),
                defaultValue: String(attribute.defaultValue || ''),
                ordinal: Number(attribute.ordinal || 0),
                managed: !!attribute.managed
            })),
            subTasks: this.editSubTasks.map((subTask) => ({
                statusName: String(subTask.statusName || '').trim(),
                taskNameFormat: String(subTask.taskNameFormat || '').trim(),
                laborHours: Number(subTask.laborHours || 0),
                ordinal: Number(subTask.ordinal || 0)
            }))
        })
    }

    private getLinkedPartUnitCost(partNumber: string): number {
        const normalizedPartNumber = String(partNumber || '').trim()
        const linkedMaterial = this.deviceMaterials.find((row) => String(row.materialPartNumber || '').trim() === normalizedPartNumber)
        if (linkedMaterial && Number.isFinite(Number(linkedMaterial.materialCost))) {
            return Number(linkedMaterial.materialCost || 0)
        }

        const vendorPart = this.vendorPartRows.find((row) => String(row.PartNumber || '').trim() === normalizedPartNumber)
            || this.vendorPartResults.find((row) => String(row.PartNumber || '').trim() === normalizedPartNumber)
        if (vendorPart) {
            return Number(vendorPart.SalesPrice || vendorPart.MSRPPrice || 0)
        }

        return 0
    }

    private releaseFocusedElementBeforeDialog(): void {
        const activeElement = typeof document !== 'undefined' ? document.activeElement : null
        if (activeElement instanceof HTMLElement) {
            activeElement.blur()
        }
    }

    private getNormalizedVendorPartFilter(): string {
        return String(this.vendorPartFilter || '').trim().toLowerCase()
    }

    private hasVendorPartLookup(): boolean {
        return !!String(this.selectedVendorPartVendorId || '').trim()
    }

    private async ensureVendorPartLookupLoaded(): Promise<void> {
        if (this.vendorPartLookupLoaded || this.vendorPartLookupWorking || !this.hasVendorPartLookup()) {
            return
        }

        const vendorId = String(this.selectedVendorPartVendorId || '').trim()
        this.vendorPartLookupWorking = true
        try {
            const response = await firstValueFrom(this.http.get<{ rows?: VwPart[] }>(`/api/firewire/vendors/${encodeURIComponent(vendorId)}/parts`))
            this.vendorPartRows = Array.isArray(response?.rows) ? response.rows : []
            this.vendorPartLookupLoaded = true
        } finally {
            this.vendorPartLookupWorking = false
        }
    }

    private resolveDefaultVendorPartVendorId(device?: VwDevice): string {
        const deviceVendorId = String(device?.vendorId || '').trim()
        if (deviceVendorId && this.vendors.some((vendor) => vendor.vendorId === deviceVendorId)) {
            return deviceVendorId
        }
        return this.vendors[0]?.vendorId || deviceVendorId
    }

    private applyVendorPartFilters() {
        const filterValue = this.getNormalizedVendorPartFilter()
        if (filterValue.length < this.vendorPartLookupMinChars) {
            this.vendorPartResults = []
            return
        }

        const selectedCategories = new Set(this.selectedVendorPartCategories.map((value) => String(value || '').trim()))
        this.vendorPartResults = this.vendorPartRows
            .filter((row) => {
                const partNumber = String(row.PartNumber || '')
                const description = String(row.LongDescription || '')
                const parentCategory = String(row.ParentCategory || '')
                const category = String(row.Category || '')
                const matchesText =
                    partNumber.toLowerCase().includes(filterValue)
                    || description.toLowerCase().includes(filterValue)
                    || parentCategory.toLowerCase().includes(filterValue)
                    || category.toLowerCase().includes(filterValue)
                if (!matchesText) {
                    return false
                }
                if (selectedCategories.size <= 0) {
                    return true
                }
                return selectedCategories.has(category)
            })
            .slice(0, 100)
    }
}

interface ConfirmDeviceDeleteDialogData {
    name: string
}

interface VendorPartDetailDialogData {
    material: VwDeviceMaterial
    category: string
}

interface DeviceVendorPartsDialogData {
    vendors: Vendor[]
    initialPartNumbers: string[]
    defaultVendorId: string
    deviceMaterials: VwDeviceMaterial[]
}

interface DeviceVendorPartsDialogResult {
    partNumbers: string[]
    parts: VwPart[]
}

@Component({
    standalone: true,
    selector: 'fw-device-vendor-parts-dialog',
    imports: [
        CommonModule,
        FormsModule,
        MatDialogTitle,
        MatDialogContent,
        MatDialogActions,
        MatButtonModule,
        MatFormFieldModule,
        MatIconModule,
        MatInputModule,
        MatSelectModule
    ],
    providers: [HttpClient],
    styles: [`
        :host {
            display: block;
            width: 100%;
            max-width: calc(100vw - 48px);
        }

        .vendor-parts-dialog__titlebar {
            display: flex;
            align-items: center;
            justify-content: space-between;
            gap: 12px;
        }

        .vendor-parts-dialog__content {
            display: grid;
            gap: 12px;
            width: 100%;
            max-width: 100%;
            max-height: min(72vh, 760px);
            overflow: auto;
        }

        .vendor-parts-dialog__toolbar {
            display: grid;
            grid-template-columns: minmax(240px, 0.85fr) minmax(320px, 1.35fr) auto minmax(180px, 0.75fr);
            gap: 10px;
            align-items: center;
            position: sticky;
            top: 0;
            z-index: 2;
            padding-top: 2px;
            background: rgba(7, 13, 23, 0.98);
        }

        .vendor-parts-dialog__table {
            display: grid;
            width: 100%;
            max-width: 100%;
            border: 1px solid rgba(72, 221, 255, 0.16);
            background: rgba(7, 15, 27, 0.72);
        }

        .vendor-parts-dialog__row,
        .vendor-parts-dialog__header {
            display: grid;
            grid-template-columns: minmax(120px, 0.8fr) minmax(0, 1.45fr) minmax(110px, 0.75fr) minmax(100px, 0.6fr) minmax(100px, 0.6fr) 40px;
            gap: 12px;
            align-items: center;
            padding: 10px 12px;
            border-bottom: 1px solid rgba(72, 221, 255, 0.1);
        }

        .vendor-parts-dialog__header {
            color: var(--fw-accent-2);
            font-size: 0.74rem;
            letter-spacing: 0.08em;
            text-transform: uppercase;
            background: rgba(72, 221, 255, 0.06);
        }

        .vendor-parts-dialog__header span:nth-child(4),
        .vendor-parts-dialog__header span:nth-child(5) {
            text-align: right;
        }

        .vendor-parts-dialog__row:last-child {
            border-bottom: 0;
        }

        .vendor-parts-dialog__part {
            color: var(--fw-text);
            font-weight: 700;
            letter-spacing: 0.04em;
        }

        .vendor-parts-dialog__description {
            min-width: 0;
            overflow-wrap: anywhere;
        }

        .vendor-parts-dialog__money {
            text-align: right;
        }

        .vendor-parts-dialog__hint,
        .vendor-parts-dialog__empty {
            color: var(--fw-muted);
            font-size: 0.82rem;
        }

        @media (max-width: 900px) {
            .vendor-parts-dialog__toolbar,
            .vendor-parts-dialog__row,
            .vendor-parts-dialog__header {
                grid-template-columns: 1fr;
            }

            .vendor-parts-dialog__money {
                text-align: left;
            }
        }
    `],
    template: `
        <div mat-dialog-title class="vendor-parts-dialog__titlebar">
            <span>Edit Vendor Parts</span>
            <button mat-icon-button type="button" aria-label="Cancel vendor part edits" (click)="discard()">
                <mat-icon>close</mat-icon>
            </button>
        </div>
        <mat-dialog-content class="vendor-parts-dialog__content">
            <div *ngIf="linkedPartNumbers.length > 0; else noLinkedParts" class="vendor-parts-dialog__table">
                <div class="vendor-parts-dialog__header">
                    <span>Part Number</span>
                    <span>Description</span>
                    <span>Category</span>
                    <span>Cost</span>
                    <span>MSRP</span>
                    <span></span>
                </div>
                <div *ngFor="let partNumber of linkedPartNumbers; let index = index" class="vendor-parts-dialog__row">
                    <span class="vendor-parts-dialog__part">{{getLinkedPartDisplayRow(partNumber).partNumber}}</span>
                    <span class="vendor-parts-dialog__description">{{getLinkedPartDisplayRow(partNumber).description || 'None'}}</span>
                    <span>{{getLinkedPartDisplayRow(partNumber).category || 'None'}}</span>
                    <span class="vendor-parts-dialog__money">{{getLinkedPartDisplayRow(partNumber).cost !== null ? (getLinkedPartDisplayRow(partNumber).cost | currency) : 'None'}}</span>
                    <span class="vendor-parts-dialog__money">{{getLinkedPartDisplayRow(partNumber).msrp !== null ? (getLinkedPartDisplayRow(partNumber).msrp | currency) : 'None'}}</span>
                    <button mat-icon-button type="button" aria-label="Remove linked part" (click)="removeLinkedPart(index)">
                        <mat-icon>delete</mat-icon>
                    </button>
                </div>
            </div>
            <ng-template #noLinkedParts>
                <div class="vendor-parts-dialog__empty">No vendor parts linked yet.</div>
            </ng-template>

            <div class="vendor-parts-dialog__toolbar">
                <mat-form-field>
                    <mat-label>Vendor</mat-label>
                    <mat-select [(ngModel)]="selectedVendorId" (selectionChange)="onVendorChanged()">
                        <mat-option *ngFor="let vendor of vendors" [value]="vendor.vendorId">{{vendor.name}}</mat-option>
                    </mat-select>
                </mat-form-field>
                <mat-form-field>
                    <mat-label>Find Vendor Part</mat-label>
                    <input matInput [(ngModel)]="filter" (ngModelChange)="onFilterChanged()" placeholder="Type part number, description, or category" />
                </mat-form-field>
                <button *ngIf="selectedCategories.length > 0" mat-icon-button type="button" aria-label="Clear category filter" (click)="clearCategoryFilter()">
                    <mat-icon>filter_alt_off</mat-icon>
                </button>
                <mat-form-field>
                    <mat-label>Category</mat-label>
                    <mat-select [(ngModel)]="selectedCategories" multiple (openedChange)="onCategoryOpened($event)" (selectionChange)="onCategoryChanged()">
                        <mat-option *ngFor="let option of getCategoryOptions()" [value]="option">{{option}}</mat-option>
                    </mat-select>
                </mat-form-field>
            </div>
            <div class="vendor-parts-dialog__hint">{{getSearchHint()}}</div>

            <div *ngIf="results.length > 0" class="vendor-parts-dialog__table">
                <div class="vendor-parts-dialog__header">
                    <span>Part Number</span>
                    <span>Description</span>
                    <span>Category</span>
                    <span>Cost</span>
                    <span>MSRP</span>
                    <span></span>
                </div>
                <div *ngFor="let row of results" class="vendor-parts-dialog__row">
                    <span class="vendor-parts-dialog__part">{{row.PartNumber}}</span>
                    <span class="vendor-parts-dialog__description">{{row.LongDescription}}</span>
                    <span>{{row.Category || row.ParentCategory || 'None'}}</span>
                    <span class="vendor-parts-dialog__money">{{(row.SalesPrice || 0) | currency}}</span>
                    <span class="vendor-parts-dialog__money">{{(row.MSRPPrice || 0) | currency}}</span>
                    <button mat-stroked-button type="button" [disabled]="isLinkedPartSelected(row.PartNumber)" (click)="addLinkedPart(row.PartNumber)">
                        {{isLinkedPartSelected(row.PartNumber) ? 'Selected' : 'Select'}}
                    </button>
                </div>
            </div>
        </mat-dialog-content>
        <mat-dialog-actions align="end">
            <button mat-button type="button" (click)="discard()">Cancel</button>
            <button mat-flat-button type="button" (click)="save()">Save Vendor Parts</button>
        </mat-dialog-actions>
    `
})
export class DeviceVendorPartsDialog {
    private readonly minChars = 3
    readonly data = inject<DeviceVendorPartsDialogData>(MAT_DIALOG_DATA)
    private dialogRef = inject(MatDialogRef<DeviceVendorPartsDialog>)
    private http = inject(HttpClient)

    vendors = [...(this.data.vendors || [])]
    linkedPartNumbers = [...(this.data.initialPartNumbers || [])]
    selectedVendorId = this.data.defaultVendorId || this.vendors[0]?.vendorId || ''
    selectedCategories: string[] = []
    rows: VwPart[] = []
    results: VwPart[] = []
    filter = ''
    loaded = false
    working = false

    async onFilterChanged(): Promise<void> {
        if (this.normalizedFilter().length < this.minChars) {
            this.results = []
            return
        }
        await this.ensureLoaded()
        this.applyFilters()
    }

    async onCategoryOpened(opened: boolean): Promise<void> {
        if (opened && !this.loaded) {
            await this.ensureLoaded()
        }
    }

    async onCategoryChanged(): Promise<void> {
        if (!this.loaded && this.normalizedFilter().length >= this.minChars) {
            await this.ensureLoaded()
        }
        this.applyFilters()
    }

    async onVendorChanged(): Promise<void> {
        this.rows = []
        this.results = []
        this.loaded = false
        this.working = false
        this.selectedCategories = []
        if (this.normalizedFilter().length >= this.minChars) {
            await this.ensureLoaded()
            this.applyFilters()
        }
    }

    clearCategoryFilter(): void {
        this.selectedCategories = []
        this.applyFilters()
    }

    addLinkedPart(partNumber: string): void {
        const normalized = String(partNumber || '').trim()
        if (normalized && !this.linkedPartNumbers.includes(normalized)) {
            this.linkedPartNumbers = [...this.linkedPartNumbers, normalized]
        }
        this.applyFilters()
    }

    removeLinkedPart(index: number): void {
        this.linkedPartNumbers = this.linkedPartNumbers.filter((_, rowIndex) => rowIndex !== index)
        this.applyFilters()
    }

    isLinkedPartSelected(partNumber: string): boolean {
        return this.linkedPartNumbers.includes(String(partNumber || '').trim())
    }

    getCategoryOptions(): string[] {
        const categories = new Set<string>()
        for (const row of this.rows) {
            const category = String(row.Category || '').trim()
            if (category) {
                categories.add(category)
            }
        }
        return [...categories].sort((a, b) => a.localeCompare(b))
    }

    getSearchHint(): string {
        if (!this.selectedVendorId) {
            return 'Select a vendor to search parts.'
        }
        if (this.working) {
            return 'Loading vendor parts...'
        }
        if (this.normalizedFilter().length < this.minChars) {
            return `Enter at least ${this.minChars} characters to search vendor parts.`
        }
        if (this.results.length <= 0) {
            return 'No vendor parts match the current filter.'
        }
        if (this.results.length >= 100) {
            return 'Showing the first 100 matching parts.'
        }
        return `${this.results.length} matching parts found.`
    }

    getLinkedPartDisplayRow(partNumber: string): LinkedPartDisplayRow {
        const normalized = String(partNumber || '').trim()
        const linkedMaterial = this.data.deviceMaterials.find((row) => String(row.materialPartNumber || '').trim() === normalized)
        const vendorPart = this.rows.find((row) => String(row.PartNumber || '').trim() === normalized)
            || this.results.find((row) => String(row.PartNumber || '').trim() === normalized)
        return {
            partNumber: normalized,
            description: String(linkedMaterial?.materialName || vendorPart?.LongDescription || '').trim(),
            category: String(vendorPart?.Category || vendorPart?.ParentCategory || linkedMaterial?.deviceCategoryName || '').trim(),
            cost: linkedMaterial?.materialCost ?? vendorPart?.SalesPrice ?? null,
            msrp: linkedMaterial?.materialMsrp ?? vendorPart?.MSRPPrice ?? null
        }
    }

    save(): void {
        const selected = new Map<string, VwPart>()
        for (const row of [...this.rows, ...this.results]) {
            const partNumber = String(row.PartNumber || '').trim()
            if (partNumber && this.linkedPartNumbers.includes(partNumber)) {
                selected.set(partNumber, row)
            }
        }
        const result: DeviceVendorPartsDialogResult = {
            partNumbers: [...this.linkedPartNumbers],
            parts: [...selected.values()]
        }
        this.dialogRef.close(result)
    }

    discard(): void {
        this.dialogRef.close(null)
    }

    private async ensureLoaded(): Promise<void> {
        if (this.loaded || this.working || !this.selectedVendorId) {
            return
        }
        this.working = true
        try {
            const response = await firstValueFrom(this.http.get<{ rows?: VwPart[] }>(`/api/firewire/vendors/${encodeURIComponent(this.selectedVendorId)}/parts`))
            this.rows = Array.isArray(response?.rows) ? response.rows : []
            this.loaded = true
        } finally {
            this.working = false
        }
    }

    private applyFilters(): void {
        const filterValue = this.normalizedFilter()
        if (filterValue.length < this.minChars) {
            this.results = []
            return
        }
        const selectedCategories = new Set(this.selectedCategories.map((value) => String(value || '').trim()))
        this.results = this.rows
            .filter((row) => {
                const partNumber = String(row.PartNumber || '')
                const description = String(row.LongDescription || '')
                const parentCategory = String(row.ParentCategory || '')
                const category = String(row.Category || '')
                const matchesText =
                    partNumber.toLowerCase().includes(filterValue)
                    || description.toLowerCase().includes(filterValue)
                    || parentCategory.toLowerCase().includes(filterValue)
                    || category.toLowerCase().includes(filterValue)
                if (!matchesText) {
                    return false
                }
                return selectedCategories.size <= 0 || selectedCategories.has(category)
            })
            .slice(0, 100)
    }

    private normalizedFilter(): string {
        return String(this.filter || '').trim().toLowerCase()
    }
}

@Component({
    standalone: true,
    selector: 'fw-vendor-part-detail-dialog',
    imports: [
        CommonModule,
        MatDialogTitle,
        MatDialogContent,
        MatDialogActions,
        MatDialogClose,
        MatButtonModule,
        MatIconModule
    ],
    styles: [`
        :host {
            display: block;
            max-width: 520px;
        }

        .vendor-part-dialog__titlebar {
            display: flex;
            align-items: center;
            justify-content: space-between;
            gap: 12px;
        }

        .vendor-part-dialog__content {
            display: grid;
            gap: 14px;
        }

        .vendor-part-dialog__part {
            color: var(--fw-accent-2);
            font-weight: 700;
            letter-spacing: 0.04em;
        }

        .vendor-part-dialog__description {
            line-height: 1.45;
        }

        .vendor-part-dialog__grid {
            display: grid;
            grid-template-columns: minmax(120px, auto) minmax(0, 1fr);
            gap: 8px 18px;
        }

        .vendor-part-dialog__label {
            color: var(--fw-muted);
        }

        .vendor-part-dialog__value {
            min-width: 0;
            overflow-wrap: anywhere;
        }
    `],
    template: `
        <div mat-dialog-title class="vendor-part-dialog__titlebar">
            <span>Vendor Part Detail</span>
            <button mat-icon-button type="button" aria-label="Close dialog" mat-dialog-close>
                <mat-icon>close</mat-icon>
            </button>
        </div>
        <mat-dialog-content class="vendor-part-dialog__content">
            <div>
                <div class="vendor-part-dialog__part">{{data.material.materialPartNumber}}</div>
                <div class="vendor-part-dialog__description">{{data.material.materialName}}</div>
            </div>
            <div class="vendor-part-dialog__grid">
                <div class="vendor-part-dialog__label">Short Name</div>
                <div class="vendor-part-dialog__value">{{data.material.materialShortName || 'None'}}</div>
                <div class="vendor-part-dialog__label">Category</div>
                <div class="vendor-part-dialog__value">{{data.category || 'None'}}</div>
                <div class="vendor-part-dialog__label">Cost</div>
                <div class="vendor-part-dialog__value">{{data.material.materialCost | currency}}</div>
                <div class="vendor-part-dialog__label">Default Labor</div>
                <div class="vendor-part-dialog__value">{{data.material.materialDefaultLabor || 0}}</div>
                <div class="vendor-part-dialog__label">Material ID</div>
                <div class="vendor-part-dialog__value">{{data.material.materialId}}</div>
                <div class="vendor-part-dialog__label">Linked Device</div>
                <div class="vendor-part-dialog__value">{{data.material.deviceName}}</div>
            </div>
        </mat-dialog-content>
        <mat-dialog-actions align="end">
            <button mat-flat-button type="button" mat-dialog-close>Close</button>
        </mat-dialog-actions>
    `
})
export class VendorPartDetailDialog {
    readonly data = inject<VendorPartDetailDialogData>(MAT_DIALOG_DATA)
}

@Component({
    standalone: true,
    imports: [
        CommonModule,
        MatDialogTitle,
        MatDialogContent,
        MatDialogActions,
        MatDialogClose,
        MatButtonModule,
        MatIconModule
    ],
    styles: [`
        :host {
            display: block;
            max-width: 360px;
        }

        .device-delete-dialog__content {
            max-width: 34ch;
            line-height: 1.5;
        }
    `],
    template: `
        <div mat-dialog-title style="display:flex;align-items:center;justify-content:space-between;gap:12px;">
            <span>Delete Device?</span>
            <button mat-icon-button type="button" aria-label="Close dialog" mat-dialog-close>
                <mat-icon>close</mat-icon>
            </button>
        </div>
        <mat-dialog-content class="device-delete-dialog__content">
            Delete <strong>{{data.name}}</strong>? This cannot be undone.
        </mat-dialog-content>
        <mat-dialog-actions align="end">
            <button mat-button type="button" mat-dialog-close>Cancel</button>
            <button mat-flat-button color="warn" type="button" [mat-dialog-close]="true">Delete</button>
        </mat-dialog-actions>
    `
})
export class ConfirmDeviceDeleteDialog {
    readonly data = inject<ConfirmDeviceDeleteDialogData>(MAT_DIALOG_DATA)
}
