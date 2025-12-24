import { Pool } from 'pg';
import dotenv from 'dotenv';
import path from 'path';

// Load .env from project root logic
dotenv.config({ path: path.join(__dirname, '../../../.env') });

const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
});

async function clearJobs() {
    try {
        console.log("🗑️  Clearing all jobs and logs...");

        // jobs table has ON DELETE CASCADE for logs usually, or logs references jobs
        // Let's check schema. If logs references jobs with ON DELETE CASCADE, deleting jobs is enough.
        // Schema: job_id UUID REFERENCES jobs(id) ON DELETE CASCADE

        const res = await pool.query('DELETE FROM jobs');
        console.log(`✅ Deleted ${res.rowCount} jobs.`);

        process.exit(0);
    } catch (err) {
        console.error("❌ Failed to clear jobs:", err);
        process.exit(1);
    }
}

clearJobs();
