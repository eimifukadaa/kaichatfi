
import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

export async function GET(request: Request, props: { params: Promise<{ id: string }> }) {
    const { id } = await props.params
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    // Verify chat ownership
    const { data: chat } = await supabase.from('chats').select('id').eq('id', id).eq('user_id', user.id).single()
    if (!chat) return NextResponse.json({ error: 'Chat not found' }, { status: 404 })

    const { data, error } = await supabase
        .from('messages')
        .select('*, citations(*)')
        .eq('chat_id', id)
        .order('created_at', { ascending: true })

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ data })
}
