// Local CORS proxy for Doubao TTS (dev use)
// Usage: node proxy-server.mjs
// Supports streaming: forwards chunked responses from V3 unidirectional endpoint.
//   POST /                             → forwards to hardcoded TTS_ENDPOINT (V3)
//   POST /<any-url-encoded-target>     → forwards to the target URL
//   OPTIONS (any path)                 → returns CORS preflight headers

import http from 'http';
import https from 'https';

const PORT = 3001;
const TTS_ENDPOINT = 'https://openspeech.bytedance.com/api/v3/tts/unidirectional';

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, X-Api-Key, X-Api-Resource-Id, X-Api-Request-Id',
};

function resolveTarget(pathname) {
  const path = pathname.replace(/^\/+/, '');
  if (!path || path === '/') return TTS_ENDPOINT;

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
          'X-Api-Request-Id': req.headers['x-api-request-id'] || `proxy-${Date.now()}`,
        },
        body,
      });

      if (!upstream.ok) {
        res.writeHead(upstream.status, { 'Content-Type': 'application/json' });
        const text = await upstream.text().catch(() => '');
        res.end(JSON.stringify({ error: `Upstream ${upstream.status}: ${text}` }));
        return;
      }

      // Stream the response — V3 unidirectional uses chunked transfer encoding
      res.writeHead(upstream.status, {
        'Content-Type': 'application/json',
        'Transfer-Encoding': 'chunked',
      });

      const reader = upstream.body?.getReader();
      if (!reader) {
        res.end();
        return;
      }

      try {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          // Write chunk length in hex + CRLF, then data, then CRLF
          const hexLen = value.length.toString(16);
          res.write(hexLen + '\r\n');
          res.write(Buffer.from(value));
          res.write('\r\n');
        }
        res.write('0\r\n\r\n'); // terminal chunk
        res.end();
      } catch (err) {
        console.error('[proxy] streaming error:', err.message);
        if (!res.writableEnded) res.end();
      }
    } catch (err) {
      if (!res.writableEnded) {
        res.writeHead(502);
        res.end(JSON.stringify({ error: 'Upstream error: ' + err.message }));
      }
    }
  });
}).listen(PORT, () => console.log(`Doubao proxy on http://localhost:${PORT}
  Direct:   POST http://localhost:${PORT}/
  Prefixed: POST http://localhost:${PORT}/https://openspeech.bytedance.com/api/v3/tts/unidirectional`));
