
import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import { v4 as uuidv4 } from 'uuid'

export async function POST(request: Request) {
    const supabase = await createClient()

    const {
        data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const { name, fileType, ocrLanguage, ocrProvider, enhancedOcr } = body

    if (!name || !fileType) {
        return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
    }

    // Define storage path
    // kai_docs/{user_id}/{document_id}/original.{ext}
    const documentId = uuidv4()
    const ext = fileType === 'pdf' ? 'pdf' : fileType === 'docx' ? 'docx' : 'txt'
    const storagePath = `${user.id}/${documentId}/original.${ext}`

    // Create document record
    const { data, error } = await supabase
        .from('documents')
        .insert({
            id: documentId,
            user_id: user.id,
            name,
            file_type: fileType,
            storage_path: storagePath,
            status: 'uploading',
            ocr_language: ocrLanguage || 'ind+eng',
            ocr_provider: ocrProvider || 'tesseract',
            enhanced_ocr: enhancedOcr !== false,
        })
        .select()
        .single()

    if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 })
    }

    // Generate Signed Upload URL
    const { data: uploadData, error: uploadError } = await supabase
        .storage
        .from('kai_docs')
        .createSignedUploadUrl(storagePath)

    if (uploadError) {
        // Rollback document creation if possible or just fail
        await supabase.from('documents').delete().eq('id', documentId)
        return NextResponse.json({ error: uploadError.message }, { status: 500 })
    }

    return NextResponse.json({
        documentId: data.id,
        storagePath: data.storage_path,
        uploadUrl: uploadData.signedUrl,
        token: uploadData.token // Supabase might require token with upload
    })
}
