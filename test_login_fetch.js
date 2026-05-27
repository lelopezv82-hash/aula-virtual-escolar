const https = require('https');

function makePost(url, data) {
  return new Promise((resolve, reject) => {
    const urlObj = new URL(url);
    const postData = JSON.stringify(data);
    
    const options = {
      hostname: urlObj.hostname,
      port: urlObj.port || 443,
      path: urlObj.pathname,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(postData)
      }
    };

    const req = https.request(options, (res) => {
      let body = '';
      res.on('data', chunk => body += chunk);
      res.on('end', () => {
        try {
          resolve({ statusCode: res.statusCode, headers: res.headers, body: JSON.parse(body) });
        } catch (e) {
          resolve({ statusCode: res.statusCode, headers: res.headers, body });
        }
      });
    });

    req.on('error', reject);
    req.write(postData);
    req.end();
  });
}

function makeGet(url, cookie) {
  return new Promise((resolve, reject) => {
    const urlObj = new URL(url);
    const options = {
      hostname: urlObj.hostname,
      port: urlObj.port || 443,
      path: urlObj.pathname + urlObj.search,
      method: 'GET',
      headers: {
        'Cookie': cookie
      }
    };

    const req = https.request(options, (res) => {
      let body = '';
      res.on('data', chunk => body += chunk);
      res.on('end', () => {
        try {
          resolve({ statusCode: res.statusCode, headers: res.headers, body: JSON.parse(body) });
        } catch (e) {
          resolve({ statusCode: res.statusCode, headers: res.headers, body });
        }
      });
    });

    req.on('error', reject);
    req.end();
  });
}

async function main() {
  console.log('Logging in as super admin...');
  const loginRes = await makePost('https://aula-virtual-co.onrender.com/api/auth/login', {
    username: 'admin',
    password: 'admin123'
  });
  
  console.log('Login Status:', loginRes.statusCode);
  console.log('Login Body:', loginRes.body);
  
  if (loginRes.statusCode !== 200) {
    console.error('Login failed!');
    return;
  }

  // Get auth_token cookie
  const setCookieHeaders = loginRes.headers['set-cookie'];
  if (!setCookieHeaders) {
    console.error('No set-cookie headers found!');
    return;
  }

  const cookie = setCookieHeaders.map(c => c.split(';')[0]).join('; ');
  console.log('Auth Cookie:', cookie);

  console.log('\nFetching /admin/administradores...');
  const adminPageRes = await makeGet('https://aula-virtual-co.onrender.com/admin/administradores', cookie);
  console.log('Admin Page Status:', adminPageRes.statusCode);
  console.log('Admin Page Headers:', adminPageRes.headers);
  console.log('Admin Page Body length:', adminPageRes.body.length);
  if (typeof adminPageRes.body === 'string') {
    console.log('Admin Page Body Snippet:', adminPageRes.body.slice(0, 500));
  } else {
    console.log('Admin Page Body:', adminPageRes.body);
  }

  console.log('\nFetching API /api/admin/administradores...');
  const apiRes = await makeGet('https://aula-virtual-co.onrender.com/api/admin/administradores', cookie);
  console.log('API Status:', apiRes.statusCode);
  console.log('API Body:', apiRes.body);
}

main().catch(console.error);
