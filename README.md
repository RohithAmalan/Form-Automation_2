# Form Automation with OpenRouter

This project automates form submission using **Playwright** for browser control and **OpenRouter (GPT-4o-mini)** for intelligent decision making.

## Setup

1.  **Install Dependencies**:
    ```bash
    pip install -r requirements.txt
    playwright install
    ```

2.  **Environment Variables**:
    Create a `.env` file with your OpenRouter key:
    ```env
    OPENROUTER_API_KEY=sk-or-v1-...
    ```

## Usage

1.  **Edit Form Data**:
    Update `form_data.json` with the entries you want to submit.

2.  **Run Automation**:
    *   **Option A: Custom Iterative Agent (Recommended)** - Uses `user_profile.json` to fill multiple forms in `form_urls.json`.
        ```bash
        python3 main.py
        ```
    *   **Option B: Hybrid Script (Legacy)** - Uses the original implementation.
        ```bash
        python3 main.py
        ```

## Structure
- `main_browser_use.py`: **New** iterative agent implementation using `browser-use`.
- `main.py`: Original automation logic (Hybrid Playwright + LLM).
- `form_data.json`: Data source for bulk processing.
- `requirements.txt`: Python package dependencies.
