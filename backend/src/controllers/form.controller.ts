import { Request, Response } from 'express';
import { JobModel } from '../models/job.model';
import { ProfileModel } from '../models/profile.model';
import { LogModel } from '../models/log.model';

export const FormController = {
    // --- Profiles ---
    getProfiles: async (req: Request, res: Response) => {
        try {
            const profiles = await ProfileModel.getAll();
            res.json(profiles);
        } catch (err: any) {
            console.error(err);
            res.status(500).json({ error: err.message });
        }
    },

    createProfile: async (req: Request, res: Response) => {
        const { name, payload } = req.body;
        try {
            const profile = await ProfileModel.create(name, payload);
            res.json(profile);
        } catch (err: any) {
            console.error(err);
            res.status(500).json({ error: err.message });
        }
    },

    // --- Jobs ---
    getJobs: async (req: Request, res: Response) => {
        try {
            const jobs = await JobModel.getAll();
            res.json(jobs);
        } catch (err: any) {
            console.error(err);
            res.status(500).json({ error: err.message });
        }
    },

    createJob: async (req: Request, res: Response): Promise<any> => {
        try {
            const body = req.body || {};
            const { url, profile_id, custom_data, form_name } = body;
            const file = req.file;

            let parsedCustomData = {};
            if (custom_data) {
                try {
                    parsedCustomData = typeof custom_data === 'string' ? JSON.parse(custom_data) : custom_data;
                } catch (e) {
                    parsedCustomData = { raw_input: custom_data };
                }
            }

            if (!url || !profile_id) {
                return res.status(400).json({ error: "Missing url or profile_id", received: body });
            }

            const filePath = file ? file.path : null;
            const finalFormName = form_name || "Untitled Form";

            const job = await JobModel.create(url, profile_id, parsedCustomData, filePath, finalFormName);
            res.json(job);
        } catch (err: any) {
            console.error("Job Creation Error:", err);
            res.status(500).json({ error: err.message });
        }
    },

    deleteJob: async (req: Request, res: Response) => {
        try {
            await JobModel.delete(req.params.id);
            res.json({ message: 'Deleted successfully' });
        } catch (err: any) {
            console.error(err);
            res.status(500).json({ error: err.message });
        }
    },

    resumeJob: async (req: Request, res: Response): Promise<any> => {
        try {
            const file = req.file;
            const updates: any = { status: 'RESUMING' };

            // 1. Fetch current job to preserve custom_data
            // We use JobModel directly or raw query. JobModel doesn't have getById exposed simply in this file context?
            // Actually getJobs does getAll. JobModel probably has generic query methods? 
            // Looking at JobModel usage, it lacks getById. 
            // For speed/safety, I'll use JobModel.update to just set what I have, BUT wait..
            // If I overwrite custom_data, I lose the _missing_label info?
            // Actually, once RESUMING, I might not need _missing_label anymore?
            // But playwrightRunner uses it to know which field to return? 
            // No, playwrightRunner logic: `if (job.custom_data && job.custom_data[missingLabel])`.
            // So I MUST preserve the key `missingLabel` (which is `_missing_label`).
            // AND add the NEW key `[missingLabel]: UserValue`.

            // To do this properly without `getById`, I'll rely on a raw query inside controller or import pool?
            // Controller shouldn't import pool directly ideally.
            // Let's check if generic 'getById' exists? No.

            // Hack/Fast Solution: 
            // In playwrightRunner, I check `job.custom_data.user_response` as fallback.
            // If I always set `user_response` key, I don't need to know the label.
            // BUT playwrightRunner logic: `if (job.custom_data && job.custom_data[missingLabel])`.
            // So if I overwrite `custom_data`, I break that check UNLESS I also send `missingLabel` from frontend.

            // Better: Frontend sends the new data merging locally? Frontend has generic job object?
            // No, frontend is cleaner if it just sends "Here is the value".

            // Let's add `getById` to JobModel?
            // Or just do a merge in SQL?
            // Let's modify JobModel to support `updateCustomData(id, newData)`?
            // Or just use `JobModel` generic update and do the merge in Controller using a fast `pool` query?
            // I can't import pool easily here (it's in config/db).

            // Let's assume we can import pool from '../config/db'. (Models do it).
            // But wait, I see `JobModel` at top.

            // Let's just implement `getById` in JobModel? 
            // OR... blindly update `custom_data`.
            // If I assume `req.body.custom_data` contains EVERYTHING needed?
            // No, risky.

            // Let's try to grab `pool` or just rely on `user_response`?
            // If I change `playwrightRunner` to check `custom_data.user_response` ALWAYS for text?
            // I did that: `if (job.custom_data && job.custom_data.user_response) return ...`
            // So I can just push `{ user_response: "Value" }` to generic update?
            // BUT if I overwrite `custom_data = { user_response: ... }`, I lose `_missing_label`... 
            // DOES PLAYWRIGHT RUNNER NEED `_missing_label`?
            // `waitForResume(..., missingLabel)` -> `missingLabel` is passed as ARG to function.
            // So `playwrightRunner` KNOWS the label locally in memory closure!
            // It does NOT need to read `_missing_label` from DB.
            // It CHECKS `job.custom_data[missingLabel]`.

            // SO:
            // 1. Playwright knows "I am waiting for Proposal Title".
            // 2. User sends `{ "Proposal Title": "My App" }`.
            // 3. We save `{ "Proposal Title": "My App" }` to DB.
            // 4. Playwright wakes up. Checks `job.custom_data["Proposal Title"]`. Finds "My App".
            // 5. Success!

            // So overwriting IS fine?
            // Yes, as long as I don't need other custom data?
            // If I overwrite, I lose `profile_id` etc? No, those are columns. `custom_data` is a column.
            // I lose previous `custom_data`.
            // If `profileData` was built by merging `custom_data`?
            // `processJob` merges `custom_data` at START.
            // `waitForResume` is MID-FLIGHT.
            // So `processJob` variable `profileData` holds the OLD custom data already merged.
            // So strictly speaking, overwriting DB `custom_data` NOW doesn't hurt the running memory.

            // CONCLUSION: Safe to overwrite `custom_data` with new input, as long as passing just the new key/value.

            // Handling req.body
            let incomingData = {};
            if (req.body.custom_data) {
                try {
                    incomingData = typeof req.body.custom_data === 'string' ? JSON.parse(req.body.custom_data) : req.body.custom_data;
                } catch (e) {
                    incomingData = { user_response: req.body.custom_data };
                }
            } else if (req.body.text_input) {
                // Convenience field from frontend
                incomingData = { user_response: req.body.text_input };
            }

            if (Object.keys(incomingData).length > 0) {
                // If we want to be nice and merge, we CAN'T without reading.
                // But for now, we'll just set it.
                // Actually, let's try to import pool just for this one read?
                // Nah, let's just use `JobModel.appendCustomData`? 
                // Let's just Overwrite. It's acceptable for this feature (just-in-time input).

                // Wait, if I overwrite, I lose `_missing_type` info, but that's fine, job is resuming.
                updates.custom_data = incomingData;
            }

            if (file) {
                updates.file_path = file.path;
            }

            await JobModel.update(req.params.id, updates);

            res.json({ message: 'Resumed successfully' });
        } catch (err: any) {
            console.error(err);
            res.status(500).json({ error: err.message });
        }
    },

    // --- Logs ---
    getJobLogs: async (req: Request, res: Response) => {
        try {
            const logs = await LogModel.getByJobId(req.params.id);
            res.json(logs);
        } catch (err: any) {
            console.error(err);
            res.status(500).json({ error: err.message });
        }
    }
};
