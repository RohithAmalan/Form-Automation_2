import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import path from 'path';
import formRoutes from './routes/form.routes';
import { JobModel } from './models/job.model';
import { runWorker } from './queue/taskQueue';

// Validates .env load
dotenv.config({ path: path.join(__dirname, '../../.env') });

const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors());
app.use(express.json());

// Mount Routes
app.use('/', formRoutes);

app.get('/health', (req, res) => {
  res.json({ status: 'ok', message: 'Server is running' });
});

// Test Form Route (Keeping for legacy/debug)
app.get('/test-form', (req, res) => {
  res.send(`
    <html>
      <body>
        <h1>Test Form</h1>
        <form>
          <label for="name">Name:</label><br>
          <input type="text" id="name" name="name"><br>
          <label for="email">Email:</label><br>
          <input type="email" id="email" name="email"><br>
          <label for="message">Message:</label><br>
          <textarea id="message" name="message"></textarea><br><br>
          <button type="submit" id="submit">Submit</button>
        </form>
      </body>
    </html>
  `);
});

app.listen(PORT, async () => {
  console.log(`Server running on port ${PORT}`);

  // Crash Recovery
  try {
    const count = await JobModel.failStuckJobs();
    if (count && count > 0) {
      console.log(`⚠️  Crash Recovery: Marked ${count} stuck jobs as FAILED.`);
    } else {
      console.log("✅ No stuck jobs found on startup.");
    }
  } catch (e) {
    console.error("Crash recovery failed:", e);
  }

  // Start Worker
  runWorker().catch(err => console.error("Worker failed to start:", err));
});
