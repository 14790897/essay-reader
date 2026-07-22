import { useState, useRef, useCallback, useEffect, useMemo } from 'react';
import { Audio } from 'expo-av';
import { synthesizeSpeech, type DoubaoConfig } from '../services/doubaoTTS';

interface UseDoubaoTTSOptions {
  config: DoubaoConfig | null;
  speedRatio?: number;
  volumeRatio?: number;
  pitchRatio?: number;
  onSentenceChange?: (index: number) => void;
  onDone?: () => void;
}

export function useDoubaoTTS(options: UseDoubaoTTSOptions) {
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [currentSentenceIndex, setCurrentSentenceIndex] = useState(0);

  const soundRef = useRef<Audio.Sound | null>(null);
  const sentenceTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const sentenceBoundariesRef = useRef<number[]>([]);
  const textRef = useRef<string>('');
  const optionsRef = useRef(options);
  optionsRef.current = options;

  const splitSentences = useCallback((text: string): number[] => {
    const boundaries: number[] = [0];
    const regex = /[。！？.!?\n]+/g;
    let match: RegExpExecArray | null;
    while ((match = regex.exec(text)) !== null) {
      boundaries.push(match.index + match[0].length);
    }
    if (boundaries[boundaries.length - 1] < text.length) {
      boundaries.push(text.length);
    }
    return boundaries;
  }, []);

  const clearTimers = useCallback(() => {
    if (sentenceTimerRef.current) {
      clearInterval(sentenceTimerRef.current);
      sentenceTimerRef.current = null;
    }
  }, []);

  const unloadSound = useCallback(async () => {
    if (soundRef.current) {
      try {
        await soundRef.current.unloadAsync();
      } catch {}
      soundRef.current = null;
    }
  }, []);

  const speak = useCallback(async (text: string) => {
    const opts = optionsRef.current;
    if (!opts.config || !text.trim()) return;

    await stopSpeaking();

    textRef.current = text;
    const boundaries = splitSentences(text);
    sentenceBoundariesRef.current = boundaries;

    setIsLoading(true);
    setIsSpeaking(true);
    setIsPaused(false);
    setCurrentSentenceIndex(0);

    try {
      const base64Audio = await synthesizeSpeech({
        config: opts.config,
        text,
        speedRatio: opts.speedRatio ?? 1.0,
        volumeRatio: opts.volumeRatio ?? 1.0,
        pitchRatio: opts.pitchRatio ?? 1.0,
      });

      setIsLoading(false);

      if (!base64Audio) {
        throw new Error('No audio data returned');
      }

      await Audio.setAudioModeAsync({
        playsInSilentModeIOS: true,
        staysActiveInBackground: true,
        shouldDuckAndroid: true,
      });

      // Write base64 to temp file and load
      const { sound } = await Audio.Sound.createAsync(
        { uri: `data:audio/mp3;base64,${base64Audio}` },
        { shouldPlay: true },
        onPlaybackStatusUpdate
      );

      soundRef.current = sound;

      // Start sentence tracking based on estimated timing
      const estimatedDurationMs = (text.length / 4) * 1000 / (opts.speedRatio ?? 1.0);
      const sentenceCount = boundaries.length - 1;
      const intervalMs = Math.max(200, estimatedDurationMs / sentenceCount);

      let currentIdx = 0;
      sentenceTimerRef.current = setInterval(() => {
        currentIdx++;
        if (currentIdx >= sentenceCount) {
          clearTimers();
          return;
        }
        setCurrentSentenceIndex(currentIdx);
        opts.onSentenceChange?.(currentIdx);
      }, intervalMs);
    } catch (error) {
      console.error('Doubao TTS error:', error);
      setIsSpeaking(false);
      setIsLoading(false);
    }
  }, [splitSentences, clearTimers]);

  const onPlaybackStatusUpdate = useCallback((status: any) => {
    if (status.didJustFinish) {
      clearTimers();
      setIsSpeaking(false);
      setIsPaused(false);
      setCurrentSentenceIndex(0);
      optionsRef.current.onDone?.();
    }
  }, [clearTimers]);

  const pause = useCallback(async () => {
    if (soundRef.current) {
      await soundRef.current.pauseAsync();
      setIsPaused(true);
      clearTimers();
    }
  }, [clearTimers]);

  const resume = useCallback(async () => {
    if (soundRef.current) {
      await soundRef.current.playAsync();
      setIsPaused(false);
    }
  }, []);

  const stopSpeaking = useCallback(async () => {
    clearTimers();
    setIsSpeaking(false);
    setIsPaused(false);
    setIsLoading(false);
    setCurrentSentenceIndex(0);
    await unloadSound();
  }, [clearTimers, unloadSound]);

  useEffect(() => {
    return () => {
      clearTimers();
      unloadSound();
    };
  }, [clearTimers, unloadSound]);

  const sentenceBoundaries = useMemo(
    () => sentenceBoundariesRef.current,
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [isSpeaking]
  );

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
