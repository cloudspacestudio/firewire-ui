import { Injectable } from '@angular/core'

@Injectable({
    providedIn: 'root'
})
export class PdfThumbnailService {
    private workerConfigured = false

    async createThumbnail(file: Blob, maxWidth = 360): Promise<string> {
        const pdfjs = await import('pdfjs-dist')
        if (!this.workerConfigured) {
            pdfjs.GlobalWorkerOptions.workerSrc = new URL('pdfjs-dist/build/pdf.worker.mjs', import.meta.url).toString()
            this.workerConfigured = true
        }

        const bytes = await file.arrayBuffer()
        const pdf = await pdfjs.getDocument({ data: bytes }).promise
        const page = await pdf.getPage(1)
        const viewport = page.getViewport({ scale: 1 })
        const scale = maxWidth / viewport.width
        const scaledViewport = page.getViewport({ scale })
        const canvas = document.createElement('canvas')
        const context = canvas.getContext('2d')
        if (!context) {
            throw new Error('Unable to render PDF thumbnail.')
        }

        canvas.width = Math.ceil(scaledViewport.width)
        canvas.height = Math.ceil(scaledViewport.height)
        await page.render({
            canvas,
            canvasContext: context,
            viewport: scaledViewport
        }).promise

        return canvas.toDataURL('image/jpeg', 0.82)
    }
}
