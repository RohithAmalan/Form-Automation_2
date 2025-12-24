import pool from '../config/db';

export interface Job {
    id: string;
    url: string;
    status: string;
    profile_id: string;
    custom_data: any;
    file_path: string | null;
    form_name: string;
    created_at: Date;
    completed_at: Date | null;
}

export const JobModel = {
    getAll: async () => {
        const result = await pool.query(`
            SELECT jobs.*, profiles.name as profile_name 
            FROM jobs 
            LEFT JOIN profiles ON jobs.profile_id = profiles.id 
            ORDER BY created_at DESC
        `);
        return result.rows;
    },

    create: async (url: string, profile_id: string, custom_data: any, file_path: string | null, form_name: string) => {
        const result = await pool.query(
            'INSERT INTO jobs (url, profile_id, custom_data, file_path, form_name) VALUES ($1, $2, $3, $4, $5) RETURNING *',
            [url, profile_id, custom_data, file_path, form_name]
        );
        return result.rows[0];
    },

    delete: async (id: string) => {
        await pool.query('DELETE FROM jobs WHERE id = $1', [id]);
    },

    update: async (id: string, updates: any) => {
        const keys = Object.keys(updates);
        if (keys.length === 0) return;

        const setClause = keys.map((key, i) => `${key} = $${i + 2}`).join(', ');
        const values = [id, ...Object.values(updates)];

        await pool.query(`UPDATE jobs SET ${setClause} WHERE id = $1`, values);
    },

    // Used by TaskQueue mainly
    getPending: async () => {
        return pool.query(`
            SELECT id FROM jobs WHERE status = 'PENDING' ORDER BY created_at ASC FOR UPDATE SKIP LOCKED LIMIT 1
        `);
    },

    // Crash recovery
    failStuckJobs: async () => {
        const result = await pool.query(
            `UPDATE jobs SET status = 'FAILED', completed_at = NOW() WHERE status = 'PROCESSING' RETURNING id`
        );
        return result.rowCount;
    }
};
