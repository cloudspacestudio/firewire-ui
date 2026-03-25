import { Injectable } from '@angular/core'
import { HttpClient } from '@angular/common/http'
import { firstValueFrom } from 'rxjs'

declare const atlas: any

@Injectable({ providedIn: 'root' })
export class AzureMapsService {
    private sdkLoader?: Promise<void>
    private subscriptionKeyPromise?: Promise<string>
    private subscriptionKey = ''

    constructor(private readonly http: HttpClient) {}

    async getSubscriptionKey(): Promise<string> {
        if (this.subscriptionKey) {
            return this.subscriptionKey
        }

        if (!this.subscriptionKeyPromise) {
            this.subscriptionKeyPromise = firstValueFrom(
                this.http.get<{ data?: { subscriptionKey?: string | null } }>('/api/firewire/projects/map-config')
            ).then((response) => {
                const resolved = (response?.data?.subscriptionKey || '').trim()
                this.subscriptionKey = resolved
                return resolved
            }).catch((err) => {
                console.error(err)
                this.subscriptionKey = ''
                return ''
            })
        }

        return this.subscriptionKeyPromise
    }

    loadSdk(): Promise<void> {
        if (this.sdkLoader) {
            return this.sdkLoader
        }

        this.sdkLoader = new Promise<void>((resolve, reject) => {
            if (typeof document === 'undefined') {
                reject(new Error('Document is not available.'))
                return
            }

            if (!document.querySelector('link[data-azure-maps-sdk="true"]')) {
                const link = document.createElement('link')
                link.rel = 'stylesheet'
                link.href = 'https://atlas.microsoft.com/sdk/javascript/mapcontrol/3/atlas.min.css'
                link.setAttribute('data-azure-maps-sdk', 'true')
                document.head.appendChild(link)
            }

            if (typeof atlas !== 'undefined') {
                resolve()
                return
            }

            const existingScript = document.querySelector('script[data-azure-maps-sdk="true"]') as HTMLScriptElement | null
            if (existingScript) {
                existingScript.addEventListener('load', () => resolve(), { once: true })
                existingScript.addEventListener('error', () => reject(new Error('Azure Maps SDK failed to load.')), { once: true })
                return
            }

            const script = document.createElement('script')
            script.src = 'https://atlas.microsoft.com/sdk/javascript/mapcontrol/3/atlas.min.js'
            script.async = true
            script.defer = true
            script.setAttribute('data-azure-maps-sdk', 'true')
            script.addEventListener('load', () => resolve(), { once: true })
            script.addEventListener('error', () => reject(new Error('Azure Maps SDK failed to load.')), { once: true })
            document.body.appendChild(script)
        })

        return this.sdkLoader
    }
}
