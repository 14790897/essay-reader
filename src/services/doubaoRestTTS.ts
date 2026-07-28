/**
 * Volcano Engine Doubao TTS V3 HTTP Unidirectional Streaming Service
 *
 * Uses POST https://openspeech.bytedance.com/api/v3/tts/unidirectional
 * with HTTP Chunked Transfer Encoding for streaming audio.
 * Compatible with web browsers (standard fetch + custom headers).
 *
 * Docs: https://docs.volcengine.com/docs/6561/2528925?lang=zh
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

// V3 unidirectional streaming endpoint
const TTS_ENDPOINT = 'https://openspeech.bytedance.com/api/v3/tts/unidirectional';

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

export interface TTSWord {
  word: string;
  startTime: number;
  endTime: number;
  confidence: number;
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

function splitIntoSentences(text: string): string[] {
  const regex = /[^。！？.!?\n]+[。！？.!?\n]*/g;
  const matches = text.match(regex);
  return matches || [text];
}

// ─── V3 Chunked Streaming Response Parser ───────────────────────────────────

/**
 * Each chunk from the V3 unidirectional endpoint is a JSON line like:
 * {"code":0,"message":"OK","data":"<base64 audio>","sentence":{...},"usage":{...}}
 *
 * The stream ends when the connection closes or when we receive a terminal chunk.
 */
async function* parseChunkedStream(
  reader: ReadableStreamDefaultReader<Uint8Array>
): AsyncGenerator<{
  code: number;
  message: string;
  data: string | null;
  sentence: {
    text: string;
    words: Array<{ word: string; startTime: number; endTime: number; confidence: number }>;
  } | null;
  usage: { text_words: number } | null;
}> {
  const decoder = new TextDecoder();
  let buffer = '';

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split('\n');
    // Keep the last possibly-incomplete line in the buffer
    buffer = lines.pop() || '';

    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed) continue;
      try {
        const chunk = JSON.parse(trimmed);
        yield chunk;
      } catch {
        // Skip non-JSON lines (e.g. empty chunks)
      }
    }
  }

  // Process any remaining data
  if (buffer.trim()) {
    try {
      const chunk = JSON.parse(buffer.trim());
      yield chunk;
    } catch {
      // skip
    }
  }
}

// ─── Single-request synthesis (non-progressive) ─────────────────────────────

export async function synthesizeRest(
  text: string,
  voice: string,
  config: DoubaoConfig,
  options?: { speechRate?: number; pitch?: number }
): Promise<TTSResult> {
  if (!text.trim()) return { audioBase64: '', durationMs: '0' };

  const isProxied = !!config.proxyUrl;
  const endpoint = config.proxyUrl ? buildProxyUrl(config.proxyUrl, TTS_ENDPOINT) : TTS_ENDPOINT;

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    'X-Api-Request-Id': uuid(),
  };
  if (!isProxied || config.apiKey) {
    headers['X-Api-Key'] = config.apiKey;
    headers['X-Api-Resource-Id'] = config.resourceId || 'seed-tts-2.0';
  }

  const response = await fetch(endpoint, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      req_params: {
        text,
        speaker: voice,
        audio_params: {
          format: 'mp3',
          sample_rate: 24000,
          speech_rate: options?.speechRate ?? 0,
        },
        ...(options?.pitch !== undefined ? { post_process: { pitch: options.pitch } } : {}),
      },
    }),
  });

  if (!response.ok) {
    const body = await response.text().catch(() => '');
    throw new Error(`Doubao TTS HTTP ${response.status}: ${body}`);
  }

  // Read the full stream
  const allChunks: Uint8Array[] = [];
  const reader = response.body?.getReader();
  if (!reader) {
    // Fallback: try parsing as single JSON response
    const result = await response.json();
    if (result.code !== 0) {
      throw new Error(`Doubao TTS error ${result.code}: ${result.message || 'Unknown'}`);
    }
    return { audioBase64: result.data || '' };
  }

  for await (const chunk of parseChunkedStream(reader)) {
    if (chunk.code !== 0) {
      throw new Error(`Doubao TTS error ${chunk.code}: ${chunk.message || 'Unknown'}`);
    }
    if (chunk.data) {
      allChunks.push(base64ToBytes(chunk.data));
    }
  }

  const totalSize = allChunks.reduce((s, c) => s + c.length, 0);
  if (totalSize === 0) {
    throw new Error('No audio data received from Doubao TTS');
  }

  const merged = new Uint8Array(totalSize);
  let offset = 0;
  for (const c of allChunks) { merged.set(c, offset); offset += c.length; }
  return { audioBase64: bytesToBase64(merged) };
}

