
import { GoogleGenerativeAI } from '@google/generative-ai'
import dotenv from 'dotenv'

dotenv.config({ path: '.env.local' })

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || '')
const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' })

async function main() {
    console.log('Testing Gemini API...')
    try {
        const result = await model.generateContent('Say hello in Indonesian')
        console.log('Response:', result.response.text())
    } catch (err: any) {
        console.error('Gemini Error:', JSON.stringify(err, null, 2))
    }
}
main()
