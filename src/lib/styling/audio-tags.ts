/**
 * ElevenLabs v3 Audio Tags Processor
 * Optimized for eleven_v3 model with contextual emotional delivery
 * Implements strategic tag placement for natural speech flow
 */

import { VoiceConfig } from './config';

/**
 * Applies ElevenLabs v3 audio tags for emotional delivery with contextual placement
 * @param {string} text - Input text to process
 * @param {VoiceConfig} config - Voice configuration
 * @returns {string} Text with strategically placed audio tags
 */
export function applyAudioTags(text: string, config: VoiceConfig): string {
  console.log('🎭 v3 Audio Tags - Processing:', {
    modelId: config.voice.model_id,
    isV3Compatible: isV3Compatible(config.voice.model_id),
    tagStrategy: config.audio_tags?.tag_strategy || 'contextual',
    textPreview: text.substring(0, 100) + '...'
  });

  // Early return if audio tags are disabled or model is not v3 compatible
  if (!config.audio_tags?.enable_emotional_tags || !isV3Compatible(config.voice.model_id)) {
    console.log('🎭 Audio Tags - Disabled or incompatible model, returning original');
    return text;
  }

  // Process text with contextual tag placement
  const processed = applyContextualTags(text, config);
  
  console.log('🎭 v3 Audio Tags - Result:', {
    originalLength: text.length,
    processedLength: processed.length,
    hasChanges: text !== processed,
    tagsAdded: (processed.match(/\[[^\]]+\]/g) || []).length
  });

  return processed;
}

/**
 * Applies contextual audio tags based on content analysis and natural placement
 */
function applyContextualTags(text: string, config: VoiceConfig): string {
  if (!config.audio_tags) return text;

  const { emotional_tags, placement_triggers, max_tags_per_chunk = 2 } = config.audio_tags;
  
  // Split text into processable segments (sentences)
  const sentences = text.split(/(?<=[.!?])\s+/);
  let tagsUsed = 0;
  
  const processedSentences = sentences.map((sentence, index) => {
    // Avoid over-tagging
    if (tagsUsed >= max_tags_per_chunk) {
      return sentence;
    }

    // Analyze sentence for emotional context
    const emotionalContext = analyzeEmotionalContext(sentence, placement_triggers);
    
    if (emotionalContext) {
      const tag = selectAppropriateTag(emotionalContext, emotional_tags);
      if (tag) {
        tagsUsed++;
        return insertTagNaturally(sentence, tag, emotionalContext);
      }
    }

    return sentence;
  });

  return processedSentences.join(' ');
}

/**
 * Analyzes sentence for emotional context using placement triggers
 */
function analyzeEmotionalContext(
  sentence: string, 
  placementTriggers: Record<string, string[]>
): string | null {
  const lowerSentence = sentence.toLowerCase();
  
  // Check triggers in order of emotional impact
  const emotionPriority = ['mystery', 'excitement', 'curiosity', 'whispers'];
  
  for (const emotion of emotionPriority) {
    const triggers = placementTriggers[emotion] || [];
    
    for (const trigger of triggers) {
      const pattern = new RegExp(`\\b${trigger}\\b`, 'i');
      if (pattern.test(lowerSentence)) {
        console.log(`🎭 Context Match: "${emotion}" triggered by "${trigger}"`);
        return emotion;
      }
    }
  }
  
  return null;
}

/**
 * Selects appropriate tag based on emotional context
 */
function selectAppropriateTag(
  emotionalContext: string,
  emotionalTags: Record<string, string[]>
): string | null {
  const availableTags = emotionalTags[emotionalContext];
  
  if (!availableTags || availableTags.length === 0) {
    return null;
  }

  // For v3, prefer single consistent tags per emotion
  // Use first tag for consistency unless variety is specifically needed
  return availableTags[0];
}

/**
 * Inserts tag at natural speech break points for optimal flow
 */
