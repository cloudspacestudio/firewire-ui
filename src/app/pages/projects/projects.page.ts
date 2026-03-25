import { Component, OnInit, AfterViewInit, OnDestroy, ViewChild, ViewChildren, QueryList, ElementRef } from "@angular/core"
import { NgIf, NgFor } from "@angular/common"
import { FormsModule } from "@angular/forms"

import { HttpClient } from "@angular/common/http"
import { CommonModule } from "@angular/common"
import { RouterLink } from "@angular/router"
import { Subscription } from "rxjs"

import { Utils } from "../../common/utils"
import { PageToolbar } from '../../common/components/page-toolbar';
import { NavToolbar } from "../../common/components/nav-toolbar"
import { FIREWIRE_PROJECT_TYPE_OPTIONS, FirewireProjectUpsert } from "../../schemas/firewire-project.schema"
import { ProjectSettingsCatalogSchema } from "../../schemas/project-settings.schema"
import { ProjectListItemSchema } from "../../schemas/project-list-item.schema"
import { ProjectSettingsApi } from "./project-settings.api"
import { AzureMapsService } from "../../common/services/azure-maps.service"
import { UserPreferencesService } from "../../common/services/user-preferences.service"
import { ProjectMapPreferences } from "../../schemas/user-preferences.schema"

import { MatButtonModule } from "@angular/material/button"
import { MatButtonToggleModule } from "@angular/material/button-toggle"
import { MatIconModule } from "@angular/material/icon"
import {MatPaginator, MatPaginatorModule} from '@angular/material/paginator';
import {MatSort, MatSortModule, Sort, SortDirection} from '@angular/material/sort';
import {MatTableDataSource, MatTableModule} from '@angular/material/table';
import {MatInputModule} from '@angular/material/input';
import {MatFormFieldModule} from '@angular/material/form-field';
import { MatSelectModule } from "@angular/material/select";

declare const atlas: any

@Component({
    standalone: true,
    selector: 'projects-page',
    imports: [CommonModule, FormsModule, RouterLink,
        MatButtonModule, MatButtonToggleModule, MatIconModule, 
        MatPaginatorModule, MatSortModule,
        MatTableModule, MatInputModule,
        MatFormFieldModule, MatSelectModule,
        PageToolbar, NavToolbar],
    providers: [HttpClient],
    templateUrl: './projects.page.html',
    styleUrls: ['./projects.page.scss']
})
export class ProjectsPage implements OnInit, AfterViewInit, OnDestroy {
    private readonly baseMapViewportPadding = { top: 80, right: 340, bottom: 80, left: 80 }
    private resizeObserver?: ResizeObserver
    private pendingMapCameraRetryHandle?: ReturnType<typeof setTimeout>
    private mapCameraRequestVersion = 0
    displayedColumns: string[] = ['projectTypeIcon', 'name', 'projectNbr', 'projectStatus', 'address', 'bidDueDate', 'actions'];
    readonly projectTypeOptions = FIREWIRE_PROJECT_TYPE_OPTIONS
    textFilter = ''
    selectedProjectStatuses: string[] = []
    projectsViewMode: 'Grid' | 'Map' = 'Grid'
    visibleMapProjects: ProjectListItemSchema[] = []
    selectedMapProjectId: string | null = null
    mapReady = false
    mapLoadError = ''
    private readonly projectsViewModeStorageKey = 'firewire.projectsViewMode'
    private readonly projectsStatusFilterStorageKey = 'firewire.projects.statusFilter'
    private readonly projectsSortStorageKey = 'firewire.projects.sort'
    currentSortActive = 'name'
    currentSortDirection: SortDirection = 'asc'
    private atlasMap: any
    private atlasPopup: any
    private atlasMarkers = new Map<string, { marker: any, element: HTMLButtonElement }>()
    private lastAppliedMapStyleSignature = ''
    private preferencesSubscription?: Subscription
    projectMapPreferences: ProjectMapPreferences = {
        version: 1,
        style: 'night',
        dimension: '2d',
        showRoadDetails: true,
        showBuildingFootprints: true,
        autoFitPins: true
    }

    private paginator?: MatPaginator;
    private sort?: MatSort;

