/**
 * Conversational realism processor for White Soul Tarot
 * Transforms formal text into natural, flowing speech patterns
 * based on analysis of sample scripts and Angela's speaking style
 */

import { VoiceConfig } from './config';

/**
 * Applies conversational realism transformations to text
 * @param {string} text - Input text to transform
 * @param {VoiceConfig} config - Voice configuration settings
 * @returns {string} Text with conversational realism applied
 */
export function applyConversationalRealism(text: string, config: VoiceConfig): string {
  if (!text?.trim()) return text;

  let processed = text;

  // Apply transformations in order
  processed = replaceYouWithYouGuys(processed, config);
  processed = addEmphasisCaps(processed, config);
  processed = replaceBreaksWithHesitation(processed, config);
  processed = combineSentences(processed, config);
  processed = applyMysticalVocabulary(processed, config);
  processed = avoidRepetitiveNegation(processed, config);

  return processed;
}

/**
 * Replaces "you" with "you guys" based on configured ratio
 * @param {string} text - Input text
 * @param {VoiceConfig} config - Voice configuration
 * @returns {string} Text with "you guys" replacements
 */
function replaceYouWithYouGuys(text: string, config: VoiceConfig): string {
  const ratio = config.conversational_realism.you_guys_ratio;
  const youPattern = /\byou\b(?!\s+guys)/gi;
  const matches = text.match(youPattern) || [];
  
  if (matches.length === 0) return text;

  const replacementCount = Math.floor(matches.length * ratio);
  let replacements = 0;
  
  return text.replace(youPattern, (match, offset) => {
    // Skip if already at target replacement count
    if (replacements >= replacementCount) return match;
    
    // Skip if in certain contexts where "you guys" doesn't fit
    const beforeContext = text.slice(Math.max(0, offset - 20), offset);
    const afterContext = text.slice(offset + match.length, offset + match.length + 20);
    
    // Don't replace in formal contexts or mid-sentence
    if (
      beforeContext.includes('<break') ||
      afterContext.match(/^[a-z]/) || // lowercase following word
      beforeContext.match(/\b(if|when|because|that)\s*$/i)
    ) {
      return match;
    }
    
    // Use weighted random selection (favor beginning of sentences)
    const isStartOfSentence = beforeContext.match(/[.!?]\s*$/);
    const shouldReplace = isStartOfSentence ? 
      Math.random() < 0.7 : // 70% chance at sentence start
      Math.random() < 0.3;  // 30% chance elsewhere
    
    if (shouldReplace) {
      replacements++;
      return match.toLowerCase() === 'you' ? 'you guys' : 'You guys';
    }
    
    return match;
  });
}

/**
 * Adds ALL CAPS emphasis to key emotional words
 * @param {string} text - Input text
 * @param {VoiceConfig} config - Voice configuration
 * @returns {string} Text with emphasis applied
 */
function addEmphasisCaps(text: string, config: VoiceConfig): string {
  const frequency = config.conversational_realism.all_caps_frequency;
  const emphasisWords = config.speech_patterns.emphasis_words;
  
  let processed = text;
  
  for (const word of emphasisWords) {
    const pattern = new RegExp(`\\b${word}\\b`, 'gi');
    const matches = processed.match(pattern) || [];
    
    if (matches.length === 0) continue;
    
    const targetReplacements = Math.floor(matches.length * frequency);
    let replacements = 0;
    
    processed = processed.replace(pattern, (match, offset) => {
      if (replacements >= targetReplacements) return match;
      
      // Higher chance for emphasis in emotional contexts
      const context = processed.slice(Math.max(0, offset - 50), offset + match.length + 50);
      const emotionalContext = /\b(feel|felt|need|want|truth|real|deep|strong)\b/i.test(context);
      
      const shouldEmphasize = emotionalContext ? 
        Math.random() < 0.8 : // 80% in emotional contexts
        Math.random() < 0.4;  // 40% elsewhere
      
      if (shouldEmphasize) {
        replacements++;
        return match.toUpperCase();
      }
      
      return match;
    });
  }
  
  return processed;
}

/**
 * Replaces some breaks with verbal hesitation cues
 * @param {string} text - Input text
 * @param {VoiceConfig} config - Voice configuration
 * @returns {string} Text with hesitation cues
 */
function replaceBreaksWithHesitation(text: string, config: VoiceConfig): string {
  const ratio = config.conversational_realism.verbal_hesitation_ratio;
  const hesitationCues = config.speech_patterns.hesitation_cues;
  
  // Target short breaks (0.3s to 1.5s) for replacement
  const breakPattern = /<break time="(0\.[3-9]|1\.[0-5])s?"\/>/g;
  const matches = text.match(breakPattern) || [];
  
  if (matches.length === 0) return text;
  
  const replacementCount = Math.floor(matches.length * ratio);
  let replacements = 0;
  
  return text.replace(breakPattern, (match, timeValue) => {
    if (replacements >= replacementCount) return match;
    
    // Don't replace breaks at end of sentences or after punctuation
    const beforeMatch = text.slice(0, text.indexOf(match));
    if (beforeMatch.match(/[.!?]\s*$/)) return match;
    
    if (Math.random() < 0.6) { // 60% chance to replace eligible breaks
      replacements++;
      const cue = hesitationCues[Math.floor(Math.random() * hesitationCues.length)];
      const pauseTime = parseFloat(timeValue) * 0.5; // Shorter pause after verbal cue
      return `${cue} <break time="${pauseTime.toFixed(1)}s"/>`;
    }
    
    return match;
  });
}

