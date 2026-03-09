import { BrowserCacheLocation, LogLevel, PublicClientApplication, type Configuration } from '@azure/msal-browser'
import { environment } from '../../environments/environment'

const redirectUri = resolveRedirectUri(environment.auth.redirectUri)
const postLogoutRedirectUri = resolveRedirectUri(environment.auth.postLogoutRedirectUri)

const msalConfig: Configuration = {
    auth: {
        clientId: environment.auth.clientId,
        authority: environment.auth.authority,
        redirectUri,
        postLogoutRedirectUri
    },
    cache: {
        cacheLocation: BrowserCacheLocation.LocalStorage
    },
    system: {
        loggerOptions: {
            logLevel: LogLevel.Warning,
            piiLoggingEnabled: false,
            loggerCallback: () => {}
        }
    }
}

export const msalInstance = new PublicClientApplication(msalConfig)

function resolveRedirectUri(pathOrUrl: string): string {
    if (!pathOrUrl) {
        return window.location.origin
    }
    if (pathOrUrl.startsWith('http://') || pathOrUrl.startsWith('https://')) {
        return pathOrUrl
    }
    return `${window.location.origin}${pathOrUrl}`
}
