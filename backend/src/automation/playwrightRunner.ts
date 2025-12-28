import { chromium } from 'playwright';
import OpenAI from 'openai';
import dotenv from 'dotenv';
import path from 'path';
import fs from 'fs';
import * as cheerio from 'cheerio';

dotenv.config({ path: path.join(__dirname, '../../../.env') });

const apiKey = process.env.OPENROUTER_API_KEY;
console.log(`[PlaywrightRunner] Init OpenAI. Key Present: ${!!apiKey}, Length: ${apiKey?.length}`);
if (apiKey) {
    console.log(`[PlaywrightRunner] Key Start: ${apiKey.substring(0, 5)}...`);
}

const openai = new OpenAI({
    apiKey: apiKey,
    baseURL: "https://openrouter.ai/api/v1",
    defaultHeaders: {
        "HTTP-Referer": "http://localhost:3000",
        "X-Title": "FormAutomation",
    }
});

const MODEL = "openai/gpt-4o-mini";

// Helper to clean HTML using Cheerio
function cleanHtml(rawHtml: string): string {
    const $ = cheerio.load(rawHtml);

    // Remove scripts, styles, iframes (unless crucial, but usually ads), svgs, noscript
    $('script').remove();
    $('style').remove();
    $('noscript').remove();
    $('iframe').remove(); // We handle frames separately in Playwright, so nested iframes are likely ads
    $('svg').remove();
    $('meta').remove();
    $('link').remove();

    // Remove known ad selectors (generic)
    $('.ad').remove();
    $('.ads').remove();
    $('[id*="google_ads"]').remove();
    $('[class*="ad-"]').remove();

    // Return body content only to save tokens
    return $('body').html() || "";
}

interface Action {
    selector: string;
    value?: string;
    type: "fill" | "click" | "upload" | "ask_user";
}

// Interface for callbacks to keeping this file DB-agnostic
export interface AutomationLogger {
    log: (msg: string, type: 'info' | 'error' | 'action' | 'warning' | 'success', details?: any) => Promise<void>;
}

// New helper to ask AI for a specific JS fix
async function getAiJavascriptFallback(html: string, selector: string, value: string): Promise<string> {
    const prompt = `
    You are a DOM Manipulation Expert.
    
    PROBLEM:
    I am trying to set the value of a dropdown (<select>) to "${value}", but it is not sticking or triggering validation.
    
    HTML CONTEXT:
    \`\`\`html
    ${html}
    \`\`\`
    
    TASK:
    Write a specific JavaScript snippet that I can run in the browser console to FORCE execution of this change.
    - Use 'document.querySelector("${selector}")' to find the element.
    - Try finding the option by text or value.
    - Force set the value.
    - Dispatch 'change', 'input', 'click', and 'blur' events manually.
    - If it looks like a React/Angular component, try to set the internal value tracker if known, or just use standard events aggressively.
    
    OUTPUT:
    Return ONLY the raw JavaScript code. No markdown. No comments wrapping it.
    `;

    try {
        const completion = await openai.chat.completions.create({
            model: MODEL,
            messages: [
                { role: "system", content: "You are a coding machine. Return only code." },
                { role: "user", content: prompt }
            ]
        });

        let code = completion.choices[0].message.content || "";
        code = code.replace(/```javascript/g, "").replace(/```/g, "").trim();
        return code;
    } catch (e) {
        console.error("AI Fallback Error:", e);
        return "";
    }
}

import pool from '../config/db';
import { JobModel } from '../models/job.model';

// Helper to update custom_data in DB
async function setMissingFieldInfo(jobId: string, type: 'file' | 'text', label: string) {
    // We need to fetch current custom_data first to preserve it
    const res = await pool.query("SELECT custom_data FROM jobs WHERE id = $1", [jobId]);
    const currentData = res.rows[0]?.custom_data || {};

    const newData = {
        ...currentData,
        _missing_type: type,
        _missing_label: label
    };

    await pool.query("UPDATE jobs SET custom_data = $1 WHERE id = $2", [newData, jobId]);
}

