// Node 18+ has built-in fetch, so we don't need to require it.
// If you are on an older version, please install node-fetch or upgrade Node.js.


// Sample data to test
const testData = [
    {
        "url": "https://fs1.formsite.com/res/showFormEmbed?EParam=B6fiTn-RcO5Oi8C4iSTjsq4WXqv4L_Qk&748593425&EmbedId=748593425",
        "Proposal title": "API Test Proposal",
        "First Name": "Test",
        "Last Name": "User",
        "Email Address": "test@example.com",
        "Description": "This is a test submission via the API."
    }
];

async function testApi() {
    try {
        console.log("Sending request to http://localhost:3000/fill-forms...");

        const response = await fetch('http://localhost:3000/fill-forms', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(testData)
        });

        const result = await response.json();

        console.log("\nResponse Status:", response.status);
        console.log("Response Body:");
        console.log(JSON.stringify(result, null, 2));

    } catch (error) {
        console.error("Error testing API:", error);
    }
}

// Check if fetch is available (Node 18+), otherwise warn
if (!globalThis.fetch) {
    console.error("This script uses 'fetch'. Please run with Node.js 18+ or install 'node-fetch'");
    // fall back to http request if needed, but let's assume modern node or user can install
} else {
    testApi();
}
