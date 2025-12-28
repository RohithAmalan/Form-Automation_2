
import OpenAI from 'openai';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.join(__dirname, '../../../.env') });

const apiKey = process.env.OPENROUTER_API_KEY;
console.log(`[Test] Key Length: ${apiKey?.length}`);

const openai = new OpenAI({
    apiKey: apiKey,
    baseURL: "https://openrouter.ai/api/v1",
    defaultHeaders: {
        "HTTP-Referer": "http://localhost:3000",
        "X-Title": "FormAutomation",
    }
});

async function testVerbose() {
    console.log("Testing with JSON mode and prompts...");
    try {
        const completion = await openai.chat.completions.create({
            model: "openai/gpt-4o-mini",
            messages: [
                { role: "system", content: "You are a helpful automation assistant returning raw JSON." },
                { role: "user", content: "Generate a list of 3 fruits in JSON format: { fruits: [] }" }
            ],
            response_format: { type: "json_object" }
        });
        console.log("✅ Success!", completion.choices[0].message.content);
    } catch (e: any) {
        console.error("❌ Failed:", e);
        console.error("Headers:", e.headers);
    }
}

testVerbose();
