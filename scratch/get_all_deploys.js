const https = require('https');

const RENDER_API_KEY = 'rnd_4OnCVuMVqth46XeVlb7kGVW9Aez9';
const SERVICE_ID = 'srv-d8avvkegvqtc73a4bqa0';

const options = {
  hostname: 'api.render.com',
  path: `/v1/services/${SERVICE_ID}/deploys`,
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
    const deploys = JSON.parse(body);
    console.log('Latest Deploys:');
    deploys.slice(0, 5).forEach(d => {
      console.log(`- ID: ${d.deploy.id}, Status: ${d.deploy.status}, CreatedAt: ${d.deploy.createdAt}, Commit: ${d.deploy.commit.message}`);
    });
  });
});

req.on('error', (e) => {
  console.error('Error fetching deploys:', e);
});

req.end();
