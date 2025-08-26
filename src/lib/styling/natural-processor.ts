/**
 * Natural text processor for ElevenLabs v3
 * Focuses on clean, natural text with minimal markup for optimal v3 performance
 */

import { VoiceConfig } from './config';

export interface NaturalProcessingResult {
  text: string;
  audioTags: string[];
  naturalPauses: number;
}

/**
 * Processes text for ElevenLabs v3 using natural language approach
 * - Removes all artificial pause markup
 * - Uses natural punctuation for pacing
 * - Adds only essential audio tags
 * - Preserves conversational flow
 */
export function processForNaturalTTS(text: string, config: VoiceConfig): NaturalProcessingResult {
  let processed = text;
  const audioTags: string[] = [];
  let naturalPauses = 0;

  // Step 1: Remove ALL pause markup - let natural punctuation handle pacing
  processed = processed.replace(/<pause[^>]*>/g, '');
  processed = processed.replace(/<break[^>]*\/>/g, '');
  
  // Step 2: Normalize spacing and punctuation for natural flow
  processed = processed.replace(/\s+/g, ' '); // Multiple spaces to single
  processed = processed.replace(/\.\.\.\s*/g, '... '); // Normalize ellipses
  processed = processed.replace(/([.!?])\s*([A-Z])/g, '$1\n\n$2'); // Paragraph breaks after sentences
  
  // Step 3: Add strategic ellipses for natural pauses where needed
  processed = processed.replace(/\n\n/g, '...\n\n'); // Add ellipses for paragraph breaks
  naturalPauses = (processed.match(/\.\.\./g) || []).length;
  
  // Step 4: Apply audio tags based on emotional context (simplified)
  if (config.audio_tags?.enable_emotional_tags) {
    const result = applyNaturalAudioTags(processed, config);
    processed = result.text;
    audioTags.push(...result.tags);
  }
  
  // Step 5: Final cleanup
  processed = processed.trim();
  processed = processed.replace(/\n{3,}/g, '\n\n'); // Max 2 line breaks
  
  return {
    text: processed,
    audioTags,
    naturalPauses
  };
}

/**
 * Applies audio tags in a natural, context-aware way
 */
function applyNaturalAudioTags(text: string, config: VoiceConfig): { text: string; tags: string[] } {
  if (!config.audio_tags) return { text, tags: [] };
  
  const appliedTags: string[] = [];
  let processed = text;
  
  // Define natural contexts where audio tags make sense
  const emotionalContexts = [
    {
      triggers: ['whisper', 'secret', 'quietly', 'intimate', 'personal'],
      tag: '[whispers]',
      emotion: 'whisper'
    },
    {
      triggers: ['amazing', 'incredible', 'fantastic', 'powerful'],
      tag: '[excited]',
      emotion: 'excitement'
    },
    {
      triggers: ['mysterious', 'hidden', 'unknown', 'reveal'],
      tag: '[mysterious]',
      emotion: 'mystery'
    },
    {
      triggers: ['funny', 'amusing', 'hilarious'],
      tag: '[laughs]',
      emotion: 'laughter'
    }
  ];
  
  // Apply tags naturally - only once per context, at meaningful moments
  for (const context of emotionalContexts) {
    for (const trigger of context.triggers) {
      const regex = new RegExp(`\\b${trigger}\\b`, 'i');
      if (regex.test(processed) && Math.random() < 0.7) { // 70% chance
        // Find a natural place to insert the tag (beginning of sentence)
        const sentences = processed.split(/(?<=[.!?])\s+/);
        for (let i = 0; i < sentences.length; i++) {
          if (regex.test(sentences[i]) && !appliedTags.includes(context.tag)) {
            sentences[i] = `${context.tag} ${sentences[i]}`;
            appliedTags.push(context.tag);
            break;
          }
        }
        processed = sentences.join(' ');
        break; // Only one tag per context
      }
    }
  }
  
  return { text: processed, tags: appliedTags };
}

/**
 * Converts traditional pause markup to natural punctuation
 */
export function convertPausesToNatural(text: string): string {
  let natural = text;
  
  // Convert different pause durations to appropriate punctuation
  natural = natural.replace(/<pause[:\,]([0-9]+)>/g, (match, ms) => {
    const duration = parseInt(ms);
    if (duration <= 300) return ','; // Short pause = comma
    if (duration <= 800) return '.'; // Medium pause = period
    if (duration <= 2000) return '...'; // Long pause = ellipses
    return '...\n\n'; // Very long pause = paragraph break
  });
  
  // Convert SSML breaks to natural punctuation
  natural = natural.replace(/<break\s+time="([0-9.]+)s?"\s*\/>/g, (match, seconds) => {
    const duration = parseFloat(seconds) * 1000;
    if (duration <= 500) return ',';
    if (duration <= 1000) return '.';
    if (duration <= 2000) return '...';
    return '...\n\n';
  });
  
  return natural;
}

/**
 * Validates that text is clean and ready for ElevenLabs v3
 */
export function validateNaturalText(text: string): { isValid: boolean; issues: string[] } {
  const issues: string[] = [];
  
  // Check for remaining markup that shouldn't be there
  if (/<pause[^>]*>/i.test(text)) {
    issues.push('Contains pause markup - should use natural punctuation');
  }
  
  if (/<break[^>]*>/i.test(text)) {
    issues.push('Contains SSML break tags - should use natural punctuation');
  }
  
  // Check for malformed audio tags
  const audioTagPattern = /\[[^\]]*\]/g;
  const audioTags = text.match(audioTagPattern) || [];
  const validTags = ['[whispers]', '[laughs]', '[excited]', '[mysterious]', '[curious]', '[sighs]'];
  
  for (const tag of audioTags) {
    if (!validTags.includes(tag)) {
      issues.push(`Invalid audio tag: ${tag}`);
    }
  }
  
  return {
    isValid: issues.length === 0,
    issues
  };
}
