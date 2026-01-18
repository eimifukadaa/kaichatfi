
import { createClient } from '@supabase/supabase-js'
import dotenv from 'dotenv'

dotenv.config({ path: '.env.local' })

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

const supabase = createClient(supabaseUrl, supabaseServiceKey)

async function main() {
    // 1. Find failed jobs
    const { data: jobs, error } = await supabase
        .from('jobs')
        .select('*')
        .eq('status', 'error')

    if (jobs && jobs.length > 0) {
        console.log(`Found ${jobs.length} failed jobs. Resetting...`)

        for (const job of jobs) {
            // Reset Job
            await supabase.from('jobs').update({ status: 'queued', attempts: 0 }).eq('id', job.id)

            // Reset Document
            await supabase.from('documents').update({ status: 'processing', error_message: null }).eq('id', job.document_id)

            console.log(`Reset Job ${job.id} (Doc ${job.document_id})`)
        }
    } else {
        console.log('No failed jobs found to reset.')
    }
}

main()
