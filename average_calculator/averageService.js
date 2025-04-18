const express = require('express');
const axios = require('./node_modules/axios/index.d.cts');

const app = express();
const PORT = 9876;

// Updated TOKEN
const BASE_URL = 'http://20.244.56.144/evaluation-service';
const TOKEN = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJNYXBDbGFpbXMiOnsiZXhwIjoxNzQzNzQ3NzIyLCJpYXQiOjE3NDM3NDc0MjIsImlzcyI6IkFmZm9yZG1lZCIsImp0aSI6IjZiOGZlMGJiLWIwM2YtNDA1Ni04MGYyLTI3YTVkNzUyNTQ1NCIsInN1YiI6ImUyMmNzZXUwNDkyQGJlbm5ldHQuZWR1LmluIn0sImVtYWlsIjoiZTIyY3NldTA0OTJAYmVubmV0dC5lZHUuaW4iLCJuYW1lIjoic2hpa2hhciBzcml2YXN0YXZhIiwicm9sbE5vIjoiZTIyY3NldTA0OTIiLCJhY2Nlc3NDb2RlIjoicnRDSFpKIiwiY2xpZW50SUQiOiI2YjhmZTBiYi1iMDNmLTQwNTYtODBmMi0yN2E1ZDc1MjU0NTQiLCJjbGllbnRTZWNyZXQiOiJnVHpRQ1JjWVN4eWtYcmpwIn0._XAcQCCN1eFh6l-MZfqQHw2I5ASgNVbwHHuUxpRuOlQ';

let windowCurrState = [];

// Add extended timeout for API calls
const apiClient = axios.create({
  timeout: 10000,
  headers: {
    Authorization: `Bearer ${TOKEN}`
  }
});

// Add direct test route
app.get('/test-api/:numberType', async (req, res) => {
  const { numberType } = req.params;
  const url = `${BASE_URL}/${numberType}`;
  
  try {
    console.log(`Testing direct API call to: ${url}`);
    const response = await apiClient.get(url);
    console.log('Direct API test successful:', response.status);
    res.json({
      success: true,
      status: response.status,
      data: response.data
    });
    
  } catch (error) {
    console.error('Direct API test failed:', {
      message: error.message,
      status: error.response?.status,
      data: error.response?.data
    });
    
    res.status(500).json({
      success: false,
      error: error.message,
      status: error.response?.status,
      data: error.response?.data
    });
  }
});

// Root path handler
app.get('/', (req, res) => {
  res.send(`
    <html>
      <head><title>Numbers API</title></head>
      <body>
        <h1>Welcome to the Numbers API</h1>
        <p>Available endpoints:</p>
        <ul>
          <li><a href="/numbers/primes">/numbers/primes</a></li>
          <li><a href="/numbers/fibo">/numbers/fibo</a></li>
          <li><a href="/numbers/odd">/numbers/odd</a></li>
          <li><a href="/numbers/even">/numbers/even</a></li>
          <li><a href="/numbers/rand">/numbers/rand</a></li>
        </ul>
        <p>Test endpoints (direct API call):</p>
        <ul>
          <li><a href="/test-api/primes">/test-api/primes</a></li>
          <li><a href="/test-api/fibo">/test-api/fibo</a></li>
          <li><a href="/test-api/odd">/test-api/odd</a></li>
          <li><a href="/test-api/even">/test-api/even</a></li>
          <li><a href="/test-api/rand">/test-api/rand</a></li>
        </ul>
      </body>
    </html>
  `);
});

app.get('/numbers/:numberType', async (req, res) => {
    const numberType = req.params.numberType;
    console.log(`Received request for number type: ${numberType}`);

    // Allow only specific types
    const allowedTypes = ['primes', 'fibo', 'odd', 'even', 'rand'];
    if (!allowedTypes.includes(numberType)) {
        console.log(`Invalid number type: ${numberType}`);
        return res.status(400).json({ error: 'Invalid number type' });
    }

    try {
        const apiUrl = `${BASE_URL}/${numberType}`;
        console.log(`Making API request to: ${apiUrl}`);
        
        console.time('API Request Duration');
        const response = await apiClient.get(apiUrl);
        console.timeEnd('API Request Duration');

        console.log(`API response received. Status: ${response.status}`);
        
        if (!response.data || !response.data.numbers) {
            console.error('API returned unexpected data structure:', response.data);
            return res.status(500).json({ 
                error: 'API returned unexpected response format',
                data: response.data
            });
        }
        
        const newNumbers = response.data.numbers;
        console.log(`Numbers received: ${JSON.stringify(newNumbers)}`);
        
        const windowPrevState = [...windowCurrState];

        // Push unique values
        newNumbers.forEach(num => {
            if (!windowCurrState.includes(num)) {
                windowCurrState.push(num);
            }
        });

        // Keep last 10
        if (windowCurrState.length > 10) {
            windowCurrState = windowCurrState.slice(-10);
        }

        const avg = windowCurrState.length > 0
            ? parseFloat((windowCurrState.reduce((a, b) => a + b, 0) / windowCurrState.length).toFixed(2))
            : null;

        res.json({
            windowPrevState,
            windowCurrState,
            numbers: newNumbers,
            avg
        });

    } catch (error) {
        console.error('\n===== API ERROR DETAILS =====');
        console.error('Error message:', error.message);
        console.error('Request URL:', `${BASE_URL}/${numberType}`);
        console.error('Response status:', error.response?.status);
        console.error('Response data:', error.response?.data);
        console.error('=============================\n');
        
        // Return detailed error information
        res.status(500).json({ 
            error: 'Failed to fetch numbers',
            message: error.message,
            endpoint: `${BASE_URL}/${numberType}`,
            status: error.response?.status || 'Unknown',
            details: error.response?.data || 'No response data available'
        });
    }
});

// Error handler middleware
app.use((err, req, res, next) => {
    console.error('Express error:', err);
    res.status(500).json({
        error: 'Server error',
        message: err.message
    });
});

// Start server with better error handling
app.listen(PORT, () => {
    console.log(`🚀 Server running at http://localhost:${PORT}`);
    console.log(`Testing endpoints available at http://localhost:${PORT}/test-api/primes`);
}).on('error', (err) => {
    console.error('❌ Server failed to start:', err.message);
    if (err.code === 'EADDRINUSE') {
        console.error(`Port ${PORT} is already in use. Try a different port.`);
    }
});
