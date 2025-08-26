/**
 * Audio Tags Processor for ElevenLabs Emotional Delivery
 * Implements ElevenLabs v3 audio tags for enhanced speech expressiveness
 */

import { VoiceConfig } from './config';

/**
 * Applies ElevenLabs audio tags for emotional delivery and ambient effects
 * @param {string} text - Input text to process
 * @param {VoiceConfig} config - Voice configuration
 * @returns {string} Text with audio tags inserted
 */
export function applyAudioTags(text: string, config: VoiceConfig): string {
  if (!config.audio_tags?.enable_emotional_tags && !config.audio_tags?.enable_sound_effects) {
    return text;
  }

  let processed = text;

  // Apply emotional tags based on context
  if (config.audio_tags?.enable_emotional_tags) {
    processed = applyEmotionalTags(processed, config);
  }

  // Apply ambient sound effects
  if (config.audio_tags?.enable_sound_effects) {
    processed = applyAmbientEffects(processed, config);
  }

  return processed;
}

/**
 * Applies emotional audio tags based on contextual triggers
 */
function applyEmotionalTags(text: string, config: VoiceConfig): string {
  if (!config.audio_tags) return text;

  const { emotional_triggers, emotional_tags, tag_probability } = config.audio_tags;

  // Process each sentence for emotional context
  const sentences = text.split(/(?<=[.!?])\s+/);
  
  const processedSentences = sentences.map(sentence => {
    if (Math.random() > tag_probability) {
      return sentence;
    }

    // Check for emotional triggers
    for (const [emotion, triggers] of Object.entries(emotional_triggers)) {
      for (const trigger of triggers) {
        const pattern = new RegExp(`\\b${trigger}\\b`, 'gi');
        if (pattern.test(sentence)) {
          return insertEmotionalTag(sentence, emotion, emotional_tags);
        }
      }
    }

    return sentence;
  });

  return processedSentences.join(' ');
}

/**
 * Inserts appropriate emotional tag for detected emotion
 */
function insertEmotionalTag(
  sentence: string, 
  emotion: string, 
  emotionalTags: Record<string, string[]>
): string {
  const tagOptions = emotionalTags[emotion];
  if (!tagOptions || tagOptions.length === 0) return sentence;

  const selectedTag = tagOptions[Math.floor(Math.random() * tagOptions.length)];
  
  // Insert tag at natural break points
  const insertionPoints = [
    // After introductory phrases
    /^(Well|So|Now|Actually|You know),?\s*/,
    // Before key phrases
    /\b(this is|that's|it's really|I think)\b/i,
    // After pauses or breaks
    /(<break[^>]*\/>)\s*/g,
  ];

  for (const pattern of insertionPoints) {
    if (pattern.test(sentence)) {
      return sentence.replace(pattern, `$1${selectedTag} `);
    }
  }

  // Default: insert at beginning of sentence
  return `${selectedTag} ${sentence}`;
}

/**
 * Applies ambient sound effects based on content context
 */
function applyAmbientEffects(text: string, config: VoiceConfig): string {
  if (!config.audio_tags) return text;

  const processed = text;
  const { ambient_effects, sound_effect_probability, max_effects_per_chunk } = config.audio_tags;

  // Limit effects per chunk to avoid overwhelming
  let effectsAdded = 0;
  const maxEffects = max_effects_per_chunk || 1;

  // Context-based sound effect triggers
  const contextTriggers = {
    mystical: [
      'energy', 'spiritual', 'universe', 'cosmic', 'divine', 'sacred',
      'mystical', 'magical', 'enchanted', 'ethereal', 'transcendent'
    ],
    nature: [
      'earth', 'water', 'wind', 'fire', 'nature', 'natural', 'flowing',
      'growing', 'blooming', 'seasonal', 'elemental'
    ],
    spiritual: [
      'meditation', 'prayer', 'blessing', 'ritual', 'ceremony', 'sacred',
      'holy', 'divine', 'enlightened', 'awakened', 'transformed'
    ]
  };

  // Process text in chunks (paragraphs)
  const paragraphs = processed.split(/\n\s*\n/);
  
  const processedParagraphs = paragraphs.map(paragraph => {
    if (effectsAdded >= maxEffects) return paragraph;
    if (Math.random() > sound_effect_probability) return paragraph;

    // Check for context triggers
    for (const [context, triggers] of Object.entries(contextTriggers)) {
      for (const trigger of triggers) {
        const pattern = new RegExp(`\\b${trigger}\\b`, 'gi');
        if (pattern.test(paragraph)) {
          const effect = selectAmbientEffect(context, ambient_effects);
          if (effect) {
            effectsAdded++;
            return insertAmbientEffect(paragraph, effect);
          }
        }
      }
    }

    return paragraph;
  });

  return processedParagraphs.join('\n\n');
}

