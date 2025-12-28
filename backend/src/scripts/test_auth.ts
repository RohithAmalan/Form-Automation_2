
import OpenAI from 'openai';
import dotenv from 'dotenv';
import path from 'path';

// Load .env from root
dotenv.config({ path: path.join(__dirname, '../../../.env') });

console.log("Checking API Key...");
if (!process.env.OPENROUTER_API_KEY) {
    console.error("❌ OPENROUTER_API_KEY is missing in .env");
    process.exit(1);
} else {
    console.log("✅ OPENROUTER_API_KEY is present (Length: " + process.env.OPENROUTER_API_KEY.length + ")");
}

const openai = new OpenAI({
    apiKey: process.env.OPENROUTER_API_KEY,
    baseURL: "https://openrouter.ai/api/v1",
});

async function test() {
    try {
        console.log("📡 Sending test request to OpenRouter...");
        const completion = await openai.chat.completions.create({
            model: "openai/gpt-4o-mini",
            messages: [{ role: "user", content: "Say hello" }],
        });
        console.log("✅ Success! Response:", completion.choices[0].message.content);
    } catch (e: any) {
        console.error("❌ Auth Failed:", e.message);
        if (e.status === 401) {
            console.error("👉 Solution: Your OPENROUTER_API_KEY is invalid. Please get a new one from https://openrouter.ai/keys and update .env");
        }
    }
}

test();