    @ViewChild('projectsMapHost')
    set projectsMapHostRef(value: ElementRef<HTMLDivElement> | undefined) {
        if (!value && this.atlasMap) {
            this.resetMapInstance()
        }
        this.projectsMapHost = value
        this.observeMapHost()
    }
    projectsMapHost?: ElementRef<HTMLDivElement>

    @ViewChildren('mapProjectCard')
    mapProjectCards?: QueryList<ElementRef<HTMLButtonElement>>

    @ViewChild(MatPaginator)
    set paginatorRef(value: MatPaginator | undefined) {
        this.paginator = value;
        this.datasource.paginator = value || null;
    }

    @ViewChild(MatSort)
    set sortRef(value: MatSort | undefined) {
        this.sort = value;
        this.datasource.sort = value || null;
        this.applyStoredSortState()
    }

    pageWorking = true
    saveWorking = false
    createPanelOpen = false
    projects: ProjectListItemSchema[] = []
    navItems = NavToolbar.ProjectNavItems
    errText?: string
    createStatusText = ''
    projectSettings: ProjectSettingsCatalogSchema = {
        jobType: [],
        scopeType: [],
        projectScope: [],
        difficulty: [],
        projectStatus: []
    }

    datasource: MatTableDataSource<ProjectListItemSchema> = new MatTableDataSource(this.projects);
    createModel: FirewireProjectUpsert = this.createDefaultProject()

    constructor(
        private http: HttpClient,
        private projectSettingsApi: ProjectSettingsApi,
        private readonly azureMapsService: AzureMapsService,
        private readonly userPreferences: UserPreferencesService
    ) {}

    ngOnInit(): void {
        this.projectsViewMode = this.readStoredProjectsViewMode()
        this.selectedProjectStatuses = this.readStoredProjectStatusFilter()
        const storedSort = this.readStoredProjectsSort()
        this.currentSortActive = storedSort.active
        this.currentSortDirection = storedSort.direction
        this.configureFilterPredicate()
        this.preferencesSubscription = this.userPreferences.preferences$.subscribe((preferences) => {
            this.projectMapPreferences = { ...preferences.projectMap }
            this.applyProjectMapPreferencesToMap('preserve')
        })
        void this.userPreferences.load()
        this.loadProjectSettings()
        this.loadProjects()
    }

    ngAfterViewInit(): void {
        this.datasource.paginator = this.paginator||null;
        this.datasource.sort = this.sort||null;
        this.applyStoredSortState()
        if (this.projectsViewMode === 'Map') {
            this.queueMapRender()
        }
    }

    ngOnDestroy(): void {
        this.resizeObserver?.disconnect()
        if (this.pendingMapCameraRetryHandle) {
            clearTimeout(this.pendingMapCameraRetryHandle)
        }
        this.preferencesSubscription?.unsubscribe()
        this.resetMapInstance()
    }

    loadProjects() {
        this.projects = []
        this.pageWorking = true
        this.errText = undefined

        this.http.get('/api/firewire/projects').subscribe({
            next: (s: any) => {
                if (s && s.rows) {
                    this.projects = [...s.rows].filter((row: ProjectListItemSchema) => !!row.firewireProjectId)
                    this.datasource = new MatTableDataSource(this.projects)
                    this.configureFilterPredicate()
                    this.datasource.paginator = this.paginator || null
                    this.datasource.sort = this.sort || null
                    this.applyStoredSortState()
                    this.applyCombinedFilter()
                    this.pageWorking = false
                    return
                } else {
                    this.projects = []
                    this.pageWorking = false
                }
            },
            error: (err: Error) => {
                this.errText = err.message
                console.dir(err)
                this.pageWorking = false
            }
        })
    }

    applyFilter(event: Event) {
        this.textFilter = (event.target as HTMLInputElement).value || ''
        this.applyCombinedFilter()
    }

    onProjectStatusFilterChange() {
        this.storeProjectStatusFilter()
        this.applyCombinedFilter()
    }

    clearProjectStatusFilter() {
        this.selectedProjectStatuses = []
        this.storeProjectStatusFilter()
        this.applyCombinedFilter()
    }

    onSortChange(sort: Sort) {
        this.currentSortActive = sort.active || 'name'
        this.currentSortDirection = sort.direction || 'asc'
        this.storeProjectsSort()
    }