// Helper to SAVE learned data to Profile
async function saveLearnedData(profileId: string, key: string, value: string) {
    if (!profileId || !key || !value) return;
    try {
        // Fetch current payload
        const res = await pool.query("SELECT payload FROM profiles WHERE id = $1", [profileId]);
        if (res.rows.length === 0) return;

        const currentPayload = res.rows[0].payload || {};
        // Merge new data
        const newPayload = { ...currentPayload, [key]: value };

        await pool.query("UPDATE profiles SET payload = $1, updated_at = NOW() WHERE id = $2", [newPayload, profileId]);
        console.log(`🧠 Learned new data for '${key}': ${value.substring(0, 20)}...`);
    } catch (e) {
        console.error("Failed to save learned data:", e);
    }
}

async function waitForResume(jobId: string, missingType: 'file' | 'text', missingLabel: string): Promise<string | null> {
    console.log(`⏸️ Job ${jobId} PAUSED. Waiting for user input (${missingType}): ${missingLabel}`);

    // Set Status to WAITING_INPUT and store meta-data for UI
    await setMissingFieldInfo(jobId, missingType, missingLabel);
    await pool.query("UPDATE jobs SET status = 'WAITING_INPUT' WHERE id = $1", [jobId]);

    // Poll for RESUME
    const POLL_INTERVAL = 3000;
    const MAX_WAIT = 10 * 60 * 1000; // 10 Minutes
    let elapsed = 0;

    while (elapsed < MAX_WAIT) {
        await new Promise(resolve => setTimeout(resolve, POLL_INTERVAL));
        elapsed += POLL_INTERVAL;

        const res = await pool.query("SELECT status, file_path, custom_data FROM jobs WHERE id = $1", [jobId]);
        const job = res.rows[0];

        if (job.status === 'RESUMING') {
            // User Resumed!
            console.log(`▶️ Job ${jobId} RESUMING!`);
            await pool.query("UPDATE jobs SET status = 'PROCESSING' WHERE id = $1", [jobId]);

            // Return the relevant data based on type
            if (missingType === 'file') return job.file_path;

            // For text, we expect the API to have put the value into custom_data under the label OR a special key
            // Let's assume the API puts it in custom_data[missingLabel] or custom_data['user_input']
            // We'll normalize to looking for it in custom_data
            if (job.custom_data && job.custom_data[missingLabel]) return job.custom_data[missingLabel];
            // Fallback: Check if they just sent a generic 'user_response'
            if (job.custom_data && job.custom_data.user_response) return job.custom_data.user_response;

            return null;
        }

        if (job.status === 'FAILED') {
            return null; // Cancelled
        }
    }

    return null; // Timed out
}

