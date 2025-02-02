import { useCallback, useEffect, useRef, useState } from 'react';

interface SpeechRecognitionEvent extends Event {
  results: SpeechRecognitionResultList;
  resultIndex: number;
}

interface SpeechRecognitionError extends Event {
  error: string;
}

interface SpeechRecognitionAlternative {
  transcript: string;
  confidence: number;
}

interface SpeechRecognitionResult {
  isFinal: boolean;
  [index: number]: SpeechRecognitionAlternative;
}

interface SpeechRecognitionResultList {
  length: number;
  item(index: number): SpeechRecognitionResult;
  [index: number]: SpeechRecognitionResult;
}

interface SpeechRecognition extends EventTarget {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  onresult: ((event: SpeechRecognitionEvent) => void) | null;
  onend: (() => void) | null;
  onerror: ((event: SpeechRecognitionError) => void) | null;
  start: () => void;
  stop: () => void;
  abort: () => void;
}

declare global {
  interface Window {
    webkitSpeechRecognition: new () => SpeechRecognition;
  }
}

type Language = 'en-US' | 'hi-IN';

interface UseSpeechRecognitionResult {
  isListening: boolean;
  transcript: string;
  interimTranscript: string;
  startListening: () => void;
  stopListening: () => void;
  resetTranscript: () => void;
  error: string | null;
  language: Language;
  setLanguage: (lang: Language) => void;
  detectedLanguage: Language | null;
}

const isHindiText = (text: string): boolean => {
  // Unicode range for Devanagari script
  const devanagariRange = /[\u0900-\u097F]/;
  return devanagariRange.test(text);
};

export function useSpeechRecognition(
  onTranscriptComplete?: (text: string, detectedLang: Language) => void
): UseSpeechRecognitionResult {
  const [isListening, setIsListening] = useState(false);
  const [transcript, setTranscript] = useState('');
  const [interimTranscript, setInterimTranscript] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [language, setLanguage] = useState<Language>('en-US');
  const [detectedLanguage, setDetectedLanguage] = useState<Language | null>(null);

  const recognizerRef = useRef<SpeechRecognition | null>(null);
  const isListeningRef = useRef(isListening);
  const lastProcessedResultRef = useRef<string>('');

  useEffect(() => {
    isListeningRef.current = isListening;
    return () => {
      if (recognizerRef.current) {
        recognizerRef.current.abort();
        recognizerRef.current = null;
      }
    };
  }, [isListening]);

  const resetTranscript = useCallback(() => {
    setTranscript('');
    setInterimTranscript('');
    lastProcessedResultRef.current = '';
    setDetectedLanguage(null);
  }, []);

  const setupRecognizer = () => {
    if (!window.webkitSpeechRecognition) {
      throw new Error('Speech recognition is not supported in this browser');
    }

    const recognizer = new window.webkitSpeechRecognition();
    recognizer.continuous = true;
    recognizer.interimResults = true;
    recognizer.lang = language;
    recognizer.maxAlternatives = 1;

    let finalTranscript = '';

    recognizer.onresult = (event: SpeechRecognitionEvent) => {
      let currentInterim = '';

      for (let i = 0; i < event.results.length; i++) {
        const result = event.results[i];
        const transcript = result[0].transcript.trim();

        if (result[0].confidence > 0) {
          // Detect language based on Devanagari characters
          const detected: Language = isHindiText(transcript) ? 'hi-IN' : 'en-US';
          if (detected !== detectedLanguage) {
            setDetectedLanguage(detected);
            // Update recognizer language if different
            if (detected !== recognizer.lang) {
              recognizer.stop();
              recognizer.lang = detected;
              recognizer.start();
            }
          }
        }

        if (result.isFinal) {
          // Only process if this is a new final result
          if (transcript && transcript !== lastProcessedResultRef.current) {
            lastProcessedResultRef.current = transcript;
            finalTranscript = transcript;

            // Call callback with detected language
            if (onTranscriptComplete) {
              const detectedLang: Language = isHindiText(transcript) ? 'hi-IN' : 'en-US';
              onTranscriptComplete(transcript, detectedLang);
            }
          }
        } else {
          currentInterim = transcript;
        }
      }

      if (finalTranscript) {
        setTranscript(finalTranscript);
        finalTranscript = ''; // Reset after setting
      }
      setInterimTranscript(currentInterim);
    };

    recognizer.onend = () => {
      if (isListeningRef.current) {
        try {
          recognizer.start();
        } catch (error) {
          console.error('Failed to restart recognition:', error);
          setIsListening(false);
        }
      }
    };

    recognizer.onerror = (event: SpeechRecognitionError) => {
      console.error('Speech recognition error:', event.error);
      setError(event.error);
      setIsListening(false);
      if (recognizerRef.current) {
        recognizerRef.current.abort();
        recognizerRef.current = null;
      }
    };

    return recognizer;
  };

  const startListening = useCallback(() => {
    try {
      setError(null);
      resetTranscript();
      setIsListening(true);

      // Clean up existing recognizer
      if (recognizerRef.current) {
        recognizerRef.current.abort();
        recognizerRef.current = null;
      }

      recognizerRef.current = setupRecognizer();
      recognizerRef.current.start();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to start speech recognition');
      setIsListening(false);
    }
  }, [resetTranscript, language]);

  const stopListening = useCallback(() => {
    setIsListening(false);
    if (recognizerRef.current) {
      recognizerRef.current.abort();
      recognizerRef.current = null;
    }
    setInterimTranscript('');
  }, []);

  return {
    isListening,
    transcript,
    interimTranscript,
    startListening,
    stopListening,
    resetTranscript,
    error,
    language,
    setLanguage,
    detectedLanguage
  };
}
