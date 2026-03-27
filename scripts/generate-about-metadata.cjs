const fs = require('fs')
const path = require('path')

const repoRoot = path.resolve(__dirname, '..')
const clientRoot = repoRoot
const outputPath = path.join(repoRoot, 'src', 'app', 'generated', 'about.generated.ts')
const clientPackagePath = path.join(clientRoot, 'package.json')
const clientLockPath = path.join(clientRoot, 'package-lock.json')

function readJson(filePath) {
    return JSON.parse(fs.readFileSync(filePath, 'utf8'))
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

function main() {
    const clientPackage = readJson(clientPackagePath)
    const clientLock = readJson(clientLockPath)

    const metadata = {
        client: {
            name: clientPackage.name,
            version: clientPackage.version,
            libraries: getInstalledProductionLibraries(clientPackage, clientLock)
        },
        server: {
            name: 'Unavailable',
            version: 'Unavailable',
            connection: {
                apiProxyPath: '/api'
            },
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
        '    client: {',
        '        name: string',
        '        version: string',
        '        libraries: AboutLibraryAttribution[]',
        '    }',
        '    server: {',
        '        name: string',
        '        version: string',
        '        connection: {',
        '            apiProxyPath: string',
        '        }',
        '        libraries: AboutLibraryAttribution[]',
        '    }',
        '}',
        '',
        `export const ABOUT_METADATA: AboutMetadata = ${JSON.stringify(metadata, null, 4)} as const`,
        ''
    ].join('\n')

    fs.mkdirSync(path.dirname(outputPath), { recursive: true })
    const previousContents = fs.existsSync(outputPath) ? fs.readFileSync(outputPath, 'utf8') : null
    if (previousContents === contents) {
        console.log(`No changes to ${path.relative(repoRoot, outputPath)}.`)
        return
    }

    fs.writeFileSync(outputPath, contents, 'utf8')
    console.log(`Generated ${path.relative(repoRoot, outputPath)}.`)
}

main()
