
import { createClient } from '@supabase/supabase-js'
import * as fs from 'fs'
import * as path from 'path'
import * as os from 'os'
import { v4 as uuidv4 } from 'uuid'
import * as mammoth from 'mammoth'
import Tesseract from 'tesseract.js'
import dotenv from 'dotenv'
import { createRequire } from 'module';

dotenv.config({ path: '.env.local' })

const require = createRequire(import.meta.url);
const Canvas = require('canvas');
import { pathToFileURL } from 'url';


// Polyfill Image for PDF.js - CRITICAL for v3
// @ts-ignore
global.Image = Canvas.Image;
// @ts-ignore
global.createCanvas = Canvas.createCanvas;

// Import pdfjs-dist v3 (CommonJS)
const pdfjsLib = require('pdfjs-dist/legacy/build/pdf.js')
pdfjsLib.GlobalWorkerOptions.workerSrc = require.resolve('pdfjs-dist/legacy/build/pdf.worker.js')


// --- NodeCanvasFactory Adapter for PDF.js ---
class NodeCanvasFactory {
    create(width: number, height: number) {
        const canvas = Canvas.createCanvas(width, height);
        const context = canvas.getContext("2d");
        return {
            canvas: canvas,
            context: context,
        };
    }

    reset(canvasAndContext: any, width: number, height: number) {
        canvasAndContext.canvas.width = width;
        canvasAndContext.canvas.height = height;
    }

    destroy(canvasAndContext: any) {
        canvasAndContext.canvas.width = 0;
        canvasAndContext.canvas.height = 0;
        canvasAndContext.canvas = null;
        canvasAndContext.context = null;
    }
}
// --------------------------------------------

// --- INLINED TYPES ---
export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[]
export interface Database {
    public: {
        Tables: {
            documents: {
                Row: {
                    id: string
                    user_id: string
                    storage_path: string
                    file_type: 'pdf' | 'docx' | 'txt'
                    status: 'uploading' | 'processing' | 'ready' | 'error'
                    ocr_language: string
                    enhanced_ocr: boolean
                    name: string
                    pages_total: number
                    pages_done: number
                    error_message: string | null
                }
            }
            document_pages: {
                Row: {}
            }
            document_chunks: {
                Row: {}
            }
            jobs: {
                Row: {
                    id: string
                    document_id: string
                    attempts: number
                }
            }
        }
    }
}
// --------------------

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

if (!supabaseUrl || !supabaseServiceKey) {
    console.error("Missing Supabase URL or Key in .env.local")
    process.exit(1)
}

const supabase = createClient<Database>(supabaseUrl, supabaseServiceKey)
const db: any = supabase

const CHUNK_SIZE = 1500
const CHUNK_OVERLAP = 200

async function main() {
    console.log('Worker started. Polling for jobs...')

    while (true) {
        try {
            await processNextJob()
        } catch (error) {
            console.error('Error in worker loop:', error)
        }
        // Sleep 2 seconds
        await new Promise(resolve => setTimeout(resolve, 2000))
    }
}

async function processNextJob() {
    const response = await db
        .from('jobs')
        .select('*, documents(*)')
        .eq('status', 'queued')
        .order('created_at', { ascending: true })
        .limit(1)
        .single()

    const job = response.data
    const error = response.error

    if (error || !job) return

    console.log(`Processing job ${job.id} for doc ${job.documents?.name}`)

    await db.from('jobs').update({ status: 'running', attempts: (job.attempts || 0) + 1 }).eq('id', job.id)

    try {
        const doc = job.documents
        if (!doc) throw new Error('Document not found')

        const fileExt = doc.file_type
        const tempFilePath = path.join(os.tmpdir(), `${doc.id}.${fileExt}`)

        const { data: fileData, error: downloadError } = await db
            .storage
            .from('kai_docs')
            .download(doc.storage_path)

        if (downloadError) throw downloadError

        const buffer = Buffer.from(await fileData.arrayBuffer())
        fs.writeFileSync(tempFilePath, buffer)

        let pages: { pageNumber: number, text: string, scanned: boolean, imagePath?: string | null }[] = []

        if (fileExt === 'pdf') {
            pages = await processPdf(doc.id, doc.user_id, tempFilePath, doc.ocr_language, doc.enhanced_ocr)
        } else if (fileExt === 'docx') {
            const result = await mammoth.extractRawText({ path: tempFilePath })
            pages = [{ pageNumber: 1, text: result.value, scanned: false, imagePath: null }]
        } else if (fileExt === 'txt') {
            const text = fs.readFileSync(tempFilePath, 'utf-8')
            pages = [{ pageNumber: 1, text: text, scanned: false, imagePath: null }]
        }

        for (const page of pages) {
            await db.from('document_pages').insert({
                document_id: doc.id,
                page_number: page.pageNumber,
                text: page.text,
                scanned: page.scanned,
                preview_image_path: page.imagePath || null
            })
        }

        let totalChunks = 0

        for (const page of pages) {
            const chunks = createChunks(page.text, CHUNK_SIZE, CHUNK_OVERLAP)
            for (let i = 0; i < chunks.length; i++) {
                await db.from('document_chunks').insert({
                    document_id: doc.id,
                    page_number: page.pageNumber,
                    chunk_index: i,
                    content: chunks[i],
                    content_preview: chunks[i].substring(0, 100).replace(/\n/g, ' ') + '...'
                })
                totalChunks++
            }
        }

        await db.from('documents').update({
            status: 'ready',
            pages_total: pages.length,
            pages_done: pages.length
        }).eq('id', doc.id)

        await db.from('jobs').update({ status: 'done' }).eq('id', job.id)
        console.log(`Job ${job.id} done. ${totalChunks} chunks created.`)

        if (fs.existsSync(tempFilePath)) fs.unlinkSync(tempFilePath)

    } catch (err: any) {
        console.error(`Job failed: ${err.message}`)
        await db.from('documents').update({ status: 'error', error_message: err.message }).eq('id', job.document_id)
        await db.from('jobs').update({ status: 'error', last_error: err.message }).eq('id', job.id)
    }
}