async function getAiActionPlan(html: string, profileData: any): Promise<Action[]> {
    // Explicitly check if a file path is present in the profile data
    const hasFile = profileData.uploaded_file_path ? true : false;
    const filePathInfo = hasFile ? `File to upload is available at: "${profileData.uploaded_file_path}". Look for <input type="file">.` : "No file path provided in profile. If <input type='file'> exists, you MUST ask the user for it.";

    const prompt = `
    You are an expert browser automation agent.
    
    TASK:
    Generate a JSON list of actions to fill the form below with this data:
    ${JSON.stringify(profileData, null, 2)}
    
    ${filePathInfo}

    HTML CONTEXT:
    \`\`\`html
    ${html}
    \`\`\`

    REQUIREMENTS:
    1. Return strictly a valid JSON Object. No markdown formatting.
    2. Example format:
       {
         "actions": [
            {"selector": "#name", "value": "John", "type": "fill"},
            {"selector": "input[type='file']", "value": "/path/to/file.pdf", "type": "upload"},
            {"selector": "#submit", "type": "click"},
            {"selector": "field_label", "value": "Question for user?", "type": "ask_user"}
         ]
       }
    3. Use 'fill' to input text.
    4. For dropdowns (<select>):
       - Use 'fill' type.
       - The 'value' MUST be the text of the option you want to select.
    5. Use 'click' for buttons, checkboxes, AND RADIO BUTTONS.
    6. For file uploads (<input type="file">):
       - Use type 'upload'.
       - The 'value' MUST be: "${profileData.uploaded_file_path || ''}".
    7. CRITICAL: Find the 'Submit' button and \`click\` it as the VERY LAST action.

    8. SPECIAL INSTRUCTION FOR DATES:
       - The profile data includes keys: "current_date" (YYYY-MM-DD), "current_day", "current_year".
       - If you see a field asking for "Today's Date", "Date", or similar, USE these values!
       - DO NOT ask the user for the date if you can infer it from these keys.
       - If the field expects a specific format (e.g. MM/DD/YYYY), convert "current_date" accordingly.
    
    9. MISSING DATA STRATEGY (HUMAN-IN-THE-LOOP):
       - YOUR GOAL IS TO FILL **EVERY** VISIBLE FIELD, NOT JUST REQUIRED ONES.
       - If a visible field (<input>, <select>, <textarea>) needs a value:
         -> Check the provided profileData.
         -> If the key is missing OR the value is empty:
            -> CREATE an action with type "ask_user".
            -> "target_selector": The CSS SELECTOR of the input field.
            -> "question_label": The HUMAN-READABLE text label.
       - FOR FILE UPLOADS:
         - If <input type="file"> exists and profileData.uploaded_file_path is missing/empty:
         - YOU MUST GENERATE type "upload" with value "". This will trigger the system to pause and ask the user.
       - Do not skip "Address Line 2" or other optional fields if they are visible.
    `;

    try {
        const completion = await openai.chat.completions.create({
            model: MODEL,
            messages: [
                { role: "system", content: "You are a helpful automation assistant returning raw JSON." },
                { role: "user", content: prompt }
            ],
            response_format: { type: "json_object" },
            max_tokens: 3000
        });

        let content = completion.choices[0].message.content || "{}";
        // Clean markdown
        content = content.replace(/```json/g, "").replace(/```/g, "");

        const data = JSON.parse(content);
        let actions: any[] = [];

        // Handle nested keys like {"actions": [...]}
        if (data.actions && Array.isArray(data.actions)) actions = data.actions;
        else if (Array.isArray(data)) actions = data;
        else {
            // Fallback: check values
            for (const key in data) {
                if (Array.isArray(data[key])) {
                    actions = data[key];
                    break;
                }
            }
        }

        // Normalize actions to standard format
        return actions.map(a => ({
            type: a.type,
            selector: a.selector || a.target_selector,
            value: a.value || a.question_label
        }));

    } catch (error) {
        console.error("AI Error:", error);
        return [];
    }
}

/**
 * Pure Automation Function
 * Doesn't know about DB. Communicates via Logger callback.
 * Throws error on failure, Resolves on success.
 */
