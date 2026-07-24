import React, { useState, useCallback, useRef } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Platform, StatusBar, Alert } from 'react-native';
import { useSpeech } from './src/hooks/useSpeech';
import { useDoubaoTTS } from './src/hooks/useDoubaoTTS';
import { useArticles } from './src/hooks/useArticles';
import type { DoubaoConfig } from './src/services/doubaoTTS';
import Reader from './src/components/Reader';
import Player from './src/components/Player';
import Settings, { type TTSProvider } from './src/components/Settings';
import ArticleList from './src/components/ArticleList';
import ArticleEditor from './src/components/ArticleEditor';

export default function App() {
  const [provider, setProvider] = useState<TTSProvider>('system');
  const [rate, setRate] = useState(0.9);
  const [pitch, setPitch] = useState(1.0);
  const [fontSize, setFontSize] = useState(18);
  const [selectedVoice, setSelectedVoice] = useState('');
  const [showList, setShowList] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [showEditor, setShowEditor] = useState(false);
  const [editTitle, setEditTitle] = useState('');
  const [editContent, setEditContent] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [doubaoConfig, setDoubaoConfig] = useState<DoubaoConfig>({
    apiKey: '',
    resourceId: 'seed-tts-2.0',
  });
  const [doubaoSpeaker, setDoubaoSpeaker] = useState('zh_female_gaolengyujie_uranus_bigtts');

  const progressRef = useRef(0);
  const articles = useArticles();

  const onBoundary = useCallback((charIndex: number) => {
    progressRef.current = charIndex;
  }, []);

  const onDone = useCallback(() => {
    if (articles.currentArticle) {
      articles.updateArticle(articles.currentArticle.id, { progress: progressRef.current });
    }
  }, [articles]);

  const systemSpeech = useSpeech({
    rate,
    pitch,
    voice: selectedVoice || undefined,
    onBoundary,
    onDone,
  });

  const onDoubaoSentenceStart = useCallback((_text: string) => {}, []);

  const onDoubaoDone = useCallback(() => {
    if (articles.currentArticle) {
      articles.updateArticle(articles.currentArticle.id, { progress: progressRef.current });
    }
  }, [articles]);

  const doubaoTTS = useDoubaoTTS({
    config: provider === 'doubao' ? doubaoConfig : null,
    speaker: doubaoSpeaker,
    speedRatio: rate,
    pitch: Math.round((pitch - 1) * 6),
    onSentenceStart: onDoubaoSentenceStart,
    onDone: onDoubaoDone,
  });

  const activeTTS = provider === 'doubao' ? doubaoTTS : systemSpeech;

  const handlePlay = useCallback(() => {
    if (!articles.currentArticle) return;
    if (provider === 'doubao' && !doubaoConfig.apiKey) {
      Alert.alert('Doubao Config Missing', 'Please enter your API Key in Settings.');
      return;
    }
    const startFrom = articles.currentArticle.progress > 0
      ? articles.currentArticle.content.slice(articles.currentArticle.progress)
      : articles.currentArticle.content;
    activeTTS.speak(startFrom);
  }, [articles.currentArticle, activeTTS, provider, doubaoConfig]);

  const handleStop = useCallback(() => {
    activeTTS.stop();
    if (articles.currentArticle) {
      articles.updateArticle(articles.currentArticle.id, { progress: progressRef.current });
    }
  }, [activeTTS, articles]);

  const handleNewArticle = useCallback(() => {
    setEditTitle(''); setEditContent(''); setEditingId(null);
    setShowList(false); setShowEditor(true);
  }, []);

  const handleEditArticle = useCallback(() => {
    if (articles.currentArticle) {
      setEditTitle(articles.currentArticle.title);
      setEditContent(articles.currentArticle.content);
      setEditingId(articles.currentArticle.id);
      setShowEditor(true);
    }
  }, [articles.currentArticle]);

  const handleSaveArticle = useCallback(async (title: string, content: string) => {
    if (editingId) {
      await articles.updateArticle(editingId, { title, content, progress: 0 });
    } else {
      const article = await articles.addArticle(title, content);
      await articles.selectArticle(article.id);
    }
    setShowEditor(false);
  }, [editingId, articles]);

  const isSpeaking = provider === 'doubao' ? doubaoTTS.isSpeaking : systemSpeech.isSpeaking;
  const isPaused = provider === 'doubao' ? doubaoTTS.isPaused : systemSpeech.isPaused;
  const isLoading = provider === 'doubao' ? doubaoTTS.isLoading : false;

  return (
    <View style={styles.root}>
      <StatusBar barStyle="dark-content" backgroundColor="#fff" />
      <View style={styles.header}>
        <TouchableOpacity testID="menu-btn" style={styles.headerBtn} onPress={() => setShowList(true)}>
          <Text style={styles.headerIcon}>{'\u2630'}</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.headerTitleArea} onPress={handleEditArticle} disabled={!articles.currentArticle}>
          <Text testID="header-title" style={styles.headerTitle} numberOfLines={1}>
            {articles.currentArticle?.title || 'Essay Reader'}
          </Text>
        </TouchableOpacity>
        <TouchableOpacity testID="settings-btn" style={styles.headerBtn} onPress={() => setShowSettings(true)}>
          <Text style={styles.headerIcon}>{'\u2699'}</Text>
        </TouchableOpacity>
      </View>
      <View style={styles.providerBadge}>
        <Text testID="provider-badge" style={styles.providerBadgeText}>
          {provider === 'doubao' ? 'Doubao TTS \u2022 WebSocket' : 'System TTS'}
        </Text>
      </View>
      <Reader
        content={articles.currentArticle?.content || ''}
        currentSentenceIndex={activeTTS.currentSentenceIndex ?? 0}
        sentenceBoundaries={activeTTS.sentenceBoundaries ?? []}
        fontSize={fontSize}
      />
      <Player
        isSpeaking={isSpeaking}
        isPaused={isPaused}
        hasContent={!!articles.currentArticle}
        isLoading={isLoading}
        onPlay={handlePlay}
        onPause={activeTTS.pause}
        onResume={activeTTS.resume}
        onStop={handleStop}
      />
      {showList && (
        <View style={styles.modalOverlay}>
          <ArticleList articles={articles.articles} currentId={articles.currentId}
            onSelect={articles.selectArticle} onDelete={articles.deleteArticle}
            onNewArticle={handleNewArticle} onClose={() => setShowList(false)} />
        </View>
      )}
      {showSettings && (
        <View style={styles.modalOverlay}>
          <View style={styles.settingsPanel}>
            <View style={styles.settingsHeader}>
              <Text style={styles.settingsTitle}>Settings</Text>
              <TouchableOpacity onPress={() => setShowSettings(false)}>
                <Text style={styles.settingsDone}>Done</Text>
              </TouchableOpacity>
            </View>
            <Settings
              provider={provider} rate={rate} pitch={pitch} fontSize={fontSize}
              doubaoConfig={doubaoConfig} doubaoSpeaker={doubaoSpeaker}
              onProviderChange={setProvider} onDoubaoConfigChange={setDoubaoConfig}
              onDoubaoSpeakerChange={setDoubaoSpeaker}
              selectedVoice={selectedVoice} voices={systemSpeech.voices}
              onRateChange={setRate} onPitchChange={setPitch}
              onFontSizeChange={setFontSize} onVoiceChange={setSelectedVoice}
            />
          </View>
        </View>
      )}
      <ArticleEditor visible={showEditor} title={editTitle} content={editContent}
        onSave={handleSaveArticle} onClose={() => setShowEditor(false)} />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#fff' },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingTop: Platform.OS === 'ios' ? 54 : 36, paddingBottom: 10, paddingHorizontal: 12, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: '#e0e0e0', backgroundColor: '#fff' },
  headerBtn: { padding: 8 },
  headerIcon: { fontSize: 22 },
  headerTitleArea: { flex: 1, marginHorizontal: 12, alignItems: 'center' },
  headerTitle: { fontSize: 18, fontWeight: '600', color: '#1a1a1a' },
  providerBadge: { alignItems: 'center', paddingVertical: 4, backgroundColor: '#f0f4ff', borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: '#d0d8f0' },
  providerBadgeText: { fontSize: 11, color: '#666', fontWeight: '500' },
  modalOverlay: { ...StyleSheet.absoluteFill, backgroundColor: '#fff', zIndex: 100 },
  settingsPanel: { flex: 1, backgroundColor: '#fff', paddingTop: Platform.OS === 'ios' ? 54 : 36 },
  settingsHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingBottom: 12, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: '#e0e0e0' },
  settingsTitle: { fontSize: 20, fontWeight: '700', color: '#1a1a1a' },
  settingsDone: { fontSize: 16, color: '#007AFF', fontWeight: '600' },
});
