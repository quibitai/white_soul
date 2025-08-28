/**
 * Text sanitization for TTS to prevent unwanted spoken artifacts
 * Removes metadata, processing artifacts, and other content that shouldn't be spoken
 */

import { VoiceConfig } from './config';

/**
 * Generates a dynamic audio tag pattern from Angela's voice configuration
 * This ensures all configured audio tags are preserved during sanitization
 */
function generateAudioTagPattern(config: VoiceConfig): RegExp {
  const allTags: string[] = [];
  
  // Extract all emotional tags from config
  if (config.audio_tags?.emotional_tags) {
    Object.values(config.audio_tags.emotional_tags).forEach(tagArray => {
      if (Array.isArray(tagArray)) {
        tagArray.forEach(tag => {
          // Remove brackets and escape special regex characters
          const cleanTag = tag.replace(/[\[\]]/g, '').replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
          allTags.push(cleanTag);
        });
      }
    });
  }
  
  // Extract ambient effects if they exist
  if (config.audio_tags?.ambient_effects) {
    Object.values(config.audio_tags.ambient_effects).forEach(tagArray => {
      if (Array.isArray(tagArray)) {
        tagArray.forEach(tag => {
          const cleanTag = tag.replace(/[\[\]]/g, '').replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
          allTags.push(cleanTag);
        });
      }
    });
  }
  
  // Create pattern that matches any of the configured tags
  const tagPattern = allTags.length > 0 ? allTags.join('|') : 'no-valid-tags';
  console.log(`🎭 Generated dynamic audio tag pattern for ${allTags.length} tags:`, allTags.slice(0, 5));
  
  return new RegExp(`\\[(${tagPattern})\\]`, 'gi');
}

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
  
  // Model-aware processing: remove incompatible tags for target model
  sanitized = removeModelIncompatibleTags(sanitized, config);
  
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
  
  // Remove hashtag-like artifacts that might be spoken
  cleaned = cleaned.replace(/\bhashtag\s+\w+\b/gi, '');
  cleaned = cleaned.replace(/\#\w+/g, '');
  cleaned = cleaned.replace(/\bmeta\b(?!\s+\w)/gi, ''); // Remove standalone "meta" word
  
  // Remove square brackets EXCEPT for ElevenLabs v3 audio tags
  // Generate dynamic pattern from Angela's voice configuration
  const audioTagPattern = generateAudioTagPattern(config);
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
 * Removes tags incompatible with the target TTS model
 * - For v3 models: removes v2-style pause tags and converts to natural punctuation
 * - Preserves audio tags that are compatible with the target model
 */
function removeModelIncompatibleTags(text: string, config: VoiceConfig): string {
  let cleaned = text;
  const modelId = config.voice.model_id || 'eleven_v3';
  const isV3Model = modelId === 'eleven_v3';
  
  if (isV3Model) {
    console.log('🎯 v3 Model detected: removing v2 pause tags and converting to natural flow');
    
    // Step 1: Remove v2-style pause tags entirely (v3 handles pacing naturally)
    cleaned = cleaned.replace(/<pause[,:]\d+>/g, '');
    
    // Step 2: Remove SSML breaks entirely (v3 handles pacing naturally) 
    cleaned = cleaned.replace(/<break\s+time="[0-9.]+s?"\s*\/>/g, '');
    
    // Step 3: Remove emphasis tags entirely (v3 handles emphasis naturally)
    cleaned = cleaned.replace(/<emphasis:[^>]*>([^<]*)<\/emphasis>/g, '$1');
    
    // Step 4: Remove rate tags entirely (v3 handles rate changes naturally)
    cleaned = cleaned.replace(/<rate:[^>]*>([^<]*)<\/rate>/g, '$1');
    
    // Step 5: Remove any remaining XML-style tags that v3 doesn't support (except audio tags)
    cleaned = cleaned.replace(/<(?!\/?\[)[^>]*>/g, '');
    
    // Step 6: Clean up malformed punctuation created by tag removal
    cleaned = cleanupMalformedPunctuation(cleaned);
    
    // Log audio tags that should be preserved
    const audioTags = cleaned.match(/\[[^\]]+\]/g) || [];
    if (audioTags.length > 0) {
      console.log(`🎭 Preserving ${audioTags.length} v3 audio tags:`, audioTags.slice(0, 5));
    }
  } else {
    console.log('🎯 v2 Model detected: preserving pause tags, removing v3-only features');
    // For v2 models, could remove v3-specific audio tags if needed
    // Currently keeping them as they might work or be ignored
  }
  
  return cleaned;
}

/**
 * Cleans up malformed punctuation patterns created by tag removal
 */
function cleanupMalformedPunctuation(text: string): string {
  let cleaned = text;
  
  console.log('🧹 Cleaning malformed punctuation patterns');
  
  // Step 1: Remove duplicate consecutive punctuation
  cleaned = cleaned.replace(/[,]{2,}/g, ',');        // Multiple commas → single comma
  cleaned = cleaned.replace(/[.]{4,}/g, '...');      // 4+ periods → ellipses
  cleaned = cleaned.replace(/[!]{2,}/g, '!');        // Multiple exclamation → single
  cleaned = cleaned.replace(/[?]{2,}/g, '?');        // Multiple question → single
  
  // Step 2: Fix mixed punctuation clusters
  cleaned = cleaned.replace(/,[.]/g, '.');           // comma-period → just period
  cleaned = cleaned.replace(/[.],/g, '.');           // period-comma → just period  
  cleaned = cleaned.replace(/,\s*[.]/g, '.');        // comma space period → period
  cleaned = cleaned.replace(/[.]\s*,/g, '.');        // period space comma → period
  
  // Step 3: Normalize spacing around punctuation
  cleaned = cleaned.replace(/\s+([,.!?])/g, '$1');   // Remove space before punctuation
  cleaned = cleaned.replace(/([,.!?])(\w)/g, '$1 $2'); // Add space after punctuation before letters
  cleaned = cleaned.replace(/([.!?])\s*([A-Z])/g, '$1 $2'); // Ensure space after sentence-ending punctuation
  
  // Step 4: Handle ellipses properly
  cleaned = cleaned.replace(/[.]\s*[.]\s*[.]/g, '...'); // Separate periods → ellipses
  cleaned = cleaned.replace(/[.]{3,}/g, '...');          // Normalize ellipses length
  
  // Step 5: Remove excessive whitespace created by cleanup
  cleaned = cleaned.replace(/\s{3,}/g, '  ');        // Multiple spaces → double space (natural pause)
  cleaned = cleaned.replace(/\s+$/gm, '');           // Remove trailing whitespace
  
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
