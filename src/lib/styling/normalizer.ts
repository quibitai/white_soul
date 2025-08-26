/**
 * Text normalizer for Angela voice styling
 * Handles smart quotes, dashes, whitespace, and emoji spacing normalization
 * to ensure consistent text processing for TTS synthesis.
 */

import { VoiceConfig } from './config';

/**
 * Normalizes text for TTS processing by standardizing quotes, dashes, and spacing
 * @param {string} text - Raw input text to normalize
 * @param {VoiceConfig} config - Voice configuration settings
 * @returns {string} Normalized text ready for further processing
 */
export function normalize(text: string, config: VoiceConfig): string {
  if (!text?.trim()) {
    return '';
  }

  let normalized = text;

  // Convert smart quotes to straight quotes
  normalized = normalized
    .replace(/[\u201C\u201D]/g, '"') // Left and right double quotation marks
    .replace(/[\u2018\u2019]/g, "'") // Left and right single quotation marks
    .replace(/[\u2032\u2033]/g, "'"); // Prime symbols

  // Normalize em and en dashes
  normalized = normalized
    .replace(/[\u2014]/g, ' -- ') // Em dash to spaced double hyphen
    .replace(/[\u2013]/g, '-')    // En dash to regular hyphen
    .replace(/[\u2012]/g, '-');   // Figure dash to regular hyphen

  // Handle ellipsis normalization
  normalized = normalized
    .replace(/[\u2026]/g, '...') // Unicode ellipsis to three dots
    .replace(/\.{4,}/g, '...'); // Multiple dots to exactly three

  // Normalize whitespace
  normalized = normalized
    .replace(/\r\n/g, '\n')      // Windows line endings to Unix
    .replace(/\r/g, '\n')        // Mac line endings to Unix
    .replace(/\t/g, ' ')         // Tabs to spaces
    .replace(/\u00A0/g, ' ')     // Non-breaking spaces to regular spaces
    .replace(/[ ]{2,}/g, ' ')    // Multiple spaces to single space
    .replace(/\n{3,}/g, '\n\n'); // Multiple newlines to double newline max

  // Handle emoji spacing (add space before/after if missing)
  normalized = normalized.replace(
    /([\u{1F600}-\u{1F64F}]|[\u{1F300}-\u{1F5FF}]|[\u{1F680}-\u{1F6FF}]|[\u{1F1E0}-\u{1F1FF}]|[\u{2600}-\u{26FF}]|[\u{2700}-\u{27BF}])/gu,
    (match, emoji, offset) => {
      const before = normalized[offset - 1];
      const after = normalized[offset + match.length];
      
      let result = emoji;
      if (before && before !== ' ' && before !== '\n') {
        result = ' ' + result;
      }
      if (after && after !== ' ' && after !== '\n' && after !== '.' && after !== ',' && after !== '!' && after !== '?') {
        result = result + ' ';
      }
      
      return result;
    }
  );

  // Trim leading/trailing whitespace from lines while preserving paragraph breaks
  normalized = normalized
    .split('\n')
    .map(line => line.trim())
    .join('\n');

  // Final cleanup - remove leading/trailing whitespace
  return normalized.trim();
}

/**
 * Validates that normalized text meets basic requirements
 * @param {string} text - Normalized text to validate
 * @returns {boolean} True if text is valid for processing
 */
export function isValidNormalizedText(text: string): boolean {
  if (!text?.trim()) {
    return false;
  }

  // Check for remaining problematic characters
  const problematicChars = /[\u201C\u201D\u2018\u2019\u2014\u2013\u2026]/;
  if (problematicChars.test(text)) {
    return false;
  }

  // Check for excessive whitespace
  if (/\s{3,}/.test(text) || /\n{4,}/.test(text)) {
    return false;
  }

  return true;
}
