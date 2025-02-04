import { useCallback, useEffect, useRef, useState } from 'react';

interface UseMicrophoneResult {
  stream: MediaStream | null;
  error: string | null;
  requestAccess: () => Promise<void>;
  isAvailable: boolean;
  deviceName: string | null;
}

const MAX_RETRY_ATTEMPTS = 3;
const RETRY_DELAY = 2000;

export function useMicrophone(): UseMicrophoneResult {
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isAvailable, setIsAvailable] = useState(true);
  const [deviceName, setDeviceName] = useState<string | null>(null);

  const streamRef = useRef<MediaStream | null>(null);
  const retryAttemptsRef = useRef(0);
  const retryTimeoutRef = useRef<number>();

  const cleanup = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }
    if (retryTimeoutRef.current) {
      window.clearTimeout(retryTimeoutRef.current);
    }
    setStream(null);
    setDeviceName(null);
  }, []);

  const handleDeviceChange = useCallback(async () => {
    // Check if audio devices are available
    const devices = await navigator.mediaDevices.enumerateDevices();
    const hasAudioDevice = devices.some(device => device.kind === 'audioinput');

    setIsAvailable(hasAudioDevice);

    if (hasAudioDevice && !streamRef.current) {
      requestAccess();
    }
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

      // Request microphone access with optimized settings
      const mediaStream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
          channelCount: 1,
          sampleRate: 48000,
          sampleSize: 16
        }
      });

      // Get device name
      const devices = await navigator.mediaDevices.enumerateDevices();
      const audioDevice = devices.find(device => device.kind === 'audioinput');
      setDeviceName(audioDevice?.label || 'Microphone');

      streamRef.current = mediaStream;
      setStream(mediaStream);
      setIsAvailable(true);
      retryAttemptsRef.current = 0;

      // Add track ended listener to handle device disconnection
      mediaStream.getTracks().forEach(track => {
        track.onended = () => {
          console.log('Audio track ended, attempting to reconnect...');
          cleanup();
          requestAccess();
        };
      });

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

      // Implement retry mechanism
      if (retryAttemptsRef.current < MAX_RETRY_ATTEMPTS) {
        retryAttemptsRef.current++;
        console.log(`Retrying microphone access (${retryAttemptsRef.current}/${MAX_RETRY_ATTEMPTS})...`);
        retryTimeoutRef.current = window.setTimeout(() => {
          requestAccess();
        }, RETRY_DELAY);
      }
    }
  }, [cleanup]);

  useEffect(() => {
    requestAccess();

    // Listen for device changes
    navigator.mediaDevices.addEventListener('devicechange', handleDeviceChange);

    return () => {
      cleanup();
      navigator.mediaDevices.removeEventListener('devicechange', handleDeviceChange);
    };
  }, [cleanup, handleDeviceChange, requestAccess]);

  return {
    stream,
    error,
    requestAccess,
    isAvailable,
    deviceName
  };
}
