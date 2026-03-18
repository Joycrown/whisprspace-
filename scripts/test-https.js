
const https = require('https');

const url = 'https://utuafbxaxvetxcvtxqrv.supabase.co/rest/v1/seed_config?id=eq.1&select=*';

const options = {
  method: 'GET',
  headers: {
    'apikey': process.env.SUPABASE_SERVICE_ROLE_KEY || '',
    'Authorization': 'Bearer ' + (process.env.SUPABASE_SERVICE_ROLE_KEY || '')
  },
  timeout: 10000
};

console.log('Requesting with HTTPS module...');
const req = https.request(url, options, (res) => {
  console.log('Status Code:', res.statusCode);
  let data = '';
  res.on('data', (chunk) => data += chunk);
  res.on('end', () => console.log('Data sample:', data.substring(0, 100)));
});

req.on('error', (err) => console.error('HTTPS Error:', err.message));
req.on('timeout', () => {
  console.error('Request timed out');
  req.destroy();
});
req.end();
