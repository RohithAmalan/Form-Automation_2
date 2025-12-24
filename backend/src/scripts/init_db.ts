import { Client } from 'pg';
import dotenv from 'dotenv';
import path from 'path';
import fs from 'fs';

dotenv.config({ path: path.join(__dirname, '../../../.env') });

const client = new Client({
    connectionString: process.env.DATABASE_URL,
});

async function initDB() {
    try {
        await client.connect();
        console.log("Connected to DB...");

        const sql = fs.readFileSync(path.join(__dirname, '../db/schema.sql'), 'utf8');
        await client.query(sql);

        console.log("✅ Schema applied successfully!");

        const res = await client.query('SELECT * FROM profiles');
        console.log(`Profiles count: ${res.rows.length}`);

        process.exit(0);
    } catch (err) {
        console.error("❌ Schema Init Failed", err);
        process.exit(1);
    }
}

initDB();
