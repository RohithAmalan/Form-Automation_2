import pool from '../config/db';

export const LogModel = {
    getByJobId: async (jobId: string) => {
        const result = await pool.query(
            'SELECT * FROM logs WHERE job_id = $1 ORDER BY timestamp ASC',
            [jobId]
        );
        return result.rows;
    },

    create: async (jobId: string, type: string, message: string, details: any) => {
        await pool.query(
            `INSERT INTO logs (job_id, action_type, message, details) VALUES ($1, $2, $3, $4)`,
            [jobId, type, message, details]
        );
    }
};
