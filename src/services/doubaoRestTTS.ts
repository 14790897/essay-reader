/**
 * Volcano Engine Doubao TTS v1 REST API (for web/browser compatibility).
 * Uses HTTP POST with custom headers instead of WebSocket binary protocol.
 */

export interface DoubaoConfig {
  apiKey: string;
  resourceId: string;
  proxyUrl: string;
}

export const DOUBAO_REST_VOICES = [
  { id: 'zh_female_gaolengyujie_uranus_bigtts', name: '高冷御姐', lang: 'zh', gender: 'female' },
  { id: 'zh_female_qingxin_bigtts', name: '清新女声', lang: 'zh', gender: 'female' },
  { id: 'zh_female_vv_uranus_bigtts', name: '豆包2.0女声', lang: 'zh', gender: 'female' },
  { id: 'zh_male_vv_uranus_bigtts', name: '豆包2.0男声', lang: 'zh', gender: 'male' },
  { id: 'zh_male_qingse_bigtts', name: '青涩男声', lang: 'zh', gender: 'male' },
  { id: 'zh_female_shuangkuaidaxue_bigtts', name: '爽快女声', lang: 'zh', gender: 'female' },
  { id: 'zh_male_wennuan_bigtts', name: '温暖男声', lang: 'zh', gender: 'male' },
  { id: 'zh_female_tianmei_bigtts', name: '甜美女生', lang: 'zh', gender: 'female' },
];

// Direct endpoint (used by native or through proxy)
const TTS_ENDPOINT = 'https://openspeech.bytedance.com/api/v1/tts';

function uuid(): string {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    return (c === 'x' ? r : (r & 0x3) | 0x8).toString(16);
  });
}

export interface TTSResult {
  audioBase64: string;
  durationMs?: string;
}

export async function synthesizeRest(
  text: string,
  voice: string,
  config: DoubaoConfig,
  _options?: { speechRate?: number; pitch?: number }
): Promise<TTSResult> {
  const endpoint = config.proxyUrl || TTS_ENDPOINT;
  const response = await fetch(endpoint, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Api-Key': config.apiKey,
      'X-Api-Resource-Id': config.resourceId || 'seed-tts-2.0',
    },
    body: JSON.stringify({
      app: { appid: 'essay-reader', token: 'access_token', cluster: 'volcano_tts' },
      user: { uid: 'web-user' },
      audio: { voice_type: voice, encoding: 'mp3', sample_rate: 24000 },
      request: { reqid: uuid(), text, text_type: 'plain', operation: 'query' },
    }),
  });

  const result: any = await response.json();
  if (result.code !== 3000) {
    throw new Error(`Doubao TTS error ${result.code}: ${result.message || 'Unknown'}`);
  }

  return { audioBase64: result.data, durationMs: result.addition?.duration };
}
