import { useState, useRef, useCallback, useEffect, useMemo } from 'react';
import { Audio } from 'expo-av';
import { DoubaoTTSClient, type DoubaoConfig } from '../services/doubaoTTS';

interface UseDoubaoTTSOptions {
  config: DoubaoConfig | null;
  speaker?: string;
  speedRatio?: number;
  pitch?: number;
  onSentenceStart?: (text: string) => void;
  onSentenceEnd?: (text: string) => void;
  onDone?: () => void;
}

export function useDoubaoTTS(options: UseDoubaoTTSOptions) {
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [currentSentenceIndex, setCurrentSentenceIndex] = useState(0);

  const clientRef = useRef<DoubaoTTSClient | null>(null);
  const soundRef = useRef<Audio.Sound | null>(null);
  const sentenceCountRef = useRef(0);
  const sentenceIdxRef = useRef(0);
  const textRef = useRef('');
  const optionsRef = useRef(options);
  optionsRef.current = options;

  const splitSentences = useCallback((text: string): string[] => {
    const regex = /[^。！？.!?\n]+[。！？.!?\n]*/g;
    const matches = text.match(regex);
    return matches || [text];
  }, []);

  const unloadSound = useCallback(async () => {
    if (soundRef.current) {
      try { await soundRef.current.unloadAsync(); } catch {}
      soundRef.current = null;
    }
  }, []);

  const stopSpeaking = useCallback(async () => {
    clientRef.current?.cancel();
    clientRef.current = null;
    setIsSpeaking(false);
    setIsPaused(false);
    setIsLoading(false);
    setCurrentSentenceIndex(0);
    await unloadSound();
  }, [unloadSound]);

  const speak = useCallback(async (text: string) => {
    const opts = optionsRef.current;
    if (!opts.config || !text.trim()) return;

    await stopSpeaking();

    textRef.current = text;
    const sentences = splitSentences(text);
    sentenceCountRef.current = sentences.length;
    sentenceIdxRef.current = 0;

    setIsLoading(true);
    setIsSpeaking(true);
    setIsPaused(false);
    setCurrentSentenceIndex(0);

    try {
      const client = new DoubaoTTSClient(opts.config, {
        onSentenceStart: (payload: any) => {
          opts.onSentenceStart?.(payload?.text || '');
        },
        onSentenceEnd: (payload: any) => {
          sentenceIdxRef.current++;
          setCurrentSentenceIndex(sentenceIdxRef.current);
          opts.onSentenceEnd?.(payload?.text || '');
        },
        onDone: () => {
          setIsSpeaking(false);
          setIsPaused(false);
          setIsLoading(false);

          if (clientRef.current) {
            const audioBase64 = clientRef.current.getAudioBase64();
            if (audioBase64) {
              playAudio(audioBase64);
            }
          }
          opts.onDone?.();
        },
        onError: (err: Error) => {
          console.error('Doubao TTS error:', err);
          setIsSpeaking(false);
          setIsLoading(false);
        },
      });

      clientRef.current = client;

      const rate = opts.speedRatio ?? 1.0;
      const speechRate = Math.round((rate - 1) * 50);

      await client.synthesize(text, opts.speaker || 'zh_female_gaolengyujie_uranus_bigtts', {
        format: 'mp3',
        speechRate,
        pitch: opts.pitch,
        enableSubtitle: true,
      });

      // Audio is played in onDone callback
    } catch (error) {
      console.error('Doubao TTS error:', error);
      setIsSpeaking(false);
      setIsLoading(false);
    }
  }, [splitSentences, stopSpeaking]);

  const playAudio = useCallback(async (base64: string) => {
    await unloadSound();
    await Audio.setAudioModeAsync({
      playsInSilentModeIOS: true,
      staysActiveInBackground: true,
      shouldDuckAndroid: true,
    });

    const { sound } = await Audio.Sound.createAsync(
      { uri: `data:audio/mp3;base64,${base64}` },
      { shouldPlay: true },
      (status: any) => {
        if (status.didJustFinish) {
          setIsSpeaking(false);
          setIsPaused(false);
        }
      }
    );
    soundRef.current = sound;
  }, [unloadSound]);

  const pause = useCallback(async () => {
    if (soundRef.current) {
      await soundRef.current.pauseAsync();
      setIsPaused(true);
    }
  }, []);

  const resume = useCallback(async () => {
    if (soundRef.current) {
      await soundRef.current.playAsync();
      setIsPaused(false);
    }
  }, []);

  useEffect(() => {
    return () => {
      clientRef.current?.cancel();
      unloadSound();
    };
  }, [unloadSound]);

  const sentenceBoundaries = useMemo(() => {
    const text = textRef.current;
    if (!text) return [];
    const boundaries: number[] = [0];
    let pos = 0;
    for (let i = 0; i < sentenceCountRef.current && pos < text.length; i++) {
      const match = text.slice(pos).match(/[。！？.!?\n]/);
      if (match && match.index !== undefined) {
        pos += match.index + 1;
        boundaries.push(pos);
      } else {
        break;
      }
    }
    if (boundaries[boundaries.length - 1] < text.length) {
      boundaries.push(text.length);
    }
    return boundaries;
  }, [isSpeaking]);

  return {
    isSpeaking,
    isPaused,
    isLoading,
    currentSentenceIndex,
    sentenceBoundaries,
    speak,
    pause,
    resume,
    stop: stopSpeaking,
  };
}
