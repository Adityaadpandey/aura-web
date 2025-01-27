import { Loader2, Mic, Square } from 'lucide-react';
import React, { useRef, useState } from 'react';

interface AudioRecorderProps {
  onTranscriptionReceived: (text: string) => void;
}

const AudioRecorder: React.FC<AudioRecorderProps> = ({ onTranscriptionReceived }) => {
  const [isRecording, setIsRecording] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;
      chunksRef.current = [];

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          chunksRef.current.push(event.data);
        }
      };

      mediaRecorder.start();
      setIsRecording(true);
    } catch (error) {
      console.error('Error accessing microphone:', error);
      alert('Error accessing microphone. Please ensure microphone permissions are granted.');
    }
  };

  const stopRecording = async () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
      setIsProcessing(true);

      // Wait for the last chunk to be processed
      await new Promise<void>((resolve) => {
        if (mediaRecorderRef.current) {
          mediaRecorderRef.current.onstop = () => {
            resolve();
          };
        }
      });

      const audioBlob = new Blob(chunksRef.current, { type: 'audio/webm' });
      const formData = new FormData();
      formData.append('audio', audioBlob);

      try {
        const response = await fetch('http://localhost:5000/transcribe', {
          method: 'POST',
          body: formData,
        });

        if (!response.ok) {
          throw new Error('Transcription failed');
        }

        const data = await response.json();
        onTranscriptionReceived(data.text);
      } catch (error) {
        console.error('Error sending audio to server:', error);
        alert('Error processing audio. Please try again.');
      } finally {
        setIsProcessing(false);
      }

      // Stop all tracks on the stream
      mediaRecorderRef.current.stream.getTracks().forEach(track => track.stop());
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
    </div>
  );
};

// Main App component
const App: React.FC = () => {
  const [transcription, setTranscription] = useState<string>('');

  return (
    <div className="min-h-screen bg-gray-100 p-8">
      <div className="max-w-2xl mx-auto bg-white rounded-lg shadow-lg p-6">
        <h1 className="text-2xl font-bold mb-6 text-center">Audio Transcription</h1>
        <AudioRecorder onTranscriptionReceived={setTranscription} />
        {transcription && (
          <div className="mt-6">
            <h2 className="text-lg font-semibold mb-2">Transcription:</h2>
            <p className="p-4 bg-gray-50 rounded-lg">{transcription}</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default App;
