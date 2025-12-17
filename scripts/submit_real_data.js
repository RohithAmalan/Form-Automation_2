const fs = require('fs');

async function submitRealData() {
    try {
        // Read the local JSON file
        const rawData = fs.readFileSync('../form_data.json', 'utf8');
        const jsonData = JSON.parse(rawData);

        console.log(`Read ${jsonData.length} entries from form_data.json.`);
        console.log("Sending to API...");

        // Send to the API
        const response = await fetch('http://localhost:3000/fill-forms', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(jsonData)
        });

        const result = await response.json();

        console.log("\n--- API Response ---");
        console.log(JSON.stringify(result, null, 2));

    } catch (error) {
        console.error("Error:", error.message);
    }
}

submitRealData();
