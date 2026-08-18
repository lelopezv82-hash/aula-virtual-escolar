const { createClient } = require('@supabase/supabase-js');
const supabaseUrl = process.env.SUPABASE_URL || 'https://placeholder.supabase.co';
const supabaseKey = process.env.SUPABASE_ANON_KEY || 'placeholder-key';
const supabase = createClient(supabaseUrl, supabaseKey);

async function test() {
  const blob = new Blob(['hello world'], { type: 'text/plain' });
  const file = new File([blob], 'test.txt', { type: 'text/plain' });
  try {
    const { data, error } = await supabase.storage.from('aula-virtual').upload('test.txt', file, { contentType: file.type });
    console.log('Result:', data, error);
  } catch (e) {
    console.error('Exception:', e);
  }
}
test();
