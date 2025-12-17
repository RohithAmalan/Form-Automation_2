const { chromium } = require('playwright');

async function processForms(inputs) {
    if (!Array.isArray(inputs)) {
        inputs = [inputs];
    }

    const results = [];
    const browser = await chromium.launch({ headless: false });
    const context = await browser.newContext();
    const page = await context.newPage();

    console.log(`Starting processing of ${inputs.length} entries...`);

    for (let i = 0; i < inputs.length; i++) {
        const data = inputs[i];
        const entryResult = { status: 'pending', entryIndex: i + 1, data: data, logs: [] };
        
        console.log(`\n--- Processing Entry ${i + 1}/${inputs.length} ---`);

        // Use URL from data entry, or fallback
        const targetUrl = data.url || 'https://fs1.formsite.com/res/showFormEmbed?EParam=B6fiTn-RcO5Oi8C4iSTjsq4WXqv4L_Qk&748593425&EmbedId=748593425';

        try {
            console.log(`Navigating to: ${targetUrl}`);
            await page.goto(targetUrl);
            await page.waitForLoadState('networkidle');

            // --- Form Filling Logic ---
            for (const [key, value] of Object.entries(data)) {
                if (key === 'url') continue; 

                try {
                    // Strategy 1: exact label match
                    const labelLocator = page.getByLabel(key, { exact: false });

                    if (await labelLocator.count() > 0 && await labelLocator.first().isVisible()) {
                        const tagName = await labelLocator.first().evaluate(el => el.tagName.toLowerCase());

                        if (tagName === 'select') {
                            await labelLocator.first().selectOption({ label: value }).catch(() => labelLocator.first().selectOption({ value: value }));
                            entryResult.logs.push(`Selected "${value}" for "${key}"`);
                        } else {
                            const input = labelLocator.first();
                            if (await input.isEditable()) {
                                await input.fill(value);
                                // Optional: press Enter if needed, but often not needed for each field
                                // await input.press('Enter'); 
                                entryResult.logs.push(`Filled "${value}" for "${key}"`);
                            } else {
                                entryResult.logs.push(`Field "${key}" is read-only. Skipped.`);
                            }
                        }
                        continue;
                    }

                    // Strategy 2: Placeholder match
                    const placeholderLocator = page.getByPlaceholder(key, { exact: false });
                    if (await placeholderLocator.count() > 0 && await placeholderLocator.first().isVisible()) {
                        if (await placeholderLocator.first().isEditable()) {
                            await placeholderLocator.first().fill(value);
                            entryResult.logs.push(`Filled "${value}" via placeholder for "${key}"`);
                        }
                        continue;
                    }

                    console.warn(`Could not find a standard input for "${key}". Skipping.`);
                    entryResult.logs.push(`Warning: input for "${key}" not found.`);

                } catch (err) {
                    console.error(`Error filling "${key}":`, err.message);
                    entryResult.logs.push(`Error filling "${key}": ${err.message}`);
                }
            }

            // --- Submission Logic ---
            try {
                const submitBtn = page.getByRole('button', { name: 'Submit' });
                if (await submitBtn.count() > 0) {
                    await submitBtn.click();
                    entryResult.logs.push("Clicked Submit button");
                } else {
                    await page.click("input[type='submit']");
                    entryResult.logs.push("Clicked Submit (fallback)");
                }

                // Wait for some success indicator or simple timeout
                await page.waitForTimeout(3000); 
                entryResult.status = 'success';

            } catch (e) {
                entryResult.status = 'error';
                entryResult.error = e.message;
                console.error("Error clicking submit:", e.message);
            }

        } catch (entryError) {
            entryResult.status = 'error';
            entryResult.error = entryError.message;
            console.error(`Failed to process entry ${i + 1}:`, entryError);
        }
        
        results.push(entryResult);
    }

    await browser.close();
    return results;
}

module.exports = { processForms };
