/**
 * Volcano Engine Doubao TTS v3 Bidirectional WebSocket Service
 * Implements the full V1 binary protocol per official docs.
 */

export interface DoubaoConfig {
  apiKey: string;
  resourceId: string;
  proxyUrl: string;
}

export interface TTSResult {
  audioBase64: string;
  words: Array<{ word: string; startTime: number; endTime: number }>;
}

// Binary protocol constants from protocols_.py
const MsgType = { FullClientRequest: 1, AudioOnlyClient: 2, FullServerResponse: 9, AudioOnlyServer: 11, FrontEndResultServer: 12, Error: 15 } as const;
const Fl = { NoSeq: 0, PositiveSeq: 1, LastNoSeq: 2, NegativeSeq: 3, WithEvent: 4 } as const;
const Ev = { StartConnection: 1, FinishConnection: 2, StartSession: 100, CancelSession: 101, FinishSession: 102, TaskRequest: 200, ConnectionStarted: 50, ConnectionFailed: 51, ConnectionFinished: 52, SessionStarted: 150, SessionCanceled: 151, SessionFinished: 152, SessionFailed: 153, TTSSentenceStart: 350, TTSSentenceEnd: 351, TTSResponse: 352, TTSSubtitle: 364 } as const;
const EvNames: Record<number, string> = {};
for (const [k, v] of Object.entries(Ev)) (EvNames as any)[v] = k;

function be4(v: number): Uint8Array { const b = new Uint8Array(4); new DataView(b.buffer).setInt32(0, v); return b; }
function ube4(v: number): Uint8Array { const b = new Uint8Array(4); new DataView(b.buffer).setUint32(0, v); return b; }

function buildHeader(msgType: number, flag: number, ser = 1, comp = 0): Uint8Array {
  return new Uint8Array([0x11, ((msgType << 4) | (flag & 0x0F)), ((ser << 4) | (comp & 0x0F)), 0]);
}

function marshalMsg(msgType: number, flag: number, event: number, sessionId: string | null, payload: string): Uint8Array {
  const parts: Uint8Array[] = [buildHeader(msgType, flag), be4(event)];
  if (sessionId && ![1, 2, 50, 51, 52].includes(event)) {
    const sid = new TextEncoder().encode(sessionId);
    parts.push(ube4(sid.length), sid);
  }
  const pl = new TextEncoder().encode(payload);
  parts.push(ube4(pl.length), pl);
  const total = new Uint8Array(parts.reduce((s, p) => s + p.length, 0));
  let offset = 0;
  for (const p of parts) { total.set(p, offset); offset += p.length; }
  return total;
}

function base64FromArrayBuffer(buf: ArrayBuffer): string {
  const bytes = new Uint8Array(buf);
  let binary = '';
  for (let i = 0; i < bytes.byteLength; i++) binary += String.fromCharCode(bytes[i]);
  return btoa(binary);
}

interface ParsedMsg {
  msgType: number; flag: number; event: number;
  sessionId: string; connectId: string; sequence: number; errorCode: number;
  payload: Uint8Array | null;
}

function parseMessage(buf: ArrayBuffer): ParsedMsg | null {
  try {
    if (buf.byteLength < 4) return null;
    const d = new DataView(buf);
    let o = 0;
    const vhs = d.getUint8(o++);
    const mt = d.getUint8(o) >> 4;
    const fl = d.getUint8(o++) & 0x0F;
    o += 1;
    o = (vhs & 0x0F) * 4;

    const m: ParsedMsg = { msgType: mt, flag: fl, event: 0, sessionId: '', connectId: '', sequence: 0, errorCode: 0, payload: null };

    if ([1, 2, 9, 11, 12].includes(mt) && (fl === 1 || fl === 3)) { m.sequence = d.getInt32(o); o += 4; }
    else if (mt === 15) { m.errorCode = d.getUint32(o); o += 4; }

    if (fl === 4) {
      if (o + 4 > buf.byteLength) return m;
      m.event = d.getInt32(o); o += 4;
      if (![1, 2, 50, 51, 52].includes(m.event)) {
        if (o + 4 > buf.byteLength) return m;
        const sl = d.getUint32(o); o += 4;
        if (sl > 0) {
          if (o + sl > buf.byteLength) return m;
          m.sessionId = new TextDecoder().decode(new Uint8Array(buf.slice(o, o + sl))); o += sl;
        }
      }
      if ([50, 51, 52].includes(m.event)) {
        if (o + 4 > buf.byteLength) return m;
        const cl = d.getUint32(o); o += 4;
        if (cl > 0) {
          if (o + cl > buf.byteLength) return m;
          m.connectId = new TextDecoder().decode(new Uint8Array(buf.slice(o, o + cl))); o += cl;
        }
      }
    }

    if (o + 4 > buf.byteLength) return m;
    const pl = d.getUint32(o); o += 4;
    if (pl > 0) {
      if (o + pl > buf.byteLength) return m;
      m.payload = new Uint8Array(buf.slice(o, o + pl));
    }
    return m;
  } catch (e) {
    console.warn("parseMessage error:", e);
    return null;
  }
}

