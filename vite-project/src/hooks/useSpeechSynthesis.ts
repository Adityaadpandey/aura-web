import { useCallback, useEffect, useRef, useState } from 'react';
import { websocketService } from '../services/websocketService';

interface UseSpeechSynthesisResult {
  speak: (text: string) => void;
  stop: () => void;
  isReady: boolean;
  isSpeaking: boolean;
}

const READY_CHECK_INTERVAL = 1000; // Check WebSocket readiness every second

export function useSpeechSynthesis(): UseSpeechSynthesisResult {
  const [isReady, setIsReady] = useState(false);
  const isSpeakingRef = useRef(false);
  const currentChunkRef = useRef<string>('');
  const readyCheckIntervalRef = useRef<number>();

  // Monitor WebSocket connection state
  useEffect(() => {
    const checkConnection = () => {
      const isConnected = websocketService.isConnected();
      setIsReady(isConnected);
    };

    // Initial check
    checkConnection();

    // Set up periodic checking
    readyCheckIntervalRef.current = window.setInterval(checkConnection, READY_CHECK_INTERVAL);

    return () => {
      if (readyCheckIntervalRef.current) {
        window.clearInterval(readyCheckIntervalRef.current);
      }
      stop();
    };
  }, []);

  const speak = useCallback(async (text: string) => {
    if (!text.trim() || !isReady) return;

    // Split text into chunks at natural pause points
    const chunks = text
      .split(/([,.!?]|\s+and\s+|\s+but\s+|\s+or\s+|\s+so\s+)/)
      .filter(chunk => chunk.trim())
      .map(chunk => chunk.trim());

    // For very short text, synthesize immediately
    if (chunks.length === 1 || text.length < 50) {
      await synthesizeChunk(text);
      return;
    }

    // For longer texts, combine chunks into natural phrases
    let currentPhrase = '';
    let delay = 0;

    for (const chunk of chunks) {
      if (currentPhrase.length + chunk.length > 30) {
        const phrase = currentPhrase;
        // Use setTimeout to sequence the chunks with natural timing
        setTimeout(() => {
          synthesizeChunk(phrase);
        }, delay);
        delay += 300; // Add slight delay between phrases
        currentPhrase = chunk;
      } else {
        currentPhrase += (currentPhrase ? ' ' : '') + chunk;
      }
    }

    // Handle the last phrase
    if (currentPhrase) {
      setTimeout(() => {
        synthesizeChunk(currentPhrase);
      }, delay);
    }
  }, [isReady]);

  const synthesizeChunk = async (text: string) => {
    if (!text.trim() || isSpeakingRef.current || !isReady) return;

    try {
      isSpeakingRef.current = true;
      currentChunkRef.current = text;

      await websocketService.synthesize(text);

      // Wait briefly to ensure audio starts playing
      await new Promise(resolve => setTimeout(resolve, 100));
    } catch (error) {
      console.error('Speech synthesis error:', error);
    } finally {
      // Reset speaking state after a delay proportional to text length
      const delay = Math.max(500, text.length * 50); // Rough estimate of speech duration
      setTimeout(() => {
        if (currentChunkRef.current === text) {
          isSpeakingRef.current = false;
          currentChunkRef.current = '';
        }
      }, delay);
    }
  };

  const stop = useCallback(() => {
    websocketService.stop();
    isSpeakingRef.current = false;
    currentChunkRef.current = '';
  }, []);

  return {
    speak,
    stop,
    isReady,
    isSpeaking: isSpeakingRef.current
  };
}
