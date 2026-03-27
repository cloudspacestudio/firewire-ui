import { Component, EventEmitter, Input, OnChanges, Output, inject } from "@angular/core"
import { CommonModule } from "@angular/common"
import { FormsModule } from "@angular/forms"
import { firstValueFrom, from, map, Observable, of, switchMap } from "rxjs"

import { HttpClient } from "@angular/common/http"

import { MatButtonModule } from "@angular/material/button"
import { MAT_DIALOG_DATA, MatDialog, MatDialogActions, MatDialogClose, MatDialogContent, MatDialogTitle } from "@angular/material/dialog"
import { MatFormFieldModule } from "@angular/material/form-field"
import { MatIconModule } from "@angular/material/icon"
import { MatInputModule } from "@angular/material/input"
import { MatListModule } from "@angular/material/list"
import { MatSelectModule } from "@angular/material/select"

import { VwDevice } from "../../schemas/vwdevice.schema"
import { VwDeviceMaterial } from "../../schemas/vwdevicematerial.schema"
import { MaterialAttribute } from "../../schemas/materialattribute.schema"
import { MaterialSubTask } from "../../schemas/materialsubtask.schema"
import { VwEddyPricelist } from "../../schemas/vwEddyPricelist"
import { Category } from "../../schemas/category.schema"
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
}

@Component({
    standalone: true,
    selector: 'device-detail',
    imports: [CommonModule, FormsModule, MatButtonModule, MatFormFieldModule, MatSelectModule, MatIconModule, MatInputModule, MatListModule],
    providers: [HttpClient],
    templateUrl: './devicedetail.component.html',
    styleUrls: ['./devicedetail.component.scss']
})
export class DeviceDetailComponent implements OnChanges {
    private readonly slcNoneValue = 'none'
    private readonly speakerFalseValue = 'false'
    private readonly strobeFalseValue = 'false'
    private readonly vendorPartLookupMinChars = 3

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
    categories: Category[] = []
    partlist: VwEddyPricelist[] = []
    vendorPartRows: VwEddyPricelist[] = []
    vendorPartResults: VwEddyPricelist[] = []
    partImagePath = ''
    partImageFailed = false

    pageWorking = true
    editMode = false
    activeEditView: DeviceEditView = 'details'
    saveWorking = false
    vendorPartLookupWorking = false
    vendorPartLookupLoaded = false
    statusText = ''

    editDevice: Partial<VwDevice> = {}
    editLinkedPartNumbers: string[] = []
    editAttributes: EditableAttribute[] = []
    editSubTasks: EditableSubTask[] = []
    vendorPartFilter = ''
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
        this.selectedVendorPartCategories = []

        try {
            const [device, materials, attributes, subTasks, categories, issuesResponse] = await Promise.all([
                firstValueFrom(this.http.get<VwDevice>(`/api/firewire/devices/${this.deviceId}`)),
                firstValueFrom(this.http.get<{ rows?: VwDeviceMaterial[] }>(`/api/firewire/vwdevicematerials/${this.deviceId}`)),
                firstValueFrom(this.http.get<{ rows?: MaterialAttribute[] }>(`/api/firewire/devices/${this.deviceId}/attributes`)),
                firstValueFrom(this.http.get<{ rows?: MaterialSubTask[] }>(`/api/firewire/devices/${this.deviceId}/subtasks`)),
                firstValueFrom(this.http.get<{ rows?: Category[] }>(`/api/firewire/categories`)),
                firstValueFrom(this.http.get<{ rows?: DeviceVendorLinkIssue[] }>('/api/firewire/devices/vendor-link-issues', { params: { state: 'all' } }))
            ])

            this.device = device
            this.deviceLoaded.emit(device)
            this.deviceMaterials = Array.isArray(materials?.rows) ? materials.rows : []
            this.deviceAttributes = Array.isArray(attributes?.rows) ? attributes.rows : []
            this.deviceSubTasks = Array.isArray(subTasks?.rows) ? subTasks.rows : []
            this.categories = Array.isArray(categories?.rows) ? categories.rows : []
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
        this.startEditView('vendor-parts')
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
                slcAddress: this.readSlcMode(this.device.slcAddress),
                speakerAddress: this.readBooleanMode(this.device.speakerAddress),
                strobeAddress: this.readBooleanMode(this.device.strobeAddress)
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

    cancelEdit() {
        this.editMode = false
        this.activeEditView = 'details'
        this.statusText = ''
        this.vendorPartFilter = ''
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
                slcAddress: this.writeSlcMode(this.editDevice.slcAddress),
                speakerAddress: this.writeBooleanMode(this.editDevice.speakerAddress),
                strobeAddress: this.writeBooleanMode(this.editDevice.strobeAddress),
                defaultLabor: resolvedDefaultLabor
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
            const response = await firstValueFrom(this.http.get<{ rows?: VwEddyPricelist[] }>(`/api/firewire/vweddypricelist/${partNumber}`))
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
            cost: linkedMaterial?.materialCost ?? vendorPart?.SalesPrice ?? vendorPart?.MSRPPrice ?? null
        }
    }

    getVendorPartSearchHint(): string {
        if (!this.hasVendorPartLookup()) {
            return 'Vendor part search is not configured for this vendor yet.'
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
        return ['SLC Channel 1', 'SLC Channel 2', 'MAC Address', 'SLC Address', 'Speaker Address', 'Strobe Address'].includes(name)
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
            return subTaskTotal
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
                categoryId: String(this.editDevice.categoryId || '').trim(),
                cost: Number(this.editDevice.cost || 0),
                defaultLabor: Number(this.editDevice.defaultLabor || 0),
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

    private getNormalizedVendorPartFilter(): string {
        return String(this.vendorPartFilter || '').trim().toLowerCase()
    }

    private hasVendorPartLookup(): boolean {
        const vendorName = String(this.device?.vendorName || '').trim().toLowerCase()
        return vendorName === 'edwards' || vendorName === 'edwards fire safety'
    }

    private async ensureVendorPartLookupLoaded(): Promise<void> {
        if (this.vendorPartLookupLoaded || this.vendorPartLookupWorking || !this.hasVendorPartLookup()) {
            return
        }

        this.vendorPartLookupWorking = true
        try {
            const response = await firstValueFrom(this.http.get<{ rows?: VwEddyPricelist[] }>('/api/firewire/vweddypricelist'))
            this.vendorPartRows = Array.isArray(response?.rows) ? response.rows : []
            this.vendorPartLookupLoaded = true
        } finally {
            this.vendorPartLookupWorking = false
        }
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
