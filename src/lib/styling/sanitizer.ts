/**
 * Text sanitization for TTS to prevent unwanted spoken artifacts
 * Removes metadata, processing artifacts, and other content that shouldn't be spoken
 */

import { VoiceConfig } from './config';

/**
 * Sanitizes text to prevent TTS from speaking unwanted metadata or artifacts
 * @param {string} text - Input text to sanitize
 * @param {VoiceConfig} config - Voice configuration
 * @returns {string} Sanitized text safe for TTS
 */
export function sanitizeForTTS(text: string, config: VoiceConfig): string {
  if (!text?.trim()) return text;

  let sanitized = text;

  // Remove common metadata artifacts that can be spoken by TTS
  sanitized = removeMetadataArtifacts(sanitized);
  
  // Remove processing artifacts
  sanitized = removeProcessingArtifacts(sanitized);
  
  // Clean up spacing and formatting
  sanitized = cleanupFormatting(sanitized);
  
  // Validate no unwanted content remains
  sanitized = validateCleanText(sanitized);

  return sanitized;
}

/**
 * Removes common metadata artifacts that TTS might speak
 */
function removeMetadataArtifacts(text: string): string {
  let cleaned = text;

  // Remove standalone metadata words that commonly get spoken
  const metadataPatterns = [
    /\bend\b(?=\s*$)/gi,           // "end" at end of text
    /\bstart\b(?=\s*^)/gi,        // "start" at beginning of text
    /\bbegin\b(?=\s*^)/gi,        // "begin" at beginning of text
    /\bfinish\b(?=\s*$)/gi,       // "finish" at end of text
    /\bcomplete\b(?=\s*$)/gi,     // "complete" at end of text
    /\bdone\b(?=\s*$)/gi,         // "done" at end of text
    /\bstop\b(?=\s*$)/gi,         // "stop" at end of text
  ];

  for (const pattern of metadataPatterns) {
    cleaned = cleaned.replace(pattern, '');
  }

  // Remove HTML-like tags that might leak through
  cleaned = cleaned.replace(/<(?!break|pause)[^>]*>/g, '');
  
  // Remove JSON-like artifacts
  cleaned = cleaned.replace(/\{[^}]*\}/g, '');
  
  // Remove square brackets EXCEPT for ElevenLabs v3 audio tags
  // Preserve all v3-compatible audio tags using a more flexible pattern
  const audioTagPattern = /\[(laughs?|giggles?|chuckles?|whispers?|sighs?|exhales?|takes?\s+a\s+breath|curious|intrigued|excited|amazed|thoughtful|mysterious|knowing|emphasizes?|with\s+conviction|soft\s+wind|gentle\s+chimes|rustling\s+cards|flowing\s+water|distant\s+thunder|night\s+sounds|bell\s+rings?\s+softly|candle\s+flickers?|crystal\s+resonance)\]/gi;
  const audioTags: string[] = [];
  
  // Extract and temporarily store audio tags
  cleaned = cleaned.replace(audioTagPattern, (match) => {
    const placeholder = `__AUDIO_TAG_${audioTags.length}__`;
    audioTags.push(match);
    return placeholder;
  });
  
  // Remove other square bracket content (JSON artifacts, etc.)
  cleaned = cleaned.replace(/\[[^\]]*\]/g, '');
  
  // Restore audio tags
  audioTags.forEach((tag, index) => {
    cleaned = cleaned.replace(`__AUDIO_TAG_${index}__`, tag);
  });

  return cleaned;
}

/**
 * Removes processing artifacts from text transformations
 */
function removeProcessingArtifacts(text: string): string {
  let cleaned = text;

  // Remove duplicate pause tags
  cleaned = cleaned.replace(/(<pause:[^>]*>\s*){2,}/g, '$1');
  cleaned = cleaned.replace(/(<break[^>]*\/>\s*){2,}/g, '$1');

  // Remove orphaned punctuation
  cleaned = cleaned.replace(/\s+([.!?,:;])/g, '$1');
  
  // Remove excessive whitespace
  cleaned = cleaned.replace(/\s{3,}/g, '  ');
  
  // Remove empty lines with only whitespace
  cleaned = cleaned.replace(/^\s*$/gm, '');
  
  // Remove trailing whitespace before breaks
  cleaned = cleaned.replace(/\s+(<(?:pause|break)[^>]*>)/g, ' $1');

  return cleaned;
}

/**
 * Cleans up formatting for optimal TTS processing
 */
function cleanupFormatting(text: string): string {
  let cleaned = text;

  // Ensure proper spacing around punctuation
  cleaned = cleaned.replace(/([.!?])\s*([A-Z])/g, '$1 $2');
  
  // Clean up line breaks
  cleaned = cleaned.replace(/\n{3,}/g, '\n\n');
  
  // Remove leading/trailing whitespace
  cleaned = cleaned.trim();
  
  // Ensure sentences end properly
  cleaned = cleaned.replace(/([^.!?])\s*$/g, '$1.');

  return cleaned;
}

/**
 * Validates that no unwanted content remains in the text
 */
function validateCleanText(text: string): string {
  let validated = text;

  // List of words that should never appear alone at the end of TTS text
  const forbiddenEndings = [
    'end', 'stop', 'finish', 'complete', 'done', 'over', 'out',
    'null', 'undefined', 'error', 'debug', 'test', 'sample'
  ];

  // Remove forbidden endings
  for (const word of forbiddenEndings) {
    const pattern = new RegExp(`\\s+\\b${word}\\b\\s*$`, 'gi');
    validated = validated.replace(pattern, '');
  }

  // Ensure text doesn't end with processing artifacts
  validated = validated.replace(/\s*<[^>]*>\s*$/, '');
  
  return validated;
}

/**
 * Analyzes text for potential TTS artifacts
 * @param {string} text - Text to analyze
 * @returns {object} Analysis results
 */
export function analyzeTTSArtifacts(text: string): {
  metadataWords: string[];
  suspiciousEndings: string[];
  orphanedTags: string[];
  recommendations: string[];
} {
  const metadataWords: string[] = [];
  const suspiciousEndings: string[] = [];
  const orphanedTags: string[] = [];
  const recommendations: string[] = [];

  // Check for metadata words
  const metadataPatterns = ['end', 'start', 'begin', 'finish', 'complete', 'done', 'stop'];
  for (const word of metadataPatterns) {
    if (new RegExp(`\\b${word}\\b`, 'gi').test(text)) {
      metadataWords.push(word);
    }
  }

  // Check for suspicious endings
  const endingMatch = text.match(/\b(\w+)\s*$/);
  if (endingMatch) {
    const lastWord = endingMatch[1].toLowerCase();
    if (metadataPatterns.includes(lastWord)) {
      suspiciousEndings.push(lastWord);
    }
  }

  // Check for orphaned tags
  const tagMatches = text.match(/<(?!break|pause)[^>]*>/g);
  if (tagMatches) {
    orphanedTags.push(...tagMatches);
  }

  // Generate recommendations
  if (metadataWords.length > 0) {
    recommendations.push(`Consider removing metadata words: ${metadataWords.join(', ')}`);
  }
  if (suspiciousEndings.length > 0) {
    recommendations.push(`Text ends with suspicious word: ${suspiciousEndings.join(', ')}`);
  }
  if (orphanedTags.length > 0) {
    recommendations.push(`Remove orphaned HTML tags: ${orphanedTags.join(', ')}`);
  }

  return {
    metadataWords,
    suspiciousEndings,
    orphanedTags,
    recommendations,
  };
}