/**
 * Combines short sentences to create more natural flow
 * @param {string} text - Input text
 * @param {VoiceConfig} config - Voice configuration
 * @returns {string} Text with combined sentences
 */
function combineSentences(text: string, config: VoiceConfig): string {
  const ratio = config.conversational_realism.run_on_sentence_ratio;
  
  // Find short sentences (< 8 words) followed by breaks
  const shortSentencePattern = /([^.!?]{1,50}[.!?])\s*<break time="[^"]*"\/>\s*([A-Z][^.!?]{1,50}[.!?])/g;
  const matches = text.match(shortSentencePattern) || [];
  
  if (matches.length === 0) return text;
  
  const combinationCount = Math.floor(matches.length * ratio);
  let combinations = 0;
  
  return text.replace(shortSentencePattern, (match, sentence1, sentence2) => {
    if (combinations >= combinationCount) return match;
    
    // Don't combine if sentences are too different in tone
    const hasQuestion = sentence1.includes('?') || sentence2.includes('?');
    const hasExclamation = sentence1.includes('!') || sentence2.includes('!');
    
    if (hasQuestion || hasExclamation) return match;
    
    if (Math.random() < 0.5) { // 50% chance to combine eligible sentences
      combinations++;
      
      // Choose appropriate connector
      const connectors = ['and', 'but', 'so', 'like', 'yeah'];
      const connector = connectors[Math.floor(Math.random() * connectors.length)];
      
      // Remove period from first sentence, add connector
      const combined = sentence1.replace(/\.$/, '') + ` ${connector} ` + sentence2.toLowerCase();
      return combined;
    }
    
    return match;
  });
}

/**
 * Applies mystical vocabulary replacements
 * @param {string} text - Input text
 * @param {VoiceConfig} config - Voice configuration
 * @returns {string} Text with mystical vocabulary
 */
function applyMysticalVocabulary(text: string, config: VoiceConfig): string {
  if (!config.conversational_realism.mystical_vocabulary) return text;
  
  const replacements = config.speech_patterns.mystical_replacements;
  let processed = text;
  
  for (const [original, mystical] of Object.entries(replacements)) {
    // Replace with 30% probability to maintain variety
    const pattern = new RegExp(`\\b${original}\\b`, 'gi');
    processed = processed.replace(pattern, (match) => {
      return Math.random() < 0.3 ? mystical : match;
    });
  }
  
  return processed;
}

/**
 * Reduces repetitive "it's not X" patterns
 * @param {string} text - Input text
 * @param {VoiceConfig} config - Voice configuration
 * @returns {string} Text with reduced repetitive patterns
 */
function avoidRepetitiveNegation(text: string, config: VoiceConfig): string {
  if (!config.conversational_realism.avoid_repetitive_negation) return text;
  
  // Detect "it's not X" patterns
  const negationPattern = /(it's not [^.!?]+[.!?]\s*){2,}/gi;
  
  return text.replace(negationPattern, (match) => {
    const sentences = match.split(/(?<=[.!?])\s+/);
    
    // Keep first negation, transform others
    const transformed = sentences.map((sentence, index) => {
      if (index === 0) return sentence; // Keep first as-is
      
      // Transform subsequent negations
      if (sentence.match(/^it's not/i)) {
        return sentence.replace(/^it's not/i, 'this isn\'t about');
      }
      
      return sentence;
    });
    
    return transformed.join(' ');
  });
}

/**
 * Analyzes text for conversational realism metrics
 * @param {string} text - Text to analyze
 * @returns {object} Analysis metrics
 */
export function analyzeConversationalRealism(text: string): {
  youGuysRatio: number;
  allCapsCount: number;
  hesitationCues: number;
  runOnSentences: number;
  mysticalWords: number;
  repetitivePatterns: number;
} {
  const youMatches = text.match(/\byou\b/gi) || [];
  const youGuysMatches = text.match(/\byou guys\b/gi) || [];
  const youGuysRatio = youMatches.length > 0 ? youGuysMatches.length / youMatches.length : 0;
  
  const allCapsMatches = text.match(/\b[A-Z]{2,}\b/g) || [];
  const allCapsCount = allCapsMatches.length;
  
  const hesitationMatches = text.match(/\b(yeah|like|so yeah|it's like|I mean)\b/gi) || [];
  const hesitationCues = hesitationMatches.length;
  
  const sentences = text.split(/[.!?]+/).filter(s => s.trim());
  const longSentences = sentences.filter(s => s.split(/\s+/).length > 15);
  const runOnSentences = longSentences.length;
  
  const mysticalMatches = text.match(/\b(currents|portal|transmission|revelation|resonance)\b/gi) || [];
  const mysticalWords = mysticalMatches.length;
  
  const repetitiveMatches = text.match(/(it's not [^.!?]+[.!?]\s*){2,}/gi) || [];
  const repetitivePatterns = repetitiveMatches.length;
  
  return {
    youGuysRatio,
    allCapsCount,
    hesitationCues,
    runOnSentences,
    mysticalWords,
    repetitivePatterns,
  };
}
