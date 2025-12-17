const { chromium } = require('playwright');
const fs = require('fs');

async function main() {
    // Load data - Support both Array and Object (convert to array if object)
    const rawData = JSON.parse(fs.readFileSync('../form_data.json', 'utf8'));
    const inputs = Array.isArray(rawData) ? rawData : [rawData];

    // Launch browser once
    const browser = await chromium.launch({ headless: false });
    const context = await browser.newContext();
    const page = await context.newPage();

    console.log(`Starting processing of ${inputs.length} entries...`);

    for (let i = 0; i < inputs.length; i++) {
        const data = inputs[i];
        console.log(`\n--- Processing Entry ${i + 1}/${inputs.length} ---`);

        // Use URL from data entry, or fallback to a default/hardcoded one if not present
        const targetUrl = data.url || 'https://fs1.formsite.com/res/showFormEmbed?EParam=B6fiTn-RcO5Oi8C4iSTjsq4WXqv4L_Qk&748593425&EmbedId=748593425';

        try {
            console.log(`Navigating to: ${targetUrl}`);
            await page.goto(targetUrl);
            await page.waitForLoadState('networkidle');

            console.log("Filling form...");

            for (const [key, value] of Object.entries(data)) {
                if (key === 'url') continue; // Skip configuration keys

                try {
                    console.log(`Looking for field: "${key}"...`);

                    // Strategy 1: exact label match
                    const labelLocator = page.getByLabel(key, { exact: false });

                    if (await labelLocator.count() > 0 && await labelLocator.first().isVisible()) {
                        const tagName = await labelLocator.first().evaluate(el => el.tagName.toLowerCase());

                        if (tagName === 'select') {
                            // Handle Dropdown
                            await labelLocator.first().selectOption({ label: value }).catch(() => labelLocator.first().selectOption({ value: value }));
                            console.log(`   -> Selected "${value}"`);
                        } else {
                            // Handle Input/Textarea
                            const input = labelLocator.first();
                            if (await input.isEditable()) {
                                await input.fill(value);
                                await input.press('Enter');
                                console.log(`   -> Filled "${value}"`);
                            } else {
                                console.log(`   -> Field "${key}" is read-only. Skipping.`);
                            }
                        }
                        continue;
                    }

                    // Strategy 2: Placeholder match
                    const placeholderLocator = page.getByPlaceholder(key, { exact: false });
                    if (await placeholderLocator.count() > 0 && await placeholderLocator.first().isVisible()) {
                        if (await placeholderLocator.first().isEditable()) {
                            await placeholderLocator.first().fill(value);
                            console.log(`   -> Filled via placeholder`);
                        }
                        continue;
                    }

                    console.warn(`Could not find a standard input for "${key}". Skipping.`);

                } catch (err) {
                    console.error(`Error filling "${key}":`, err.message);
                }
            }

            // Submit Logic
            try {
                console.log("Looking for Submit button...");
                const submitBtn = page.getByRole('button', { name: 'Submit' });
                if (await submitBtn.count() > 0) {
                    await submitBtn.click();
                    console.log("Clicked Submit!");
                } else {
                    await page.click("input[type='submit']");
                    console.log("Clicked Submit (fallback)!");
                }

                // Wait for successful submission indication
                await page.waitForTimeout(3000);

                console.log(`Entry ${i + 1} Done.`);

            } catch (e) {
                console.error("Error clicking submit:", e.message);
            }

        } catch (entryError) {
            console.error(`Failed to process entry ${i + 1}:`, entryError);
        }
    }

    await browser.close();
    console.log("\nAll entries processed.");
}

main().catch(console.error);