export async function processJob(url: string, profileData: any, logger: AutomationLogger) {
    // console.log(`Processing Job for ${url}`); // Optional local log

    // VITALITY CHECK
    try {
        await logger.log('Testing AI connection...', 'info');
        await openai.chat.completions.create({
            model: "openai/gpt-3.5-turbo", // Use cheap model for ping
            messages: [{ role: "user", content: "ping" }],
            max_tokens: 5
        });
        await logger.log('AI Connection Valid', 'success');
    } catch (e: any) {
        await logger.log(`AI Connection Failed: ${e.message}`, 'error');
        throw e; // Fail early
    }

    const browser = await chromium.launch({ headless: false }); // Visible for demo
    const context = await browser.newContext();
    const page = await context.newPage();

    try {
        await logger.log('Navigating to URL...', 'info');
        await page.goto(url);
        await page.waitForLoadState('networkidle');

        // Extract HTML from ALL frames
        let content = "";
        for (const frame of page.frames()) {
            try {
                const frameContent = await frame.content();
                const frameUrl = frame.url();
                const cleaned = cleanHtml(frameContent);
                if (cleaned && cleaned.trim().length > 50) { // Only append if meaningful
                    content += `\n<!-- FRAME: ${frameUrl} -->\n${cleaned}`;
                }
            } catch (e) {
                // Ignore cross-origin frame access errors
            }
        }

        // Safety cap (now applied to cleaned content)
        if (content.length > 150000) content = content.substring(0, 150000);

        await logger.log('Analyzing page with AI...', 'info');
        const actions = await getAiActionPlan(content, profileData);

        if (!actions || actions.length === 0) {
            await logger.log('No actions generated by AI', 'error');
            throw new Error("No actions generated");
        }

        await logger.log(`Executing ${actions.length} actions`, 'info', { actions });

        for (const action of actions) {
            const { selector, value, type } = action;

            try {
                // Find which frame has this selector
                let targetFrame: any = null;
                // Check main frame first
                if (await page.$(selector).catch(() => null)) {
                    targetFrame = page;
                } else {
                    // Check other frames
                    for (const frame of page.frames()) {
                        if (await frame.$(selector).catch(() => null)) {
                            targetFrame = frame;
                            break;
                        }
                    }
                }

                if (!targetFrame) {
                    await logger.log(`Element not found: ${selector}`, 'warning');
                    continue;
                }

                // Highlight
                await targetFrame.evaluate((sel: string) => {
                    try {
                        const el = document.querySelector(sel) as HTMLElement;
                        if (el) el.style.border = '2px solid red';
                    } catch (e) { }
                }, selector);

                if (type === 'fill') {
                    // Check editable
                    const isEditable = await targetFrame.locator(selector).isEditable().catch(() => true);
                    if (!isEditable) {
                        await logger.log(`Skipping read-only: ${selector}`, 'warning');
                        continue;
                    }

                    // Handle Select or Input
                    const tagName = await targetFrame.evaluate((sel: string) => {
                        const el = document.querySelector(sel);
                        return el ? el.tagName : '';
                    }, selector);

                    if (tagName === 'SELECT') {

                        const options = await targetFrame.evaluate((sel: string) => {
                            const select = document.querySelector(sel) as HTMLSelectElement;
                            if (!select) return [];
                            return Array.from(select.options).map(opt => ({
                                text: opt.text.trim(),
                                value: opt.value,
                                index: opt.index
                            }));
                        }, selector);

                        const normalize = (s: string) => s.toLowerCase().replace(/\s+/g, ' ').trim();
                        const targetVal = normalize(value || "");

                        // Find Match - Enhanced Logic
                        let bestMatch = options.find((o: any) => o.text === value);
                        if (!bestMatch) bestMatch = options.find((o: any) => normalize(o.text) === targetVal);
                        if (!bestMatch) bestMatch = options.find((o: any) => normalize(o.text).includes(targetVal));
                        if (!bestMatch) bestMatch = options.find((o: any) => o.value === value);

                        // Try strict label match if value failed
                        if (!bestMatch && value) {
                            bestMatch = options.find((o: any) =>
                                o.text.toLowerCase().trim() === value.toLowerCase().trim()
                            );
                        }

                        if (bestMatch) {
                            // STRATEGY: Double Selection + Focus/Blur

                            // 1. Focus
                            await targetFrame.focus(selector);

                            // 2. Select a DIFFERENT option first (to force change event)
                            const dummyOption = options.find((o: any) => o.index !== bestMatch.index);
                            if (dummyOption) {
                                await targetFrame.selectOption(selector, { index: dummyOption.index });
                                await page.waitForTimeout(200);
                            }

                            // 3. Select the CORRECT option
                            await logger.log(`Selecting option "${bestMatch.text}" (val: ${bestMatch.value})`, 'action');
                            await targetFrame.selectOption(selector, { value: bestMatch.value });
                        } else {
                            // Fallback: Try selecting by Label directly if options analysis failed
                            await logger.log(`Option match failed. Trying direct selectOption by label: "${value}"`, 'warning');
                            try {
                                await targetFrame.selectOption(selector, { label: value });
                            } catch (e) {
                                // If that fails, try by value directly as a last resort
                                await targetFrame.selectOption(selector, { value: value }).catch(() => { });
                            }
                        }

                        // 4. Force Events & Blur (Critical)
                        await page.waitForTimeout(100);
                        await targetFrame.locator(selector).dispatchEvent('change');
                        await targetFrame.locator(selector).dispatchEvent('input');
                        await targetFrame.locator(selector).blur();

                        // --- LLM FALLBACK START ---
                        let selectedValue = await targetFrame.evalOnSelector(selector, (el: HTMLSelectElement) => el.value);
                        const expectedValue = bestMatch ? bestMatch.value : value;

                        // Only trigger fallback if we really suspect failure
                        if (selectedValue !== expectedValue && bestMatch) {
                            await logger.log(`Standard methods failed (Val: ${selectedValue} vs Exp: ${expectedValue}). Asking AI for a custom JS fix...`, 'warning');

                            // Get element HTML for context
                            const elementHtml = await targetFrame.evalOnSelector(selector, (el: HTMLElement) => el.outerHTML);

                            // Ask AI for logic
                            const aiScript = await getAiJavascriptFallback(elementHtml, selector, value || "");

                            if (aiScript) {
                                await logger.log(`Executing AI-generated fix script`, 'action', { script: aiScript });
                                try {
                                    await targetFrame.evaluate((code: string) => {
                                        // Execute raw code safely
                                        new Function(code)();
                                    }, aiScript);
                                } catch (scriptErr: any) {
                                    await logger.log(`AI Script execution failed: ${scriptErr.message}`, 'error');
                                }
                            }
                        }
                        // --- LLM FALLBACK END ---

                        // 5. Debug Final State
                        const finalValue = await targetFrame.evalOnSelector(selector, (el: HTMLSelectElement) => el.value);
                        await logger.log(`Final Dropdown State: ${finalValue}`, 'info');

                    } else {
                        await targetFrame.fill(selector, String(value));
                    }

                } else if (type === 'click') {
                    // Self-Healing
                    const isOption = selector.toLowerCase().includes('option');
                    if (isOption) {
                        const parentId = await targetFrame.evaluate((sel: string) => {
                            const el = document.querySelector(sel);
                            const p = el?.closest('select');
                            return p ? p.id : null;
                        }, selector);

                        const val = await targetFrame.locator(selector).getAttribute('value');

                        if (parentId && val) {
                            await targetFrame.selectOption(`#${parentId}`, { value: val });
                            await logger.log(`Healed click-option to select-option`, 'action', { selector });
                            continue;
                        }
                    }

                    await targetFrame.click(selector);

                } else if (type === 'ask_user') {
                    // --- HUMAN IN THE LOOP (TEXT) ---
                    await logger.log(`AI asking user. Selector: "${selector}", Value: "${value}"`, 'warning');

                    // The prompt asks 'value' to be the Question, text like "Please enter Proposal Title".
                    // The 'selector' should be the Label "Proposal Title".
                    // However, we want the UI popup to show the most useful text. 
                    // If 'value' exists, it's usually the question or the label name. Use it as priority for display.
                    const labelEncoded = value || selector;

                    const userResponse = await waitForResume(profileData.job_id, 'text', labelEncoded);

                    if (userResponse) {
                        // --- LEARNING MOMENT (FIX) ---
                        if (profileData.profile_id) {
                            // STRATEGY: 
                            // 1. Save using the specific question asked (current behavior).
                            // 2. ALSO save using the 'selector' if it looks like a clean ID, as a fallback backup.

                            await saveLearnedData(profileData.profile_id, labelEncoded, userResponse);

                            // If labelEncoded was just a long natural question, try to save a cleaner key if we have the selector?
                            // This is complex without knowing the field name. 
                            // Ideally, we'd use the 'missing_label' passed to waitForResume.

                            await logger.log(`Saved "${labelEncoded}" to your profile for future use.`, 'success');
                        }
                        // -----------------------------

                        await logger.log(`User provided: "${userResponse}"`, 'success');

                        // NOW, we need to fill this into the form. 
                        // But we only have the "Label" (selector).
                        // Let's try to find an input with this label or placeholder.
                        let filled = false;

                        // Try 1: By Label Text (Playwright style)
                        // Heuristic: Find label containing text, get its 'for', find input with that id.
                        // Or input with placeholder.

                        // We can reuse the "AiJavascriptFallback" or just try generic locators.
                        // Or, we can ask AI for a small "fill" action based on this new data?
                        // That seems safest but slower.

                        // Faster: Try to find an input whose placeholder or previous sibling matches.
                        // Since we are inside the runner loop, let's try a heuristic.

                        // Heuristic A: Assume 'selector' in the action plan was actually a CSS selector if it looks like one.
                        // If it contains '#' or '.', try filling it detailedly.
                        if (selector.includes('#') || selector.includes('.') || selector.includes('[')) {
                            try {
                                await targetFrame.fill(selector, userResponse);
                                filled = true;
                            } catch (e) { }
                        }

                        if (!filled) {
                            // Heuristic B: Try getByLabel (approximate)
                            try {
                                const labels = await targetFrame.$$('label');
                                for (const lbl of labels) {
                                    const txt = await lbl.innerText();
                                    if (txt.toLowerCase().includes(selector.toLowerCase())) {
                                        const forAttr = await lbl.getAttribute('for');
                                        if (forAttr) {
                                            await targetFrame.fill(`#${forAttr}`, userResponse);
                                            filled = true;
                                            break;
                                        }
                                    }
                                }
                            } catch (e) { }
                        }

                        if (!filled) {
                            await logger.log(`Could not auto-fill field "${selector}" with "${userResponse}". Please check manually or restart.`, 'warning');
                        } else {
                            await logger.log(`Auto-filled "${selector}" successfully.`, 'action');
                        }

                    } else {
                        throw new Error("User cancelled text input.");
                    }

                } else if (type === 'upload') {
                    let filePathToUse = value;

                    // --- HUMAN IN THE LOOP: PAUSE IF MISSING ---
                    let fileExists = false;
                    if (filePathToUse) {
                        if (fs.existsSync(path.resolve(filePathToUse))) fileExists = true;
                        else if (fs.existsSync(path.join(__dirname, '../../../', filePathToUse))) fileExists = true;
                    }

                    if (!filePathToUse || !fileExists) {
                        await logger.log(`Missing file for upload selector: ${selector}. Pausing for user input...`, 'warning');

                        // Use the new generic waitForResume
                        const newPath = await waitForResume(profileData.job_id, 'file', 'Missing File Upload');
                        if (newPath) {
                            filePathToUse = newPath;
                            await logger.log(`User provided file: ${filePathToUse}. Resuming...`, 'success');
                        } else {
                            throw new Error("User cancelled or timed out on file upload.");
                        }
                    }
                    // ------------------------------------------

                    if (filePathToUse) {
                        // Verify file exists (robust check)
                        const resolvedPath = path.resolve(filePathToUse);
                        if (fs.existsSync(resolvedPath)) {
                            await targetFrame.setInputFiles(selector, resolvedPath);
                            await logger.log(`Uploaded file: ${resolvedPath}`, 'action');
                        } else {
                            // Try relative to project root if absolute failed
                            const projectRootPath = path.join(__dirname, '../../../', filePathToUse);
                            if (fs.existsSync(projectRootPath)) {
                                await targetFrame.setInputFiles(selector, projectRootPath);
                                await logger.log(`Uploaded file (resolved from root): ${projectRootPath}`, 'action');
                            } else {
                                await logger.log(`File still not found at: ${filePathToUse}`, 'error');
                            }
                        }
                    }
                }

                // Brief pause
                await page.waitForTimeout(500);

            } catch (err: any) {
                await logger.log(`Failed action on ${selector}`, 'error', { error: err.message });
            }
        }

        // --- VALIDATION & RECOVERY STEP ---
        await logger.log("Validating form completeness...", "info");
        const validationPrompt = `
        You are a QA Agent.
        HTML:
        \`\`\`html
        ${await page.content()}
        \`\`\`
        
        TASK:
        Identify any <input>, <select>, or <textarea> that:
        1. Is visible
        2. Is NOT readonly/disabled
        3. Has an empty value (or no file selected for file inputs)
        4. Appears to be a meaningful field (e.g. "Address Line 2", "Upload Document", "Comments")
        5. IGNORE hidden fields, search bars, or insignificant UI elements.
        
        CRITICAL: The 'label' MUST be the visible text on the screen (e.g. "Street Address", "Resume"), NOT the ID or Selector (e.g. #input_123).
        
        OUTPUT:
        Return a JSON list of objects describing missing fields:
        {
            "missing_fields": [
                { "label": "Address Line 2", "selector": "#addr2", "type": "text" },
                { "label": "Upload Resume", "selector": "input[type='file']", "type": "file" }
            ]
        }
        `;

        try {
            const valCompletion = await openai.chat.completions.create({
                model: MODEL,
                messages: [{ role: "user", content: validationPrompt }],
                response_format: { type: "json_object" },
                max_tokens: 1000
            });
            const valContent = valCompletion.choices[0].message.content || "{}";
            const valData = JSON.parse(valContent);
            const missingFields = valData.missing_fields || [];

            if (Array.isArray(missingFields) && missingFields.length > 0) {
                await logger.log(`Found ${missingFields.length} unfilled fields. Asking user...`, 'warning');

                for (const field of missingFields) {
                    // Check if it's really empty/meaningful by asking for User Input
                    // We reuse the existing flow: ask user, then fill.
                    const label = field.label || "Unfilled Field";
                    const type = field.type === 'file' ? 'file' : 'text';
                    const selector = field.selector;

                    if (type === 'file') {
                        await logger.log(`Asking user for missing file: ${label}`, 'warning');
                        const newPath = await waitForResume(profileData.job_id, 'file', label);
                        if (newPath) {
                            if (fs.existsSync(path.resolve(newPath))) {
                                await page.setInputFiles(selector, path.resolve(newPath)).catch(() => { });
                                await logger.log(`Uploaded late-provided file: ${label}`, 'success');
                            }
                        }
                    } else {
                        await logger.log(`Asking user for missing text: ${label}`, 'warning');
                        const resp = await waitForResume(profileData.job_id, 'text', label);
                        if (resp) {
                            // --- LEARNING MOMENT ---
                            if (profileData.profile_id) {
                                await saveLearnedData(profileData.profile_id, label, resp);
                                await logger.log(`Saved "${label}" to your profile for future use.`, 'success');
                            }
                            // -----------------------

                            // Attempt to fill using BEST EFFORT
                            try {
                                await page.fill(selector, resp);
                                await logger.log(`Filled ${label} with user input`, 'success');
                            } catch (e) {
                                // Fallback: try by label?
                                await logger.log(`Could not auto-fill ${selector}. Please fill manually if needed.`, 'warning');
                            }
                        }
                    }
                }

            } else {
                await logger.log("Validation passed. All relevant fields appear filled.", "info");
            }
        } catch (e: any) {
            await logger.log(`Validation/Recovery failed: ${e.message}`, 'warning');
        }
        // --- END VALIDATION ---

        await logger.log('Job Completed Successfully', 'success');
        // No DB update here

    } catch (err: any) {
        console.error("Automation Error:", err);
        await logger.log(`Job Failed: ${err.message}`, 'error');
        throw err; // Re-throw to let Worker know it failed
    } finally {
        // await browser.close(); // Keep open for debugging
        console.log("Browser left open for debugging.");
    }
}
