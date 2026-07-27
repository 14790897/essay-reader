// Local CORS proxy for Doubao TTS (dev use)
// Usage: node proxy-server.mjs
// Supports two modes:
//   POST /                          → forwards to hardcoded TTS_ENDPOINT
//   POST /<any-url-encoded-target>  → forwards to the target URL
//   OPTIONS (any path)              → returns CORS preflight headers

import http from 'http';
import https from 'https';

const PORT = 3001;
const TTS_ENDPOINT = 'https://openspeech.bytedance.com/api/v1/tts';

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, X-Api-Key, X-Api-Resource-Id',
};

function resolveTarget(pathname) {
  // pathname is something like "/https://openspeech.bytedance.com/api/v1/tts"
  const path = pathname.replace(/^\/+/, '');
  if (!path || path === '/') return TTS_ENDPOINT;

  // Reconstruct the full URL from path (handle the "http:/" → "http://" issue)
  // Path will look like: "https:/openspeech.bytedance.com/api/v1/tts"
  // because slashes get collapsed. Reconstruct.
  const match = path.match(/^https?:?\/?(.*)/i);
  if (match) {
    const protocol = path.startsWith('https') ? 'https' : 'http';
    return protocol + '://' + match[1].replace(/^\/+/, '');
  }
  return TTS_ENDPOINT;
}

http.createServer(async (req, res) => {
  Object.entries(CORS_HEADERS).forEach(([k, v]) => res.setHeader(k, v));

  if (req.method === 'OPTIONS') { res.writeHead(200); res.end(); return; }
  if (req.method !== 'POST') { res.writeHead(405); res.end('POST only'); return; }

  const target = resolveTarget(req.url ? new URL(req.url, `http://localhost:${PORT}`).pathname : '/');
  console.log(`[proxy] ${req.method} → ${target}`);

  let body = '';
  req.on('data', c => body += c);
  req.on('end', async () => {
    try {
      const upstream = await fetch(target, {
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
}).listen(PORT, () => console.log(`Doubao proxy on http://localhost:${PORT}
  Direct:   POST http://localhost:${PORT}/
  Prefixed: POST http://localhost:${PORT}/https://openspeech.bytedance.com/api/v1/tts`));