type WSCallback = (data: any) => void;

export class DoubaoTTSClient {
  private ws: WebSocket | null = null;
  private sessionId: string = '';
  private audioChunks: ArrayBuffer[] = [];
  private words: Array<{ word: string; startTime: number; endTime: number }> = [];

  private onSentenceStart?: WSCallback;
  private onSentenceEnd?: WSCallback;
  private onSubtitle?: WSCallback;
  private onDone?: WSCallback;
  private onError?: (err: Error) => void;
  private sentFinish = false;

  constructor(private config: DoubaoConfig, callbacks: {
    onSentenceStart?: WSCallback; onSentenceEnd?: WSCallback;
    onSubtitle?: WSCallback; onDone?: WSCallback; onError?: (err: Error) => void;
  }) {
    this.onSentenceStart = callbacks.onSentenceStart; this.onSentenceEnd = callbacks.onSentenceEnd;
    this.onSubtitle = callbacks.onSubtitle; this.onDone = callbacks.onDone; this.onError = callbacks.onError;
  }

  async synthesize(
    text: string, speaker: string,
    options?: { format?: 'mp3' | 'pcm' | 'wav' | 'ogg_opus'; speechRate?: number; loudnessRate?: number; pitch?: number; enableSubtitle?: boolean; }
  ): Promise<void> {
    return new Promise((resolve, reject) => {
      try {
        if (!this.config.apiKey) {
          reject(new Error('Doubao API key is empty'));
          return;
        }

        this.sessionId = this.uuid();
        const url = 'wss://openspeech.bytedance.com/api/v3/tts/bidirection';

        console.log('[Doubao] Connecting to WebSocket...');

        this.ws = new (WebSocket as any)(url, undefined, {
          headers: {
            'X-Api-Key': this.config.apiKey,
            'X-Api-Resource-Id': this.config.resourceId || 'seed-tts-2.0',
          },
        });
        (this.ws as any).binaryType = 'arraybuffer';

        const done = (err?: Error) => {
          if (this.sentFinish) return;
          this.sentFinish = true;
          if (err) {
            this.onError?.(err);
            reject(err);
          } else {
            resolve();
          }
        };

        this.ws!.onopen = () => {
          console.log('[Doubao] WS connected, sending StartConnection');
          try {
            this.sendBinary(MsgType.FullClientRequest, Fl.WithEvent, Ev.StartConnection, null, '{}');
          } catch (e) {
            done(new Error('Failed to send StartConnection: ' + (e as Error).message));
          }
        };

        this.ws!.onmessage = (event: MessageEvent) => {
          try {
            const data = event.data;
            if (data instanceof ArrayBuffer) {
              const msg = parseMessage(data);
              if (msg) this.handleBinaryMsg(msg, text, speaker, options, done);
            } else if (typeof Blob !== 'undefined' && data instanceof Blob) {
              const reader = new FileReader();
              reader.onload = () => {
                try {
                  const ab = reader.result as ArrayBuffer;
                  const msg = parseMessage(ab);
                  if (msg) this.handleBinaryMsg(msg, text, speaker, options, done);
                } catch (e) {
                  console.warn('[Doubao] FileReader onload error:', e);
                }
              };
              reader.onerror = () => {
                console.warn('[Doubao] FileReader error, trying fallback');
                try {
                  const ab = new ArrayBuffer(0);
                  const msg = parseMessage(ab);
                } catch {}
              };
              reader.readAsArrayBuffer(data);
            } else if (typeof data === 'string') {
              try {
                const encoded = new TextEncoder().encode(data);
                const msg = parseMessage(encoded.buffer as ArrayBuffer);
                if (msg) this.handleBinaryMsg(msg, text, speaker, options, done);
              } catch (e) {
                console.warn('[Doubao] string data parse error:', e);
              }
            }
          } catch (e) {
            console.warn('[Doubao] onmessage error:', e);
          }
        };

        this.ws!.onerror = (error: any) => {
          console.warn('[Doubao] WS error:', error?.message || error);
          done(new Error('WebSocket connection error'));
        };

        this.ws!.onclose = () => {
          console.log('[Doubao] WS closed');
          if (!this.sentFinish && this.audioChunks.length === 0) {
            done(new Error('No audio received - check API key and network'));
          }
        };
      } catch (err) {
        console.warn('[Doubao] synthesize error:', err);
        reject(err);
      }
    });
  }

