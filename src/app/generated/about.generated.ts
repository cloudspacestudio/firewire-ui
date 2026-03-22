export interface AboutLibraryAttribution {
    name: string
    version: string
    license: string
}

export interface AboutMetadata {
    generatedAt: string
    client: {
        name: string
        version: string
        libraries: AboutLibraryAttribution[]
    }
    server: {
        name: string
        version: string
        connection: {
            browserOriginMode: string
            apiProxyPath: string
            proxyTarget: string
            defaultServerPort: string
            authAuthority: string
            apiScopes: string[]
            protectedResourceStartsWith: string[]
        }
        libraries: AboutLibraryAttribution[]
    }
}

export const ABOUT_METADATA: AboutMetadata = {
    "generatedAt": "2026-03-22T08:08:01.948Z",
    "client": {
        "name": "mean-ui",
        "version": "0.0.0",
        "libraries": [
            {
                "name": "@angular/animations",
                "version": "19.0.0",
                "license": "MIT"
            },
            {
                "name": "@angular/cdk",
                "version": "19.0.0",
                "license": "MIT"
            },
            {
                "name": "@angular/common",
                "version": "19.0.0",
                "license": "MIT"
            },
            {
                "name": "@angular/compiler",
                "version": "19.0.0",
                "license": "MIT"
            },
            {
                "name": "@angular/core",
                "version": "19.0.0",
                "license": "MIT"
            },
            {
                "name": "@angular/forms",
                "version": "19.0.0",
                "license": "MIT"
            },
            {
                "name": "@angular/material",
                "version": "19.0.0",
                "license": "MIT"
            },
            {
                "name": "@angular/platform-browser",
                "version": "19.0.0",
                "license": "MIT"
            },
            {
                "name": "@angular/platform-browser-dynamic",
                "version": "19.0.0",
                "license": "MIT"
            },
            {
                "name": "@angular/router",
                "version": "19.0.0",
                "license": "MIT"
            },
            {
                "name": "@azure/msal-angular",
                "version": "5.1.1",
                "license": "MIT"
            },
            {
                "name": "@azure/msal-browser",
                "version": "5.4.0",
                "license": "MIT"
            },
            {
                "name": "rxjs",
                "version": "7.8.1",
                "license": "Apache-2.0"
            },
            {
                "name": "tslib",
                "version": "2.8.1",
                "license": "0BSD"
            },
            {
                "name": "zone.js",
                "version": "0.15.0",
                "license": "MIT"
            }
        ]
    },
    "server": {
        "name": "Unavailable",
        "version": "Unavailable",
        "connection": {
            "browserOriginMode": "window.location.origin",
            "apiProxyPath": "/api",
            "proxyTarget": "http://localhost:3000",
            "defaultServerPort": "3000",
            "authAuthority": "https://login.microsoftonline.com/3d16214c-01a7-4050-836c-312b53e9be54",
            "apiScopes": [
                "api://be29f453-6a2a-497b-a842-77ca88af2123/user_impersonation"
            ],
            "protectedResourceStartsWith": [
                "/api"
            ]
        },
        "libraries": []
    }
} as const
