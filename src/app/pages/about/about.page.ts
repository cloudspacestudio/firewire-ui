import { CommonModule, Location } from '@angular/common'
import { HttpClient } from '@angular/common/http'
import { Component, OnInit } from '@angular/core'
import { MatButtonModule } from '@angular/material/button'
import { MatIconModule } from '@angular/material/icon'
import { PageToolbar } from '../../common/components/page-toolbar'
import { ABOUT_METADATA, AboutLibraryAttribution, AboutMetadata } from '../../generated/about.generated'
import { firstValueFrom } from 'rxjs'

interface AboutDetail {
    label: string
    value: string
}

type RuntimeServerConnection = AboutMetadata['server']['connection'] & {
    runtimeBaseUrl?: string
    runtimeApiRoot?: string
    tenantId?: string
    apiAudience?: string
    requiredScopes?: string[]
}

type RuntimeServerAboutMetadata = Omit<AboutMetadata['server'], 'connection'> & {
    connection: RuntimeServerConnection
    generatedAt?: string
}

@Component({
    standalone: true,
    selector: 'about-page',
    imports: [CommonModule, MatButtonModule, MatIconModule, PageToolbar],
    templateUrl: './about.page.html',
    styleUrls: ['./about.page.scss']
})
export class AboutPage implements OnInit {
    readonly metadata = ABOUT_METADATA
    serverMetadata: RuntimeServerAboutMetadata = ABOUT_METADATA.server
    localEnvironmentDetails: AboutDetail[] = []
    copyMessage = ''
    serverStatusMessage = ''

    constructor(
        private readonly location: Location,
        private readonly http: HttpClient
    ) {}

    ngOnInit(): void {
        this.localEnvironmentDetails = this.buildLocalEnvironmentDetails()
        this.loadServerMetadata()
    }

    get clientLibraries(): AboutLibraryAttribution[] {
        return this.metadata.client.libraries
    }

    get serverLibraries(): AboutLibraryAttribution[] {
        return this.serverMetadata.libraries
    }

    get derivedServerDetails(): AboutDetail[] {
        const origin = typeof window !== 'undefined' ? window.location.origin : ''
        return [
            { label: 'Client Origin', value: origin || 'Unavailable' },
            { label: 'Effective API Base', value: this.serverMetadata.connection?.runtimeApiRoot || (origin ? `${origin}${this.serverMetadata.connection.apiProxyPath}` : this.serverMetadata.connection.apiProxyPath) },
            { label: 'Runtime Base URL', value: this.serverMetadata.connection?.runtimeBaseUrl || 'Unavailable' },
            { label: 'Proxy Target', value: this.serverMetadata.connection.proxyTarget || 'Unavailable' },
            { label: 'Default Server Port', value: this.serverMetadata.connection.defaultServerPort || 'Unavailable' },
            { label: 'Protected Resource Prefixes', value: this.serverMetadata.connection.protectedResourceStartsWith?.join(', ') || 'Unavailable' },
            { label: 'Auth Authority', value: this.serverMetadata.connection.authAuthority || 'Unavailable' },
            { label: 'API Scopes', value: this.serverMetadata.connection.apiScopes?.join(', ') || 'Unavailable' },
            { label: 'Metadata Source', value: this.serverStatusMessage || 'Live API' }
        ]
    }

    async copyLocalEnvironment(): Promise<void> {
        const text = this.localEnvironmentDetails
            .map((detail) => `${detail.label}: ${detail.value}`)
            .join('\n')

        try {
            if (navigator.clipboard?.writeText) {
                await navigator.clipboard.writeText(text)
            } else {
                this.copyWithTextareaFallback(text)
            }
            this.copyMessage = 'Local settings copied to clipboard.'
        } catch {
            this.copyMessage = 'Clipboard copy failed.'
        }
    }

    onBack(): void {
        this.location.back()
    }

    private async loadServerMetadata(): Promise<void> {
        try {
            const response = await firstValueFrom(
                this.http.get<{ data?: RuntimeServerAboutMetadata }>('/api/firewire/about')
            )
            if (response?.data) {
                this.serverMetadata = {
                    ...this.serverMetadata,
                    ...response.data,
                    connection: {
                        ...this.serverMetadata.connection,
                        ...response.data.connection
                    },
                    libraries: Array.isArray(response.data.libraries) ? response.data.libraries : this.serverMetadata.libraries
                }
                this.serverStatusMessage = 'Live API'
                return
            }
            this.serverStatusMessage = 'Generated fallback'
        } catch {
            this.serverStatusMessage = 'Generated fallback'
        }
    }

    private buildLocalEnvironmentDetails(): AboutDetail[] {
        if (typeof window === 'undefined' || typeof navigator === 'undefined') {
            return [{ label: 'Environment', value: 'Browser details unavailable' }]
        }

        const userAgentData = (navigator as Navigator & { userAgentData?: { platform?: string, brands?: Array<{ brand: string, version: string }> } }).userAgentData
        const timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone || 'Unavailable'
        const screenSize = typeof screen !== 'undefined' ? `${screen.width} x ${screen.height}` : 'Unavailable'
        const viewportSize = `${window.innerWidth} x ${window.innerHeight}`

        return [
            { label: 'Current URL', value: window.location.href },
            { label: 'Browser Origin', value: window.location.origin },
            { label: 'Browser Platform', value: userAgentData?.platform || navigator.platform || 'Unavailable' },
            { label: 'Browser User Agent', value: navigator.userAgent || 'Unavailable' },
            { label: 'Browser Vendor', value: navigator.vendor || 'Unavailable' },
            { label: 'Browser Languages', value: (navigator.languages || []).join(', ') || navigator.language || 'Unavailable' },
            { label: 'Time Zone', value: timeZone },
            { label: 'Screen Size', value: screenSize },
            { label: 'Viewport Size', value: viewportSize },
            { label: 'Online Status', value: navigator.onLine ? 'Online' : 'Offline' },
            { label: 'Cookies Enabled', value: navigator.cookieEnabled ? 'Yes' : 'No' },
            { label: 'CPU Threads', value: String(navigator.hardwareConcurrency || 'Unavailable') },
            { label: 'Device Memory (GB)', value: String((navigator as Navigator & { deviceMemory?: number }).deviceMemory || 'Unavailable') },
            { label: 'Touch Points', value: String(navigator.maxTouchPoints || 0) }
        ]
    }

    private copyWithTextareaFallback(text: string): void {
        const textarea = document.createElement('textarea')
        textarea.value = text
        textarea.setAttribute('readonly', '')
        textarea.style.position = 'absolute'
        textarea.style.left = '-9999px'
        document.body.appendChild(textarea)
        textarea.select()
        document.execCommand('copy')
        document.body.removeChild(textarea)
    }
}
