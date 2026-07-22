export interface DoubaoConfig {
  appId: string;
  token: string;
  cluster: string;
  voiceType: string;
}

export interface DoubaoTTSParams {
  config: DoubaoConfig;
  text: string;
  speedRatio?: number;
  volumeRatio?: number;
  pitchRatio?: number;
  encoding?: 'mp3' | 'wav' | 'ogg';
}

function uuid(): string {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

const API_URL = 'https://openspeech.bytedance.com/api/v1/tts';

export async function synthesizeSpeech(params: DoubaoTTSParams): Promise<string> {
  const { config, text, speedRatio = 1.0, volumeRatio = 1.0, pitchRatio = 1.0, encoding = 'mp3' } = params;

  const body = {
    app: {
      appid: config.appId,
      token: config.token,
      cluster: config.cluster,
    },
    user: {
      uid: 'essay-reader-user',
    },
    audio: {
      voice_type: config.voiceType,
      encoding,
      speed_ratio: speedRatio,
      volume_ratio: volumeRatio,
      pitch_ratio: pitchRatio,
    },
    request: {
      reqid: uuid(),
      text,
      operation: 'query',
    },
  };

  const response = await fetch(API_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer;${config.token}`,
    },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Doubao TTS API error ${response.status}: ${errorText}`);
  }

  const result = await response.json();

  if (result.code !== 3000) {
    throw new Error(`Doubao TTS error: code=${result.code}, message=${result.message || 'unknown'}`);
  }

  // The response contains base64-encoded audio data
  return result.data as string;
}

// Predefined Doubao voices - common ones with good Chinese support
export const DOUBAO_VOICES = [
  { id: 'zh_female_qingxin_bigtts', name: '清新女声', lang: 'zh', gender: 'female' },
  { id: 'zh_male_qingse_bigtts', name: '青涩男声', lang: 'zh', gender: 'male' },
  { id: 'zh_female_shuangkuaidaxue_bigtts', name: '爽快女声', lang: 'zh', gender: 'female' },
  { id: 'zh_male_wennuan_bigtts', name: '温暖男声', lang: 'zh', gender: 'male' },
  { id: 'zh_female_tianmei_bigtts', name: '甜美女声', lang: 'zh', gender: 'female' },
  { id: 'zh_male_chunhou_bigtts', name: '淳厚男声', lang: 'zh', gender: 'male' },
  { id: 'BV034_streaming', name: '通用女声', lang: 'zh', gender: 'female' },
  { id: 'BV700_streaming', name: '通用男声', lang: 'zh', gender: 'male' },
  { id: 'zh_female_vv_uranus_bigtts', name: '豆包2.0女声', lang: 'zh', gender: 'female' },
  { id: 'zh_male_vv_uranus_bigtts', name: '豆包2.0男声', lang: 'zh', gender: 'male' },
];
