import { useCallback, useRef, useState } from 'react';
import { cancelActiveRequest, generateGeminiResponse } from '../services/gemini';

type Language = 'en-US' | 'hi-IN';

interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
  language: Language;
}

const SYSTEM_PROMPT = `
You are a helpful and friendly AI assistant that can communicate in both English and Hindi.

Important guidelines:
- Always respond in the same language as the user's input (English or Hindi)
- For Hindi, use proper Devanagari script (not transliteration)
- Keep context from previous messages
- Be direct and natural in responses
- Use emojis occasionally where appropriate
- Never repeat generic greetings

For Hindi responses:
- Use pure Hindi words when possible
- Write in proper Devanagari script
- Keep the language natural and conversational
- Avoid mixing English words unless necessary
- Format Hindi text properly with spaces and punctuation

Example Hindi response:
नमस्ते! मैं आपकी कैसे मदद कर सकता हूं? 😊`;

const isHindiText = (text: string): boolean => {
  // Unicode range for Devanagari script (0900-097F)
  return /[\u0900-\u097F]/.test(text);
};

interface UseConversationResult {
  isLoading: boolean;
  error: string | null;
  processUserInput: (
    input: string,
    inputLanguage: Language,
    onStream: (text: string, language: Language) => void
  ) => Promise<void>;
  cancelResponse: () => void;
  clearHistory: () => void;
}

export function useConversation(): UseConversationResult {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const processingRef = useRef(false);
  const chatHistoryRef = useRef<ChatMessage[]>([]);

  const clearHistory = useCallback(() => {
    chatHistoryRef.current = [];
  }, []);

  const cancelResponse = useCallback(() => {
    cancelActiveRequest();
    setIsLoading(false);
    processingRef.current = false;
  }, []);

  const processUserInput = useCallback(async (
    input: string,
    inputLanguage: Language,
    onStream: (text: string, language: Language) => void
  ): Promise<void> => {
    if (processingRef.current) {
      return;
    }

    try {
      setIsLoading(true);
      setError(null);
      processingRef.current = true;

      // Add user message to history
      chatHistoryRef.current.push({
        role: 'user',
        content: input,
        language: inputLanguage
      });

      const prompt = `${SYSTEM_PROMPT}

Previous conversation (maximum 2 turns):
${chatHistoryRef.current
  .slice(-4)
  .map(msg => `${msg.role === 'user' ? 'Human' : 'Assistant'} [${msg.language}]: ${msg.content}`)
  .join('\n\n')}

Important: Respond naturally in ${inputLanguage === 'hi-IN' ? 'शुद्ध हिंदी (Pure Hindi)' : 'fluent English'}.
Human: ${input}
Assistant:`;

      let currentResponse = '';

      await generateGeminiResponse(
        prompt,
        (chunk: string) => {
          const chunkLanguage = isHindiText(chunk) ? 'hi-IN' : 'en-US';
          currentResponse += chunk;
          onStream(chunk, chunkLanguage);
        },
        () => {
          // On complete, add assistant message to history
          if (currentResponse) {
            chatHistoryRef.current.push({
              role: 'assistant',
              content: currentResponse,
              language: isHindiText(currentResponse) ? 'hi-IN' : 'en-US'
            });
          }
          setIsLoading(false);
          processingRef.current = false;
        },
        (errorMessage: string) => {
          setError(errorMessage);
          setIsLoading(false);
          processingRef.current = false;
          const errorInLanguage = inputLanguage === 'hi-IN'
            ? "क्षमा करें, कोई त्रुटि हुई। कृपया पुनः प्रयास करें 🙏"
            : "Sorry, an error occurred. Please try again 😅";
          onStream(errorInLanguage, inputLanguage);
        }
      );
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'An error occurred';
      console.error('Conversation Error:', errorMessage);
      setError(errorMessage);
      const errorInLanguage = inputLanguage === 'hi-IN'
        ? "क्षमा करें, कुछ गड़बड़ हो गई। कृपया फिर से कोशिश करें 🙏"
        : "Oops! Something went wrong. Let's try again! 🙈";
      onStream(errorInLanguage, inputLanguage);
      setIsLoading(false);
      processingRef.current = false;
    }
  }, []);

  return {
    isLoading,
    error,
    processUserInput,
    cancelResponse,
    clearHistory
  };
}
