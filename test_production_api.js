async function main() {
  const loginUrl = 'https://aula-virtual-co.onrender.com/api/auth/login';
  const apiUrl = 'https://aula-virtual-co.onrender.com/api/estudiante/tareas/4aade8a8-4138-4c3c-8c62-d75f11cf9ab1';

  console.log('Logging in to production...');
  try {
    const loginRes = await fetch(loginUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        username: 'pedro.perez',
        password: '123'
      })
    });

    // Extract cookie
    const cookies = loginRes.headers.getSetCookie();
    const token = cookies.find(c => c.startsWith('auth_token=')).split(';')[0];

    console.log('Fetching production task details API...');
    const apiRes = await fetch(apiUrl, {
      headers: {
        Cookie: token
      }
    });

    const data = await apiRes.json();
    console.log('API response keys:', Object.keys(data));
    console.log('feedbackTemplate length/presence:', data.feedbackTemplate ? data.feedbackTemplate.length : 'NULL');
    if (data.feedbackTemplate) {
      console.log('feedbackTemplate preview:', data.feedbackTemplate.substring(0, 200));
    }
  } catch (error) {
    console.error('Error:', error.message);
  }
}

main();
