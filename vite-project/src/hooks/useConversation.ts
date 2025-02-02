import { useCallback, useRef, useState } from 'react';
import { cancelActiveRequest, generateGeminiResponse } from '../services/gemini';

// Personality prompt to make responses more engaging and cute
const PERSONALITY_PROMPT = `
You are a cute and friendly AI assistant. Your responses should be:
- Cheerful and positive
- Clear and helpful
- Brief and concise (2-3 sentences max)
- Casual and conversational
- Use simple, everyday language
- Add appropriate emojis occasionally

Important:
- Only respond to the most recent user input
- Keep responses focused and relevant
- Avoid repeating yourself

Please respond in this style to make our conversation more engaging!
`;

import { sentimental_prompts } from "../prompts/sentimanetal";

interface UseConversationResult {
  isLoading: boolean;
  error: string | null;
  processUserInput: (input: string, onStream: (text: string) => void) => Promise<void>;
  cancelResponse: () => void;
}

export function useConversation(): UseConversationResult {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const processingRef = useRef(false);

  const cancelResponse = useCallback(() => {
    cancelActiveRequest();
    setIsLoading(false);
    processingRef.current = false;
  }, []);

  const processUserInput = useCallback(async (
    input: string,
    onStream: (text: string) => void
  ): Promise<void> => {
    // Prevent multiple simultaneous requests
    if (processingRef.current) {
      return;
    }

    try {
      setIsLoading(true);
      setError(null);
      processingRef.current = true;

      const fullPrompt = `${sentimental_prompts}

Previous messages are not relevant. Respond only to this message:
User: ${input}

Response:`;

      await generateGeminiResponse(
        fullPrompt,
        (chunk: string) => {
          // Stream each chunk
          onStream(chunk + ' ');
        },
        () => {
          // On complete
          setIsLoading(false);
          processingRef.current = false;
        },
        (errorMessage: string) => {
          // On error
          setError(errorMessage);
          setIsLoading(false);
          processingRef.current = false;
          onStream("Sorry, I couldn't process that request. Could you try again? ");
        }
      );
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'An error occurred';
      console.error('Conversation Error:', errorMessage);
      setError(errorMessage);
      onStream("Oops! Something went wrong. Let's try again! 🙈");
      setIsLoading(false);
      processingRef.current = false;
    }
  }, []);

  return {
    isLoading,
    error,
    processUserInput,
    cancelResponse
  };
}
