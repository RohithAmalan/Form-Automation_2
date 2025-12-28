
import pool from '../config/db';

async function initAuthDB() {
    console.log("🔒 Initializing Auth Database Schema...");

    // 1. Users Table
    await pool.query(`
        CREATE TABLE IF NOT EXISTS users (
            id VARCHAR(255) PRIMARY KEY, -- Google ID
            email VARCHAR(255) NOT NULL,
            display_name VARCHAR(255),
            photo_url TEXT,
            created_at TIMESTAMP DEFAULT NOW(),
            last_login TIMESTAMP DEFAULT NOW()
        );
    `);
    console.log("✅ Table 'users' ready.");

    // 2. Session Table (for connect-pg-simple)
    await pool.query(`
        CREATE TABLE IF NOT EXISTS "session" (
            "sid" varchar NOT NULL COLLATE "default",
            "sess" json NOT NULL,
            "expire" timestamp(6) NOT NULL
        )
        WITH (OIDS=FALSE);
    `);

    // Add constraint if not exists (using manual check or ignore error)
    try {
        await pool.query(`ALTER TABLE "session" ADD CONSTRAINT "session_pkey" PRIMARY KEY ("sid") NOT DEFERRABLE INITIALLY IMMEDIATE;`);
    } catch (e: any) {
        if (!e.message.includes('already exists')) console.error(e);
    }

    try {
        await pool.query(`CREATE INDEX "IDX_session_expire" ON "session" ("expire");`);
    } catch (e: any) {
        if (!e.message.includes('already exists')) console.error(e);
    }

    console.log("✅ Table 'session' ready.");

    process.exit(0);
}

initAuthDB().catch(e => {
    console.error("Failed to init auth db", e);
    process.exit(1);
});