  private handleBinaryMsg(
    msg: ParsedMsg, text: string, speaker: string, options: any,
    done: (err?: Error) => void
  ) {
    try {
      if (msg.msgType === 11) {
        if (msg.payload) this.audioChunks.push(msg.payload.buffer as ArrayBuffer);
        return;
      }

      if (msg.msgType === 15) {
        const pl = msg.payload ? new TextDecoder().decode(msg.payload) : '';
        let errMsg = 'TTS Error';
        try { const j = JSON.parse(pl); errMsg = j.error || errMsg; } catch {}
        done(new Error(errMsg));
        return;
      }

      const rawPayload = msg.payload ? new TextDecoder().decode(msg.payload) : '{}';
      let pl: any = {};
      try { pl = JSON.parse(rawPayload); } catch {}

      console.log('[Doubao] Event:', EvNames[msg.event] || msg.event, 'type:', msg.msgType);

      switch (msg.event) {
        case Ev.ConnectionStarted: {
          const startReq = JSON.stringify({ event: Ev.StartSession, req_params: { speaker, audio_params: { format: options?.format || 'mp3', sample_rate: 24000, speech_rate: options?.speechRate ?? 0, loudness_rate: options?.loudnessRate ?? 0, enable_subtitle: options?.enableSubtitle ?? false }, post_process: typeof options?.pitch === 'number' ? { pitch: options.pitch } : undefined } });
          this.sendBinary(MsgType.FullClientRequest, Fl.WithEvent, Ev.StartSession, this.sessionId, startReq);
          break;
        }
        case Ev.SessionStarted: {
          const taskReq = JSON.stringify({ event: Ev.TaskRequest, req_params: { speaker, text, audio_params: { format: options?.format || 'mp3', sample_rate: 24000, speech_rate: options?.speechRate ?? 0, loudness_rate: options?.loudnessRate ?? 0, enable_subtitle: options?.enableSubtitle ?? false }, post_process: typeof options?.pitch === 'number' ? { pitch: options.pitch } : undefined } });
          this.sendBinary(MsgType.FullClientRequest, Fl.WithEvent, Ev.TaskRequest, this.sessionId, taskReq);
          this.sendBinary(MsgType.FullClientRequest, Fl.WithEvent, Ev.FinishSession, this.sessionId, '{}');
          break;
        }
        case Ev.TTSSentenceStart: this.onSentenceStart?.(pl); break;
        case Ev.TTSSentenceEnd: this.onSentenceEnd?.(pl); break;
        case Ev.TTSSubtitle: if (pl?.words) { this.words.push(...pl.words); } this.onSubtitle?.(pl); break;
        case Ev.SessionFinished:
          this.sendBinary(MsgType.FullClientRequest, Fl.WithEvent, Ev.FinishConnection, null, '{}');
          break;
        case Ev.ConnectionFinished:
          this.onDone?.({ words: this.words });
          done();
          break;
        case Ev.ConnectionFailed:
        case Ev.SessionFailed: {
          const errMsg2 = pl?.message || rawPayload || 'TTS Failed';
          done(new Error(errMsg2));
          break;
        }
      }
    } catch (e) {
      console.warn('[Doubao] handleBinaryMsg error:', e);
    }
  }

  private sendBinary(msgType: number, flag: number, event: number, sid: string | null, pl: string) {
    if (this.ws?.readyState === WebSocket.OPEN) {
      try {
        this.ws.send(marshalMsg(msgType, flag, event, sid, pl));
      } catch (e) {
        console.warn('[Doubao] sendBinary error:', e);
      }
    }
  }

  getAudioBytes(): Uint8Array | null {
    if (this.audioChunks.length === 0) return null;
    const totalSize = this.audioChunks.reduce((sum, c) => sum + c.byteLength, 0);
    const merged = new Uint8Array(totalSize);
    let offset = 0;
    for (const chunk of this.audioChunks) {
      merged.set(new Uint8Array(chunk), offset);
      offset += chunk.byteLength;
    }
    return merged;
  }

  getAudioBase64(): string {
    const bytes = this.getAudioBytes();
    if (!bytes) return '';
    return base64FromArrayBuffer(bytes.buffer as ArrayBuffer);
  }

  cancel() {
    this.sentFinish = true;
    try { this.ws?.close(); } catch {}
    this.ws = null;
  }

  private uuid(): string {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
      const r = (Math.random() * 16) | 0;
      return (c === 'x' ? r : (r & 0x3) | 0x8).toString(16);
    });
  }
}

export const DOUBAO_VOICES = [
  { id: 'zh_female_gaolengyujie_uranus_bigtts', name: '\u9ad8\u51b7\u5fa1\u59d0', lang: 'zh', gender: 'female' },
  { id: 'zh_female_qingxin_bigtts', name: '\u6e05\u65b0\u5973\u58f0', lang: 'zh', gender: 'female' },
  { id: 'zh_female_vv_uranus_bigtts', name: '\u8c46\u53052.0\u5973\u58f0', lang: 'zh', gender: 'female' },
  { id: 'zh_male_vv_uranus_bigtts', name: '\u8c46\u53052.0\u7537\u58f0', lang: 'zh', gender: 'male' },
  { id: 'zh_male_qingse_bigtts', name: '\u9752\u6da9\u7537\u58f0', lang: 'zh', gender: 'male' },
  { id: 'zh_female_shuangkuaidaxue_bigtts', name: '\u723d\u5feb\u5973\u58f0', lang: 'zh', gender: 'female' },
  { id: 'zh_male_wennuan_bigtts', name: '\u6e29\u6696\u7537\u58f0', lang: 'zh', gender: 'male' },
  { id: 'zh_female_tianmei_bigtts', name: '\u751c\u7f8e\u5973\u58f0', lang: 'zh', gender: 'female' },
];
