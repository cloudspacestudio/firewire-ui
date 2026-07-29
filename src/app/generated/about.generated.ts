export interface AboutLibraryAttribution {
    name: string
    version: string
    license: string
}

export interface AboutMetadata {
    client: {
        name: string
        version: string
        libraries: AboutLibraryAttribution[]
    }
    server: {
        name: string
        version: string
        connection: {
            apiProxyPath: string
        }
        libraries: AboutLibraryAttribution[]
    }
}

export const ABOUT_METADATA: AboutMetadata = {
    "client": {
        "name": "mean-ui",
        "version": "0.0.0",
        "libraries": [
            {
                "name": "@angular/animations",
                "version": "22.0.8",
                "license": "MIT"
            },
            {
                "name": "@angular/cdk",
                "version": "22.0.6",
                "license": "MIT"
            },
            {
                "name": "@angular/common",
                "version": "22.0.8",
                "license": "MIT"
            },
            {
                "name": "@angular/compiler",
                "version": "22.0.8",
                "license": "MIT"
            },
            {
                "name": "@angular/core",
                "version": "22.0.8",
                "license": "MIT"
            },
            {
                "name": "@angular/forms",
                "version": "22.0.8",
                "license": "MIT"
            },
            {
                "name": "@angular/material",
                "version": "22.0.6",
                "license": "MIT"
            },
            {
                "name": "@angular/platform-browser",
                "version": "22.0.8",
                "license": "MIT"
            },
            {
                "name": "@angular/platform-browser-dynamic",
                "version": "22.0.8",
                "license": "MIT"
            },
            {
                "name": "@angular/router",
                "version": "22.0.8",
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
                "name": "pdfjs-dist",
                "version": "5.6.205",
                "license": "Apache-2.0"
            },
            {
                "name": "rxjs",
                "version": "7.8.2",
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
            "apiProxyPath": "/api"
        },
        "libraries": []
    }
} as const
