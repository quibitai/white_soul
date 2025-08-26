/**
 * ElevenLabs Model Selection Utility
 * Optimizes model selection based on use case and requirements
 */

import { VoiceConfig } from '../styling/config';

/**
 * Use case types for model selection
 */
export type UseCase = 'proof' | 'streaming' | 'full' | 'conversational' | 'content';

/**
 * Model performance characteristics
 */
export interface ModelCharacteristics {
  quality: 'high' | 'medium' | 'standard';
  latency: 'low' | 'medium' | 'high';
  multilingual: boolean;
  realtime: boolean;
  maxContextLength: number;
  supportedFeatures: string[];
}

/**
 * Available ElevenLabs models with their characteristics
 */
export const ELEVENLABS_MODELS: Record<string, ModelCharacteristics> = {
  'eleven_multilingual_v2': {
    quality: 'high',
    latency: 'high',
    multilingual: true,
    realtime: false,
    maxContextLength: 2500,
    supportedFeatures: ['ssml', 'pronunciation_dictionaries', 'voice_settings'],
  },
  'eleven_flash_v2_5': {
    quality: 'medium',
    latency: 'low',
    multilingual: true,
    realtime: true,
    maxContextLength: 2000,
    supportedFeatures: ['ssml', 'websocket', 'streaming'],
  },
  'eleven_turbo_v2_5': {
    quality: 'medium',
    latency: 'medium',
    multilingual: true,
    realtime: true,
    maxContextLength: 2200,
    supportedFeatures: ['ssml', 'websocket', 'streaming', 'voice_settings'],
  },
  'eleven_v3': {
    quality: 'high',
    latency: 'high',
    multilingual: true,
    realtime: false,
    maxContextLength: 3000,
    supportedFeatures: ['audio_tags', 'emotional_delivery', 'advanced_ssml', 'voice_settings'],
  },
  'eleven_english_v1': {
    quality: 'standard',
    latency: 'medium',
    multilingual: false,
    realtime: true,
    maxContextLength: 1500,
    supportedFeatures: ['ssml', 'voice_settings'],
  },
};

/**
 * Selects optimal model based on use case and configuration
 * @param {UseCase} useCase - The intended use case
 * @param {VoiceConfig} config - Voice configuration
 * @param {string[]} requiredFeatures - Required model features
 * @returns {string} Optimal model ID
 */
export function selectOptimalModel(
  useCase: UseCase,
  config: VoiceConfig,
  requiredFeatures: string[] = []
): string {
  // Check if model selection is configured
  if (config.model_selection) {
    const configuredModel = config.model_selection[useCase as keyof typeof config.model_selection];
    if (configuredModel && ELEVENLABS_MODELS[configuredModel]) {
      // Validate that configured model supports required features
      const modelFeatures = ELEVENLABS_MODELS[configuredModel].supportedFeatures;
      const supportsAllFeatures = requiredFeatures.every(feature => 
        modelFeatures.includes(feature)
      );
      
      if (supportsAllFeatures) {
        return configuredModel;
      }
    }
  }

  // Default model selection logic
  switch (useCase) {
    case 'proof':
      // Prioritize low latency for quick previews
      return selectByPriority(['latency'], requiredFeatures);
    
    case 'streaming':
    case 'conversational':
      // Balance latency and quality for real-time use
      return selectByPriority(['realtime', 'latency', 'quality'], requiredFeatures);
    
    case 'full':
    case 'content':
      // Prioritize quality for final output
      return selectByPriority(['quality', 'multilingual'], requiredFeatures);
    
    default:
      // Default to balanced model
      return 'eleven_turbo_v2_5';
  }
}

/**
 * Selects model by priority criteria
 */
function selectByPriority(priorities: string[], requiredFeatures: string[]): string {
  const candidates = Object.entries(ELEVENLABS_MODELS)
    .filter(([, characteristics]) => {
      // Filter by required features
      return requiredFeatures.every(feature => 
        characteristics.supportedFeatures.includes(feature)
      );
    })
    .map(([modelId, characteristics]) => ({
      modelId,
      characteristics,
      score: calculateModelScore(characteristics, priorities),
    }))
    .sort((a, b) => b.score - a.score);

  return candidates.length > 0 ? candidates[0].modelId : 'eleven_multilingual_v2';
}

/**
 * Calculates model score based on priorities
 */
function calculateModelScore(characteristics: ModelCharacteristics, priorities: string[]): number {
  let score = 0;
  const weights = { high: 3, medium: 2, low: 1, standard: 1 };

  for (let i = 0; i < priorities.length; i++) {
    const priority = priorities[i];
    const weight = priorities.length - i; // Higher weight for earlier priorities
    
    switch (priority) {
      case 'quality':
        score += weights[characteristics.quality] * weight;
        break;
      case 'latency':
        // Invert latency scoring (low latency = high score)
        const latencyScore = characteristics.latency === 'low' ? 3 : 
                           characteristics.latency === 'medium' ? 2 : 1;
        score += latencyScore * weight;
        break;
      case 'multilingual':
        score += characteristics.multilingual ? 3 * weight : 0;
        break;
      case 'realtime':
        score += characteristics.realtime ? 3 * weight : 0;
        break;
    }
  }

  return score;
}