    onProjectsViewModeChange(value: 'Grid' | 'Map') {
        const nextValue = value === 'Map' ? 'Map' : 'Grid'
        if (this.projectsViewMode === nextValue) {
            return
        }

        this.projectsViewMode = nextValue
        this.storeProjectsViewMode(nextValue)
        if (nextValue !== 'Map') {
            this.resetMapInstance()
        }
        this.refreshVisibleMapProjects()
        if (nextValue === 'Map') {
            this.queueMapRender()
        }
    }

    getNoDataRowText(filterValue: string) {
        if (this.pageWorking) {
            return "Loading, please wait..."
        }
        if (this.errText) {
            return this.errText
        }
        if (!filterValue) {
            return "No Data Found"
        }
        return `No data matching the filter "${filterValue}"`
    }

    toLocalDateTimeString(input: Date|string) {
        return Utils.toLocalString(input)
    }

    toLocalDateString(input: Date|string) {
        const parsed = new Date(input)
        if (Number.isNaN(parsed.getTime())) {
            return ''
        }
        return new Intl.DateTimeFormat(undefined, {
            dateStyle: 'short'
        }).format(parsed)
    }

    toggleCreatePanel() {
        this.createPanelOpen = !this.createPanelOpen
        this.createStatusText = ''
        if (!this.createPanelOpen) {
            this.createModel = this.createDefaultProject()
        }
    }

    createProject() {
        this.saveWorking = true
        this.createStatusText = 'Saving project...'

        this.http.post('/api/firewire/projects', this.createModel).subscribe({
            next: () => {
                this.saveWorking = false
                this.createStatusText = 'Project saved.'
                this.createPanelOpen = false
                this.createModel = this.createDefaultProject()
                this.loadProjects()
            },
            error: (err: any) => {
                this.saveWorking = false
                this.createStatusText = err?.error?.message || err?.message || 'Unable to save project.'
            }
        })
    }

    getActiveSettings(listKey: keyof ProjectSettingsCatalogSchema) {
        return (this.projectSettings[listKey] || []).filter((item) => item.isActive)
    }

    getProjectStatusFilterOptions(): string[] {
        return this.getActiveSettings('projectStatus').map((item) => item.label)
    }

    hasProjectGeo(row: ProjectListItemSchema): boolean {
        return this.getProjectCoordinates(row) !== null
    }

    getMapProjectCards(): ProjectListItemSchema[] {
        return this.visibleMapProjects
    }

    getMapExclusionNote(): string {
        const excluded = this.datasource.filteredData.filter((row) => !this.hasProjectGeo(row))
        if (excluded.length <= 0) {
            return ''
        }

        const notFoundCount = excluded.filter((row) => row.geocodeStatus === 'Not Found').length
        const notConfiguredCount = excluded.filter((row) => row.geocodeStatus === 'Not Configured').length
        const missingAddressCount = excluded.filter((row) => row.geocodeStatus === 'Missing Address').length

        const parts: string[] = []
        if (notFoundCount > 0) {
            parts.push(`${notFoundCount} address${notFoundCount === 1 ? ' was' : 'es were'} not found`)
        }
        if (notConfiguredCount > 0) {
            parts.push(`${notConfiguredCount} project${notConfiguredCount === 1 ? ' is' : 's are'} not configured`)
        }
        if (missingAddressCount > 0) {
            parts.push(`${missingAddressCount} project${missingAddressCount === 1 ? ' is' : 's are'} missing an address`)
        }

        if (parts.length <= 0) {
            parts.push(`${excluded.length} project${excluded.length === 1 ? ' was' : 's were'} not mapped`)
        }

        return `Map uplink note: ${parts.join('; ')} and excluded from the current tactical view.`
    }

    selectMapProject(row: ProjectListItemSchema, centerMap = false) {
        const projectId = row.firewireProjectId || row.fieldwireProjectId || null
        this.selectedMapProjectId = projectId
        this.refreshMarkerSelectionState()
        this.openMapPopup(row)
        this.scrollSelectedMapProjectCardIntoView(projectId)

        const coordinates = this.getProjectCoordinates(row)
        if (centerMap && this.atlasMap && coordinates) {
            this.atlasMap.setCamera({
                ...this.getProjectMapCameraMode(),
                center: coordinates,
                zoom: Math.max(Number(this.atlasMap.getCamera()?.zoom || 0), 11),
                type: 'ease',
                duration: 700
            })
        }
    }

