type Language = 'en-US' | 'hi-IN';

/**
 * Checks if text contains Devanagari script (Hindi characters)
 * @param text Text to check
 * @returns boolean indicating if text contains Hindi characters
 */
export const isHindiText = (text: string): boolean => {
  // Devanagari Unicode range: \u0900-\u097F
  // Additional Devanagari Unicode blocks: \u0980-\u09FF, \uA8E0-\uA8FF
  const devanagariRange = /[\u0900-\u097F\u0980-\u09FF-\uA8E0-\uA8FF]/;
  return devanagariRange.test(text);
};

/**
 * Detects the primary language of the text
 * @param text Text to analyze
 * @returns Language code ('en-US' or 'hi-IN')
 */
export const detectLanguage = (text: string): Language => {
  // Count Hindi characters
  const hindiChars = text.split('').filter(char =>
    /[\u0900-\u097F]|[\u0980-\u09FF]|[\uA8E0-\uA8FF]/.test(char)
  ).length;

  // If text contains significant Hindi characters (more than 10%), treat as Hindi
  return hindiChars > text.length * 0.1 ? 'hi-IN' : 'en-US';
};

/**
 * Gets voice parameters for a specific language
 * @param language Language code
 * @returns Voice configuration for speech synthesis
 */
export const getVoiceParams = (language: Language) => {
  switch (language) {
    case 'hi-IN':
      return {
        pitch: 1.0,    // Normal pitch for Hindi
        rate: 0.9,     // Slightly slower for Hindi clarity
        volume: 1,
        preferredVoices: [
          'hi-IN-Wavenet-A',
          'hi-IN-Standard-A',
          'Microsoft Kalpana',
          (voice: SpeechSynthesisVoice) => voice.lang.startsWith('hi'),
        ]
      };
    case 'en-US':
      return {
        pitch: 1.1,    // Slightly higher for English
        rate: 1.1,     // Slightly faster for English
        volume: 1,
        preferredVoices: [
          'Microsoft Zira Desktop',
          (voice: SpeechSynthesisVoice) => voice.name.toLowerCase().includes('female') && voice.lang.startsWith('en'),
          (voice: SpeechSynthesisVoice) => voice.lang.startsWith('en'),
        ]
      };
  }
};

/**
 * Splits text into natural sentences based on language
 * @param text Text to split
 * @param language Language code
 * @returns Array of sentences
 */
export const splitIntoSentences = (text: string, language: Language): string[] => {
  if (language === 'hi-IN') {
    // Hindi sentence terminators: ।, ?, !
    return text
      .split(/([।!?])\s+/)
      .map(s => s.trim())
      .filter(s => s.length > 0);
  }

  // English sentence terminators: . ? !
  return text
    .split(/([.!?])\s+/)
    .map(s => s.trim())
    .filter(s => s.length > 0);
};
