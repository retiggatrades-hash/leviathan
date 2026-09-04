const https = require('https');
function fetch(url) {
  return new Promise((resolve, reject) => {
    https.get(url, (res) => {
      let body = '';
      res.on('data', (chunk) => body += chunk);
      res.on('end', () => resolve({ statusCode: res.statusCode, body }));
    }).on('error', reject);
  });
}
(async () => {
  try {
    const urls = [
      'https://leviathan-56ara6c1a-velox-x.vercel.app/',
      'https://leviathan-56ara6c1a-velox-x.vercel.app/api/telegram'
    ];
    for (const url of urls) {
      const result = await fetch(url);
      console.log(url, result.statusCode, result.body.slice(0, 200));
    }
  } catch (err) {
    console.error('ERROR', err.message || err);
    process.exit(1);
  }
})();
