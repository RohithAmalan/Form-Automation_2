import pool from '../config/db';

export const ProfileModel = {
    getAll: async () => {
        const result = await pool.query('SELECT * FROM profiles ORDER BY created_at DESC');
        return result.rows;
    },

    getById: async (id: string) => {
        const result = await pool.query('SELECT payload FROM profiles WHERE id = $1', [id]);
        return result.rows[0];
    },

    create: async (name: string, payload: any) => {
        const result = await pool.query(
            'INSERT INTO profiles (name, payload) VALUES ($1, $2) RETURNING *',
            [name, payload]
        );
        return result.rows[0];
    }
};
