import { useCallback, useEffect, useRef, useState } from 'react';

type Language = 'en-US' | 'hi-IN';

interface UseSpeechSynthesisResult {
  speak: (text: string, language?: Language) => void;
  stop: () => void;
  isReady: boolean;
  isSpeaking: boolean;
  availableVoices: {
    [key in Language]: SpeechSynthesisVoice[];
  };
}

export function useSpeechSynthesis(): UseSpeechSynthesisResult {
  const synthRef = useRef<SpeechSynthesis>();
  const voiceRef = useRef<{
    [key in Language]: SpeechSynthesisVoice | null;
  }>({
    'en-US': null,
    'hi-IN': null
  });
  const [isReady, setIsReady] = useState(false);
  const isSpeakingRef = useRef(false);
  const utteranceQueueRef = useRef<Array<{ text: string; lang: Language }>>([]);
  const currentUtteranceRef = useRef<SpeechSynthesisUtterance | null>(null);
  const [availableVoices, setAvailableVoices] = useState<{
    [key in Language]: SpeechSynthesisVoice[];
  }>({
    'en-US': [],
    'hi-IN': []
  });

  const findOptimalVoice = (voices: SpeechSynthesisVoice[], language: Language): SpeechSynthesisVoice | null => {
    const langPrefix = language === 'hi-IN' ? 'hi' : 'en';

    // Priority order for voice selection
    const priorities = [
      // For English
      ...(language === 'en-US' ? [
        (v: SpeechSynthesisVoice) => v.name === 'Microsoft Zira Desktop',
        (v: SpeechSynthesisVoice) => v.name.toLowerCase().includes('female') && v.lang.startsWith('en'),
      ] : []),
      // For Hindi
      ...(language === 'hi-IN' ? [
        (v: SpeechSynthesisVoice) => v.lang.startsWith('hi'),
        (v: SpeechSynthesisVoice) => v.name.toLowerCase().includes('hindi'),
      ] : []),
      // Fallback
      (v: SpeechSynthesisVoice) => v.lang.startsWith(langPrefix),
    ];

    for (const priority of priorities) {
      const match = voices.find(priority);
      if (match) return match;
    }

    return voices.find(v => v.lang.startsWith(langPrefix)) || null;
  };

  useEffect(() => {
    synthRef.current = window.speechSynthesis;

    const updateVoices = () => {
      const voices = synthRef.current?.getVoices() || [];
      const categorizedVoices = {
        'en-US': voices.filter(v => v.lang.startsWith('en')),
        'hi-IN': voices.filter(v => v.lang.startsWith('hi'))
      };

      setAvailableVoices(categorizedVoices);

      // Set optimal voices for each language
      voiceRef.current = {
        'en-US': findOptimalVoice(voices, 'en-US'),
        'hi-IN': findOptimalVoice(voices, 'hi-IN')
      };

      setIsReady(true);
    };

    updateVoices();
    if (speechSynthesis.onvoiceschanged !== undefined) {
      speechSynthesis.onvoiceschanged = updateVoices;
    }

    return () => {
      stop();
    };
  }, []);

  const processNextInQueue = useCallback(() => {
    if (!synthRef.current || isSpeakingRef.current || utteranceQueueRef.current.length === 0) {
      return;
    }

    const nextItem = utteranceQueueRef.current.shift();
    if (!nextItem) return;

    isSpeakingRef.current = true;
    const utterance = new SpeechSynthesisUtterance(nextItem.text);
    currentUtteranceRef.current = utterance;

    // Configure voice settings
    const voice = voiceRef.current[nextItem.lang];
    if (voice) {
      utterance.voice = voice;
      utterance.lang = voice.lang;
    }

    // Optimize voice settings based on language
    if (nextItem.lang === 'en-US') {
      utterance.pitch = 1.1;  // Slightly higher pitch for English
      utterance.rate = 1.1;   // Slightly faster for English
    } else {
      utterance.pitch = 1.0;  // Normal pitch for Hindi
      utterance.rate = 0.9;   // Slightly slower for Hindi for better clarity
    }
    utterance.volume = 1;

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

  const speak = useCallback((text: string, language: Language = 'en-US') => {
    if (!text.trim()) return;

    // Split into smaller chunks for more natural speech
    const chunks = text
      .replace(/([.!?।])\s+/g, '$1|') // Split on sentence endings (including Hindi)
      .split('|')
      .filter(chunk => chunk.trim())
      .map(chunk => chunk.trim());

    // Add chunks to queue with language
    utteranceQueueRef.current.push(...chunks.map(chunk => ({ text: chunk, lang: language })));

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
    isSpeaking: isSpeakingRef.current,
    availableVoices
  };
}