    isMapProjectSelected(row: ProjectListItemSchema): boolean {
        const projectId = row.firewireProjectId || row.fieldwireProjectId || null
        return !!projectId && projectId === this.selectedMapProjectId
    }

    getProjectStatusTone(status: string | null): string {
        switch ((status || '').trim()) {
            case 'Estimation':
                return 'cyan'
            case 'Proposal':
                return 'amber'
            case 'Booking':
                return 'lime'
            case 'Design':
                return 'violet'
            case 'Install':
                return 'orange'
            case 'Service':
                return 'teal'
            case 'Closed':
                return 'slate'
            default:
                return 'cyan'
        }
    }

    getProjectLink(row: ProjectListItemSchema): string[] {
        return row.firewireProjectId ? ['/projects', 'firewire', row.firewireProjectId, 'project-details'] : ['/projects']
    }

    getFieldwireProjectUrl(row: ProjectListItemSchema): string | null {
        const fieldwireProjectId = row.fieldwireProjectId || row.fieldwireId
        return fieldwireProjectId ? `https://app.fieldwire.com/projects/${fieldwireProjectId}` : null
    }

    getProjectTypeIcon(projectType: ProjectListItemSchema['projectType']): string {
        switch (projectType) {
            case 'Sprinkler':
                return 'water_drop'
            case 'Security':
                return 'shield'
            case 'Fire Alarm':
            default:
                return 'local_fire_department'
        }
    }

    getProjectTypeIconClass(projectType: ProjectListItemSchema['projectType']): string {
        switch (projectType) {
            case 'Sprinkler':
                return 'project-type-icon project-type-icon--sprinkler'
            case 'Security':
                return 'project-type-icon project-type-icon--security'
            case 'Fire Alarm':
            default:
                return 'project-type-icon project-type-icon--fire-alarm'
        }
    }

    private createDefaultProject(): FirewireProjectUpsert {
        const defaultBidDate = new Date()
        defaultBidDate.setDate(defaultBidDate.getDate() + 30)

        return {
            fieldwireId: null,
            name: '',
            projectNbr: '',
            address: '',
            bidDueDate: defaultBidDate.toISOString().slice(0, 10),
            projectStatus: 'Estimation',
            projectType: 'Fire Alarm',
            salesman: '',
            jobType: '',
            scopeType: '',
            projectScope: '',
            difficulty: '',
            totalSqFt: 0
        }
    }

    private configureFilterPredicate() {
        this.datasource.filterPredicate = (row: ProjectListItemSchema, filter: string) => {
            const parsed = this.parseFilterValue(filter)
            const haystack = [
                row.name,
                row.projectNbr,
                row.projectStatus,
                row.address,
                row.salesman,
                row.jobType,
                row.scopeType,
                row.projectScope,
                row.difficulty
            ]
                .filter((value): value is string => typeof value === 'string')
                .join(' ')
                .toLowerCase()

            const matchesText = !parsed.text || haystack.includes(parsed.text)
            const matchesStatus = parsed.statuses.length <= 0 || parsed.statuses.includes((row.projectStatus || '').toLowerCase())
            return matchesText && matchesStatus
        }
    }

    private applyCombinedFilter() {
        this.datasource.filter = JSON.stringify({
            text: this.textFilter.trim().toLowerCase(),
            statuses: this.selectedProjectStatuses.map((status) => status.toLowerCase()).sort()
        })

        this.refreshVisibleMapProjects()

        if (this.datasource.paginator) {
            this.datasource.paginator.firstPage()
        }
    }

    private parseFilterValue(filter: string): { text: string, statuses: string[] } {
        if (!filter) {
            return { text: '', statuses: [] }
        }

        try {
            const parsed = JSON.parse(filter)
            return {
                text: typeof parsed?.text === 'string' ? parsed.text : '',
                statuses: Array.isArray(parsed?.statuses) ? parsed.statuses.filter((value: unknown): value is string => typeof value === 'string') : []
            }
        } catch {
            return { text: filter.trim().toLowerCase(), statuses: [] }
        }
    }

