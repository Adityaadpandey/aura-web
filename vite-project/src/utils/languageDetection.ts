/**
 * Language utilities
 */

export type Language = 'en-US';

/**
 * Gets a language-appropriate error message
 */
export const getLocalizedErrorMessage = (error: string): string => {
  return `Oops! ${error} 💝`;
};

/**
 * Gets a language-appropriate loading message
 */
export const getLocalizedLoadingMessage = (): string => {
  return 'Thinking about it... 💭';
};

/**
 * Gets a language-appropriate placeholder message
 */
export const getLocalizedPlaceholder = (): string => {
  return 'I\'m here to chat! Say something! 💝';
};
