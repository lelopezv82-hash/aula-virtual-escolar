const https = require('https');

const RENDER_API_KEY = 'rnd_4OnCVuMVqth46XeVlb7kGVW9Aez9';
const SERVICE_ID = 'srv-d8avvkegvqtc73a4bqa0';
const DEPLOY_ID = 'dep-d929amjtqb8s73f4722g';

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

let attempts = 0;
const maxAttempts = 15;

function check() {
  attempts++;
  const req = https.request(options, (res) => {
    let body = '';
    res.on('data', chunk => body += chunk);
    res.on('end', () => {
      if (res.statusCode !== 200) {
        console.log(`Error: status code ${res.statusCode}`);
        return;
      }
      const data = JSON.parse(body);
      // Detail response is at data.status or data.deploy.status depending on exact shape
      const deployObj = data.deploy || data;
      const status = deployObj.status;
      console.log(`[Attempt ${attempts}/${maxAttempts}] Deploy Status: ${status}`);
      if (status === 'live') {
        console.log('Deploy is live! Success!');
        process.exit(0);
      } else if (status === 'build_failed' || status === 'canceled') {
        console.log('Deploy failed or was canceled.');
        process.exit(1);
      } else {
        if (attempts < maxAttempts) {
          setTimeout(check, 15000); // check again in 15 seconds
        } else {
          console.log('Timed out waiting for deploy to be live.');
          process.exit(1);
        }
      }
    });
  });
  req.on('error', (e) => {
    console.error('Request error:', e);
    if (attempts < maxAttempts) {
      setTimeout(check, 15000);
    }
  });
  req.end();
}

check();
