
import { createClient } from '@supabase/supabase-js'
import dotenv from 'dotenv'

dotenv.config({ path: '.env.local' })

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

const supabase = createClient(supabaseUrl, supabaseServiceKey)

async function main() {
    console.log('=== JOBS ===')
    const { data: jobs } = await supabase
        .from('jobs')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(3)

    console.log(JSON.stringify(jobs, null, 2))

    console.log('\n=== DOCUMENTS ===')
    const { data: docs } = await supabase
        .from('documents')
        .select('id, name, status, error_message')
        .order('created_at', { ascending: false })
        .limit(3)

    console.log(JSON.stringify(docs, null, 2))
}
main()
