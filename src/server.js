const express = require('express');
const bodyParser = require('body-parser');
const { processForms } = require('./formRunner');

const app = express();
const port = 3000;

app.use(bodyParser.json());

app.post('/fill-forms', async (req, res) => {
    const inputs = req.body;

    if (!inputs) {
        return res.status(400).json({ error: 'No data provided' });
    }

    try {
        console.log('Received form fill request with data:', JSON.stringify(inputs).substring(0, 100) + '...');
        const results = await processForms(inputs);
        res.json({ message: 'Processing complete', results: results });
    } catch (error) {
        console.error('Error processing forms:', error);
        res.status(500).json({ error: 'Internal server error', details: error.message });
    }
});

app.listen(port, () => {
    console.log(`Form Automation API listening at http://localhost:${port}`);
});
