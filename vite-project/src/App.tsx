import { Loader2, Mic, Square, Volume2 } from 'lucide-react';
import React, { useEffect, useRef, useState } from 'react';

interface AudioRecorderProps {
  onTranscriptionReceived: (text: string) => void;
}

const AudioRecorder: React.FC<AudioRecorderProps> = ({ onTranscriptionReceived }) => {
  const [isRecording, setIsRecording] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTranscription, setCurrentTranscription] = useState('');
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const websocketRef = useRef<WebSocket | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);

  useEffect(() => {
    // Initialize WebSocket connection
    websocketRef.current = new WebSocket('ws://localhost:5000/stream');

    websocketRef.current.onmessage = async (event) => {
      const response = JSON.parse(event.data);

      if (response.type === 'transcription') {
        setCurrentTranscription(response.text);
        onTranscriptionReceived(response.text);
      } else if (response.type === 'audio') {
        // Handle converted audio from RVC
        if (!audioContextRef.current) {
          audioContextRef.current = new AudioContext();
        }

        const audioData = Uint8Array.from(atob(response.audio), c => c.charCodeAt(0));
        const audioBuffer = await audioContextRef.current.decodeAudioData(audioData.buffer);

        const source = audioContextRef.current.createBufferSource();
        source.buffer = audioBuffer;
        source.connect(audioContextRef.current.destination);
        source.start();
        setIsPlaying(true);

        source.onended = () => {
          setIsPlaying(false);
        };
      }
    };

    return () => {
      if (websocketRef.current) {
        websocketRef.current.close();
      }
    };
  }, [onTranscriptionReceived]);

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream, {
        mimeType: 'audio/webm;codecs=opus'
      });
      mediaRecorderRef.current = mediaRecorder;

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0 && websocketRef.current?.readyState === WebSocket.OPEN) {
          // Convert blob to base64 and send to server
          const reader = new FileReader();
          reader.onloadend = () => {
            const base64Audio = (reader.result as string).split(',')[1];
            websocketRef.current?.send(JSON.stringify({
              type: 'audio',
              audio: base64Audio
            }));
          };
          reader.readAsDataURL(event.data);
        }
      };

      // Send smaller chunks more frequently for real-time processing
      mediaRecorder.start(100); // Send 100ms chunks
      setIsRecording(true);
    } catch (error) {
      console.error('Error accessing microphone:', error);
      alert('Error accessing microphone. Please ensure microphone permissions are granted.');
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);

      // Stop all tracks on the stream
      mediaRecorderRef.current.stream.getTracks().forEach(track => track.stop());

      // Send end-of-stream signal to server
      websocketRef.current?.send(JSON.stringify({ type: 'end' }));
    }
  };

  return (
    <div className="flex flex-col items-center gap-4 p-4">
      <div className="flex gap-4">
        {!isRecording ? (
          <button
            onClick={startRecording}
            className="p-4 bg-blue-500 text-white rounded-full hover:bg-blue-600 transition-colors"
            disabled={isProcessing}
          >
            <Mic className="w-6 h-6" />
          </button>
        ) : (
          <button
            onClick={stopRecording}
            className="p-4 bg-red-500 text-white rounded-full hover:bg-red-600 transition-colors"
          >
            <Square className="w-6 h-6" />
          </button>
        )}
      </div>

      {isProcessing && (
        <div className="flex items-center gap-2 text-gray-600">
          <Loader2 className="w-4 h-4 animate-spin" />
          <span>Processing audio...</span>
        </div>
      )}

      {isPlaying && (
        <div className="flex items-center gap-2 text-green-600">
          <Volume2 className="w-4 h-4 animate-pulse" />
          <span>Playing converted audio...</span>
        </div>
      )}

      {currentTranscription && (
        <div className="mt-4 p-4 bg-gray-50 rounded-lg w-full">
          <p className="text-gray-700">{currentTranscription}</p>
        </div>
      )}
    </div>
  );
};

const App: React.FC = () => {
  const [transcription, setTranscription] = useState<string>('');

  return (
    <div className="min-h-screen bg-gray-100 p-8">
      <div className="max-w-2xl mx-auto bg-white rounded-lg shadow-lg p-6">
        <h1 className="text-2xl font-bold mb-6 text-center">Real-time Audio Transcription</h1>
        <AudioRecorder onTranscriptionReceived={setTranscription} />
      </div>
    </div>
  );
};

export default App;
