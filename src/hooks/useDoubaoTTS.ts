import { useState, useRef, useCallback, useEffect, useMemo } from "react";
import { createAudioPlayer, setAudioModeAsync } from "expo-audio";
import type { AudioPlayer, AudioStatus } from "expo-audio";
import { Paths, File } from "expo-file-system";
import { DoubaoTTSClient, type DoubaoConfig } from "../services/doubaoTTS";

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
  const playerRef = useRef<AudioPlayer | null>(null);
  const sentenceCountRef = useRef(0);
  const sentenceIdxRef = useRef(0);
  const textRef = useRef("");
  const optionsRef = useRef(options);
  optionsRef.current = options;

  const splitSentences = useCallback((text: string): string[] => {
    const regex = /[^。！？.!?\n]+[。！？.!?\n]*/g;
    const matches = text.match(regex);
    return matches || [text];
  }, []);

  const unloadPlayer = useCallback(async () => {
    if (playerRef.current) {
      try { playerRef.current.release(); } catch {}
      playerRef.current = null;
    }
  }, []);

  const stopSpeaking = useCallback(async () => {
    clientRef.current?.cancel();
    clientRef.current = null;
    setIsSpeaking(false);
    setIsPaused(false);
    setIsLoading(false);
    setCurrentSentenceIndex(0);
    await unloadPlayer();
  }, [unloadPlayer]);

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
          opts.onSentenceStart?.(payload?.text || "");
        },
        onSentenceEnd: (payload: any) => {
          sentenceIdxRef.current++;
          setCurrentSentenceIndex(sentenceIdxRef.current);
          opts.onSentenceEnd?.(payload?.text || "");
        },
        onDone: async () => {
          setIsLoading(false);

          if (clientRef.current) {
            const audioBytes = clientRef.current.getAudioBytes();
            if (audioBytes && audioBytes.byteLength > 0) {
              try {
                const cacheFile = new File(Paths.cache, `doubao_tts_${Date.now()}.mp3`);
                cacheFile.write(audioBytes);
                await playFromUri(cacheFile.uri);
              } catch (e) {
                console.error("Failed to play audio:", e);
              }
            }
          }
          opts.onDone?.();
        },
        onError: (err: Error) => {
          console.error("Doubao TTS error:", err);
          setIsSpeaking(false);
          setIsLoading(false);
        },
      });

      clientRef.current = client;

      const rate = opts.speedRatio ?? 1.0;
      const speechRate = Math.round((rate - 1) * 50);

      await client.synthesize(text, opts.speaker || "zh_female_gaolengyujie_uranus_bigtts", {
        format: "mp3",
        speechRate,
        pitch: opts.pitch,
        enableSubtitle: true,
      });
    } catch (error) {
      console.error("Doubao TTS error:", error);
      setIsSpeaking(false);
      setIsLoading(false);
    }
  }, [splitSentences, stopSpeaking]);

  const playFromUri = useCallback(async (uri: string) => {
    await unloadPlayer();

    await setAudioModeAsync({
      playsInSilentMode: true,
      shouldPlayInBackground: true,
      interruptionModeAndroid: "duckOthers",
    });

    const player = createAudioPlayer({ uri });
    playerRef.current = player;

    player.addListener("playbackStatusUpdate", (status: AudioStatus) => {
      if (status.didJustFinish && !status.playing) {
        setIsSpeaking(false);
        setIsPaused(false);
      }
    });

    await player.play();
    setIsPaused(false);
  }, [unloadPlayer]);

  const pause = useCallback(async () => {
    if (playerRef.current) {
      playerRef.current.pause();
      setIsPaused(true);
    }
  }, []);

  const resume = useCallback(async () => {
    if (playerRef.current) {
      playerRef.current.play();
      setIsPaused(false);
    }
  }, []);

  useEffect(() => {
    return () => {
      clientRef.current?.cancel();
      unloadPlayer();
    };
  }, [unloadPlayer]);

  const sentenceBoundaries = useMemo(() => {
    const text = textRef.current;
    if (!text || sentenceCountRef.current === 0) return [];
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
  }, [isSpeaking, currentSentenceIndex]);

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