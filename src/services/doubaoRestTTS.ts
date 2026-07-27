/**
 * Volcano Engine Doubao TTS v1 REST API (for web/browser compatibility).
 * Uses HTTP POST with custom headers instead of WebSocket binary protocol.
 */

import type { DoubaoConfig } from './doubaoTTS';
export type { DoubaoConfig } from './doubaoTTS';

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

function buildProxyUrl(proxyUrl: string, target: string): string {
  const normalized = proxyUrl.endsWith('/') ? proxyUrl : proxyUrl + '/';
  return normalized + target;
}

export interface TTSResult {
  audioBase64: string;
  durationMs?: string;
}

function splitIntoSentences(text: string): string[] {
  const regex = /[^。！？.!?\n]+[。！？.!?\n]*/g;
  const matches = text.match(regex);
  return matches || [text];
}

function base64ToBytes(b64: string): Uint8Array {
  const binary = atob(b64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

function bytesToBase64(bytes: Uint8Array): string {
  let binary = '';
  for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
  return btoa(binary);
}

export async function synthesizeRest(
  text: string,
  voice: string,
  config: DoubaoConfig,
  _options?: { speechRate?: number; pitch?: number }
): Promise<TTSResult> {
  if (!text.trim()) return { audioBase64: '', durationMs: '0' };

  const endpoint = config.proxyUrl ? buildProxyUrl(config.proxyUrl, TTS_ENDPOINT) : TTS_ENDPOINT;
  const isProxied = !!config.proxyUrl;

  // When proxied, don't send empty auth headers — let the proxy supply its own.
  // This also avoids triggering CORS preflight for custom headers in browsers.
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (!isProxied) {
    headers['X-Api-Key'] = config.apiKey;
    headers['X-Api-Resource-Id'] = config.resourceId || 'seed-tts-2.0';
  } else if (config.apiKey) {
    // Only send user's key when present and using proxy
    headers['X-Api-Key'] = config.apiKey;
  }

  const response = await fetch(endpoint, {
    method: 'POST',
    headers,
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

export interface ProgressiveCallbacks {
  onSentenceStart?: (text: string, index: number) => void;
  onSentenceEnd?: (text: string, index: number) => void;
  onAudioReady?: (audioBase64: string) => void;
}

export async function synthesizeRestProgressive(
  text: string,
  voice: string,
  config: DoubaoConfig,
  options?: { speechRate?: number; pitch?: number },
  callbacks?: ProgressiveCallbacks
): Promise<TTSResult> {
  if (!text.trim()) return { audioBase64: '', durationMs: '0' };

  const endpoint = config.proxyUrl ? buildProxyUrl(config.proxyUrl, TTS_ENDPOINT) : TTS_ENDPOINT;
  const isProxied = !!config.proxyUrl;
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (!isProxied) {
    headers['X-Api-Key'] = config.apiKey;
    headers['X-Api-Resource-Id'] = config.resourceId || 'seed-tts-2.0';
  } else if (config.apiKey) {
    headers['X-Api-Key'] = config.apiKey;
  }

  const sentences = splitIntoSentences(text);
  const allChunks: Uint8Array[] = [];

  for (let i = 0; i < sentences.length; i++) {
    const sentence = sentences[i];
    callbacks?.onSentenceStart?.(sentence, i);

    const response = await fetch(endpoint, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        app: { appid: 'essay-reader', token: 'access_token', cluster: 'volcano_tts' },
        user: { uid: 'web-user' },
        audio: { voice_type: voice, encoding: 'mp3', sample_rate: 24000 },
        request: { reqid: uuid(), text: sentence, text_type: 'plain', operation: 'query' },
      }),
    });

    const result: any = await response.json();
    if (result.code !== 3000) {
      throw new Error(`Doubao TTS error ${result.code}: ${result.message || 'Unknown'}`);
    }

    if (result.data) {
      allChunks.push(base64ToBytes(result.data));
    }

    callbacks?.onSentenceEnd?.(sentence, i);

    // Yield audio incrementally so playback can start early
    if (allChunks.length > 0) {
      const merged = new Uint8Array(allChunks.reduce((s, c) => s + c.length, 0));
      let offset = 0;
      for (const c of allChunks) { merged.set(c, offset); offset += c.length; }
      callbacks?.onAudioReady?.(bytesToBase64(merged));
    }
  }

  const totalSize = allChunks.reduce((s, c) => s + c.length, 0);
  const merged = new Uint8Array(totalSize);
  let offset = 0;
  for (const c of allChunks) { merged.set(c, offset); offset += c.length; }
  return { audioBase64: bytesToBase64(merged) };
}