    private refreshVisibleMapProjects() {
        this.bumpMapCameraRequestVersion()
        this.cancelPendingMapCameraRetry()
        this.visibleMapProjects = this.datasource.filteredData.filter((row) => this.hasProjectGeo(row))
        if (this.selectedMapProjectId && !this.visibleMapProjects.some((row) => (row.firewireProjectId || row.fieldwireProjectId) === this.selectedMapProjectId)) {
            this.selectedMapProjectId = null
        }
        if (!this.selectedMapProjectId && this.visibleMapProjects.length > 0) {
            this.selectedMapProjectId = this.visibleMapProjects[0].firewireProjectId || this.visibleMapProjects[0].fieldwireProjectId || null
        }
        if (this.projectsViewMode === 'Map') {
            this.queueMapRender()
        }
    }

    private queueMapRender() {
        setTimeout(() => {
            void this.ensureMapReady()
        }, 180)
    }

    private async ensureMapReady(): Promise<void> {
        if (!this.projectsMapHost?.nativeElement) {
            return
        }

        this.syncProjectMapPreferencesFromSnapshot()

        const subscriptionKey = await this.getAzureMapsSubscriptionKey()
        if (!subscriptionKey) {
            this.mapLoadError = 'Azure Maps is not configured on the server for authenticated map access.'
            return
        }

        try {
            await this.azureMapsService.loadSdk()
            this.mapLoadError = ''

            if (!this.atlasMap) {
                this.atlasMap = new atlas.Map(this.projectsMapHost.nativeElement, {
                    authOptions: {
                        authType: 'subscriptionKey',
                        subscriptionKey
                    },
                    center: [-97.7431, 30.2672],
                    zoom: 4,
                    style: this.projectMapPreferences.style,
                    language: 'en-US'
                })

                this.atlasMap.events.add('ready', () => {
                    this.mapReady = true
                    this.atlasMap.controls.add([
                        new atlas.control.ZoomControl(),
                        new atlas.control.CompassControl()
                    ], {
                        position: 'top-right'
                    })
                    this.atlasPopup = new atlas.Popup({
                        closeButton: false,
                        pixelOffset: [0, -24]
                    })
                    this.atlasMap.events.add('click', () => this.closeMapPopup())
                    this.applyProjectMapPreferencesToMap('preserve')
                    this.scheduleInitialMapRender()
                })
                return
            }

            if (this.mapReady) {
                this.applyProjectMapPreferencesToMap('preserve')
                this.renderMapProjects()
            }
        } catch (err) {
            console.error(err)
            this.mapLoadError = 'Unable to load Azure Maps.'
        }
    }

    private async getAzureMapsSubscriptionKey(): Promise<string> {
        return this.azureMapsService.getSubscriptionKey()
    }

    private renderMapProjects() {
        if (!this.atlasMap || !this.mapReady) {
            return
        }

        this.syncProjectMapPreferencesFromSnapshot()
        const requestVersion = this.bumpMapCameraRequestVersion()
        this.cancelPendingMapCameraRetry()
        this.atlasMap.resize()

        const viewportPadding = this.getMapViewportPadding()
        if (!viewportPadding) {
            this.queueMapRender()
            return
        }

        for (const { marker } of this.atlasMarkers.values()) {
            this.atlasMap.markers.remove(marker)
        }
        this.atlasMarkers.clear()

        const positions: [number, number][] = []
        for (const row of this.visibleMapProjects) {
            if (!this.hasProjectGeo(row)) {
                continue
            }

            const projectId = row.firewireProjectId || row.fieldwireProjectId
            if (!projectId) {
                continue
            }

            const coordinates = this.getProjectCoordinates(row)
            if (!coordinates) {
                continue
            }

            const [longitude, latitude] = coordinates

            const markerElement = document.createElement('button')
            markerElement.type = 'button'
            markerElement.className = `project-map-marker project-map-marker--${this.getProjectStatusTone(row.projectStatus)}`
            markerElement.setAttribute('aria-label', row.name)
            markerElement.innerHTML = '<span class="project-map-marker__core"></span><span class="project-map-marker__pulse"></span>'
            markerElement.addEventListener('click', (event) => {
                event.stopPropagation()
                this.selectMapProject(row)
            })

            const marker = new atlas.HtmlMarker({
                htmlContent: markerElement,
                position: [longitude, latitude],
                anchor: 'bottom'
            })

            this.atlasMarkers.set(projectId, { marker, element: markerElement })
            this.atlasMap.markers.add(marker)
            positions.push([longitude, latitude])
        }

        this.refreshMarkerSelectionState()

        if (positions.length <= 0) {
            this.closeMapPopup()
            return
        }

        if (positions.length === 1 && this.projectMapPreferences.autoFitPins) {
            this.focusSingleMapPoint(positions[0], requestVersion)
            return
        }

        if (positions.length > 1 && this.projectMapPreferences.autoFitPins) {
            const bounds = positions.reduce((acc, position) => {
                acc[0] = Math.min(acc[0], position[0])
                acc[1] = Math.min(acc[1], position[1])
                acc[2] = Math.max(acc[2], position[0])
                acc[3] = Math.max(acc[3], position[1])
                return acc
            }, [positions[0][0], positions[0][1], positions[0][0], positions[0][1]])

            this.trySetMapCamera({
                ...this.getProjectMapCameraMode(),
                bounds,
                padding: viewportPadding,
                type: 'ease',
                duration: 900
            }, requestVersion)
        }
    }

