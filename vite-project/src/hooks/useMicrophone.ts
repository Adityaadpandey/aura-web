import { useCallback, useEffect, useRef, useState } from 'react';

interface UseMicrophoneResult {
  stream: MediaStream | null;
  error: string | null;
  requestAccess: () => Promise<void>;
  isAvailable: boolean;
}

export function useMicrophone(): UseMicrophoneResult {
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isAvailable, setIsAvailable] = useState(true);
  const streamRef = useRef<MediaStream | null>(null);

  const cleanup = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }
    setStream(null);
  }, []);

  const requestAccess = useCallback(async () => {
    try {
      // Clean up any existing streams
      cleanup();
      setError(null);

      // Check if getUserMedia is supported
      if (!navigator.mediaDevices?.getUserMedia) {
        throw new Error('Your browser does not support microphone access');
      }

      // Request microphone access
      const mediaStream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true
        }
      });

      streamRef.current = mediaStream;
      setStream(mediaStream);
      setIsAvailable(true);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to access microphone';
      console.error('Microphone Error:', errorMessage);

      if (errorMessage.includes('Permission denied') || errorMessage.includes('Permission dismissed')) {
        setError('Please allow microphone access to use this feature');
      } else if (errorMessage.includes('not found') || errorMessage.includes('NotFoundError')) {
        setError('No microphone found. Please connect a microphone and try again');
        setIsAvailable(false);
      } else {
        setError(errorMessage);
      }

      setStream(null);
      streamRef.current = null;
    }
  }, [cleanup]);

  useEffect(() => {
    requestAccess();

    return () => {
      cleanup();
    };
  }, [cleanup, requestAccess]);

  return {
    stream,
    error,
    requestAccess,
    isAvailable
  };
}
