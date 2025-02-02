import { useCallback, useEffect, useRef, useState } from "react";
import { AudioVisualizer } from "./components/AudioVisualizer";
import { useConversation } from "./hooks/useConversation";
import { useMicrophone } from "./hooks/useMicrophone";
import { useSpeechRecognition } from "./hooks/useSpeechRecognition";
import { useSpeechSynthesis } from "./hooks/useSpeechSynthesis";

type Language = 'en-US' | 'hi-IN';

function App(): JSX.Element {
  const [isRunning, setRunning] = useState(false);
  const [response, setResponse] = useState("");
  const [currentLanguage, setCurrentLanguage] = useState<Language>('en-US');

  const { stream: mic, error: micError, isAvailable: isMicAvailable } = useMicrophone();
  const { speak, stop: stopSpeaking } = useSpeechSynthesis();
  const { isLoading, processUserInput, error: aiError, cancelResponse } = useConversation();
  const processingRef = useRef(false);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      stopSpeaking();
      cancelResponse();
    };
  }, [stopSpeaking, cancelResponse]);

  const handleStreamingResponse = useCallback((text: string, language: Language) => {
    setResponse(prev => {
      const needsSpace = prev.length > 0 && !prev.endsWith(' ') && !text.startsWith(' ');
      return prev + (needsSpace ? ' ' : '') + text;
    });
    speak(text, language);
  }, [speak]);

  const handleTranscriptComplete = useCallback(async (text: string, detectedLang: Language) => {
    if (processingRef.current || !text.trim()) {
      return;
    }

    try {
      processingRef.current = true;

      // Stop any ongoing speech and response
      stopSpeaking();
      cancelResponse();

      // Update current language
      setCurrentLanguage(detectedLang);

      // Clear previous response
      setResponse("");

      // Process through Gemini with language
      await processUserInput(text, detectedLang, handleStreamingResponse);
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
    setLanguage,
    detectedLanguage
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
  const errorMessage = micError || aiError;

  return (
    <div className="flex items-center justify-center min-h-screen ">
      <div className="w-screen h-screen bg-indigo-950 relative flex items-center justify-center overflow-hidden">
        {/* Language selector */}
        <div className="absolute top-4 left-4 z-10">
          <select
            className="bg-indigo-900/50 text-white px-4 py-2 rounded-lg backdrop-blur-sm"
            value={currentLanguage}
            onChange={(e) => {
              const lang = e.target.value as Language;
              setCurrentLanguage(lang);
              setLanguage(lang);
            }}
          >
            <option value="en-US">English</option>
            <option value="hi-IN">हिंदी</option>
          </select>
        </div>

        {/* Main visualization container */}
        <div className="relative w-[600px] h-[600px]" onClick={toggleListening}>
          <AudioVisualizer isRunning={isRunning} mic={mic} />

          {/* Centered visualization with glowing effect */}
          <div className="absolute left-1/2 -translate-x-1/2 -top-16 z-10">
            <div className="relative group">
              <div className="absolute inset-0 bg-white/10 rounded-full blur-xl group-hover:bg-white/20 transition-all duration-300" />
              <div className="absolute -bottom-8 left-1/2 -translate-x-1/2 w-max">
                <p className="text-white text-sm px-4 py-1 rounded-full bg-indigo-600/50 backdrop-blur-sm">
                  {isRunning ? "Tap to stop" : "Tap to start"}
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Transcription panel */}
        <div className="absolute bottom-8 left-1/2 -translate-x-1/2 w-2/3 max-w-3xl">
          <div className="bg-indigo-900/50 p-6 rounded-lg backdrop-blur-sm shadow-lg">
            <div className="text-white/50 text-sm mb-2">
              {detectedLanguage === 'hi-IN' ? 'हिंदी' : 'English'} detected
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
          <div className="bg-indigo-900/50 p-6 rounded-lg backdrop-blur-sm shadow-lg">
            {errorMessage && (
              <div className="mb-4 p-2 bg-red-500/20 rounded text-white text-sm">
                {errorMessage}
              </div>
            )}
            {isLoading ? (
              <div className="flex items-center justify-center space-x-2">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-white"></div>
                <p className="text-white">Thinking...</p>
              </div>
            ) : (
              <p className="text-white text-lg leading-relaxed max-h-[60vh] overflow-y-auto">
                {response || (currentLanguage === 'hi-IN' ?
                  "आपका जवाब यहाँ दिखाया जाएगा!" :
                  "AI responses will appear here!"
                )}
              </p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export default App;
