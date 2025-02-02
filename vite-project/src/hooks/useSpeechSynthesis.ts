import { useCallback, useEffect, useRef, useState } from 'react';

interface UseSpeechSynthesisResult {
  speak: (text: string) => void;
  stop: () => void;
  isReady: boolean;
  isSpeaking: boolean;
}

export function useSpeechSynthesis(): UseSpeechSynthesisResult {
  const synthRef = useRef<SpeechSynthesis>();
  const voiceRef = useRef<SpeechSynthesisVoice | null>(null);
  const [isReady, setIsReady] = useState(false);
  const isSpeakingRef = useRef(false);
  const utteranceQueueRef = useRef<string[]>([]);
  const currentUtteranceRef = useRef<SpeechSynthesisUtterance | null>(null);

  const findOptimalVoice = (voices: SpeechSynthesisVoice[]): SpeechSynthesisVoice | null => {
    const priorities = [
      (v: SpeechSynthesisVoice) => v.name === 'Microsoft Zira Desktop',
      (v: SpeechSynthesisVoice) => v.name.toLowerCase().includes('female') && v.lang.startsWith('en'),
      (v: SpeechSynthesisVoice) => v.lang.startsWith('en'),
    ];

    for (const priority of priorities) {
      const match = voices.find(priority);
      if (match) return match;
    }

    return voices[0] || null;
  };

  useEffect(() => {
    synthRef.current = window.speechSynthesis;

    const setVoice = () => {
      const voices = synthRef.current?.getVoices() || [];
      voiceRef.current = findOptimalVoice(voices);
      setIsReady(true);
    };

    setVoice();
    if (speechSynthesis.onvoiceschanged !== undefined) {
      speechSynthesis.onvoiceschanged = setVoice;
    }

    return () => {
      stop();
    };
  }, []);

  const processNextInQueue = useCallback(() => {
    if (!synthRef.current || !voiceRef.current || isSpeakingRef.current || utteranceQueueRef.current.length === 0) {
      return;
    }

    const text = utteranceQueueRef.current.shift();
    if (!text) return;

    isSpeakingRef.current = true;
    const utterance = new SpeechSynthesisUtterance(text);
    currentUtteranceRef.current = utterance;

    // Configure voice settings
    utterance.voice = voiceRef.current;
    utterance.pitch = 1.1;     // Slightly higher pitch for cuteness
    utterance.rate = 1.1;      // Slightly faster but still clear
    utterance.volume = 1;      // Full volume

    // Handle events
    utterance.onend = () => {
      isSpeakingRef.current = false;
      currentUtteranceRef.current = null;
      processNextInQueue();
    };

    utterance.onerror = () => {
      isSpeakingRef.current = false;
      currentUtteranceRef.current = null;
      processNextInQueue();
    };

    try {
      synthRef.current.speak(utterance);
    } catch (error) {
      console.error('Speech synthesis error:', error);
      isSpeakingRef.current = false;
      currentUtteranceRef.current = null;
    }
  }, []);

  const speak = useCallback((text: string) => {
    if (!text.trim()) return;

    // Split into smaller chunks for more natural speech
    const chunks = text
      .replace(/([.!?])\s+/g, '$1|') // Split on sentence endings
      .split('|')
      .filter(chunk => chunk.trim())
      .map(chunk => chunk.trim());

    // Add chunks to queue
    utteranceQueueRef.current.push(...chunks);

    // Process queue if not currently speaking
    if (!isSpeakingRef.current) {
      processNextInQueue();
    }
  }, [processNextInQueue]);

  const stop = useCallback(() => {
    if (synthRef.current) {
      synthRef.current.cancel();
    }
    utteranceQueueRef.current = [];
    isSpeakingRef.current = false;
    currentUtteranceRef.current = null;
  }, []);

  return {
    speak,
    stop,
    isReady,
    isSpeaking: isSpeakingRef.current
  };
}