    private scheduleInitialMapRender() {
        setTimeout(() => {
            this.atlasMap?.resize?.()
            this.renderMapProjects()
        }, 260)
    }

    private openMapPopup(row: ProjectListItemSchema) {
        const coordinates = this.getProjectCoordinates(row)
        if (!this.atlasPopup || !coordinates) {
            return
        }

        const projectNbr = row.projectNbr ? `<div class="project-map-popup__meta"># ${this.escapeHtml(row.projectNbr)}</div>` : ''
        const status = this.escapeHtml(row.projectStatus || 'Status Pending')
        const name = this.escapeHtml(row.name)
        const address = this.escapeHtml(row.address || '')
        const projectType = this.escapeHtml(row.projectType || 'Firewire')

        this.atlasPopup.setOptions({
            position: coordinates,
            content: `
                <div class="project-map-popup">
                    <div class="project-map-popup__eyebrow">${status}</div>
                    <div class="project-map-popup__title">${name}</div>
                    <div class="project-map-popup__meta">${projectType}</div>
                    <div class="project-map-popup__meta">${address}</div>
                    ${projectNbr}
                </div>
            `
        })
        this.atlasPopup.open(this.atlasMap)
    }

    private closeMapPopup() {
        if (this.atlasPopup?.close) {
            this.atlasPopup.close()
        }
    }

    private refreshMarkerSelectionState() {
        for (const [projectId, entry] of this.atlasMarkers.entries()) {
            entry.element.classList.toggle('is-selected', projectId === this.selectedMapProjectId)
        }
    }

    private scrollSelectedMapProjectCardIntoView(projectId: string | null) {
        if (!projectId) {
            return
        }

        setTimeout(() => {
            const card = this.mapProjectCards?.find((entry) => entry.nativeElement.dataset['projectId'] === projectId)
            card?.nativeElement.scrollIntoView({
                behavior: 'smooth',
                block: 'nearest',
                inline: 'nearest'
            })
        }, 0)
    }

    private storeProjectsViewMode(mode: 'Grid' | 'Map') {
        if (typeof localStorage === 'undefined') {
            return
        }
        try {
            localStorage.setItem(this.projectsViewModeStorageKey, mode)
        } catch {
            return
        }
    }

    private readStoredProjectsViewMode(): 'Grid' | 'Map' {
        if (typeof localStorage === 'undefined') {
            return 'Grid'
        }
        try {
            const value = localStorage.getItem(this.projectsViewModeStorageKey)
            return value === 'Map' ? 'Map' : 'Grid'
        } catch {
            return 'Grid'
        }
    }

    private storeProjectStatusFilter() {
        if (typeof localStorage === 'undefined') {
            return
        }
        try {
            localStorage.setItem(this.projectsStatusFilterStorageKey, JSON.stringify(this.selectedProjectStatuses))
        } catch {
            return
        }
    }

    private readStoredProjectStatusFilter(): string[] {
        if (typeof localStorage === 'undefined') {
            return []
        }

        try {
            const value = JSON.parse(localStorage.getItem(this.projectsStatusFilterStorageKey) || '[]')
            return Array.isArray(value) ? value.filter((item): item is string => typeof item === 'string') : []
        } catch {
            return []
        }
    }

    private storeProjectsSort() {
        if (typeof localStorage === 'undefined') {
            return
        }
        try {
            localStorage.setItem(this.projectsSortStorageKey, JSON.stringify({
                active: this.currentSortActive,
                direction: this.currentSortDirection
            }))
        } catch {
            return
        }
    }