/**
 * Gets model characteristics for a given model ID
 * @param {string} modelId - Model ID to look up
 * @returns {ModelCharacteristics | null} Model characteristics or null if not found
 */
export function getModelCharacteristics(modelId: string): ModelCharacteristics | null {
  return ELEVENLABS_MODELS[modelId] || null;
}

/**
 * Validates if a model supports required features
 * @param {string} modelId - Model ID to validate
 * @param {string[]} requiredFeatures - Features that must be supported
 * @returns {boolean} True if model supports all required features
 */
export function validateModelFeatures(modelId: string, requiredFeatures: string[]): boolean {
  const characteristics = getModelCharacteristics(modelId);
  if (!characteristics) return false;

  return requiredFeatures.every(feature => 
    characteristics.supportedFeatures.includes(feature)
  );
}

/**
 * Gets recommended voice settings for a specific model
 * @param {string} modelId - Model ID
 * @param {UseCase} useCase - Use case context
 * @returns {object} Recommended voice settings
 */
export function getModelOptimizedSettings(modelId: string, useCase: UseCase): object {
  const characteristics = getModelCharacteristics(modelId);
  if (!characteristics) return {};

  const baseSettings = {
    stability: 0.5,
    similarity_boost: 0.8,
    style: 0.0,
    use_speaker_boost: true,
  };

  // Optimize settings based on model and use case
  switch (modelId) {
    case 'eleven_v3':
      return {
        ...baseSettings,
        stability: useCase === 'conversational' ? 'Natural' : 'Creative',
        // v3 uses different stability values
      };
    
    case 'eleven_flash_v2_5':
      return {
        ...baseSettings,
        stability: 0.6, // Slightly higher for consistency in fast model
        style: 0.1, // Minimal style for speed
      };
    
    case 'eleven_multilingual_v2':
      return {
        ...baseSettings,
        stability: 0.4, // Lower for more expressiveness in high-quality model
        style: 0.2, // More style for content creation
      };
    
    default:
      return baseSettings;
  }
}

/**
 * Analyzes text requirements and suggests optimal model
 * @param {string} text - Text to analyze
 * @param {UseCase} useCase - Intended use case
 * @param {VoiceConfig} config - Voice configuration
 * @returns {ModelRecommendation} Model recommendation with reasoning
 */
export function analyzeAndRecommendModel(
  text: string,
  useCase: UseCase,
  config: VoiceConfig
): ModelRecommendation {
  const textLength = text.length;
  const hasAudioTags = /\[[^\]]+\]/.test(text);
  const hasComplexSSML = /<[^>]+>/.test(text);
  const isMultilingual = /[^\x00-\x7F]/.test(text); // Basic non-ASCII detection

  const requiredFeatures: string[] = [];
  const recommendations: string[] = [];

  // Analyze requirements
  if (hasAudioTags) {
    requiredFeatures.push('audio_tags');
    recommendations.push('Audio tags detected - consider Eleven v3 for best results');
  }

  if (hasComplexSSML) {
    requiredFeatures.push('ssml');
    recommendations.push('Complex SSML detected - ensure model supports advanced SSML');
  }

  if (isMultilingual) {
    requiredFeatures.push('multilingual');
    recommendations.push('Non-English characters detected - multilingual model recommended');
  }

  if (textLength > 2000) {
    recommendations.push('Long text detected - high-quality model recommended for consistency');
  }

  // Select optimal model
  const recommendedModel = selectOptimalModel(useCase, config, requiredFeatures);
  const characteristics = getModelCharacteristics(recommendedModel);
  
  // Generate reasoning
  const reasoning = [
    `Selected ${recommendedModel} for ${useCase} use case`,
    `Quality: ${characteristics?.quality}, Latency: ${characteristics?.latency}`,
    ...recommendations,
  ];

  return {
    modelId: recommendedModel,
    characteristics: characteristics!,
    requiredFeatures,
    reasoning,
    confidence: calculateConfidence(textLength, requiredFeatures, useCase),
  };
}

/**
 * Calculates confidence score for model recommendation
 */
function calculateConfidence(
  textLength: number,
  requiredFeatures: string[],
  useCase: UseCase
): number {
  let confidence = 0.8; // Base confidence

  // Adjust based on text complexity
  if (textLength < 100) confidence -= 0.1; // Very short text is harder to optimize
  if (textLength > 1000) confidence += 0.1; // Longer text benefits more from optimization

  // Adjust based on feature requirements
  if (requiredFeatures.length === 0) confidence -= 0.1; // No specific requirements
  if (requiredFeatures.length > 2) confidence += 0.1; // Clear requirements

  // Adjust based on use case clarity
  if (useCase === 'proof' || useCase === 'full') confidence += 0.1; // Clear use cases

  return Math.min(Math.max(confidence, 0.0), 1.0);
}

/**
 * Interface for model recommendation result
 */
export interface ModelRecommendation {
  modelId: string;
  characteristics: ModelCharacteristics;
  requiredFeatures: string[];
  reasoning: string[];
  confidence: number;
}
