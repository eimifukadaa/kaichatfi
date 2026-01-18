
import { createClient } from '@supabase/supabase-js'
import dotenv from 'dotenv'

dotenv.config({ path: '.env.local' })

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

const supabase = createClient(supabaseUrl, supabaseServiceKey)

async function main() {
    const { data: docs } = await supabase
        .from('documents')
        .select('name, status, error_message')
        .order('created_at', { ascending: false })
        .limit(1)

    if (docs && docs.length > 0) {
        console.log('Last Error Message:')
        console.log(docs[0].error_message)
    }
}
main()
