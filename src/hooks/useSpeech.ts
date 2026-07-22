import { useRef, useState, useCallback, useEffect } from 'react';
import * as Speech from 'expo-speech';

export interface VoiceInfo {
  identifier: string;
  name: string;
  language: string;
  quality?: number;
}

interface UseSpeechOptions {
  rate?: number;
  pitch?: number;
  voice?: string;
  onBoundary?: (charIndex: number, charLength: number) => void;
  onDone?: () => void;
}

export function useSpeech(options: UseSpeechOptions = {}) {
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [voices, setVoices] = useState<VoiceInfo[]>([]);
  const [currentCharIndex, setCurrentCharIndex] = useState(0);

  const optionsRef = useRef(options);
  optionsRef.current = options;

  const sentenceBoundaries = useRef<number[]>([]);

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

  const findCurrentSentenceIndex = useCallback((charIndex: number): number => {
    const boundaries = sentenceBoundaries.current;
    for (let i = boundaries.length - 1; i >= 0; i--) {
      if (boundaries[i] <= charIndex) return i;
    }
    return 0;
  }, []);

  const speak = useCallback(async (text: string) => {
    if (!text.trim()) return;

    sentenceBoundaries.current = splitSentences(text);

    setIsSpeaking(true);
    setIsPaused(false);
    setCurrentCharIndex(0);

    Speech.speak(text, {
      language: 'zh-CN',
      rate: optionsRef.current.rate ?? 0.9,
      pitch: optionsRef.current.pitch ?? 1.0,
      voice: optionsRef.current.voice,
      onStart: () => {
        setIsSpeaking(true);
        setIsPaused(false);
      },
      onBoundary: (e: any) => {
        setCurrentCharIndex(e.charIndex);
        optionsRef.current.onBoundary?.(e.charIndex, e.charLength);
      },
      onDone: () => {
        setIsSpeaking(false);
        setIsPaused(false);
        optionsRef.current.onDone?.();
      },
      onStopped: () => {
        setIsSpeaking(false);
        setIsPaused(false);
      },
      onPause: () => {
        setIsPaused(true);
      },
      onResume: () => {
        setIsPaused(false);
      },
    });
  }, [splitSentences]);

  const pause = useCallback(async () => {
    await Speech.pause();
    setIsPaused(true);
  }, []);

  const resume = useCallback(async () => {
    await Speech.resume();
    setIsPaused(false);
  }, []);

  const stopSpeaking = useCallback(async () => {
    await Speech.stop();
    setIsSpeaking(false);
    setIsPaused(false);
  }, []);

  const loadVoices = useCallback(async () => {
    const available = await Speech.getAvailableVoicesAsync();
    setVoices(available as unknown as VoiceInfo[]);
  }, []);

  useEffect(() => {
    loadVoices();
  }, [loadVoices]);

  useEffect(() => {
    return () => {
      Speech.stop();
    };
  }, []);

  return {
    isSpeaking,
    isPaused,
    voices,
    currentCharIndex,
    currentSentenceIndex: findCurrentSentenceIndex(currentCharIndex),
    sentenceBoundaries: sentenceBoundaries.current,
    speak,
    pause,
    resume,
    stop: stopSpeaking,
    loadVoices,
  };
}
