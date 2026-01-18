
import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import { GoogleGenerativeAI } from '@google/generative-ai'

export async function POST(request: Request, props: { params: Promise<{ id: string }> }) {
    const { id: chatId } = await props.params
    const supabase = await createClient()

    // Safety check for supabase client
    if (!supabase) {
        return NextResponse.json({ error: 'Internal Server Error (Database)' }, { status: 500 })
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
        return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
    }

    if (!content) return NextResponse.json({ error: 'Content required' }, { status: 400 })

    // 1. Save User Message
    await supabase.from('messages').insert({
        chat_id: chatId,
        user_id: user.id,
        role: 'user',
        content
    })

    // 2. Retrieve Documents
    let chunks: any[] = []
    try {
        const { data } = await supabase
            .from('document_chunks')
            .select('content, page_number, documents!inner(name)')
            .textSearch('tsv', content, { type: 'websearch', config: 'simple' })
            .limit(10)
        chunks = data || []
    } catch (ragError) {
        console.error('RAG Error:', ragError)
    }

    // 3. Prompt Construction
    const contextText = chunks.length > 0
        ? chunks.map(c => `[Doc: ${c.documents?.name}, Hal: ${c.page_number}] ${c.content}`).join('\n\n')
        : 'No relevant document snippets found.'

    const systemPrompt = `You are PT.KAI AI CHAT. 
Answer the user based ONLY on the context below. 
If the answer isn't there, say you don't know. 
Be helpful, professional, and natural (like ChatGPT). 
Always answer in Indonesian.

CONTEXT:
${contextText}

USER: ${content}`

    // 4. Gemini Execution
    const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || '')
    const encoder = new TextEncoder()
    const stream = new ReadableStream({
        async start(controller) {
            let fullResponse = ''
            try {
                // Try the most stable model names
                const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash-latest' })
                const result = await model.generateContentStream(systemPrompt)

                for await (const chunk of result.stream) {
                    const text = chunk.text()
                    if (text) {
                        fullResponse += text
                        controller.enqueue(encoder.encode(text))
                    }
                }
            } catch (err: any) {
                console.error('Gemini Failure:', err)
                const errorMsg = "Maaf, asisten sedang mengalami gangguan teknis. Harap coba lagi nanti."
                fullResponse = errorMsg
                controller.enqueue(encoder.encode(errorMsg))
            }

            if (fullResponse) {
                await supabase.from('messages').insert({
                    chat_id: chatId,
                    user_id: user.id,
                    role: 'assistant',
                    content: fullResponse
                })
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
