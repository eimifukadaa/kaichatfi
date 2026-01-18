
import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import { GoogleGenerativeAI } from '@google/generative-ai'

// Stable model configuration
const MODEL_NAME = 'gemini-1.5-flash'

export async function POST(request: Request, props: { params: Promise<{ id: string }> }) {
    const { id: chatId } = await props.params
    const supabase = await createClient()

    if (!supabase) {
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

    // 3. Prompt for Human-like response
    const contextText = chunks.length > 0
        ? chunks.map(c => `[Dokumen: ${c.documents?.name}, Hal: ${c.page_number}] ${c.content}`).join('\n\n')
        : 'Tidak ada dokumen yang relevan ditemukan.'

    const systemPrompt = `Anda adalah PT.KAI AI CHAT. 
Tugas Anda adalah menjawab pertanyaan pengguna secara natural dan profesional dalam Bahasa Indonesia, persis seperti ChatGPT.

Gunakan data dokumen di bawah sebagai referensi utama untuk menjawab. 
Jika ada informasi yang kurang jelas di dokumen, gunakan pengetahuan umum Anda untuk melengkapi jawaban agar enak dibaca oleh manusia.

JANGAN memberikan jawaban robotic atau daftar kaku. Berikan penjelasan yang mengalir.

DATA DOKUMEN:
${contextText}

PERTANYAAN: ${content}`

    // 4. Stream Response from Gemini
    const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || '')
    const encoder = new TextEncoder()
    const stream = new ReadableStream({
        async start(controller) {
            let fullResponse = ''
            try {
                const model = genAI.getGenerativeModel({ model: MODEL_NAME })
                const result = await model.generateContentStream(systemPrompt)

                for await (const chunk of result.stream) {
                    const text = chunk.text()
                    if (text) {
                        fullResponse += text
                        controller.enqueue(encoder.encode(text))
                    }
                }
            } catch (err: any) {
                console.error('Gemini Error:', err)
                // If Gemini fails, give a natural fallback, NOT a robotic list
                const naturalFallback = `Berdasarkan dokumen KAI, ${chunks.length > 0 ? chunks[0].content : "informasi tersebut tidak ditemukan secara spesifik"}. Silakan coba tanyakan hal lain.`
                fullResponse = naturalFallback
                controller.enqueue(encoder.encode(naturalFallback))
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
