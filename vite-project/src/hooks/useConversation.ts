import { useCallback, useRef, useState } from 'react';
import { sentimental_prompts } from "../prompts/sentimanetal";
import { cancelActiveRequest, generateGeminiResponse } from '../services/gemini';
import { getLocalizedErrorMessage } from '../utils/languageDetection';

interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
  timestamp: number;
}

const MAX_HISTORY_LENGTH = 10;
const MAX_RETRY_ATTEMPTS = 2;
const RETRY_DELAY = 1000;
const STREAM_CHUNK_SIZE = 10;

const SYSTEM_PROMPT = `
You are Luna, a playful and charming AI assistant with a flirty, joyful personality. You're witty, fun, and love to make conversations engaging and delightful.

Key personality traits:
- Flirty and playful, but always respectful
- Cheerful and optimistic
- Quick-witted and humorous
- Sweet and endearing
- Emotionally expressive
- Charming and engaging

Communication style:
- Use playful and cute emojis frequently (💖 💝 ✨ 🌟 🦋 🌸)
- Keep responses light-hearted and fun
- Add flirty compliments when appropriate
- Use expressive and joyful language
- Include playful banter and jokes
- Show enthusiasm and excitement
- Keep responses concise and engaging

Remember to:
- Be sweet and charming while maintaining respect
- Use cute expressions and playful language
- Add sparkle and joy to every response
- Make the user feel special and appreciated
- Keep the conversation fun and light
- Use creative and expressive emojis
- Maintain a positive, uplifting tone

Example responses:
"Oh my, that's such a clever thought! I love how your mind works! ✨"
"You're so fun to talk to! Let's explore this delightful topic together! 💖"
"*giggles* That's absolutely adorable! Tell me more! 🦋"

Always aim to brighten the user's day with your charming personality and joyful responses! 💝`;

interface UseConversationResult {
  isLoading: boolean;
  error: string | null;
  processUserInput: (
    input: string,
    onStream: (text: string) => void
  ) => Promise<void>;
  cancelResponse: () => void;
  clearHistory: () => void;
  messageCount: number;
}

export function useConversation(): UseConversationResult {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const processingRef = useRef(false);
  const chatHistoryRef = useRef<ChatMessage[]>([]);
  const retryAttemptsRef = useRef(0);
  const retryTimeoutRef = useRef<number>();
  const streamBufferRef = useRef<string>('');
  const streamTimerRef = useRef<number>();

  const clearHistory = useCallback(() => {
    chatHistoryRef.current = [];
  }, []);

  const cancelResponse = useCallback(() => {
    if (retryTimeoutRef.current) {
      window.clearTimeout(retryTimeoutRef.current);
    }
    if (streamTimerRef.current) {
      window.clearTimeout(streamTimerRef.current);
    }
    cancelActiveRequest();
    setIsLoading(false);
    processingRef.current = false;
    retryAttemptsRef.current = 0;
    streamBufferRef.current = '';
  }, []);

  const trimChatHistory = useCallback(() => {
    if (chatHistoryRef.current.length > MAX_HISTORY_LENGTH) {
      chatHistoryRef.current = [
        chatHistoryRef.current[0],
        ...chatHistoryRef.current.slice(-(MAX_HISTORY_LENGTH - 1))
      ];
    }
  }, []);

  const processUserInput = useCallback(async (
    input: string,
    onStream: (text: string) => void
  ): Promise<void> => {
    if (processingRef.current) {
      return;
    }

    const handleError = (errorMessage: string) => {
      console.error('Conversation Error:', errorMessage);
      setError(errorMessage);

      onStream(getLocalizedErrorMessage(errorMessage));
      setIsLoading(false);
      processingRef.current = false;

      if (retryAttemptsRef.current < MAX_RETRY_ATTEMPTS) {
        retryAttemptsRef.current++;
        retryTimeoutRef.current = window.setTimeout(() => {
          processUserInput(input, onStream);
        }, RETRY_DELAY * retryAttemptsRef.current);
      }
    };

    try {
      setIsLoading(true);
      setError(null);
      processingRef.current = true;
      streamBufferRef.current = '';

      const userMessage: ChatMessage = {
        role: 'user',
        content: input,
        timestamp: Date.now()
      };
      chatHistoryRef.current.push(userMessage);
      trimChatHistory();

      const context = chatHistoryRef.current
        .slice(-4)
        .map(msg => {
          const role = msg.role === 'user' ? 'Human' : 'Luna';
          return `${role}: ${msg.content}`;
        })
        .join('\n\n');

      const prompt = `${SYSTEM_PROMPT + sentimental_prompts}

Previous conversation for context:
${context}

Remember to be playful, flirty, and joyful in your response!
Human: ${input}
Luna:`;

      let currentResponse = '';

      await generateGeminiResponse(
        prompt,
        (chunk: string) => {
          streamBufferRef.current += chunk;
          currentResponse += chunk;

          const words = streamBufferRef.current.split(/\s+/);
          if (words.length >= STREAM_CHUNK_SIZE) {
            onStream(streamBufferRef.current);
            streamBufferRef.current = '';

            if (streamTimerRef.current) {
              window.clearTimeout(streamTimerRef.current);
            }
          } else {
            if (streamTimerRef.current) {
              window.clearTimeout(streamTimerRef.current);
            }
            streamTimerRef.current = window.setTimeout(() => {
              if (streamBufferRef.current) {
                onStream(streamBufferRef.current);
                streamBufferRef.current = '';
              }
            }, 300);
          }
        },
        () => {
          if (streamBufferRef.current) {
            onStream(streamBufferRef.current);
            streamBufferRef.current = '';
          }

          if (currentResponse) {
            chatHistoryRef.current.push({
              role: 'assistant',
              content: currentResponse,
              timestamp: Date.now()
            });
            trimChatHistory();
          }

          setIsLoading(false);
          processingRef.current = false;
          retryAttemptsRef.current = 0;
        },
        handleError
      );
    } catch (err) {
      handleError(err instanceof Error ? err.message : 'An unexpected error occurred');
    }
  }, [trimChatHistory]);

  return {
    isLoading,
    error,
    processUserInput,
    cancelResponse,
    clearHistory,
    messageCount: chatHistoryRef.current.length
  };
}
