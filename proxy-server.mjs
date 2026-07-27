// Local CORS proxy for Doubao TTS (dev use)
// Usage: node proxy-server.mjs
import http from 'http';

const PORT = 3001;
const TTS_URL = 'https://openspeech.bytedance.com/api/v1/tts';

http.createServer(async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, X-Api-Key, X-Api-Resource-Id');

  if (req.method === 'OPTIONS') { res.writeHead(200); res.end(); return; }
  if (req.method !== 'POST') { res.writeHead(405); res.end('POST only'); return; }

  let body = '';
  req.on('data', c => body += c);
  req.on('end', async () => {
    try {
      const upstream = await fetch(TTS_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Api-Key': req.headers['x-api-key'] || '',
          'X-Api-Resource-Id': req.headers['x-api-resource-id'] || 'seed-tts-2.0',
        },
        body,
      });
      const data = await upstream.json();
      res.writeHead(upstream.status, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(data));
    } catch (err) {
      res.writeHead(502);
      res.end(JSON.stringify({ error: 'Upstream error: ' + err.message }));
    }
  });
}).listen(PORT, () => console.log(`Doubao proxy on http://localhost:${PORT}`));
