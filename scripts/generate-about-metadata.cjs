const fs = require('fs')
const path = require('path')

const repoRoot = path.resolve(__dirname, '..')
const clientRoot = repoRoot
const outputPath = path.join(repoRoot, 'src', 'app', 'generated', 'about.generated.ts')
const clientPackagePath = path.join(clientRoot, 'package.json')
const clientLockPath = path.join(clientRoot, 'package-lock.json')
const proxyConfigPath = path.join(clientRoot, 'src', 'proxy.config.json')
const environmentPath = path.join(clientRoot, 'src', 'environments', 'environment.ts')

function readJson(filePath) {
    return JSON.parse(fs.readFileSync(filePath, 'utf8'))
}

function safeReadJson(filePath) {
    return fs.existsSync(filePath) ? readJson(filePath) : null
}

function parseEnvironmentTs(source) {
    const authority = source.match(/authority:\s*'([^']+)'/)?.[1] || ''
    const protectedResourceStartsWith = Array.from(source.matchAll(/protectedResourceStartsWith:\s*\[([^\]]*)\]/g))
        .flatMap((match) => (match[1] || '').match(/'([^']+)'/g) || [])
        .map((value) => value.replace(/'/g, ''))
    const apiScopes = Array.from(source.matchAll(/apiScopes:\s*\[([^\]]*)\]/g))
        .flatMap((match) => (match[1] || '').match(/'([^']+)'/g) || [])
        .map((value) => value.replace(/'/g, ''))
    return { authority, protectedResourceStartsWith, apiScopes }
}

function getInstalledProductionLibraries(packageJson, packageLock) {
    const dependencyNames = Object.keys(packageJson.dependencies || {}).sort((left, right) => left.localeCompare(right))
    const packages = packageLock?.packages || {}

    return dependencyNames.map((name) => {
        const packageEntry = packages[`node_modules/${name}`] || {}
        return {
            name,
            version: packageEntry.version || packageJson.dependencies[name],
            license: packageEntry.license || 'Unknown'
        }
    })
}

function getServerConnectionDetails() {
    const proxyConfig = safeReadJson(proxyConfigPath) || {}
    const environmentSource = fs.existsSync(environmentPath) ? fs.readFileSync(environmentPath, 'utf8') : ''
    const environmentInfo = parseEnvironmentTs(environmentSource)
    const apiProxy = proxyConfig['/api'] || {}

    return {
        browserOriginMode: 'window.location.origin',
        apiProxyPath: '/api',
        proxyTarget: typeof apiProxy.target === 'string' ? apiProxy.target : '',
        defaultServerPort: '3000',
        authAuthority: environmentInfo.authority,
        apiScopes: environmentInfo.apiScopes,
        protectedResourceStartsWith: environmentInfo.protectedResourceStartsWith
    }
}

function main() {
    const clientPackage = readJson(clientPackagePath)
    const clientLock = readJson(clientLockPath)
    const serverConnection = getServerConnectionDetails()

    const metadata = {
        generatedAt: new Date().toISOString(),
        client: {
            name: clientPackage.name,
            version: clientPackage.version,
            libraries: getInstalledProductionLibraries(clientPackage, clientLock)
        },
        server: {
            name: 'Unavailable',
            version: 'Unavailable',
            connection: serverConnection,
            libraries: []
        }
    }

    const contents = [
        'export interface AboutLibraryAttribution {',
        '    name: string',
        '    version: string',
        '    license: string',
        '}',
        '',
        'export interface AboutMetadata {',
        '    generatedAt: string',
        '    client: {',
        '        name: string',
        '        version: string',
        '        libraries: AboutLibraryAttribution[]',
        '    }',
        '    server: {',
        '        name: string',
        '        version: string',
        '        connection: {',
        '            browserOriginMode: string',
        '            apiProxyPath: string',
        '            proxyTarget: string',
        '            defaultServerPort: string',
        '            authAuthority: string',
        '            apiScopes: string[]',
        '            protectedResourceStartsWith: string[]',
        '        }',
        '        libraries: AboutLibraryAttribution[]',
        '    }',
        '}',
        '',
        `export const ABOUT_METADATA: AboutMetadata = ${JSON.stringify(metadata, null, 4)} as const`,
        ''
    ].join('\n')

    fs.mkdirSync(path.dirname(outputPath), { recursive: true })
    fs.writeFileSync(outputPath, contents, 'utf8')
    console.log(`Generated ${path.relative(repoRoot, outputPath)}.`)
}

main()
