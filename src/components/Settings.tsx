import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
} from 'react-native';
import type { VoiceInfo } from '../hooks/useSpeech';
import type { DoubaoConfig } from '../services/doubaoTTS';
import { DOUBAO_VOICES } from '../services/doubaoTTS';

export type TTSProvider = 'system' | 'doubao';

interface SettingsProps {
  provider: TTSProvider;
  rate: number;
  pitch: number;
  fontSize: number;
  doubaoConfig: DoubaoConfig;
  doubaoSpeaker: string;
  onProviderChange: (provider: TTSProvider) => void;
  onDoubaoConfigChange: (config: DoubaoConfig) => void;
  onDoubaoSpeakerChange: (speaker: string) => void;
  selectedVoice: string;
  voices: VoiceInfo[];
  onRateChange: (rate: number) => void;
  onPitchChange: (pitch: number) => void;
  onFontSizeChange: (size: number) => void;
  onVoiceChange: (voice: string) => void;
}

const RATES = [0.5, 0.7, 0.9, 1.0, 1.2, 1.5, 1.8, 2.0];
const PITCHES = [0.8, 0.9, 1.0, 1.1, 1.2];
const FONT_SIZES = [14, 16, 18, 20, 22, 24, 28];

export default function Settings({
  provider,
  rate,
  pitch,
  fontSize,
  doubaoConfig,
  doubaoSpeaker,
  onProviderChange,
  onDoubaoConfigChange,
  onDoubaoSpeakerChange,
  selectedVoice,
  voices,
  onRateChange,
  onPitchChange,
  onFontSizeChange,
  onVoiceChange,
}: SettingsProps) {
  const [tab, setTab] = useState<'engine' | 'voice' | 'speed' | 'display'>('engine');

  const chineseVoices = voices.filter(
    (v) => v.language.startsWith('zh') || v.language.startsWith('cmn')
  );
  const otherVoices = voices.filter(
    (v) => !v.language.startsWith('zh') && !v.language.startsWith('cmn')
  );

  const updateDoubaoField = (field: keyof DoubaoConfig, value: string) => {
    onDoubaoConfigChange({ ...doubaoConfig, [field]: value });
  };

  return (
    <View style={styles.container}>
      <View style={styles.tabs}>
        {(['engine', 'voice', 'speed', 'display'] as const).map((t) => (
          <TouchableOpacity
            key={t}
            style={[styles.tab, tab === t && styles.tabActive]}
            onPress={() => setTab(t)}
          >
            <Text style={[styles.tabText, tab === t && styles.tabTextActive]}>
              {t === 'engine' ? 'Engine' : t === 'voice' ? 'Voice' : t === 'speed' ? 'Speed' : 'Display'}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      <ScrollView style={styles.body} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
        {tab === 'engine' && (
          <View>
            <Text style={styles.sectionTitle}>TTS Engine</Text>
            <View style={styles.providerRow}>
              <TouchableOpacity
                style={[styles.providerChip, provider === 'system' && styles.chipActive]}
                onPress={() => onProviderChange('system')}
              >
                <Text style={[styles.chipText, provider === 'system' && styles.chipTextActive]}>
                  System
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.providerChip, provider === 'doubao' && styles.chipActive]}
                onPress={() => onProviderChange('doubao')}
              >
                <Text style={[styles.chipText, provider === 'doubao' && styles.chipTextActive]}>
                  Doubao TTS
                </Text>
              </TouchableOpacity>
            </View>

            {provider === 'doubao' && (
              <View style={styles.doubaoConfig}>
                <Text style={styles.sectionTitle}>API Config</Text>
                <Text style={styles.configHint}>
                  Create API Key at Volcano Engine Console
                </Text>

                <Text style={styles.inputLabel}>X-Api-Key</Text>
                <TextInput
                  testID="doubao-api-key-input"
                  style={styles.textInput}
                  value={doubaoConfig.apiKey}
                  onChangeText={(v) => updateDoubaoField('apiKey', v)}
                  placeholder="Your API Key"
                  placeholderTextColor="#bbb"
                  autoCapitalize="none"
                  secureTextEntry
                />

                <Text style={styles.inputLabel}>X-Api-Resource-Id</Text>
                <TextInput
                  testID="doubao-resource-id-input"
                  style={styles.textInput}
                  value={doubaoConfig.resourceId}
                  onChangeText={(v) => updateDoubaoField('resourceId', v)}
                  placeholder="seed-tts-2.0"
                  placeholderTextColor="#bbb"
                  autoCapitalize="none"
                />

                <Text style={styles.sectionTitle}>Speaker</Text>
                <View style={styles.voiceGrid}>
                  {DOUBAO_VOICES.map((v) => (
                    <TouchableOpacity
                      key={v.id}
                      style={[
                        styles.voiceChip,
                        doubaoSpeaker === v.id && styles.chipActive,
                      ]}
                      onPress={() => onDoubaoSpeakerChange(v.id)}
                    >
                      <Text style={[
                        styles.voiceChipText,
                        doubaoSpeaker === v.id && styles.chipTextActive,
                      ]}>
                        {v.name}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>
            )}

            {provider === 'system' && (
              <View style={styles.configHintBox}>
                <Text style={styles.configHint}>
                  Uses built-in device TTS. Works offline.
                </Text>
              </View>
            )}
          </View>
        )}

        {tab === 'speed' && (
          <View>
            <Text style={styles.sectionTitle}>Reading Speed</Text>
            <View style={styles.chipRow}>
              {RATES.map((r) => (
                <TouchableOpacity
                  key={r}
                  style={[styles.chip, rate === r && styles.chipActive]}
                  onPress={() => onRateChange(r)}
                >
                  <Text style={[styles.chipText, rate === r && styles.chipTextActive]}>
                    {r}x
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            <Text style={[styles.sectionTitle, { marginTop: 20 }]}>Pitch</Text>
            <View style={styles.chipRow}>
              {PITCHES.map((p) => (
                <TouchableOpacity
                  key={p}
                  style={[styles.chip, pitch === p && styles.chipActive]}
                  onPress={() => onPitchChange(p)}
                >
                  <Text style={[styles.chipText, pitch === p && styles.chipTextActive]}>
                    {p.toFixed(1)}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
        )}

        {tab === 'voice' && provider === 'system' && (
          <View>
            {chineseVoices.length > 0 && (
              <>
                <Text style={styles.sectionTitle}>Chinese Voices</Text>
                {chineseVoices.map((v) => (
                  <TouchableOpacity
                    key={v.identifier}
                    style={[styles.voiceItem, selectedVoice === v.identifier && styles.voiceItemActive]}
                    onPress={() => onVoiceChange(v.identifier)}
                  >
                    <Text style={styles.voiceName}>{v.name}</Text>
                    <Text style={styles.voiceLang}>{v.language}</Text>
                  </TouchableOpacity>
                ))}
              </>
            )}
            {otherVoices.length > 0 && (
              <>
                <Text style={[styles.sectionTitle, { marginTop: 16 }]}>Other Voices</Text>
                {otherVoices.map((v) => (
                  <TouchableOpacity
                    key={v.identifier}
                    style={[styles.voiceItem, selectedVoice === v.identifier && styles.voiceItemActive]}
                    onPress={() => onVoiceChange(v.identifier)}
                  >
                    <Text style={styles.voiceName}>{v.name}</Text>
                    <Text style={styles.voiceLang}>{v.language}</Text>
                  </TouchableOpacity>
                ))}
              </>
            )}
            <TouchableOpacity
              style={[styles.voiceItem, !selectedVoice && styles.voiceItemActive]}
              onPress={() => onVoiceChange('')}
            >
              <Text style={styles.voiceName}>System Default</Text>
              <Text style={styles.voiceLang}>auto</Text>
            </TouchableOpacity>
          </View>
        )}

        {tab === 'voice' && provider === 'doubao' && (
          <View>
            <Text style={styles.sectionTitle}>Doubao Voices</Text>
            <Text style={styles.configHint}>Select speaker in the Engine tab above.</Text>
          </View>
        )}

        {tab === 'display' && (
          <View>
            <Text style={styles.sectionTitle}>Font Size</Text>
            <View style={styles.chipRow}>
              {FONT_SIZES.map((s) => (
                <TouchableOpacity
                  key={s}
                  style={[styles.chip, fontSize === s && styles.chipActive]}
                  onPress={() => onFontSizeChange(s)}
                >
                  <Text style={[styles.chipText, fontSize === s && styles.chipTextActive]}>
                    {s}px
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  tabs: { flexDirection: 'row', borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: '#e0e0e0' },
  tab: { flex: 1, paddingVertical: 12, alignItems: 'center' },
  tabActive: { borderBottomWidth: 2, borderBottomColor: '#007AFF' },
  tabText: { fontSize: 13, color: '#888' },
  tabTextActive: { color: '#007AFF', fontWeight: '600' },
  body: { flex: 1, padding: 16 },
  sectionTitle: { fontSize: 13, fontWeight: '600', color: '#888', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 10, marginTop: 8 },
  providerRow: { flexDirection: 'row', gap: 10 },
  providerChip: { flex: 1, paddingVertical: 14, borderRadius: 10, backgroundColor: '#f0f0f0', alignItems: 'center' },
  doubaoConfig: { marginTop: 8 },
  configHint: { fontSize: 12, color: '#aaa', marginBottom: 12 },
  configHintBox: { marginTop: 12, padding: 12, backgroundColor: '#f8f8f8', borderRadius: 8 },
  inputLabel: { fontSize: 13, color: '#666', marginBottom: 4, marginTop: 10, fontWeight: '500' },
  textInput: { borderWidth: 1, borderColor: '#ddd', borderRadius: 8, paddingHorizontal: 12, paddingVertical: 10, fontSize: 14, color: '#333', backgroundColor: '#fafafa' },
  voiceGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  voiceChip: { paddingHorizontal: 12, paddingVertical: 8, borderRadius: 16, backgroundColor: '#f0f0f0' },
  voiceChipText: { fontSize: 13, color: '#555' },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: { paddingHorizontal: 16, paddingVertical: 10, borderRadius: 20, backgroundColor: '#f0f0f0' },
  chipActive: { backgroundColor: '#007AFF' },
  chipText: { fontSize: 15, color: '#555', fontWeight: '500' },
  chipTextActive: { color: '#fff' },
  voiceItem: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 12, paddingHorizontal: 12, borderRadius: 8, marginBottom: 4 },
  voiceItemActive: { backgroundColor: '#E8F0FE' },
  voiceName: { fontSize: 15, color: '#333' },
  voiceLang: { fontSize: 13, color: '#888' },
});
