import { Router } from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { FormController } from '../controllers/form.controller';

const router = Router();

// --- Multer Config ---
// Ensure uploads directory exists relative to project root (since we are in backend/src/routes)
// Project root is ../../../
const uploadDir = path.join(__dirname, '../../../uploads');
if (!fs.existsSync(uploadDir)) {
    fs.mkdirSync(uploadDir, { recursive: true });
}

const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        cb(null, uploadDir);
    },
    filename: function (req, file, cb) {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        cb(null, uniqueSuffix + '-' + file.originalname);
    }
});
const upload = multer({ storage: storage });

// --- Routes ---

// Profiles
router.get('/profiles', FormController.getProfiles);
router.post('/profiles', FormController.createProfile);

// Jobs
router.get('/jobs', FormController.getJobs);
router.post('/jobs', upload.single('file'), FormController.createJob);
router.delete('/jobs/:id', FormController.deleteJob);
router.post('/jobs/:id/resume', upload.single('file'), FormController.resumeJob);

// Logs
router.get('/jobs/:id/logs', FormController.getJobLogs);

export default router;
