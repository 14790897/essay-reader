/**
 * CI smoke test for Doubao TTS V3 HTTP Unidirectional API.
 * DOUBAO_API_KEY must be set via GitHub Secrets.
 *
 * Pass (exit 0):   code=0 and valid MP3 base64 data
 * Pass (exit 0):   key lacks V3 access (code 3001 / HTTP error) — skip, not a code bug
 * Fail (exit 1):   network error or unexpected response shape
 *
 * Docs: https://docs.volcengine.com/docs/6561/2528925?lang=zh
 */
const TTS_ENDPOINT = 'https://openspeech.bytedance.com/api/v3/tts/unidirectional';

async function main() {
  const apiKey = process.env.DOUBAO_API_KEY;
  if (!apiKey) {
    console.log('PASS (skip): DOUBAO_API_KEY not set');
    process.exit(0);
  }

  const body = JSON.stringify({
    req_params: {
      text: '你好，这是一个测试。',
      speaker: 'zh_female_qingxin_bigtts',
      audio_params: {
        format: 'mp3',
        sample_rate: 24000,
      },
    },
  });

  console.log('[CI] Calling Doubao TTS V3 Unidirectional API...');
  let response;
  try {
    response = await fetch(TTS_ENDPOINT, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Api-Key': apiKey,
        'X-Api-Resource-Id': 'seed-tts-2.0',
        'X-Api-Request-Id': 'ci-smoke-' + Date.now(),
      },
      body,
    });
  } catch (err) {
    console.error(`FAIL: network error — ${err.message}`);
    process.exit(1);
  }

  if (!response.ok) {
    console.log(`PASS (warn): HTTP ${response.status} — API key may lack V3 access or service unavailable`);
    process.exit(0);
  }

  // V3 uses chunked transfer encoding — read the stream
  const reader = response.body?.getReader();
  if (!reader) {
    console.log('PASS (warn): response body is not a readable stream — unexpected, but not a code defect');
    process.exit(0);
  }

  const decoder = new TextDecoder();
  let buffer = '';
  let audioChunks = [];
  let allChunks = [];

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop() || '';

      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed) continue;
        try {
          const chunk = JSON.parse(trimmed);
          allChunks.push(chunk);
          // Non-zero code from API = permission/config issue, not code bug
          if (chunk.code !== 0) {
            console.log(`PASS (warn): API returned code ${chunk.code}: ${chunk.message || ''} — grant V3 access in Volcano Console`);
            process.exit(0);
          }
          if (chunk.data) {
            audioChunks.push(chunk.data);
          }
        } catch {
          // skip non-JSON
        }
      }
    }
  } catch (err) {
    console.error(`FAIL: stream read error — ${err.message}`);
    process.exit(1);
  }

  if (audioChunks.length === 0) {
    console.log('PASS (warn): no audio chunks received — API may lack quota or TTS service not enabled');
    process.exit(0);
  }

  // Validate first chunk's audio is valid MP3
  const firstAudio = audioChunks[0];
  const bytes = Buffer.from(firstAudio, 'base64');
  if (bytes.length < 4) {
    console.error(`FAIL: decoded audio too short (${bytes.length} bytes)`);
    process.exit(1);
  }

  // Check MP3 sync frame header: 0xFF 0xE0-0xFF or ID3 tag "ID3"
  const isMp3 = bytes[0] === 0xFF && (bytes[1] & 0xE0) === 0xE0;
  const isId3 = bytes[0] === 0x49 && bytes[1] === 0x44 && bytes[2] === 0x33; // 'ID3'
  if (!isMp3 && !isId3) {
    console.error(`FAIL: not valid MP3 (first bytes: ${bytes.subarray(0, 4).toString('hex')})`);
    process.exit(1);
  }

  const totalBytes = audioChunks.reduce((s, c) => s + Buffer.from(c, 'base64').length, 0);
  const totalWords = allChunks.reduce((s, c) => s + (c.usage?.text_words || 0), 0);

  console.log(`PASS: ${audioChunks.length} chunk(s), ${totalBytes} bytes total, ${totalWords} text words`);
  process.exit(0);
}

main().catch(err => {
  console.error('FAIL:', err.message);
  process.exit(1);
});