async function processPdf(docId: string, userId: string, filePath: string, lang: string, enhancedOcr: boolean) {
    const data = new Uint8Array(fs.readFileSync(filePath))

    console.log(`[Worker] Processing PDF with ${data.length} bytes`);


    const loadingTask = pdfjsLib.getDocument({
        data: data,
        cMapUrl: 'node_modules/pdfjs-dist/cmaps/',
        cMapPacked: true,
        standardFontDataUrl: 'node_modules/pdfjs-dist/standard_fonts/',
        canvasFactory: new NodeCanvasFactory()
    })

    const pdfDocument = await loadingTask.promise
    const numPages = pdfDocument.numPages
    const pages = []

    for (let i = 1; i <= numPages; i++) {
        const page = await pdfDocument.getPage(i)
        const textContent = await page.getTextContent()
        const textItems = textContent.items.map((item: any) => item.str).join(' ')

        let finalText = textItems
        let isScanned = false
        let previewPath: string | null = null

        // Detect scanned
        if (textItems.trim().length < 50) {
            isScanned = true
            console.log(`Page ${i}/${numPages} [SCANNED]. Processing...`)

            const viewport = page.getViewport({ scale: 2.0 })
            const canvasFactory = new NodeCanvasFactory()
            const { canvas, context } = canvasFactory.create(viewport.width, viewport.height)

            await page.render({
                canvasContext: context as any,
                viewport: viewport,
                canvasFactory: canvasFactory as any
            } as any).promise

            let buffer = canvas.toBuffer('image/jpeg')

            if (enhancedOcr) {
                console.log(`- Enhancing image logic...`)
                const imgData = (context as any).getImageData(0, 0, canvas.width, canvas.height)
                const d = imgData.data
                for (let j = 0; j < d.length; j += 4) {
                    const avg = (d[j] + d[j + 1] + d[j + 2]) / 3
                    d[j] = d[j + 1] = d[j + 2] = avg
                }
                (context as any).putImageData(imgData, 0, 0)
                buffer = canvas.toBuffer('image/jpeg')
            }

            const previewName = `${userId}/${docId}/pages/${i}.jpg`
            await db.storage.from('kai_previews').upload(previewName, buffer, { contentType: 'image/jpeg', upsert: true })
            previewPath = previewName

            try {
                const { data: { text: ocrText } } = await Tesseract.recognize(buffer, 'eng')
                finalText = ocrText
            } catch (e) {
                console.error("OCR Failed", e)
                finalText = "[OCR Failed]"
            }
        } else {
            console.log(`Page ${i}/${numPages} [TEXT]. Extracted ${finalText.length} chars.`)
        }

        pages.push({
            pageNumber: i,
            text: finalText || '',
            scanned: isScanned,
            imagePath: previewPath
        })
    }
    return pages
}

function createChunks(text: string, size: number, overlap: number) {
    if (!text) return []
    const chunks = []
    let start = 0
    while (start < text.length) {
        const end = Math.min(start + size, text.length)
        chunks.push(text.slice(start, end))
        if (end === text.length) break
        start += (size - overlap)
    }
    return chunks
}

main().catch(console.error)
