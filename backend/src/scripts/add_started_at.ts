import pool from '../config/db';

async function migrate() {
    console.log("Running Migration: Add started_at to jobs table...");
    try {
        await pool.query("ALTER TABLE jobs ADD COLUMN IF NOT EXISTS started_at TIMESTAMP;");
        console.log("✅ Migration successful: started_at column added.");
    } catch (e: any) {
        console.error("❌ Migration failed:", e.message);
    } finally {
        await pool.end();
    }
}

migrate();
