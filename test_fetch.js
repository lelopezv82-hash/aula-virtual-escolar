const https = require('https');

function fetchUrl(url) {
  return new Promise((resolve) => {
    https.get(url, (res) => {
      let body = '';
      res.on('data', chunk => body += chunk);
      res.on('end', () => {
        resolve({ statusCode: res.statusCode, headers: res.headers, bodyLength: body.length, bodySnippet: body.slice(0, 300) });
      });
    }).on('error', (err) => {
      resolve({ error: err.message });
    });
  });
}

async function main() {
  console.log('Testing live website paths...');
  
  const loginRes = await fetchUrl('https://aula-virtual-co.onrender.com/login');
  console.log('--- LOGIN PAGE ---');
  console.log(loginRes);

  const adminRes = await fetchUrl('https://aula-virtual-co.onrender.com/admin/administradores');
  console.log('--- ADMIN ADMINS PAGE ---');
  console.log(adminRes);
}

main().catch(console.error);
