import { Injectable } from '@angular/core'
import { BrowserAuthError, InteractionRequiredAuthError, type AccountInfo } from '@azure/msal-browser'
import { environment } from '../../environments/environment'
import { msalInstance } from './msal.config'

export interface AuthUserProfile {
    name: string
    email: string
    avatarUrl?: string
}

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
            // Never trigger an interactive redirect from iframe context
            // (MSAL silent token renewal uses hidden iframes).
            if (!this.isInIframe()) {
                await msalInstance.loginRedirect({ scopes: this.loginScopes })
            }
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
            if (!this.isInIframe()) {
                await msalInstance.loginRedirect({ scopes: this.loginScopes })
            }
            return null
        }

        try {
            const result = await msalInstance.acquireTokenSilent({
                account,
                scopes: this.apiScopes
            })
            return result.accessToken
        } catch (err) {
            if (err instanceof InteractionRequiredAuthError || this.isMsalTimeoutError(err)) {
                if (!this.isInIframe()) {
                    await msalInstance.acquireTokenRedirect({
                        account,
                        scopes: this.apiScopes
                    })
                }
                return null
            }
            console.error('Failed to acquire token', err)
            return null
        }
    }

    getUserProfile(): AuthUserProfile | null {
        const account = this.getActiveAccount()
        if (!account) {
            return null
        }

        const claims = (account.idTokenClaims ?? {}) as Record<string, unknown>
        const claimEmails = Array.isArray(claims['emails'])
            ? (claims['emails'] as unknown[]).filter((value): value is string => typeof value === 'string' && value.length > 0)
            : []

        const name = this.firstNonEmptyString(
            claims['name'],
            account.name,
            account.username
        ) || 'User'

        const email = this.firstNonEmptyString(
            claims['preferred_username'],
            claims['email'],
            claimEmails[0],
            account.username
        ) || ''

        const avatarUrl = this.firstNonEmptyString(
            claims['picture'],
            claims['avatar_url'],
            claims['photo'],
            claims['profile_picture']
        ) || undefined

        return { name, email, avatarUrl }
    }

    async signOut(): Promise<void> {
        if (!this.isConfigured()) {
            return
        }
        await msalInstance.initialize()
        const account = this.getActiveAccount()
        await msalInstance.logoutRedirect({
            account: account ?? undefined
        })
    }

    private getActiveAccount(): AccountInfo | null {
        return msalInstance.getActiveAccount() ?? msalInstance.getAllAccounts()[0] ?? null
    }

    private isConfigured(): boolean {
        return !!environment.auth.clientId && !environment.auth.clientId.includes('YOUR_')
    }

    private isInIframe(): boolean {
        return window.parent !== window
    }

    private isMsalTimeoutError(err: unknown): boolean {
        return err instanceof BrowserAuthError && err.errorCode === 'timed_out'
    }

    private firstNonEmptyString(...values: unknown[]): string | null {
        for (const value of values) {
            if (typeof value === 'string' && value.trim().length > 0) {
                return value.trim()
            }
        }
        return null
    }
}
