import { Pool } from 'pg';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.join(__dirname, '../../.env') });

const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
});

async function migrate() {
    try {
        console.log("Adding form_name column to jobs table...");
        await pool.query(`
            ALTER TABLE jobs 
            ADD COLUMN IF NOT EXISTS form_name TEXT;
        `);
        console.log("Migration successful.");
    } catch (error) {
        console.error("Migration failed:", error);
    } finally {
        await pool.end();
    }
}

migrate();
