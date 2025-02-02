const GEMINI_API_KEY = import.meta.env.VITE_GEMINI_API_KEY;
const API_URL = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-pro:generateContent';

interface GeminiResponse {
  candidates: Array<{
    content: {
      parts: Array<{
        text: string;
      }>;
    };
  }>;
}

type StreamCallback = (chunk: string) => void;

let activeRequest: AbortController | null = null;

export async function generateGeminiResponse(
  prompt: string,
  onChunk: StreamCallback,
  onComplete: () => void,
  onError: (error: string) => void
): Promise<void> {
  try {
    if (!GEMINI_API_KEY) {
      throw new Error('Gemini API key not found');
    }

    // Cancel any active request
    if (activeRequest) {
      activeRequest.abort();
    }

    // Create new abort controller for this request
    activeRequest = new AbortController();

    const response = await fetch(`${API_URL}?key=${GEMINI_API_KEY}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        contents: [{
          parts: [{
            text: prompt
          }]
        }],
        generationConfig: {
          temperature: 0.7,
          maxOutputTokens: 800,
          stopSequences: ["Human:", "User:"],
          topP: 0.8,
          topK: 40
        },
        safetySettings: [
        ]
      }),
      signal: activeRequest.signal
    });

    if (!response.ok) {
      throw new Error(`Failed to get response from Gemini API: ${response.status}`);
    }

    const data: GeminiResponse = await response.json();
    const text = data.candidates[0]?.content?.parts[0]?.text || '';

    if (!text) {
      throw new Error('No response received from Gemini API');
    }

    // Process response in sentence-sized chunks
    const sentences = text
      .replace(/([.!?])\s+/g, '$1|') // Split on sentence endings
      .split('|')
      .filter(chunk => chunk.trim())
      .map(chunk => chunk.trim());

    // Send each sentence as a chunk with a small delay
    for (let i = 0; i < sentences.length && !activeRequest?.signal.aborted; i++) {
      onChunk(sentences[i]);
      if (i < sentences.length - 1) {
        await new Promise(resolve => setTimeout(resolve, 200));
      }
    }

    onComplete();
  } catch (error) {
    if (error instanceof Error && error.name === 'AbortError') {
      // Request was intentionally aborted, don't show error
      return;
    }
    const errorMessage = error instanceof Error ? error.message : 'Failed to generate response';
    console.error('Gemini API Error:', errorMessage);
    onError(errorMessage);
  } finally {
    if (activeRequest?.signal.aborted) {
      console.log('Request aborted');
    }
    activeRequest = null;
  }
}

export function cancelActiveRequest(): void {
  if (activeRequest) {
    activeRequest.abort();
    activeRequest = null;
  }
}