    private readStoredProjectsSort(): { active: string, direction: SortDirection } {
        if (typeof localStorage === 'undefined') {
            return { active: 'name', direction: 'asc' }
        }

        try {
            const parsed = JSON.parse(localStorage.getItem(this.projectsSortStorageKey) || '{}') as { active?: unknown, direction?: unknown }
            const active = typeof parsed.active === 'string' && parsed.active.trim() ? parsed.active : 'name'
            const direction = parsed.direction === 'desc' || parsed.direction === 'asc' ? parsed.direction : 'asc'
            return { active, direction }
        } catch {
            return { active: 'name', direction: 'asc' }
        }
    }

    private applyStoredSortState() {
        if (!this.sort) {
            return
        }

        this.sort.active = this.currentSortActive
        this.sort.direction = this.currentSortDirection
    }

    private getProjectCoordinates(row: ProjectListItemSchema): [number, number] | null {
        const rawLatitude = row.latitude as number | string | null | undefined
        const rawLongitude = row.longitude as number | string | null | undefined

        if (rawLatitude === null || typeof rawLatitude === 'undefined' || rawLatitude === '') {
            return null
        }
        if (rawLongitude === null || typeof rawLongitude === 'undefined' || rawLongitude === '') {
            return null
        }

        const latitude = typeof rawLatitude === 'number' ? rawLatitude : Number(rawLatitude)
        const longitude = typeof rawLongitude === 'number' ? rawLongitude : Number(rawLongitude)
        if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) {
            return null
        }
        return [longitude, latitude]
    }

    private escapeHtml(value: string): string {
        return value
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#39;')
    }

    private updateProjectMapPreferences(preferences: ProjectMapPreferences, cameraBehavior: 'preserve' | 'refit') {
        this.projectMapPreferences = { ...preferences }
        this.applyProjectMapPreferencesToMap(cameraBehavior)
    }

    private syncProjectMapPreferencesFromSnapshot() {
        const snapshot = this.userPreferences.snapshot?.projectMap
        if (!snapshot) {
            return
        }
        this.projectMapPreferences = { ...snapshot }
    }

    private applyProjectMapPreferencesToMap(cameraBehavior: 'preserve' | 'refit') {
        if (!this.atlasMap || !this.mapReady) {
            return
        }

        const styleSignature = JSON.stringify({
            style: this.projectMapPreferences.style,
            showRoadDetails: this.projectMapPreferences.showRoadDetails,
            showBuildingFootprints: this.projectMapPreferences.showBuildingFootprints
        })
        const styleChanged = styleSignature !== this.lastAppliedMapStyleSignature

        if (styleChanged) {
            this.lastAppliedMapStyleSignature = styleSignature
            this.atlasMap.setStyle({
                style: this.projectMapPreferences.style,
                styleOverrides: {
                    roadDetails: {
                        visible: this.projectMapPreferences.showRoadDetails
                    },
                    buildingFootprint: {
                        visible: this.projectMapPreferences.showBuildingFootprints
                    }
                }
            })
        }

        if (cameraBehavior === 'refit') {
            this.renderMapProjects()
        }
    }

    private getProjectMapCameraMode(): { pitch: number, bearing: number } {
        return this.projectMapPreferences.dimension === '3d'
            ? { pitch: 58, bearing: -18 }
            : { pitch: 0, bearing: 0 }
    }

    private getMapViewportPadding(): { top: number, right: number, bottom: number, left: number } | null {
        const host = this.projectsMapHost?.nativeElement
        const width = host?.clientWidth ?? 0
        const height = host?.clientHeight ?? 0

        if (width <= 0 || height <= 0) {
            return null
        }

        const maxHorizontalPadding = Math.max(40, Math.floor(width * 0.28))
        const maxVerticalPadding = Math.max(48, Math.floor(height * 0.28))

        return {
            top: Math.min(this.baseMapViewportPadding.top, maxVerticalPadding),
            right: Math.min(this.baseMapViewportPadding.right, maxHorizontalPadding),
            bottom: Math.min(this.baseMapViewportPadding.bottom, maxVerticalPadding),
            left: Math.min(this.baseMapViewportPadding.left, maxHorizontalPadding)
        }
    }

    private trySetMapCamera(options: Record<string, unknown>, requestVersion: number) {
        this.trySetMapCameraWithRetry(options, 0, requestVersion)
    }

    private focusSingleMapPoint(position: [number, number], requestVersion: number) {
        this.trySetMapCamera({
            ...this.getProjectMapCameraMode(),
            center: position,
            zoom: this.projectMapPreferences.dimension === '3d' ? 12 : 11,
            type: 'ease',
            duration: 600
        }, requestVersion)
    }

    private trySetMapCameraWithRetry(options: Record<string, unknown>, attempt: number, requestVersion: number) {
        if (!this.atlasMap || !this.mapReady) {
            return
        }
        if (requestVersion !== this.mapCameraRequestVersion) {
            return
        }

        if (!this.isMapCanvasReady()) {
            this.scheduleMapCameraRetry(options, attempt, requestVersion)
            return
        }

        try {
            this.atlasMap.setCamera(options)
        } catch (err) {
            this.scheduleMapCameraRetry(options, attempt, requestVersion)
        }
    }

    private scheduleMapCameraRetry(options: Record<string, unknown>, attempt: number, requestVersion: number) {
        if (attempt >= 6) {
            return
        }

        this.cancelPendingMapCameraRetry()

        this.pendingMapCameraRetryHandle = setTimeout(() => {
            this.pendingMapCameraRetryHandle = undefined
            this.atlasMap?.resize?.()
            this.trySetMapCameraWithRetry(options, attempt + 1, requestVersion)
        }, 180)
    }

    private bumpMapCameraRequestVersion(): number {
        this.mapCameraRequestVersion += 1
        return this.mapCameraRequestVersion
    }

    private cancelPendingMapCameraRetry() {
        if (!this.pendingMapCameraRetryHandle) {
            return
        }

        clearTimeout(this.pendingMapCameraRetryHandle)
        this.pendingMapCameraRetryHandle = undefined
    }

    private isMapCanvasReady(): boolean {
        const host = this.projectsMapHost?.nativeElement
        const hostWidth = host?.clientWidth ?? 0
        const hostHeight = host?.clientHeight ?? 0
        if (hostWidth <= 0 || hostHeight <= 0) {
            return false
        }

        const mapContainer = this.atlasMap?.getMapContainer?.() as HTMLElement | undefined
        const canvas = this.atlasMap?.getCanvas?.() as HTMLCanvasElement | undefined
        const internalWidth = Math.max(mapContainer?.clientWidth ?? 0, canvas?.clientWidth ?? 0, canvas?.width ?? 0)
        const internalHeight = Math.max(mapContainer?.clientHeight ?? 0, canvas?.clientHeight ?? 0, canvas?.height ?? 0)

        return internalWidth > 0 && internalHeight > 0
    }

    private observeMapHost() {
        this.resizeObserver?.disconnect()

        const host = this.projectsMapHost?.nativeElement
        if (!host || typeof ResizeObserver === 'undefined') {
            return
        }

        this.resizeObserver = new ResizeObserver((entries) => {
            const entry = entries[0]
            if (!entry || this.projectsViewMode !== 'Map') {
                return
            }

            const width = Math.round(entry.contentRect.width)
            const height = Math.round(entry.contentRect.height)
            if (width <= 0 || height <= 0) {
                return
            }

            this.atlasMap?.resize?.()

            if (this.mapReady) {
                this.renderMapProjects()
            }
        })

        this.resizeObserver.observe(host)
    }

    private resetMapInstance() {
        this.cancelPendingMapCameraRetry()
        this.atlasMarkers.clear()
        this.mapReady = false
        if (this.atlasPopup?.close) {
            this.atlasPopup.close()
        }
        if (this.atlasMap?.dispose) {
            this.atlasMap.dispose()
        }
        this.atlasPopup = undefined
        this.atlasMap = undefined
    }

    private loadProjectSettings() {
        this.projectSettingsApi.getCatalog().subscribe({
            next: (catalog) => {
                this.projectSettings = catalog
                const validStatuses = new Set(this.getProjectStatusFilterOptions())
                this.selectedProjectStatuses = this.selectedProjectStatuses.filter((status) => validStatuses.has(status))
                this.storeProjectStatusFilter()
                this.applyCombinedFilter()
            },
            error: (err) => {
                console.error(err)
            }
        })
    }
}
