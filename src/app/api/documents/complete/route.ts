
import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

export async function POST(request: Request) {
    const supabase = await createClient()

    const {
        data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { documentId } = await request.json()

    if (!documentId) {
        return NextResponse.json({ error: 'Missing documentId' }, { status: 400 })
    }

    // Verify ownership
    const { data: doc, error: docError } = await supabase
        .from('documents')
        .select('id')
        .eq('id', documentId)
        .eq('user_id', user.id)
        .single()

    if (docError || !doc) {
        return NextResponse.json({ error: 'Document not found' }, { status: 404 })
    }

    // Update status to processing
    const { error: updateError } = await supabase
        .from('documents')
        .update({ status: 'processing' })
        .eq('id', documentId)

    if (updateError) {
        return NextResponse.json({ error: updateError.message }, { status: 500 })
    }

    // Create Job
    const { error: jobError } = await supabase
        .from('jobs')
        .insert({
            document_id: documentId,
            user_id: user.id,
            status: 'queued',
            stage: 'queued'
        })

    if (jobError) {
        return NextResponse.json({ error: jobError.message }, { status: 500 })
    }

    return NextResponse.json({ ok: true })
}
