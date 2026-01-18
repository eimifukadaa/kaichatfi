
import { createClient } from '@supabase/supabase-js'
import dotenv from 'dotenv'

dotenv.config({ path: '.env.local' })

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

const supabase = createClient(supabaseUrl, supabaseServiceKey)

async function main() {
    console.log('Testing worker query WITHOUT .single()...')

    const response = await supabase
        .from('jobs')
        .select('*, documents(*)')
        .eq('status', 'queued')
        .order('created_at', { ascending: true })
        .limit(1)

    console.log('Response:', JSON.stringify(response, null, 2))

    if (response.data && response.data.length > 0) {
        console.log('\nFound job:', response.data[0].id)
        console.log('Document:', response.data[0].documents?.name)
    }
}
main()
