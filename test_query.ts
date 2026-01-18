
import { createClient } from '@supabase/supabase-js'
import dotenv from 'dotenv'

dotenv.config({ path: '.env.local' })

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

const supabase = createClient(supabaseUrl, supabaseServiceKey)

async function main() {
    console.log('Testing worker query...')

    const response = await supabase
        .from('jobs')
        .select('*, documents(*)')
        .eq('status', 'queued')
        .order('created_at', { ascending: true })
        .limit(1)
        .single()

    console.log('Response:', JSON.stringify(response, null, 2))
}
main()
