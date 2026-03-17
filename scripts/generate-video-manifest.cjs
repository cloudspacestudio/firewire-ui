const fs = require('fs')
const path = require('path')
const { spawnSync } = require('child_process')

const repoRoot = path.resolve(__dirname, '..')
const videosDir = path.join(repoRoot, 'public', 'images', 'videos')
const outputPath = path.join(videosDir, 'index.json')
const allowedExtensions = new Set(['.mp4', '.mov', '.webm'])
const thumbnailExtension = '.jpg'
const ffmpegCommand = process.env.FFMPEG_PATH || 'ffmpeg'

function toLabel(fileName) {
    const baseName = fileName.replace(path.extname(fileName), '')
    if (/^media\d+$/i.test(baseName)) {
        return baseName.replace(/^media/i, 'Media ')
    }
    if (/^ps3$/i.test(baseName)) {
        return 'PS3 Legacy'
    }
    return baseName
        .replace(/([a-z])([A-Z0-9])/g, '$1 $2')
        .replace(/[_-]+/g, ' ')
        .replace(/\b\w/g, (match) => match.toUpperCase())
}

function getThumbnailFileName(fileName) {
    return `${path.basename(fileName, path.extname(fileName))}${thumbnailExtension}`
}

function detectFfmpeg() {
    const result = spawnSync(ffmpegCommand, ['-version'], { encoding: 'utf8' })
    return !result.error && result.status === 0
}

function ensureThumbnail(videoFileName, ffmpegAvailable) {
    const thumbnailFileName = getThumbnailFileName(videoFileName)
    const videoPath = path.join(videosDir, videoFileName)
    const thumbnailPath = path.join(videosDir, thumbnailFileName)

    const thumbnailExists = fs.existsSync(thumbnailPath)
    const shouldRegenerate = !thumbnailExists || fs.statSync(thumbnailPath).mtimeMs < fs.statSync(videoPath).mtimeMs

    if (!ffmpegAvailable) {
        return thumbnailExists ? thumbnailFileName : null
    }

    if (shouldRegenerate) {
        const result = spawnSync(
            ffmpegCommand,
            [
                '-y',
                '-ss', '00:00:01.000',
                '-i', videoPath,
                '-frames:v', '1',
                '-vf', 'scale=640:-1',
                thumbnailPath
            ],
            { encoding: 'utf8' }
        )

        if (result.error || result.status !== 0) {
            const reason = result.error?.message || result.stderr || 'unknown ffmpeg error'
            console.warn(`Failed to generate thumbnail for ${videoFileName}: ${reason}`)
            return fs.existsSync(thumbnailPath) ? thumbnailFileName : null
        }
    }

    return thumbnailFileName
}

function main() {
    if (!fs.existsSync(videosDir)) {
        throw new Error(`Video directory not found: ${videosDir}`)
    }

    const ffmpegAvailable = detectFfmpeg()
    if (!ffmpegAvailable) {
        console.warn(`ffmpeg was not found on PATH. Existing thumbnails will be reused, but new thumbnails were not generated.`)
    }

    const files = fs.readdirSync(videosDir, { withFileTypes: true })
        .filter((entry) => entry.isFile())
        .map((entry) => entry.name)
        .filter((name) => allowedExtensions.has(path.extname(name).toLowerCase()))
        .sort((left, right) => left.localeCompare(right, undefined, { numeric: true, sensitivity: 'base' }))
        .map((fileName) => ({
            fileName,
            label: toLabel(fileName),
            extension: path.extname(fileName).slice(1).toLowerCase(),
            thumbnailFileName: ensureThumbnail(fileName, ffmpegAvailable)
        }))

    fs.writeFileSync(outputPath, JSON.stringify(files, null, 2) + '\n', 'utf8')
    console.log(`Generated ${path.relative(repoRoot, outputPath)} with ${files.length} entries.`)
}

main()
