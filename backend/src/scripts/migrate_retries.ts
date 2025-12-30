import { Client } from 'pg';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.join(__dirname, '../../../.env') });

const client = new Client({
    connectionString: process.env.DATABASE_URL,
});

async function migrate() {
    try {
        await client.connect();
        console.log("Connected to DB...");

        await client.query(`
            ALTER TABLE jobs 
            ADD COLUMN IF NOT EXISTS retries INT DEFAULT 0;
        `);

        console.log("✅ Added 'retries' column to jobs table.");
        process.exit(0);
    } catch (err) {
        console.error("❌ Migration Failed", err);
        process.exit(1);
    }
}

migrate();
