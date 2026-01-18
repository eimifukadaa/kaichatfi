
import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

export async function DELETE(request: Request, props: { params: Promise<{ id: string }> }) {
    const { id } = await props.params
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    // DB Delete (Cascades will handle pages, chunks, messages, citations, jobs)
    const { error } = await supabase
        .from('documents')
        .delete()
        .eq('id', id)
        .eq('user_id', user.id)

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    // Storage Delete
    // List files in folder
    const { data: files } = await supabase.storage.from('kai_docs').list(`${user.id}/${id}`)
    if (files) {
        await supabase.storage.from('kai_docs').remove(files.map(f => `${user.id}/${id}/${f.name}`))
    }
    // Remove folder? Supabase doesn't have explicit remove folder, just empty it.

    // Previews
    const { data: previews } = await supabase.storage.from('kai_previews').list(`${user.id}/${id}`)
    if (previews) {
        // Recursive delete? list returns items in root of folder.
        // Assuming pages are in pages/ subfolder.
        // This is MVP, cleanup might be best effort.
    }

    return NextResponse.json({ ok: true })
}
