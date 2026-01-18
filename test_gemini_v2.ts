
import { GoogleGenerativeAI } from '@google/generative-ai'
import dotenv from 'dotenv'

dotenv.config({ path: '.env.local' })

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || '')

async function testModel(modelName: string) {
    console.log(`Testing model: ${modelName}`)
    const model = genAI.getGenerativeModel({ model: modelName })
    try {
        const result = await model.generateContent('Say hello in Indonesian')
        console.log(`✓ ${modelName} Success:`, result.response.text())
        return true
    } catch (err: any) {
        console.log(`✗ ${modelName} Failure:`, err.message || err.statusText || err)
        if (err.status) console.log(`   Status: ${err.status}`)
        return false
    }
}

async function main() {
    console.log('--- Gemini Connectivity Test ---')
    console.log('API Key length:', process.env.GEMINI_API_KEY?.length || 0)

    await testModel('gemini-1.5-flash')
    await testModel('gemini-1.5-flash-latest')
    await testModel('gemini-pro')
}
main()