function insertTagNaturally(
  sentence: string,
  tag: string,
  emotionalContext: string
): string {
  // Strategic placement based on emotional context and sentence structure
  
  // For whispers: place at beginning for intimate delivery
  if (emotionalContext === 'whispers') {
    return `${tag} ${sentence}`;
  }
  
  // For curiosity: place before key discovery words
  if (emotionalContext === 'curiosity') {
    const discoveryPatterns = [
      /(\b(?:this|that|it)'s\b)/i,
      /(\bwhat(?:'s|'re)?\b)/i,
      /(\bhow\b)/i
    ];
    
    for (const pattern of discoveryPatterns) {
      if (pattern.test(sentence)) {
        return sentence.replace(pattern, `${tag} $1`);
      }
    }
  }
  
  // For excitement: place before power words
  if (emotionalContext === 'excitement') {
    const powerPatterns = [
      /(\b(?:amazing|incredible|powerful|energy)\b)/i,
      /(\b(?:wow|yes|absolutely)\b)/i
    ];
    
    for (const pattern of powerPatterns) {
      if (pattern.test(sentence)) {
        return sentence.replace(pattern, `${tag} $1`);
      }
    }
  }
  
  // For mystery: place after pause-inducing punctuation
  if (emotionalContext === 'mystery') {
    const mysteryPatterns = [
      /(\.\.\.)\s*/g,
      /(\,)\s*(?=(?:but|however|yet)\b)/i
    ];
    
    for (const pattern of mysteryPatterns) {
      if (pattern.test(sentence)) {
        return sentence.replace(pattern, `$1 ${tag} `);
      }
    }
  }
  
  // Default: place at natural sentence beginning
  return `${tag} ${sentence}`;
}

/**
 * Checks if model supports v3 audio tags
 */
function isV3Compatible(modelId: string): boolean {
  return modelId === 'eleven_v3' || modelId.startsWith('eleven_v3_preview');
}

/**
 * Validates v3 audio tags format and compatibility
 */
export function validateV3AudioTags(text: string): {
  validTags: string[];
  invalidTags: string[];
  warnings: string[];
  recommendations: string[];
} {
  const validTags: string[] = [];
  const invalidTags: string[] = [];
  const warnings: string[] = [];
  const recommendations: string[] = [];

  // Extract all audio tags
  const tagPattern = /\[([^\]]+)\]/g;
  const tags = text.match(tagPattern) || [];

  // v3 verified compatible tags
  const v3CompatibleTags = [
    'laughs', 'giggles', 'chuckles', 'whispers', 'sighs', 'exhales',
    'curious', 'intrigued', 'excited', 'amazed', 'mysterious', 'knowing',
    'emphasizes', 'soft wind', 'gentle chimes'
  ];

  for (const tag of tags) {
    const tagContent = tag.slice(1, -1).toLowerCase();
    
    if (v3CompatibleTags.some(compatible => 
        compatible.toLowerCase() === tagContent || 
        tagContent.includes(compatible.toLowerCase())
    )) {
      validTags.push(tag);
    } else {
      invalidTags.push(tag);
      warnings.push(`Tag "${tag}" may not be optimized for v3`);
    }
  }

  // Analysis and recommendations
  const tagDensity = tags.length / text.split(' ').length;
  
  if (tagDensity > 0.05) {
    warnings.push('High tag density may affect natural speech flow');
    recommendations.push('Consider reducing tags to 1-2 per chunk for better naturalness');
  }
  
  if (tags.length === 0 && text.length > 100) {
    recommendations.push('Consider adding contextual emotional tags for enhanced delivery');
  }

  if (validTags.length > 0) {
    recommendations.push(`${validTags.length} v3-compatible tags found - good for emotional expression`);
  }

  return { validTags, invalidTags, warnings, recommendations };
}

/**
 * Analyzes text for optimal v3 audio tag opportunities
 */
export function analyzeV3TagOpportunities(text: string, config: VoiceConfig): {
  emotionalOpportunities: Array<{emotion: string, count: number, examples: string[]}>;
  recommendations: string[];
  optimalTagCount: number;
} {
  const emotionalOpportunities: Array<{emotion: string, count: number, examples: string[]}> = [];
  const recommendations: string[] = [];

  if (!config.audio_tags?.placement_triggers) {
    recommendations.push('Configure placement_triggers for automatic tag detection');
    return { emotionalOpportunities, recommendations, optimalTagCount: 0 };
  }

  const { placement_triggers } = config.audio_tags;
  const lowerText = text.toLowerCase();

  // Analyze opportunities for each emotion
  for (const [emotion, triggers] of Object.entries(placement_triggers)) {
    const examples: string[] = [];
    let count = 0;

    for (const trigger of triggers) {
      const pattern = new RegExp(`\\b${trigger}\\b`, 'gi');
      const matches = lowerText.match(pattern);
      if (matches) {
        count += matches.length;
        examples.push(...matches.slice(0, 3)); // Limit examples
      }
    }

    if (count > 0) {
      emotionalOpportunities.push({ emotion, count, examples });
    }
  }

  // Generate recommendations
  const totalOpportunities = emotionalOpportunities.reduce((sum, opp) => sum + opp.count, 0);
  const wordCount = text.split(' ').length;
  const optimalTagCount = Math.min(Math.floor(wordCount / 100), 3); // 1 tag per ~100 words, max 3

  if (totalOpportunities > 0) {
    recommendations.push(`Found ${totalOpportunities} tag opportunities across ${emotionalOpportunities.length} emotions`);
  }

  if (optimalTagCount > 0) {
    recommendations.push(`Optimal tag count for this text: ${optimalTagCount} tags`);
  }

  if (totalOpportunities === 0) {
    recommendations.push('Consider adding more expressive language to enable better emotional tagging');
  }

  return { emotionalOpportunities, recommendations, optimalTagCount };
}