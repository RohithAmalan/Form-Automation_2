import dotenv from 'dotenv';
import path from 'path';

// Load .env from Root (../../.env relative to src/)
console.log("🔌 Loading Environment Variables...");
const result = dotenv.config({ path: path.join(__dirname, '../../.env') });

if (result.error) {
    console.error("❌ Failed to load .env file:", result.error);
} else {
    // console.log("✅ Environment Variables Loaded.");
}
