require('dotenv').config();
const https = require('https');

const key = process.env.NVIDIA_API_KEY;
console.log('Key starts with:', key ? key.substring(0, 10) + '...' : 'UNDEFINED');
console.log('Key length:', key ? key.length : 0);

const data = JSON.stringify({
  model: 'z-ai/glm-5.1',
  messages: [{ role: 'user', content: 'hola' }],
  max_tokens: 50,
});

const req = https.request({
  hostname: 'integrate.api.nvidia.com',
  path: '/v1/chat/completions',
  method: 'POST',
  headers: {
    'Authorization': 'Bearer ' + key,
    'Content-Type': 'application/json',
    'Content-Length': Buffer.byteLength(data),
  },
}, (res) => {
  let body = '';
  res.on('data', (d) => body += d);
  res.on('end', () => {
    console.log('Status:', res.statusCode);
    console.log('Body:', body.substring(0, 400));
  });
});

req.on('error', (e) => console.error('Request error:', e.message));
req.write(data);
req.end();