// ─── Progressive synthesis (streaming + incremental callbacks) ──────────────

export interface ProgressiveCallbacks {
  onSentenceStart?: (text: string, index: number) => void;
  onSentenceEnd?: (text: string, index: number) => void;
  onAudioReady?: (audioBase64: string) => void;
}

/**
 * Sends the entire text in one request to the V3 unidirectional endpoint
 * and yields audio incrementally as chunks arrive.
 *
 * For sentence-level tracking, we split the text locally and correlate
 * chunks to sentence boundaries using the `sentence.text` field in each chunk.
 */
export async function synthesizeRestProgressive(
  text: string,
  voice: string,
  config: DoubaoConfig,
  options?: { speechRate?: number; pitch?: number },
  callbacks?: ProgressiveCallbacks
): Promise<TTSResult> {
  if (!text.trim()) return { audioBase64: '', durationMs: '0' };

  const isProxied = !!config.proxyUrl;
  const endpoint = config.proxyUrl ? buildProxyUrl(config.proxyUrl, TTS_ENDPOINT) : TTS_ENDPOINT;

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    'X-Api-Request-Id': uuid(),
  };
  if (!isProxied || config.apiKey) {
    headers['X-Api-Key'] = config.apiKey;
    headers['X-Api-Resource-Id'] = config.resourceId || 'seed-tts-2.0';
  }

  // Build sentence index for correlating stream chunks
  const sentences = splitIntoSentences(text);
  let sentenceIdx = 0;

  const requestBody: any = {
    req_params: {
      text,
      speaker: voice,
      audio_params: {
        format: 'mp3',
        sample_rate: 24000,
        speech_rate: options?.speechRate ?? 0,
      },
    },
  };
  if (options?.pitch !== undefined) {
    requestBody.req_params.post_process = { pitch: options.pitch };
  }

  const response = await fetch(endpoint, {
    method: 'POST',
    headers,
    body: JSON.stringify(requestBody),
  });

  if (!response.ok) {
    const body = await response.text().catch(() => '');
    throw new Error(`Doubao TTS HTTP ${response.status}: ${body}`);
  }

  const reader = response.body?.getReader();
  const allChunks: Uint8Array[] = [];

  if (!reader) {
    // Fallback: single JSON response
    const result = await response.json();
    if (result.code !== 0) {
      throw new Error(`Doubao TTS error ${result.code}: ${result.message || 'Unknown'}`);
    }
    if (result.data) {
      allChunks.push(base64ToBytes(result.data));
    }
    const merged = new Uint8Array(allChunks.reduce((s, c) => s + c.length, 0));
    let offset = 0;
    for (const c of allChunks) { merged.set(c, offset); offset += c.length; }
    return { audioBase64: bytesToBase64(merged) };
  }

  for await (const chunk of parseChunkedStream(reader)) {
    if (chunk.code !== 0) {
      throw new Error(`Doubao TTS error ${chunk.code}: ${chunk.message || 'Unknown'}`);
    }

    // Track sentences via the sentence.text field
    if (chunk.sentence?.text && sentenceIdx < sentences.length) {
      callbacks?.onSentenceStart?.(chunk.sentence.text, sentenceIdx);

      if (chunk.data) {
        allChunks.push(base64ToBytes(chunk.data));
      }

      callbacks?.onSentenceEnd?.(chunk.sentence.text, sentenceIdx);
      sentenceIdx++;

      // Yield audio incrementally
      if (allChunks.length > 0) {
        const totalSize = allChunks.reduce((s, c) => s + c.length, 0);
        const merged = new Uint8Array(totalSize);
        let offset = 0;
        for (const c of allChunks) { merged.set(c, offset); offset += c.length; }
        callbacks?.onAudioReady?.(bytesToBase64(merged));
      }
    } else if (chunk.data) {
      // Audio chunk without sentence info — just accumulate
      allChunks.push(base64ToBytes(chunk.data));
    }
  }

  if (allChunks.length === 0) {
    throw new Error('No audio data received from Doubao TTS');
  }

  const totalSize = allChunks.reduce((s, c) => s + c.length, 0);
  const merged = new Uint8Array(totalSize);
  let offset = 0;
  for (const c of allChunks) { merged.set(c, offset); offset += c.length; }
  return { audioBase64: bytesToBase64(merged) };
}
