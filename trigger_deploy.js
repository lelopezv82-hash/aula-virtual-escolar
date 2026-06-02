const https = require('https');

const RENDER_API_KEY = 'rnd_4OnCVuMVqth46XeVlb7kGVW9Aez9';
const SERVICE_ID = 'srv-d8avvkegvqtc73a4bqa0';

const data = JSON.stringify({
  clearCache: 'do_not_clear'
});

const options = {
  hostname: 'api.render.com',
  path: `/v1/services/${SERVICE_ID}/deploys`,
  method: 'POST',
  headers: {
    'Accept': 'application/json',
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${RENDER_API_KEY}`,
    'User-Agent': 'node-deploy-trigger',
    'Content-Length': data.length
  }
};

const req = https.request(options, (res) => {
  let body = '';
  res.on('data', chunk => body += chunk);
  res.on('end', () => {
    console.log('Status Code:', res.statusCode);
    console.log('Response:', body);
  });
});

req.on('error', (e) => {
  console.error('Error triggering deploy:', e);
});

req.write(data);
req.end();
