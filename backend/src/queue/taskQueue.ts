import pool from '../config/db';
import { JobModel } from '../models/job.model';
import { processJob, AutomationLogger } from '../automation/playwrightRunner';

export async function runWorker() {
    console.log("👷 Worker started. Polling for jobs...");

    while (true) {
        try {
            // 1. Fetch NEXT PENDING JOB (Using Model logic, but we need atomic update so keeping raw SQL or moving atomic logic to model)
            // Function getPending in JobModel does the query.
            const res = await JobModel.getPending();

            if (res.rowCount === 0) {
                // No jobs, sleep 2s
                await new Promise(resolve => setTimeout(resolve, 2000));
                continue;
            }

            // Lock it
            const jobId = res.rows[0].id;
            await pool.query("UPDATE jobs SET status = 'PROCESSING' WHERE id = $1", [jobId]);

            // Fetch full details
            const jobRes = await pool.query("SELECT * FROM jobs WHERE id = $1", [jobId]);
            const job = jobRes.rows[0];

            console.log(`🚀 Picked up Job: ${job.url}`);

            // 2. Fetch Profile
            let profileData = {};
            if (job.profile_id) {
                const profRes = await pool.query('SELECT payload FROM profiles WHERE id = $1', [job.profile_id]);
                if (profRes.rows.length > 0) {
                    profileData = { ...profRes.rows[0].payload };
                }
            }

            // Merge Custom Data
            if (job.custom_data) {
                profileData = { ...profileData, ...job.custom_data };
            }

            // Inject File Path
            if (job.file_path) {
                profileData = { ...profileData, uploaded_file_path: job.file_path };
                console.log(`📎 Found attachment: ${job.file_path}`);
            }

            // Critical for Resume feature
            profileData = { ...profileData, job_id: job.id };

            // 3. Define Logger
            const logger: AutomationLogger = {
                log: async (msg, type, details = null) => {
                    console.log(`[${type}] ${msg}`);
                    await pool.query(
                        `INSERT INTO logs (job_id, action_type, message, details) VALUES ($1, $2, $3, $4)`,
                        [job.id, type, msg, details]
                    );
                }
            };

            // 4. Process
            try {
                await processJob(job.url, profileData, logger);

                // Success
                await pool.query(`UPDATE jobs SET status = 'COMPLETED', completed_at = NOW() WHERE id = $1`, [job.id]);
                console.log(`✅ Job ${job.id} Completed`);

            } catch (err: any) {
                // Failure
                await pool.query(`UPDATE jobs SET status = 'FAILED', completed_at = NOW() WHERE id = $1`, [job.id]);
                console.error(`❌ Job ${job.id} Failed:`, err);
            }

        } catch (err) {
            console.error("Worker Loop Error:", err);
            await new Promise(resolve => setTimeout(resolve, 5000));
        }
    }
}
