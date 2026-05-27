const https = require('https');
const fs = require('fs');
const path = require('path');

const RENDER_API_KEY = 'rnd_4OnCVuMVqth46XeVlb7kGVW9Aez9';
const OWNER_ID = 'tea-d8aumf5ckfvc73djv5m0';
const SERVICE_ID = 'srv-d8avvkegvqtc73a4bqa0';

function makeRequest(url, headers = {}) {
  return new Promise((resolve, reject) => {
    https.get(url, { headers }, (res) => {
      let body = '';
      res.on('data', chunk => body += chunk);
      res.on('end', () => {
        try {
          resolve({ statusCode: res.statusCode, body: JSON.parse(body) });
        } catch (e) {
          resolve({ statusCode: res.statusCode, body });
        }
      });
    }).on('error', reject);
  });
}

async function main() {
  console.log('Fetching logs from Render...');
  const url = `https://api.render.com/v1/logs?ownerId=${OWNER_ID}&resource=${SERVICE_ID}&limit=100`;
  const res = await makeRequest(url, {
    'Accept': 'application/json',
    'Authorization': `Bearer ${RENDER_API_KEY}`
  });
  
  if (res.statusCode !== 200) {
    console.error('Failed to get logs:', res.body);
    return;
  }

  const outPath = 'C:/Users/Estudiante/.gemini/antigravity/scratch/aula_virtual_escolar/response.json';
  fs.writeFileSync(outPath, JSON.stringify(res.body, null, 2), 'utf8');
  console.log(`Successfully wrote raw logs to ${outPath}`);
}

main().catch(console.error);
