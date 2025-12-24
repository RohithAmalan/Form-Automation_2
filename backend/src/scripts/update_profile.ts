import { Pool } from 'pg';
import dotenv from 'dotenv';
import path from 'path';
import fs from 'fs';

dotenv.config({ path: path.join(__dirname, '../../../.env') });

const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
});

async function updateProfile() {
    try {
        const jsonPath = path.join(__dirname, '../../../profile_data.json');

        if (!fs.existsSync(jsonPath)) {
            console.error(`❌ File not found: ${jsonPath}`);
            console.error("Please create 'profile_data.json' in the project root first.");
            process.exit(1);
        }

        const rawData = fs.readFileSync(jsonPath, 'utf8');
        const newData = JSON.parse(rawData);

        console.log("🔄 Updating Profile with new data...");
        console.log(newData);

        // Update the 'Default User' profile (or allow selecting by ID later)
        // For now, we assume single-user mode and update the first profile found or a specific name
        const res = await pool.query(`
            UPDATE profiles 
            SET payload = $1, updated_at = NOW() 
            WHERE name = 'Default User'
            RETURNING id, name
        `, [newData]);

        if (res.rowCount === 0) {
            console.log("⚠️ No profile named 'Default User' found. Creating one...");
            await pool.query(`
                INSERT INTO profiles (name, payload) VALUES ('Default User', $1)
            `, [newData]);
            console.log("✅ Created new profile 'Default User'.");
        } else {
            console.log(`✅ Successfully updated profile for '${res.rows[0].name}'`);
        }

        process.exit(0);

    } catch (err) {
        console.error("❌ Failed to update profile:", err);
        process.exit(1);
    }
}

updateProfile();
