
import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import { GoogleGenerativeAI, HarmCategory, HarmBlockThreshold } from '@google/generative-ai'
import { v4 as uuidv4 } from 'uuid'

// Helper to clean OCR noise from context
function cleanText(text: string): string {
    if (!text) return ''
    // Remove repeated punctuation/noise like "......." or "-------" or "ssssss"
    text = text.replace(/([.\-_=s]){2,}/gi, ' ')
    // Remove repeated vowel patterns (OCR artifacts) like "aaaa"
    text = text.replace(/([aeiou])\1{2,}/gi, '$1')
    // Remove repeated consonant patterns like "ccccc"
    text = text.replace(/([bcdfghjklmnpqrstvwxyz])\1{2,}/gi, '$1')
    // Remove excessive whitespace
    return text.replace(/\s+/g, ' ').trim()
}

export async function POST(request: Request, props: { params: Promise<{ id: string }> }) {
    const { id: chatId } = await props.params
    const supabase = await createClient()

    // Initialize Gemini inside POST to ensure env vars are fresh
    const geminiKey = process.env.GEMINI_API_KEY || ''
    const genAI = new GoogleGenerativeAI(geminiKey)
    const { data: { user } } = await supabase!.auth.getUser()

    if (!user || !supabase) {
        console.error('[Stream] Unauthorized or missing client')
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    let content: string
    try {
        const body = await request.json()
        content = body.content
    } catch (e) {
        return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
    }

    if (!content) return NextResponse.json({ error: 'Content required' }, { status: 400 })

    console.log(`[Stream] Started for chat: ${chatId} by user: ${user.id}`)

    // 1. Save User Message (Fire and forget, but log errors)
    const { error: userMsgError } = await supabase.from('messages').insert({
        chat_id: chatId,
        user_id: user.id,
        role: 'user',
        content
    })
    if (userMsgError) console.warn('[Stream] Warning: Failed to save user message:', userMsgError.message)

    // 2. Retrieve Documents (RAG)
    let chunks: any[] = []
    try {
        const { data: chat, error: chatLookupError } = await supabase
            .from('chats')
            .select('scope, document_id')
            .eq('id', chatId)
            .single()

        if (chatLookupError) throw chatLookupError

        if (chat?.scope === 'document' && chat.document_id) {
            console.log(`[Stream] Searching doc: ${chat.document_id}`)
            const { data, error } = await supabase
                .from('document_chunks')
                .select('id, content, page_number, document_id')
                .eq('document_id', chat.document_id)
                .textSearch('tsv', content, { type: 'websearch', config: 'simple' })
                .limit(20)
            if (error) throw error
            chunks = data || []
        } else {
            console.log(`[Stream] Searching all docs for user`)
            const { data, error } = await supabase
                .from('document_chunks')
                .select('id, content, page_number, document_id, documents!inner(name)')
                .textSearch('tsv', content, { type: 'websearch', config: 'simple' })
                .limit(20)
            if (error) throw error
            chunks = data || []
        }
        console.log(`[Stream] RAG Context: Found ${chunks.length} chunks`)
    } catch (ragError: any) {
        console.error('[Stream] RAG Logic Failure:', ragError.message)
        // Continue without RAG context if search fails
    }

    // 3. Construct Context and Prompt
    const contextText = chunks.length > 0
        ? chunks.map((c) => `[DOC: ${c.documents?.name || 'Knowledge Base'}] [PAGE: ${c.page_number}] \n${cleanText(c.content)}`).join('\n\n')
        : 'No documents found for this query.'

    const systemPrompt = `Anda adalah PT.KAI AI CHAT, asisten cerdas dan ramah untuk karyawan KAI.
Tugas Anda adalah memberikan jawaban yang manusiawi, natural, dan akurat seperti ChatGPT.

Gunakan CONTEXT di bawah sebagai referensi utama. 
Jika CONTEXT mengandung banyak noise (seperti "sssss" atau karakter aneh hasil scan), abaikan noise tersebut dan gunakan pengetahuan Anda untuk merapikan informasi bagi pengguna.
Jika Anda sudah tahu definisinya (seperti arti "KRL"), sampaikan dengan bahasa yang profesional namun tetap mudah dimengerti.

JANGAN memberikan jawaban robotic. Berikan penjelasan yang lengkap.

CONTEXT:
${contextText}

USER QUERY:
${content}`

    const getGeminiResult = async (prompt: string) => {
        const models = [
            'gemini-1.5-flash',
            'gemini-1.5-flash-latest',
            'gemini-2.0-flash',
            'gemini-2.0-flash-001',
            'gemini-1.5-pro',
            'gemini-pro',
            'gemini-1.5-pro-latest'
        ]
        let lastError = null

        if (!geminiKey) {
            throw new Error('GEMINI_API_KEY is missing')
        }

        for (const modelName of models) {
            try {
                console.log(`[Gemini] Attempting ${modelName}...`)
                const model = genAI.getGenerativeModel({
                    model: modelName,
                    safetySettings: [
                        { category: HarmCategory.HARM_CATEGORY_HARASSMENT, threshold: HarmBlockThreshold.BLOCK_NONE },
                        { category: HarmCategory.HARM_CATEGORY_HATE_SPEECH, threshold: HarmBlockThreshold.BLOCK_NONE },
                        { category: HarmCategory.HARM_CATEGORY_SEXUALLY_EXPLICIT, threshold: HarmBlockThreshold.BLOCK_NONE },
                        { category: HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT, threshold: HarmBlockThreshold.BLOCK_NONE }
                    ]
                })
                const result = await model.generateContentStream(prompt)
                return { result, modelName }
            } catch (err: any) {
                console.warn(`[Gemini] ${modelName} failed:`, err.message)
                lastError = err
            }
        }
        throw lastError
    }

    const encoder = new TextEncoder()
    const stream = new ReadableStream({
        async start(controller) {
            let fullResponse = ''

            try {
                // Update title if it's "New chat" (auto-titling)
                const { data: currentChat } = await supabase.from('chats').select('title').eq('id', chatId).single()
                if (currentChat?.title === 'New chat' || currentChat?.title === 'New Chat') {
                    const newTitle = content.substring(0, 40) + (content.length > 40 ? '...' : '')
                    await supabase.from('chats').update({ title: newTitle }).eq('id', chatId)
                    console.log(`[Stream] Updated chat title to: ${newTitle}`)
                }

                const { result, modelName } = await getGeminiResult(systemPrompt)
                console.log(`[Gemini] Using model ${modelName} for streaming`)

                for await (const chunk of result.stream) {
                    try {
                        const text = chunk.text()
                        if (text) {
                            fullResponse += text
                            controller.enqueue(encoder.encode(text))
                        }
                    } catch (e) {
                        console.warn('[Gemini] Chunk parsing error, skipping...')
                    }
                }
            } catch (err: any) {
                console.error('[Gemini] Final Service Error - Falling back to natural PDF answer:', err.message || err)

                if (chunks.length > 0) {
                    // Find the most relevant paragraph (usually the first chunk)
                    const topChunk = chunks[0]
                    const cleanedContent = cleanText(topChunk.content)

                    fullResponse = `Berdasarkan dokumen KAI, berikut adalah penjelasan yang ditemukan:\n\n**${cleanedContent}**\n\n*(Info ini diambil langsung dari dokumen ${topChunk.documents?.name || 'KAI'} hal. ${topChunk.page_number} karena layanan AI sedang dalam pemeliharaan)*`
                } else {
                    fullResponse = `Maaf, saya tidak dapat menemukan informasi tersebut dalam dokumen KAI. Silakan coba tanyakan detail lainnya.`
                }

                controller.enqueue(encoder.encode(fullResponse))
            }

            if (fullResponse.trim()) {
                try {
                    console.log(`[Stream] Saving assistant response (${fullResponse.length} chars)`)
                    const { data: msg, error: saveError } = await supabase.from('messages').insert({
                        chat_id: chatId,
                        user_id: user.id,
                        role: 'assistant',
                        content: fullResponse
                    }).select().single()

                    if (saveError) {
                        console.error('[Stream] Failed to save assistant message:', saveError.message)
                    } else if (msg && chunks.length > 0) {
                        // Save top chunks as citations
                        const topChunks = chunks.slice(0, 3)
                        const citations = topChunks.map(c => ({
                            message_id: msg.id,
                            document_id: c.document_id,
                            page_number: c.page_number,
                            snippet: c.content.substring(0, 200),
                            chunk_id: c.id
                        }))
                        const { error: citeError } = await supabase.from('citations').insert(citations)
                        if (citeError) console.warn('[Stream] Failed to save citations:', citeError.message)
                    }
                } catch (saveCatchError) {
                    console.error('[Stream] Critical error saving message:', saveCatchError)
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

