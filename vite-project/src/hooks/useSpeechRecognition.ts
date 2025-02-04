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

interface UseSpeechRecognitionResult {
  isListening: boolean;
  transcript: string;
  interimTranscript: string;
  startListening: () => void;
  stopListening: () => void;
  resetTranscript: () => void;
  error: string | null;
  connectionStatus: 'connected' | 'disconnected' | 'error';
}

const MAX_RESTART_ATTEMPTS = 3;
const RESTART_DELAY = 1000;
const CONFIDENCE_THRESHOLD = 0.6; // Higher confidence threshold for better accuracy

export function useSpeechRecognition(
  onTranscriptComplete?: (text: string) => void
): UseSpeechRecognitionResult {
  const [isListening, setIsListening] = useState(false);
  const [transcript, setTranscript] = useState('');
  const [interimTranscript, setInterimTranscript] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [connectionStatus, setConnectionStatus] = useState<'connected' | 'disconnected' | 'error'>('disconnected');

  const recognizerRef = useRef<SpeechRecognition | null>(null);
  const isListeningRef = useRef(isListening);
  const lastProcessedResultRef = useRef<string>('');
  const restartAttemptsRef = useRef(0);
  const reconnectTimeoutRef = useRef<number>();

  useEffect(() => {
    isListeningRef.current = isListening;
    return () => {
      if (recognizerRef.current) {
        recognizerRef.current.abort();
        recognizerRef.current = null;
      }
      if (reconnectTimeoutRef.current) {
        window.clearTimeout(reconnectTimeoutRef.current);
      }
    };
  }, [isListening]);

  const resetTranscript = useCallback(() => {
    setTranscript('');
    setInterimTranscript('');
    lastProcessedResultRef.current = '';
  }, []);

  const handleRecognitionError = useCallback((errorMessage: string) => {
    console.error('Speech recognition error:', errorMessage);
    setError(errorMessage);
    setConnectionStatus('error');

    if (isListeningRef.current && restartAttemptsRef.current < MAX_RESTART_ATTEMPTS) {
      restartAttemptsRef.current++;
      reconnectTimeoutRef.current = window.setTimeout(() => {
        if (recognizerRef.current) {
          try {
            recognizerRef.current.start();
            setConnectionStatus('connected');
          } catch {
            handleRecognitionError('Failed to restart recognition');
          }
        }
      }, RESTART_DELAY);
    } else {
      setIsListening(false);
      if (recognizerRef.current) {
        recognizerRef.current.abort();
        recognizerRef.current = null;
      }
    }
  }, []);

  const setupRecognizer = useCallback(() => {
    if (!window.webkitSpeechRecognition) {
      throw new Error('Speech recognition is not supported in this browser');
    }

    const recognizer = new window.webkitSpeechRecognition();
    recognizer.continuous = true;
    recognizer.interimResults = true;
    recognizer.lang = 'en-US'; // English only

    let finalTranscript = '';

    recognizer.onresult = (event: SpeechRecognitionEvent) => {
      let currentInterim = '';
      setConnectionStatus('connected');

      for (let i = 0; i < event.results.length; i++) {
        const result = event.results[i];
        const transcript = result[0].transcript.trim();

        if (result.isFinal) {
          if (transcript && transcript !== lastProcessedResultRef.current) {
            lastProcessedResultRef.current = transcript;
            finalTranscript = transcript;

            if (onTranscriptComplete && result[0].confidence > CONFIDENCE_THRESHOLD) {
              onTranscriptComplete(transcript);
            }
          }
        } else {
          currentInterim = transcript;
        }
      }

      if (finalTranscript) {
        setTranscript(finalTranscript);
        finalTranscript = '';
      }
      setInterimTranscript(currentInterim);
    };

    recognizer.onend = () => {
      if (isListeningRef.current) {
        try {
          recognizer.start();
        } catch {
          handleRecognitionError('Failed to restart recognition');
        }
      } else {
        setConnectionStatus('disconnected');
      }
    };

    recognizer.onerror = (event: SpeechRecognitionError) => {
      handleRecognitionError(event.error);
    };

    return recognizer;
  }, [onTranscriptComplete, handleRecognitionError]);

  const startListening = useCallback(() => {
    try {
      setError(null);
      resetTranscript();
      setIsListening(true);
      restartAttemptsRef.current = 0;

      if (recognizerRef.current) {
        recognizerRef.current.abort();
        recognizerRef.current = null;
      }

      recognizerRef.current = setupRecognizer();
      recognizerRef.current.start();
    } catch (err) {
      handleRecognitionError(err instanceof Error ? err.message : 'Failed to start speech recognition');
      setIsListening(false);
    }
  }, [resetTranscript, setupRecognizer, handleRecognitionError]);

  const stopListening = useCallback(() => {
    setIsListening(false);
    if (recognizerRef.current) {
      recognizerRef.current.abort();
      recognizerRef.current = null;
    }
    setInterimTranscript('');
    setConnectionStatus('disconnected');
  }, []);

  return {
    isListening,
    transcript,
    interimTranscript,
    startListening,
    stopListening,
    resetTranscript,
    error,
    connectionStatus
  };
}
