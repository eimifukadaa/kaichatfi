
import { createClient } from '@supabase/supabase-js'
import dotenv from 'dotenv'

dotenv.config({ path: '.env.local' })

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

const supabase = createClient(supabaseUrl, supabaseServiceKey)

async function main() {
    // Get all error documents
    const { data: errorDocs } = await supabase
        .from('documents')
        .select('id, name, status')
        .eq('status', 'error')

    if (!errorDocs || errorDocs.length === 0) {
        console.log('No error documents found')
        return
    }

    console.log(`Found ${errorDocs.length} error documents. Resetting...`)

    for (const doc of errorDocs) {
        // Reset document to processing
        await supabase
            .from('documents')
            .update({
                status: 'processing',
                error_message: null,
                pages_total: 0,
                pages_done: 0
            })
            .eq('id', doc.id)

        // Create new job
        await supabase
            .from('jobs')
            .insert({
                document_id: doc.id,
                status: 'queued',
                stage: 'queued',
                attempts: 0
            })

        console.log(`✓ Reset: ${doc.name} (${doc.id})`)
    }

    console.log('\nAll documents reset and jobs created!')
}

main()
