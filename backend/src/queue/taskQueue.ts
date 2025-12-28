import pool from '../config/db';
import { JobModel } from '../models/job.model';
import { processJob } from '../automation/playwrightRunner';

// ==========================================
// 🛠️ JOB REGISTRY & DEFINITIONS (Single File)
// ==========================================

export interface AutomationLogger {
    log: (msg: string, type: 'info' | 'error' | 'action' | 'warning' | 'success', details?: any) => Promise<void>;
}

export interface JobParams {
    jobId: string;
    url: string;
    profileData: any;
    logger: AutomationLogger;
}

// 1. Define what an "Executor" looks like
type JobExecutor = (params: JobParams) => Promise<void>;

// 2. The Registry Map
const REGISTRY: Record<string, JobExecutor> = {};

/**
 * Register a new project/task type here.
 */
export function registerJobType(type: string, executor: JobExecutor) {
    REGISTRY[type] = executor;
    console.log(`[Queue] Registered Job Type: '${type}'`);
}

// ==========================================
// 🧩 EXECUTORS (Add your project logic here)
// ==========================================

// Executor A: Form Automation
const formAutomationExecutor: JobExecutor = async ({ url, profileData, logger }) => {
    // Calls the external Playwright logic
    await processJob(url, profileData, logger);
};

// Executor B: Example Scraper (Placeholder)
const scraperExecutor: JobExecutor = async ({ url, logger }) => {
    await logger.log(`Starting Scraper for ${url}`, 'info');
    await new Promise(r => setTimeout(r, 2000)); // Simulaton
    await logger.log(`Scraping complete`, 'success');
};


// 3. AUTO-REGISTER HANDLERS
registerJobType('FORM_SUBMISSION', formAutomationExecutor);
registerJobType('SCRAPER', scraperExecutor); // Example
registerJobType('DEFAULT', formAutomationExecutor); // Fallback


// ==========================================
// 👷 WORKER LOOP
// ==========================================
export async function runWorker() {
    console.log("👷 Worker started. Polling for jobs...");
    console.log(`Supported Types: ${Object.keys(REGISTRY).join(', ')}`);

    while (true) {
        try {
            const res = await JobModel.getPending();

            if (res.rowCount === 0) {
                await new Promise(resolve => setTimeout(resolve, 2000));
                continue;
            }

            const jobId = res.rows[0].id;
            await pool.query("UPDATE jobs SET status = 'PROCESSING', started_at = NOW() WHERE id = $1", [jobId]);

            const jobRes = await pool.query("SELECT * FROM jobs WHERE id = $1", [jobId]);
            const job = jobRes.rows[0];
            const jobType = job.type || 'FORM_SUBMISSION';

            console.log(`🚀 Processing Job ${job.id} [Type: ${jobType}] (FRESH CODE)`);

            // Find Executor
            const executor = REGISTRY[jobType] || REGISTRY['DEFAULT'];
            if (!executor) {
                throw new Error(`No executor found for type '${jobType}'`);
            }

            // Prepare Data
            let profileData = {};
            if (job.profile_id) {
                const profRes = await pool.query('SELECT payload FROM profiles WHERE id = $1', [job.profile_id]);
                if (profRes.rows.length > 0) profileData = { ...profRes.rows[0].payload };
            }
            if (job.custom_data) profileData = { ...profileData, ...job.custom_data };
            if (job.file_path) profileData = { ...profileData, uploaded_file_path: job.file_path };

            // Inject Date/Time Context
            const now = new Date();
            profileData = {
                ...profileData,
                job_id: job.id,
                profile_id: job.profile_id,
                current_date: now.toISOString().split('T')[0], // YYYY-MM-DD
                current_day: now.toLocaleDateString('en-US', { weekday: 'long' }),
                current_year: now.getFullYear()
            };

            const logger: AutomationLogger = {
                log: async (msg, type, details = null) => {
                    console.log(`[${type}] ${msg}`);
                    try {
                        await pool.query(
                            `INSERT INTO logs (job_id, action_type, message, details) VALUES ($1, $2, $3, $4)`,
                            [job.id, type, msg, details]
                        );
                    } catch (e: any) {
                        // If job was deleted, silent fail or stop worker?
                        if (e.code === '23503') { // Foreign Key Violation
                            console.warn(`[Worker] Job ${job.id} no longer exists. Stopping logging.`);
                            // Optionally throw to stop execution?
                            // throw new Error("Job Deleted");
                        }
                    }
                }
            };

            // Run
            try {
                await executor({ jobId: job.id, url: job.url, profileData, logger });

                await pool.query(`UPDATE jobs SET status = 'COMPLETED', completed_at = NOW() WHERE id = $1`, [job.id]);
                console.log(`✅ Job ${job.id} Completed`);
            } catch (err: any) {
                await pool.query(`UPDATE jobs SET status = 'FAILED', completed_at = NOW() WHERE id = $1`, [job.id]);
                console.error(`❌ Job ${job.id} Failed:`, err);
            }

        } catch (err) {
            console.error("Worker Loop Error:", err);
            await new Promise(resolve => setTimeout(resolve, 5000));
        }
    }
}
