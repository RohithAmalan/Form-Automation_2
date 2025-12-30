# Intelligent Form Automation (Full-Stack)

A robust, AI-powered form automation agent featuring **Human-in-the-Loop (HITL)** capabilities, a production-grade **Job Queue**, and deep system observability. The system uses a **Next.js Frontend** for control and a **Node.js/Express Backend** with **Playwright** for automation, backed by **PostgreSQL**.

> **Pro Agent**: Capable of learning from profile data, handling file uploads, and intelligently recovering from failures.

## 🚀 Key Features

### 🤖 Automation & Intelligence
*   **Human-in-the-Loop (HITL)**: Intelligently pauses when data is missing (e.g., File Uploads, specific text fields) and waits for user input via the dashboard.
*   **📂 Smart File Handling**: Support for **Multiple File Uploads**. The AI intelligently selects the correct file from your upload list for specific fields (e.g., Resume vs. Cover Letter).
*   **⚡ Quick Replay & Caching**: Automatically caches successful form actions. Re-run complex forms in seconds with the **Quick Replay** sidebar.
*   **🧠 Profile Learning**: Automatically learns from your inputs. If you provide information once (e.g., "Address Line 2"), it saves it to your profile and never asks again.

### ⚙️ Robust Job Backend
*   **Queue Architecture**: Implements a generic Producer-Consumer job queue with PostgreSQL (`SKIP LOCKED`) for concurrency safety.
*   **Retry Logic**: Automatically retries failed jobs once before marking them as `DEAD`.
*   **Lifecycle Management**: Full state tracking: `PENDING` → `PROCESSING` → `PAUSED` → `COMPLETED` / `FAILED`.
*   **Manual Control**: Pause, Resume, or Cancel jobs directly from the UI.

### 📊 Observability
*   **Live Dashboard**: Real-time status, timeline visualization of every action.
*   **Database View Logs**: Switch between visual timelines and raw database logs for deep debugging.
*   **Global System Logs**: Unified stream of all agent activities across the platform.

---

## 🛠️ Tech Stack

*   **Frontend**: Next.js 15, React 19, Tailwind CSS, Lucide Icons
*   **Backend**: Node.js, Express, TypeScript, Playwright
*   **AI**: OpenAI (GPT-4o) / Google Gemini (via OpenRouter)
*   **Database**: PostgreSQL (with `pg` and `uuid-ossp`)
*   **Process Management**: Concurrently

---

## 📦 Setup & Installation

1.  **Clone the Repository**:
    ```bash
    git clone https://github.com/RohithAmalan/Form-Automation_2.git
    cd Form_Automation_2
    ```

2.  **Install Dependencies**:
    ```bash
    # Root & Backend
    npm install
    
    # Frontend
    cd frontend && npm install && cd ..
    ```

3.  **Environment Variables**:
    Create a `.env` file in the root directory:
    ```env
    PORT=3001
    DATABASE_URL=postgresql://postgres:password@localhost:5432/form_automation_v2
    OPENROUTER_API_KEY=sk-your-key
    SESSION_SECRET=dev_secret
    ```

4.  **Database Setup**:
    Ensure PostgreSQL is running, then initialize the schema:
    ```bash
    npx ts-node backend/src/scripts/init_db.ts
    ```

---

## 🏃‍♂️ Usage

**Start the System** (Frontend + Backend):
```bash
./run.sh
```
*   **Dashboard**: `http://localhost:3000`
*   **API**: `http://localhost:3001`

### Queue Workflow
The system follows a strict state machine:
```mermaid
graph TD
    Start([queue.add()]) --> PENDING
    PENDING --> PROCESSING
    PROCESSING --> COMPLETED
    PROCESSING --> FAILED
    FAILED --> CheckRetry{Retries < 1?}
    CheckRetry -- Yes --> PENDING
    CheckRetry -- No --> DEAD
    
    PROCESSING -.-> PAUSED
    PAUSED -.-> PROCESSING
```

---

## 📁 Project Structure

*   `frontend/`: Next.js React Application (Logs, Dashboard, Sidebar).
*   `backend/src/`:
    *   `automation/`: Playwright logic & AI Prompts.
    *   `queue/`: **Task Queue Worker** (Producer/Consumer logic).
    *   `models/`: DB interaction (JobModel, LogModel).
    *   `scripts/`: DB Init & Migrations.
*   `database/`: SQL Schema & Migrations.

---
*Built by Rohith Amalan*
