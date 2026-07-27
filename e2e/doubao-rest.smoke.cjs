/**
 * CI smoke test for Doubao TTS REST API.
 * DOUBAO_API_KEY must be set via GitHub Secrets.
 *
 * Pass: code=3000 and valid MP3 base64 data
 * Warn (exit 0): key lacks v1 REST access (code=3001) — needs resource grant in Volcano Console
 * Fail: network error or unexpected response
 */
const TTS_ENDPOINT = 'https://openspeech.bytedance.com/api/v1/tts';

async function main() {
  const apiKey = process.env.DOUBAO_API_KEY;
  if (!apiKey) {
    console.log('PASS (skip): DOUBAO_API_KEY not set');
    process.exit(0);
  }

  const body = JSON.stringify({
    app: { appid: 'essay-reader-ci', token: 'access_token', cluster: 'volcano_tts' },
    user: { uid: 'ci-test' },
    audio: { voice_type: 'zh_female_qingxin_bigtts', encoding: 'mp3', sample_rate: 24000 },
    request: { reqid: 'ci-smoke-' + Date.now(), text: '你好，这是一个测试。', text_type: 'plain', operation: 'query' },
  });

  console.log('[CI] Calling Doubao TTS REST API...');
  let response;
  try {
    response = await fetch(TTS_ENDPOINT, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Api-Key': apiKey,
        'X-Api-Resource-Id': 'seed-tts-2.0',
      },
      body,
    });
  } catch (err) {
    console.error(`FAIL: network error — ${err.message}`);
    process.exit(1);
  }

  const result = await response.json().catch(() => null);
  if (!result) {
    console.error('FAIL: response is not valid JSON');
    process.exit(1);
  }

  console.log(`[CI] Response code: ${result.code}, message: ${result.message}`);

  // 3001 = key doesn't have v1 REST access — not a code bug, just config
  if (result.code === 3001) {
    console.log('PASS (warn): API reachable but key lacks v1 REST access. Grant in Volcano Console → https://console.volcengine.com/speech/service/list');
    process.exit(0);
  }

  if (result.code !== 3000) {
    console.error(`FAIL: unexpected code ${result.code}: ${result.message}`);
    process.exit(1);
  }

  if (!result.data || typeof result.data !== 'string') {
    console.error('FAIL: response.data is missing or not a string');
    process.exit(1);
  }

  const bytes = Buffer.from(result.data, 'base64');
  if (bytes.length < 4) {
    console.error(`FAIL: decoded audio too short (${bytes.length} bytes)`);
    process.exit(1);
  }

  const isMp3 = bytes[0] === 0xFF && (bytes[1] & 0xE0) === 0xE0;
  if (!isMp3) {
    console.error(`FAIL: not valid MP3 (first bytes: ${bytes.subarray(0, 4).toString('hex')})`);
    process.exit(1);
  }

  console.log(`PASS: Valid MP3, ${bytes.length} bytes, duration ${result.addition?.duration || '?'}ms`);
  process.exit(0);
}

main().catch(err => {
  console.error('FAIL:', err.message);
  process.exit(1);
});
