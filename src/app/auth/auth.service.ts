import { Injectable } from '@angular/core'
import { InteractionRequiredAuthError, type AccountInfo } from '@azure/msal-browser'
import { environment } from '../../environments/environment'
import { msalInstance } from './msal.config'

@Injectable({ providedIn: 'root' })
export class AuthService {
    private initialized = false
    private readonly loginScopes = environment.auth.loginScopes
    private readonly apiScopes = environment.auth.apiScopes

    async initialize(): Promise<void> {
        if (this.initialized) {
            return
        }
        if (!this.isConfigured()) {
            console.warn('MSAL is not configured. Set auth values in src/environments/environment.ts')
            this.initialized = true
            return
        }

        await msalInstance.initialize()
        const redirectResult = await msalInstance.handleRedirectPromise()
        if (redirectResult?.account) {
            msalInstance.setActiveAccount(redirectResult.account)
        }

        if (!msalInstance.getActiveAccount()) {
            const accounts = msalInstance.getAllAccounts()
            if (accounts.length > 0) {
                msalInstance.setActiveAccount(accounts[0])
            }
        }

        if (!msalInstance.getActiveAccount()) {
            await msalInstance.loginRedirect({ scopes: this.loginScopes })
            return
        }

        this.initialized = true
    }

    async getAccessToken(): Promise<string | null> {
        if (!this.isConfigured()) {
            return null
        }

        await this.initialize()

        const account = this.getActiveAccount()
        if (!account) {
            return null
        }

        try {
            const result = await msalInstance.acquireTokenSilent({
                account,
                scopes: this.apiScopes
            })
            return result.accessToken
        } catch (err) {
            if (err instanceof InteractionRequiredAuthError) {
                await msalInstance.acquireTokenRedirect({
                    account,
                    scopes: this.apiScopes
                })
                return null
            }
            console.error('Failed to acquire token', err)
            return null
        }
    }

    private getActiveAccount(): AccountInfo | null {
        return msalInstance.getActiveAccount() ?? msalInstance.getAllAccounts()[0] ?? null
    }

    private isConfigured(): boolean {
        return !!environment.auth.clientId && !environment.auth.clientId.includes('YOUR_')
    }
}
