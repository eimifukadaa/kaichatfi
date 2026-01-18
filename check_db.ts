
import { createClient } from '@supabase/supabase-js'
import dotenv from 'dotenv'

dotenv.config({ path: '.env.local' })

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

const supabase = createClient(supabaseUrl, supabaseServiceKey)

async function main() {
    const { data: docs, error } = await supabase
        .from('documents')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(5)

    if (error) {
        console.error('Error fetching docs:', error)
        return
    }

    console.log('Recent Documents:')
    docs.forEach(doc => {
        console.log(`- [${doc.status}] ${doc.name} (ID: ${doc.id})`)
        console.log(`  Error: ${doc.error_message}`)
        console.log(`  Pages: ${doc.pages_done}/${doc.pages_total}`)
    })

    const { data: jobs } = await supabase.from('jobs').select('*').limit(5)
    console.log('\nRecent Jobs:')
    jobs?.forEach(job => console.log(job))
}

main()
