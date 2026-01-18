
import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

// POST /api/chats - Create new chat
export async function POST(request: Request) {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    // Parse JSON body if present, otherwise use defaults
    let title = 'New chat'
    let scope = 'all'
    let documentId = null

    try {
        const body = await request.json()
        title = body.title || title
        scope = body.scope || scope
        documentId = body.documentId || documentId
    } catch (e) {
        // No body or invalid JSON, use defaults
    }

    const { data, error } = await supabase
        .from('chats')
        .insert({
            user_id: user.id,
            title: title || 'New chat',
            scope: scope || 'all',
            document_id: documentId || null
        })
        .select()
        .single()

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ chatId: data.id, data })
}

// GET /api/chats - List chats
export async function GET() {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { data, error } = await supabase
        .from('chats')
        .select('*')
        .eq('user_id', user.id)
        .order('updated_at', { ascending: false })

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ data })
}
