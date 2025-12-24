import { Client } from 'pg';
import dotenv from 'dotenv';
import path from 'path';

// Explicitly load .env from current directory
dotenv.config({ path: path.join(__dirname, '../../.env') });

console.log("Connecting to:", process.env.DATABASE_URL);

const client = new Client({
    connectionString: process.env.DATABASE_URL,
});

async function verify() {
    try {
        await client.connect();
        console.log("✅ Successfully connected to PostgreSQL!");

        const res = await client.query('SELECT NOW()');
        console.log('Database Time:', res.rows[0].now);

        await client.end();
        process.exit(0);
    } catch (err) {
        console.error("❌ Connection failed", err);
        process.exit(1);
    }
}

verify();