/**
 * Selects appropriate ambient effect for context
 */
function selectAmbientEffect(context: string, ambientEffects: Record<string, string[]>): string | null {
  const effects = ambientEffects[context];
  if (!effects || effects.length === 0) return null;
  
  return effects[Math.floor(Math.random() * effects.length)];
}

/**
 * Inserts ambient effect at appropriate location
 */
function insertAmbientEffect(paragraph: string, effect: string): string {
  // Insert at natural pause points or beginning of paragraph
  const sentences = paragraph.split(/(?<=[.!?])\s+/);
  
  if (sentences.length > 1) {
    // Insert between sentences
    const insertIndex = Math.floor(sentences.length / 2);
    sentences.splice(insertIndex, 0, effect);
    return sentences.join(' ');
  } else {
    // Insert at beginning of single sentence
    return `${effect} ${paragraph}`;
  }
}

/**
 * Analyzes text for audio tag opportunities and provides insights
 */
export function analyzeAudioTagOpportunities(text: string, config: VoiceConfig): {
  emotionalOpportunities: string[];
  ambientOpportunities: string[];
  recommendations: string[];
} {
  const emotionalOpportunities: string[] = [];
  const ambientOpportunities: string[] = [];
  const recommendations: string[] = [];

  if (!config.audio_tags) {
    recommendations.push('Enable audio_tags in configuration to enhance emotional delivery');
    return { emotionalOpportunities, ambientOpportunities, recommendations };
  }

  // Analyze emotional opportunities
  const { emotional_triggers } = config.audio_tags;
  for (const [emotion, triggers] of Object.entries(emotional_triggers)) {
    for (const trigger of triggers) {
      const pattern = new RegExp(`\\b${trigger}\\b`, 'gi');
      const matches = text.match(pattern);
      if (matches) {
        emotionalOpportunities.push(`${emotion}: ${matches.length} opportunities`);
      }
    }
  }

  // Analyze ambient opportunities
  const contextTriggers = {
    mystical: ['energy', 'spiritual', 'universe', 'cosmic', 'divine'],
    nature: ['earth', 'water', 'wind', 'fire', 'nature'],
    spiritual: ['meditation', 'prayer', 'blessing', 'ritual', 'ceremony']
  };

  for (const [context, triggers] of Object.entries(contextTriggers)) {
    for (const trigger of triggers) {
      const pattern = new RegExp(`\\b${trigger}\\b`, 'gi');
      const matches = text.match(pattern);
      if (matches) {
        ambientOpportunities.push(`${context}: ${matches.length} opportunities`);
      }
    }
  }

  // Generate recommendations
  if (emotionalOpportunities.length > 0) {
    recommendations.push(`Found ${emotionalOpportunities.length} emotional tag opportunities`);
  }
  if (ambientOpportunities.length > 0) {
    recommendations.push(`Found ${ambientOpportunities.length} ambient effect opportunities`);
  }
  if (emotionalOpportunities.length === 0 && ambientOpportunities.length === 0) {
    recommendations.push('Consider adding more expressive language for better audio tag utilization');
  }

  return { emotionalOpportunities, ambientOpportunities, recommendations };
}

/**
 * Validates audio tags in text for ElevenLabs compatibility
 */
export function validateAudioTags(text: string): {
  validTags: string[];
  invalidTags: string[];
  warnings: string[];
} {
  const validTags: string[] = [];
  const invalidTags: string[] = [];
  const warnings: string[] = [];

  // Extract all audio tags
  const tagPattern = /\[([^\]]+)\]/g;
  const tags = text.match(tagPattern) || [];

  // ElevenLabs v3 supported tags (partial list)
  const supportedTags = [
    'laughs', 'giggles', 'chuckles', 'whispers', 'sighs', 'exhales',
    'curious', 'excited', 'thoughtful', 'mysterious', 'emphasizes',
    'soft wind', 'gentle chimes', 'rustling cards', 'flowing water',
    'bell rings softly', 'candle flickers', 'crystal resonance'
  ];

  for (const tag of tags) {
    const tagContent = tag.slice(1, -1); // Remove brackets
    
    if (supportedTags.some(supported => tagContent.toLowerCase().includes(supported.toLowerCase()))) {
      validTags.push(tag);
    } else {
      invalidTags.push(tag);
    }
  }

  // Generate warnings
  if (invalidTags.length > 0) {
    warnings.push(`${invalidTags.length} potentially unsupported audio tags found`);
  }

  const tagDensity = tags.length / text.split(' ').length;
  if (tagDensity > 0.1) {
    warnings.push('High audio tag density may affect speech naturalness');
  }

  return { validTags, invalidTags, warnings };
}
