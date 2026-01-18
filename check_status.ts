
import { createClient } from '@supabase/supabase-js'
import dotenv from 'dotenv'

dotenv.config({ path: '.env.local' })

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

const supabase = createClient(supabaseUrl, supabaseServiceKey)

async function main() {
    const { data: docs } = await supabase
        .from('documents')
        .select('name, status, error_message, pages_total, pages_done')
        .order('updated_at', { ascending: false })
        .limit(1)

    if (docs && docs.length > 0) {
        console.log(JSON.stringify(docs[0], null, 2))
    } else {
        console.log('{}')
    }
}
main()
