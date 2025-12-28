import pool from '../config/db';

async function migrate() {
    console.log("📦 Migrating DB: Adding 'type' to jobs table...");
    try {
        await pool.query(`
            ALTER TABLE jobs 
            ADD COLUMN IF NOT EXISTS type VARCHAR(50) DEFAULT 'FORM_SUBMISSION';
        `);
        console.log("✅ Migration successful.");
    } catch (e) {
        console.error("❌ Migration failed:", e);
    } finally {
        pool.end();
    }
}

migrate();
