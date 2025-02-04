import { useCallback, useEffect, useRef, useState } from "react";
import { AudioVisualizer } from "./components/AudioVisualizer";
import { useConversation } from "./hooks/useConversation";
import { useMicrophone } from "./hooks/useMicrophone";
import { useSpeechRecognition } from "./hooks/useSpeechRecognition";
import { useSpeechSynthesis } from "./hooks/useSpeechSynthesis";
import { getLocalizedPlaceholder } from "./utils/languageDetection";

function App(): JSX.Element {
  const [isRunning, setRunning] = useState(false);
  const [response, setResponse] = useState("");

  const { stream: mic, error: micError, isAvailable: isMicAvailable } = useMicrophone();
  const { speak, stop: stopSpeaking } = useSpeechSynthesis();
  const { isLoading, processUserInput, error: aiError, cancelResponse } = useConversation();
  const processingRef = useRef(false);
  const responseBufferRef = useRef("");

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      stopSpeaking();
      cancelResponse();
    };
  }, [stopSpeaking, cancelResponse]);

  const handleStreamingResponse = useCallback((text: string) => {
    // Append to response immediately for visual feedback
    setResponse(prev => {
      const needsSpace = prev.length > 0 && !prev.endsWith(' ') && !text.startsWith(' ');
      const updatedResponse = prev + (needsSpace ? ' ' : '') + text;
      responseBufferRef.current = updatedResponse;
      return updatedResponse;
    });

    // Speak the streamed text
    speak(text);
  }, [speak]);

  const handleTranscriptComplete = useCallback(async (text: string) => {
    if (processingRef.current || !text.trim()) {
      return;
    }

    try {
      processingRef.current = true;

      // Stop any ongoing speech and response
      stopSpeaking();
      cancelResponse();

      // Clear previous response
      setResponse("");
      responseBufferRef.current = "";

      // Process through Gemini with streaming
      await processUserInput(text, handleStreamingResponse);
    } finally {
      processingRef.current = false;
    }
  }, [processUserInput, handleStreamingResponse, stopSpeaking, cancelResponse]);

  const {
    transcript,
    interimTranscript,
    startListening,
    stopListening,
    resetTranscript,
    connectionStatus,
    error: recognitionError
  } = useSpeechRecognition(handleTranscriptComplete);

  const toggleListening = useCallback(() => {
    if (isRunning) {
      setRunning(false);
      stopListening();
      stopSpeaking();
      cancelResponse();
    } else {
      if (!isMicAvailable) {
        alert("Please allow microphone access to use this feature.");
        return;
      }
      setRunning(true);
      setResponse("");
      responseBufferRef.current = "";
      resetTranscript();
      startListening();
    }
  }, [
    isRunning,
    isMicAvailable,
    startListening,
    stopListening,
    stopSpeaking,
    cancelResponse,
    resetTranscript
  ]);

  // Show error messages if any
  const errorMessage = micError || aiError || recognitionError;

  // Get connection status color
  const getStatusColor = () => {
    switch (connectionStatus) {
      case 'connected':
        return 'bg-green-500';
      case 'error':
        return 'bg-red-500';
      default:
        return 'bg-gray-500';
    }
  };

  return (
    <div className="flex items-center justify-center min-h-screen">
      <div className="w-screen h-screen bg-indigo-950 relative flex items-center justify-center overflow-hidden">
        {/* Status indicator */}
        <div className="absolute top-4 right-4 flex items-center space-x-2 z-10">
          <div className={`w-3 h-3 rounded-full ${getStatusColor()} animate-pulse`} />
          <span className="text-white/70 text-sm">
            {connectionStatus === 'connected' ? 'Listening' :
              connectionStatus === 'error' ? 'Error' : 'Ready'}
          </span>
        </div>

        {/* Main visualization container */}
        <div
          className="relative w-[600px] h-[600px] cursor-pointer transition-transform duration-200
                     hover:scale-105 active:scale-95"
          onClick={toggleListening}
        >
          <AudioVisualizer isRunning={isRunning} mic={mic} />

          {/* Centered visualization with glowing effect */}
          <div className="absolute left-1/2 -translate-x-1/2 -top-16 z-10">
            <div className="relative group">
              <div className={`absolute inset-0 rounded-full blur-xl transition-all duration-300
                           ${isRunning ? 'bg-green-500/30 group-hover:bg-green-500/40' :
                  'bg-white/10 group-hover:bg-white/20'}`}
              />
              <div className="absolute -bottom-8 left-1/2 -translate-x-1/2 w-max">
                <p className={`text-white text-sm px-4 py-1 rounded-full backdrop-blur-sm
                           ${isRunning ? 'bg-green-600/50' : 'bg-indigo-600/50'}`}>
                  {isRunning ? "Tap to stop" : "Tap to start"}
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Transcription panel */}
        <div className="absolute bottom-8 left-1/2 -translate-x-1/2 w-2/3 max-w-3xl">
          <div className="bg-indigo-900/50 p-6 rounded-lg backdrop-blur-sm shadow-lg
                       transition-all duration-300 hover:bg-indigo-800/50">
            <div className="text-white/50 text-sm mb-2 flex items-center justify-between">
              <span>Voice Input</span>
              {isRunning && <span className="text-green-400">● Recording</span>}
            </div>
            <p className="text-white text-lg leading-relaxed max-h-48 overflow-y-auto">
              {transcript}
              {interimTranscript && (
                <span className="text-white/70 italic">
                  {' '}{interimTranscript}
                </span>
              )}
            </p>
          </div>
        </div>

        {/* AI Response panel */}
        <div className="absolute top-8 right-8 w-1/3 max-w-md">
          <div className={`bg-indigo-900/50 p-6 rounded-lg backdrop-blur-sm shadow-lg
                        transition-all duration-300 hover:bg-indigo-800/50
                        ${isLoading ? 'border-l-4 border-blue-500' : ''}`}>
            {errorMessage && (
              <div className="mb-4 p-3 bg-red-500/20 rounded-lg text-white text-sm
                           border border-red-500/30 flex items-start space-x-2">
                <svg className="w-5 h-5 text-red-500 mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
                <span>{errorMessage}</span>
              </div>
            )}
            <div className="relative">
              {isLoading ? (
                <div className="flex items-center justify-center space-x-3 py-4">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-white"></div>
                  <p className="text-white">Processing...</p>
                </div>
              ) : (
                <p className="text-white text-lg leading-relaxed max-h-[60vh] overflow-y-auto">
                  {response || getLocalizedPlaceholder()}
                </p>
              )}
              {response && !isLoading && (
                <div className="absolute -top-2 -right-2 text-green-400 animate-pulse">●</div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default App;
