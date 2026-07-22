// Volcano Engine Doubao TTS - v3 Bidirectional WebSocket
// Docs: https://docs.volcengine.com/docs/6561/2532486

export interface DoubaoConfig {
  apiKey: string;
  resourceId: string;
}

interface AudioChunk {
  base64: string;
}

export interface TTSResult {
  audioBase64: string;
  words: Array<{ word: string; startTime: number; endTime: number }>;
}

// Events sent to server
const EventType = {
  StartConnection: 'StartConnection',
  StartSession: 'StartSession',
  TaskRequest: 'TaskRequest',
  FinishSession: 'FinishSession',
  FinishConnection: 'FinishConnection',
} as const;

// Events received from server
const ResponseEvent = {
  ConnectionStarted: 'ConnectionStarted',
  SessionStarted: 'SessionStarted',
  TTSSentenceStart: 'TTSSentenceStart',
  TTSResponse: 'TTSResponse',
  TTSSentenceEnd: 'TTSSentenceEnd',
  TTSSubtitle: 'TTSSubtitle',
  SessionFinished: 'SessionFinished',
  ConnectionFinished: 'ConnectionFinished',
} as const;

type WSCallback = (data: any) => void;
type BinaryCallback = (data: ArrayBuffer) => void;

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

  constructor(
    private config: DoubaoConfig,
    callbacks: {
      onSentenceStart?: WSCallback;
      onSentenceEnd?: WSCallback;
      onSubtitle?: WSCallback;
      onDone?: WSCallback;
      onError?: (err: Error) => void;
    }
  ) {
    this.onSentenceStart = callbacks.onSentenceStart;
    this.onSentenceEnd = callbacks.onSentenceEnd;
    this.onSubtitle = callbacks.onSubtitle;
    this.onDone = callbacks.onDone;
    this.onError = callbacks.onError;
  }

  async synthesize(
    text: string,
    speaker: string,
    options?: {
      format?: 'mp3' | 'pcm' | 'wav' | 'ogg_opus';
      speechRate?: number;
      loudnessRate?: number;
      pitch?: number;
      enableSubtitle?: boolean;
    }
  ): Promise<void> {
    return new Promise((resolve, reject) => {
      try {
        const connectId = this.uuid();
        this.sessionId = this.uuid();

        const url = 'wss://openspeech.bytedance.com/api/v3/tts/bidirection';

        // React Native WebSocket does support custom headers via a different API.
        // We pass them as the third argument.
        this.ws = new WebSocket(url);

        this.ws.onopen = () => {
          // Step 1: StartConnection
          this.send({
            event: EventType.StartConnection,
            req_params: {
              connect_id: connectId,
            },
          });
        };

        this.ws.onmessage = (event: any) => {
          if (typeof event.data === 'string') {
            const msg = JSON.parse(event.data);
            this.handleMessage(msg, text, speaker, options, resolve, reject);
          } else if (event.data instanceof ArrayBuffer) {
            this.audioChunks.push(event.data);
          }
        };

        this.ws.onerror = (error: any) => {
          const err = new Error(`WebSocket error: ${error.message || 'unknown'}`);
          this.onError?.(err);
          reject(err);
        };

        this.ws.onclose = () => {
          if (this.audioChunks.length === 0) {
            reject(new Error('No audio received'));
          }
        };
      } catch (err) {
        reject(err);
      }
    });
  }

  private handleMessage(
    msg: any,
    text: string,
    speaker: string,
    options: any,
    resolve: () => void,
    reject: (err: Error) => void
  ) {
    const eventType = msg.EventType || msg.event;

    switch (eventType) {
      case ResponseEvent.ConnectionStarted:
        // Step 2: StartSession
        this.send({
          event: EventType.StartSession,
          session_id: this.sessionId,
          req_params: {
            speaker,
            text: '',
            audio_params: {
              format: options?.format || 'mp3',
              sample_rate: 24000,
              speech_rate: options?.speechRate ?? 0,
              loudness_rate: options?.loudnessRate ?? 0,
              enable_subtitle: options?.enableSubtitle ?? false,
            },
            post_process: typeof options?.pitch === 'number' ? { pitch: options.pitch } : undefined,
          },
        });
        break;

      case ResponseEvent.SessionStarted:
        // Step 3: Send text as TaskRequest
        this.send({
          event: EventType.TaskRequest,
          session_id: this.sessionId,
          req_params: {
            speaker,
            text,
            audio_params: {
              format: options?.format || 'mp3',
              sample_rate: 24000,
              speech_rate: options?.speechRate ?? 0,
              loudness_rate: options?.loudnessRate ?? 0,
              enable_subtitle: options?.enableSubtitle ?? false,
            },
            post_process: typeof options?.pitch === 'number' ? { pitch: options.pitch } : undefined,
          },
        });
        // Step 4: Finish session (we send all text at once)
        this.send({
          event: EventType.FinishSession,
          session_id: this.sessionId,
        });
        break;

      case ResponseEvent.TTSSentenceStart:
        this.onSentenceStart?.(msg.Payload);
        break;

      case ResponseEvent.TTSSentenceEnd:
        this.onSentenceEnd?.(msg.Payload);
        break;

      case ResponseEvent.TTSSubtitle:
        if (msg.Payload?.words) {
          this.words.push(...msg.Payload.words);
        }
        this.onSubtitle?.(msg.Payload);
        break;

      case ResponseEvent.SessionFinished:
        // Step 5: Finish connection
        this.send({ event: EventType.FinishConnection });
        break;

      case ResponseEvent.ConnectionFinished:
        this.onDone?.({
          words: this.words,
        });
        resolve();
        break;

      case 'SessionFailed':
      case 'ConnectionFailed':
        const errMsg = msg.Payload?.message || msg.message || 'TTS synthesis failed';
        const err = new Error(errMsg);
        this.onError?.(err);
        reject(err);
        break;
    }
  }

  private send(msg: any) {
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(msg));
    }
  }

  getAudioBase64(): string {
    const totalSize = this.audioChunks.reduce((sum, c) => sum + c.byteLength, 0);
    const merged = new Uint8Array(totalSize);
    let offset = 0;
    for (const chunk of this.audioChunks) {
      merged.set(new Uint8Array(chunk), offset);
      offset += chunk.byteLength;
    }
    return this.arrayBufferToBase64(merged.buffer);
  }

  cancel() {
    this.ws?.close();
    this.ws = null;
  }

  private uuid(): string {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
      const r = (Math.random() * 16) | 0;
      return (c === 'x' ? r : (r & 0x3) | 0x8).toString(16);
    });
  }

  private arrayBufferToBase64(buffer: ArrayBuffer): string {
    const bytes = new Uint8Array(buffer);
    let binary = '';
    for (let i = 0; i < bytes.byteLength; i++) {
      binary += String.fromCharCode(bytes[i]);
    }
    return btoa(binary);
  }
}

// v3-compatible Doubao voices (seed-tts-2.0 compatible)
export const DOUBAO_VOICES = [
  { id: 'zh_female_gaolengyujie_uranus_bigtts', name: '高冷御姐', lang: 'zh', gender: 'female' },
  { id: 'zh_female_qingxin_bigtts', name: '清新女声', lang: 'zh', gender: 'female' },
  { id: 'zh_female_vv_uranus_bigtts', name: '豆包2.0女声', lang: 'zh', gender: 'female' },
  { id: 'zh_male_vv_uranus_bigtts', name: '豆包2.0男声', lang: 'zh', gender: 'male' },
  { id: 'zh_male_qingse_bigtts', name: '青涩男声', lang: 'zh', gender: 'male' },
  { id: 'zh_female_shuangkuaidaxue_bigtts', name: '爽快女声', lang: 'zh', gender: 'female' },
  { id: 'zh_male_wennuan_bigtts', name: '温暖男声', lang: 'zh', gender: 'male' },
  { id: 'zh_female_tianmei_bigtts', name: '甜美女声', lang: 'zh', gender: 'female' },
];
