import { useCallback, useEffect, useRef, useState } from 'react';

interface SpeechRecognitionEvent extends Event {
  results: SpeechRecognitionResultList;
}

interface SpeechRecognitionError extends Event {
  error: string;
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
}

export function useSpeechRecognition(
  onTranscriptComplete?: (text: string) => void
): UseSpeechRecognitionResult {
  const [isListening, setIsListening] = useState(false);
  const [transcript, setTranscript] = useState('');
  const [interimTranscript, setInterimTranscript] = useState('');
  const [error, setError] = useState<string | null>(null);

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
  }, []);

  const setupRecognizer = () => {
    if (!window.webkitSpeechRecognition) {
      throw new Error('Speech recognition is not supported in this browser');
    }

    const recognizer = new window.webkitSpeechRecognition();
    recognizer.continuous = true;
    recognizer.interimResults = true;
    recognizer.lang = "en-US";

    let finalTranscript = '';

    recognizer.onresult = (event: SpeechRecognitionEvent) => {
      let currentInterim = '';

      for (let i = 0; i < event.results.length; i++) {
        const result = event.results[i];

        if (result.isFinal) {
          const transcript = result[0].transcript.trim();

          // Only process if this is a new final result
          if (transcript && transcript !== lastProcessedResultRef.current) {
            lastProcessedResultRef.current = transcript;
            finalTranscript = transcript;

            // Call callback with just the new final result
            if (onTranscriptComplete) {
              onTranscriptComplete(transcript);
            }
          }
        } else {
          currentInterim = result[0].transcript;
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
  }, [resetTranscript]);

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
    error
  };
}
