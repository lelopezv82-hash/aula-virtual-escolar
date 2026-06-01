const https = require('https');

const RENDER_API_KEY = 'rnd_4OnCVuMVqth46XeVlb7kGVW9Aez9';
const SERVICE_ID = 'srv-d8avvkegvqtc73a4bqa0';

function makeRequest(url) {
  const urlObj = new URL(url);
  const options = {
    hostname: urlObj.hostname,
    path: urlObj.pathname + urlObj.search,
    method: 'GET',
    headers: {
      'Accept': 'application/json',
      'Authorization': `Bearer ${RENDER_API_KEY}`,
      'User-Agent': 'node-status-check'
    }
  };

  return new Promise((resolve) => {
    https.get(options, (res) => {
      let body = '';
      res.on('data', chunk => body += chunk);
      res.on('end', () => {
        try {
          resolve(JSON.parse(body));
        } catch (e) {
          resolve(body);
        }
      });
    });
  });
}

async function main() {
  const deploys = await makeRequest(`https://api.render.com/v1/services/${SERVICE_ID}/deploys?limit=1`);
  if (deploys && deploys[0]) {
    const latest = deploys[0].deploy;
    console.log(`Latest Deploy ID: ${latest.id}`);
    console.log(`Status: ${latest.status}`);
    console.log(`Created At: ${latest.createdAt}`);
    console.log(`Updated At: ${latest.updatedAt}`);
  } else {
    console.log('No deploys found or error:', deploys);
  }
}

main();
