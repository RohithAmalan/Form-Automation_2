import { Pool } from 'pg';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.join(__dirname, '../../../.env') });

const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
});

async function checkData() {
    try {
        console.log("🔍 Checking Database Content...\n");

        // 1. Check Profiles
        const profiles = await pool.query('SELECT id, name, payload, created_at FROM profiles');
        console.log(`--- PROFILES (${profiles.rowCount}) ---`);
        profiles.rows.forEach(p => {
            console.log(`\n👤 PROFILE: [${p.name}] (ID: ${p.id})`);
            console.log("👇 DATA:");
            console.log(JSON.stringify(p.payload, null, 2));
        });
        console.log("");

        // 2. Check Jobs
        const jobs = await pool.query('SELECT id, url, status, form_name, created_at FROM jobs ORDER BY created_at DESC LIMIT 5');
        console.log(`--- RECENT JOBS (Last 5) ---`);
        jobs.rows.forEach(j => {
            console.log(`[${j.status}] ${j.form_name || 'Untitled'} - ${j.url} (ID: ${j.id})`);
        });
        console.log("");

        // 3. Check Logs (Most recent)
        const logs = await pool.query('SELECT action_type, message, timestamp FROM logs ORDER BY timestamp DESC LIMIT 5');
        console.log(`--- RECENT LOGS (Last 5) ---`);
        logs.rows.forEach(l => {
            console.log(`[${l.action_type}] ${l.message}`);
        });

        process.exit(0);
    } catch (err) {
        console.error("❌ Error checking data:", err);
        process.exit(1);
    }
}

checkData();
