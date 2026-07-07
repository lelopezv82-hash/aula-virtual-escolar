const https = require('https');
const RENDER_API_KEY = 'rnd_4OnCVuMVqth46XeVlb7kGVW9Aez9';
const SERVICE_ID = 'srv-d8avvkegvqtc73a4bqa0';

const options = {
  hostname: 'api.render.com',
  path: `/v1/services/${SERVICE_ID}/env-vars`,
  method: 'GET',
  headers: {
    'Accept': 'application/json',
    'Authorization': `Bearer ${RENDER_API_KEY}`,
    'User-Agent': 'node'
  }
};

const req = https.request(options, (res) => {
  let body = '';
  res.on('data', chunk => body += chunk);
  res.on('end', () => {
    try {
      const data = JSON.parse(body);
      console.log('Env Vars:', JSON.stringify(data, null, 2));
    } catch (e) {
      console.log('Response:', body);
    }
  });
});

req.on('error', (e) => {
  console.error('Error fetching env vars:', e);
});

req.end();
