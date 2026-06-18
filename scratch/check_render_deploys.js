const https = require('https');

const RENDER_API_KEY = 'rnd_4OnCVuMVqth46XeVlb7kGVW9Aez9';
const SERVICE_ID = 'srv-d8avvkegvqtc73a4bqa0';
const DEPLOY_ID = 'dep-d8q7ktgk1i2s73fsn98g';

const options = {
  hostname: 'api.render.com',
  path: `/v1/services/${SERVICE_ID}/deploys/${DEPLOY_ID}`,
  method: 'GET',
  headers: {
    'Accept': 'application/json',
    'Authorization': `Bearer ${RENDER_API_KEY}`,
    'User-Agent': 'node-deploy-checker'
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
  console.error('Error fetching deploy:', e);
});

req.end();
