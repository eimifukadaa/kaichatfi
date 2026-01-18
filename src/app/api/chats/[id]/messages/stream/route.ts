
import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import { GoogleGenerativeAI } from '@google/generative-ai'

// 🧹 CLEANER: Removes OCR noise like "sssss", "....", "-------"
function cleanOCR(text: string): string {
    if (!text) return ''
    // Remove repeated non-alphanumeric junk characters (3+ times)
    let cleaned = text.replace(/([^a-zA-Z0-9\s])\1{2,}/g, ' ')
    // Remove repeated letters like "sssss"
    cleaned = cleaned.replace(/([a-zA-Z])\1{4,}/gi, '$1')
    // Remove excessive whitespace
    return cleaned.replace(/\s+/g, ' ').trim()
}

// Stable model configuration
const MODEL_NAME = 'gemini-1.5-flash'

export async function POST(request: Request, props: { params: Promise<{ id: string }> }) {
    const { id: chatId } = await props.params
    const supabase = await createClient()

    if (!supabase) {
        console.error('[Stream] CRITICAL: Supabase client is null')
        return NextResponse.json({ error: 'Database connection failed' }, { status: 500 })
    }

    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    let content: string
    try {
        const body = await request.json()
        content = body.content
    } catch (e) {
        return NextResponse.json({ error: 'Invalid request' }, { status: 400 })
    }

    if (!content) return NextResponse.json({ error: 'Message content is empty' }, { status: 400 })

    // 1. Save User Message
    await supabase.from('messages').insert({
        chat_id: chatId,
        user_id: user.id,
        role: 'user',
        content
    })

    // 2. Search PDF Documents (RAG)
    let chunks: any[] = []
    try {
        const { data } = await supabase
            .from('document_chunks')
            .select('id, content, page_number, document_id, documents!inner(name)')
            .textSearch('tsv', content, { type: 'websearch', config: 'simple' })
            .limit(10)
        chunks = data || []
    } catch (ragError) {
        console.error('Search error:', ragError)
    }

    const contextText = chunks.length > 0
        ? chunks.map(c => `[Dokumen: ${c.documents?.name}, Hal: ${c.page_number}] ${cleanOCR(c.content)}`).join('\n\n')
        : 'Tidak ada konteks dokumen yang ditemukan.'

    const systemPrompt = `Anda adalah asisten cerdas PT.KAI (ChatGPT-style). 
Nama Anda adalah PT.KAI AI CHAT. 

INSTRUKSI:
1. Jawablah pertanyaan pengguna dengan gaya bahasa yang santai, profesional, dan sangat manusiawi (TIDAK ROBOTIC).
2. Gunakan DATA DOKUMEN di bawah sebagai sumber utama.
3. Jika dokumen berantakan (banyak karakter aneh), gunakan kecerdasan Anda untuk merapikannya sehingga pengguna mendapat jawaban yang jelas.
4. Jika Anda tidak tahu, katakan sejujurnya dengan sopan.
5. Jawab dalam Bahasa Indonesia yang baik.

DATA DOKUMEN:
${contextText}

PERTANYAAN PENGGUNA: 
${content}`

    // 4. Gemini Execution with Multi-Model Fallback
    const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || '')
    const encoder = new TextEncoder()
    const stream = new ReadableStream({
        async start(controller) {
            let fullResponse = ''
            const modelsToTry = ['gemini-1.5-flash', 'gemini-1.5-flash-latest', 'gemini-pro']
            let success = false

            for (const modelName of modelsToTry) {
                if (success) break
                try {
                    console.log(`[Gemini] Mencoba model: ${modelName}`)
                    const model = genAI.getGenerativeModel({ model: modelName })
                    const result = await model.generateContentStream(systemPrompt)

                    for await (const chunk of result.stream) {
                        const text = chunk.text()
                        if (text) {
                            fullResponse += text
                            controller.enqueue(encoder.encode(text))
                        }
                    }
                    success = true
                    console.log(`[Gemini] Berhasil menggunakan model: ${modelName}`)
                } catch (err: any) {
                    console.warn(`[Gemini] Gagal dengan model ${modelName}:`, err.message || err)
                }
            }

            if (!success) {
                console.error('[Gemini] SEMUA MODEL GAGAL! Menggunakan Human-Fallback...')
                // fallback natural, bukan robot
                const firstHit = chunks[0]
                const rawText = firstHit ? cleanOCR(firstHit.content) : ''
                const fallbackMsg = firstHit
                    ? `Berdasarkan dokumen KAI (${firstHit.documents?.name}), ini adalah informasi yang saya temukan:\n\n${rawText}\n\n*(Layanan AI sedang gangguan, saya menampilkan teks langsung dari dokumen)*`
                    : "Maaf, saat ini saya tidak dapat memproses jawaban Anda karena gangguan teknis. Silakan coba lagi nanti."

                fullResponse = fallbackMsg
                controller.enqueue(encoder.encode(fallbackMsg))
            }

            // 5. Save assistant response and citations
            if (fullResponse) {
                const { data: msg } = await supabase.from('messages').insert({
                    chat_id: chatId,
                    user_id: user.id,
                    role: 'assistant',
                    content: fullResponse
                }).select().single()

                if (msg && chunks.length > 0) {
                    const citations = chunks.slice(0, 3).map(c => ({
                        message_id: msg.id,
                        document_id: c.document_id,
                        page_number: c.page_number,
                        snippet: c.content.substring(0, 200),
                        chunk_id: c.id
                    }))
                    await supabase.from('citations').insert(citations)
                }
            }
            controller.close()
        }
    })

    return new NextResponse(stream, {
        headers: {
            'Content-Type': 'text/event-stream',
            'Cache-Control': 'no-cache',
            'Connection': 'keep-alive',
        },
    })
}
