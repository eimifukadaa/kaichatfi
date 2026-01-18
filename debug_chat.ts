
import { createClient } from '@supabase/supabase-js'
import dotenv from 'dotenv'

dotenv.config({ path: '.env.local' })

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

const supabase = createClient(supabaseUrl, supabaseServiceKey)

async function main() {
    const chatId = 'e819d9cc-7f95-439e-87d7-f7be116e5814' // From user screenshot

    console.log('--- Checking Chat ---')
    const { data: chat, error: chatError } = await supabase
        .from('chats')
        .select('*')
        .eq('id', chatId)
        .single()

    if (chatError) console.error('Chat error:', chatError)
    else console.log('Chat:', JSON.stringify(chat, null, 2))

    console.log('\n--- Checking Messages ---')
    const { data: messages, error: msgError } = await supabase
        .from('messages')
        .select('*')
        .eq('chat_id', chatId)
        .order('created_at', { ascending: false })
        .limit(5)

    if (msgError) console.error('Messages error:', msgError)
    else console.log('Last messages:', JSON.stringify(messages, null, 2))

    console.log('\n--- Testing Search Logic ---')
    const content = 'KRL'
    const { data: chunks, error: searchError } = await supabase
        .from('document_chunks')
        .select('id, content, page_number, document_id, documents!inner(name)')
        .textSearch('tsv', content, { type: 'websearch', config: 'english' })
        .limit(5)

    if (searchError) console.error('Search error:', searchError)
    else {
        console.log('Search results count:', chunks?.length)
        if (chunks && chunks.length > 0) {
            console.log('First chunk:', JSON.stringify(chunks[0], null, 2))
        }
    }
}
main()
