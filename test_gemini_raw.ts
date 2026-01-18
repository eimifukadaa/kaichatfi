
import dotenv from 'dotenv'
dotenv.config({ path: '.env.local' })

async function checkModel(url: string, label: string) {
    try {
        const response = await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                contents: [{ parts: [{ text: 'Hi' }] }]
            })
        })
        const data = await response.json()
        console.log(`[${label}] Status: ${response.status}`, data.candidates ? '✓ SUCCESS' : '✗ FAILED')
        if (!data.candidates) console.log(`   Error: ${data.error?.message || 'Unknown'}`)
    } catch (e) {
        console.log(`[${label}] Fetch Error`)
    }
}

async function testAll() {
    const key = process.env.GEMINI_API_KEY
    const models = ['gemini-1.5-flash', 'gemini-1.5-pro', 'gemini-pro']
    const versions = ['v1', 'v1beta']

    for (const v of versions) {
        for (const m of models) {
            await checkModel(`https://generativelanguage.googleapis.com/${v}/models/${m}:generateContent?key=${key}`, `${v}/${m}`)
        }
    }
}

testAll()
