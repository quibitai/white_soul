/**
 * ElevenLabs model capabilities and text sanitization
 * Handles model-specific SSML support and text preprocessing
 */

export interface ModelCapabilities {
  id: string;
  name: string;
  supportsSSML: boolean;
  supportsProsody: boolean;
  supportsBreaks: boolean;
  maxBreakTime: number; // milliseconds
  supportsEmphasis: boolean;
  supportsPronunciationDictionaries: boolean;
  maxDictionaries: number;
  supportsWebSocket: boolean;
  supportsAudioTags?: boolean; // v3's key feature for emotional delivery
  supportsStabilityModes?: boolean; // Creative, Natural, Robust modes
  recommendedSettings: {
    stability: number;
    similarity_boost: number;
    style: number;
    speaker_boost: boolean;
  };
}

/**
 * Model capabilities database
 */
export const MODEL_CAPS: Record<string, ModelCapabilities> = {
  'eleven_multilingual_v2': {
    id: 'eleven_multilingual_v2',
    name: 'Multilingual V2',
    supportsSSML: true,
    supportsProsody: false, // Disabled by default for stability
    supportsBreaks: true,
    maxBreakTime: 2200, // 2.2 seconds max
    supportsEmphasis: false, // Disabled by default
    supportsPronunciationDictionaries: true,
    maxDictionaries: 3,
    supportsWebSocket: true,
    recommendedSettings: {
      stability: 0.35,
      similarity_boost: 0.8,
      style: 0.2,
      speaker_boost: true,
    },
  },
  'eleven_monolingual_v1': {
    id: 'eleven_monolingual_v1',
    name: 'Monolingual V1',
    supportsSSML: true,
    supportsProsody: false,
    supportsBreaks: true,
    maxBreakTime: 2200,
    supportsEmphasis: false,
    supportsPronunciationDictionaries: true,
    maxDictionaries: 3,
    supportsWebSocket: false,
    recommendedSettings: {
      stability: 0.4,
      similarity_boost: 0.75,
      style: 0.15,
      speaker_boost: true,
    },
  },
  'eleven_turbo_v2': {
    id: 'eleven_turbo_v2',
    name: 'Turbo V2',
    supportsSSML: true,
    supportsProsody: false,
    supportsBreaks: true,
    maxBreakTime: 2000, // Slightly more conservative
    supportsEmphasis: false,
    supportsPronunciationDictionaries: true,
    maxDictionaries: 2, // Fewer for turbo model
    supportsWebSocket: true,
    recommendedSettings: {
      stability: 0.3,
      similarity_boost: 0.8,
      style: 0.25,
      speaker_boost: true,
    },
  },
  'eleven_v3': {
    id: 'eleven_v3',
    name: 'Eleven V3',
    supportsSSML: true,
    supportsProsody: false, // Use audio tags instead
    supportsBreaks: true,
    maxBreakTime: 2200,
    supportsEmphasis: false, // Use audio tags instead
    supportsPronunciationDictionaries: true,
    maxDictionaries: 3,
    supportsWebSocket: false, // v3 is not for real-time applications
    supportsAudioTags: true, // v3's key feature for emotional delivery
    supportsStabilityModes: true, // Creative, Natural, Robust modes
    recommendedSettings: {
      stability: 0.0, // Creative mode (0.0) for maximum emotional expressiveness
      similarity_boost: 0.85, // Higher for better voice consistency
      style: 0.0, // Not used in v3, stability controls behavior
      speaker_boost: true,
    },
  },
};

/**
 * Gets model capabilities for a given model ID
 * @param {string} modelId - ElevenLabs model ID
 * @returns {ModelCapabilities} Model capabilities object
 */
export function getModelCapabilities(modelId: string): ModelCapabilities {
  return MODEL_CAPS[modelId] || MODEL_CAPS['eleven_multilingual_v2']; // Default fallback
}

/**
 * Sanitizes text for a specific model, removing unsupported SSML features
 * @param {string} text - Input text with potential SSML
 * @param {string} modelId - ElevenLabs model ID
 * @returns {string} Sanitized text compatible with the model
 */
export function sanitizeForModel(text: string, modelId: string): string {
  const caps = getModelCapabilities(modelId);
  let sanitized = text;

  if (!caps.supportsSSML) {
    // Strip all SSML tags if model doesn't support SSML
    sanitized = sanitized.replace(/<[^>]+>/g, '');
    return sanitized.replace(/\s+/g, ' ').trim();
  }

  // Remove prosody tags if not supported
  if (!caps.supportsProsody) {
    sanitized = sanitized.replace(/<prosody[^>]*>(.*?)<\/prosody>/g, '$1');
  }

  // Remove emphasis tags if not supported
  if (!caps.supportsEmphasis) {
    sanitized = sanitized.replace(/<emphasis[^>]*>(.*?)<\/emphasis>/g, '$1');
  }

  // Handle break tags
  if (caps.supportsBreaks) {
    // Clamp break times to model maximum
    sanitized = sanitized.replace(/<break\s+time="(\d+(?:\.\d+)?)s?"[^>]*\/>/g, (match, timeStr) => {
      const timeMs = parseFloat(timeStr) * (timeStr.includes('.') ? 1000 : 1);
      const clampedMs = Math.min(timeMs, caps.maxBreakTime);
      const clampedSeconds = (clampedMs / 1000).toFixed(clampedMs % 1000 === 0 ? 0 : 1);
      return `<break time="${clampedSeconds}s"/>`;
    });

    // Handle legacy pause macros and convert to breaks
    sanitized = sanitized.replace(/<pause:(\d+)>/g, (match, ms) => {
      const clampedMs = Math.min(parseInt(ms), caps.maxBreakTime);
      const seconds = (clampedMs / 1000).toFixed(clampedMs % 1000 === 0 ? 0 : 1);
      return `<break time="${seconds}s"/>`;
    });
  } else {
    // Remove all break tags if not supported
    sanitized = sanitized.replace(/<break[^>]*\/?>/g, '');
    sanitized = sanitized.replace(/<pause:\d+>/g, '');
  }

  // Apply two-space rule before breaks at line ends
  sanitized = sanitized.replace(/\s*<break[^>]*\/>\s*$/gm, '  <break time="0.4s"/>');

  // Clean up extra whitespace
  sanitized = sanitized.replace(/\s+/g, ' ').trim();

  // Ensure proper SSML wrapping if using SSML
  if (caps.supportsSSML && sanitized.includes('<')) {
    if (!sanitized.startsWith('<speak>')) {
      sanitized = `<speak>${sanitized}</speak>`;
    }
  }

  return sanitized;
}

/**
 * Validates that text is compatible with a model
 * @param {string} text - Text to validate
 * @param {string} modelId - ElevenLabs model ID
 * @returns {string[]} Array of validation warnings
 */
export function validateTextForModel(text: string, modelId: string): string[] {
  const caps = getModelCapabilities(modelId);
  const warnings: string[] = [];

  if (!caps.supportsSSML && /<[^>]+>/.test(text)) {
    warnings.push(`Model ${caps.name} does not support SSML tags`);
  }

  if (!caps.supportsProsody && /<prosody/.test(text)) {
    warnings.push(`Model ${caps.name} does not support prosody tags`);
  }

  if (!caps.supportsEmphasis && /<emphasis/.test(text)) {
    warnings.push(`Model ${caps.name} does not support emphasis tags`);
  }

  // Check break times
  const breakMatches = text.match(/<break\s+time="(\d+(?:\.\d+)?)s?"[^>]*\/?>/g);
  if (breakMatches) {
    for (const match of breakMatches) {
      const timeMatch = match.match(/time="(\d+(?:\.\d+)?)s?"/);
      if (timeMatch) {
        const timeMs = parseFloat(timeMatch[1]) * (timeMatch[1].includes('.') ? 1000 : 1);
        if (timeMs > caps.maxBreakTime) {
          warnings.push(`Break time ${timeMs}ms exceeds model maximum of ${caps.maxBreakTime}ms`);
        }
      }
    }
  }

  return warnings;
}

/**
 * Gets recommended voice settings for a model
 * @param {string} modelId - ElevenLabs model ID
 * @returns {object} Recommended voice settings
 */
export function getRecommendedSettings(modelId: string) {
  const caps = getModelCapabilities(modelId);
  return caps.recommendedSettings;
}

/**
 * Checks if a model supports WebSocket streaming
 * @param {string} modelId - ElevenLabs model ID
 * @returns {boolean} True if model supports WebSocket
 */
export function supportsWebSocket(modelId: string): boolean {
  const caps = getModelCapabilities(modelId);
  return caps.supportsWebSocket;
}

/**
 * Checks if a model supports ElevenLabs v3 audio tags
 * @param {string} modelId - ElevenLabs model ID
 * @returns {boolean} True if model supports audio tags
 */
export function supportsAudioTags(modelId: string): boolean {
  const caps = getModelCapabilities(modelId);
  return caps.supportsAudioTags === true;
}

/**
 * Gets v3 stability mode recommendations - v3 API only accepts discrete values
 * @param {'creative' | 'natural' | 'robust'} mode - Stability mode
 * @returns {number} ElevenLabs v3 discrete stability value
 */
export function getV3StabilityValue(mode: 'creative' | 'natural' | 'robust'): number {
  const stabilityModes = {
    creative: 0.0,  // Creative mode - maximum emotional expressiveness
    natural: 0.5,   // Natural mode - balanced expressiveness and consistency  
    robust: 1.0,    // Robust mode - maximum stability and consistency
  };
  return stabilityModes[mode];
}

/**
 * Checks if model is ElevenLabs v3 or v3 preview
 * @param {string} modelId - ElevenLabs model ID
 * @returns {boolean} True if model is v3 variant
 */
export function isV3Model(modelId: string): boolean {
  return modelId === 'eleven_v3' || modelId.startsWith('eleven_v3_preview');
}

/**
 * Validates v3-specific configuration and provides recommendations
 * @param {string} modelId - ElevenLabs model ID
 * @param {object} voiceSettings - Voice settings to validate
 * @returns {object} Validation result with warnings and recommendations
 */
export function validateV3Configuration(
  modelId: string, 
  voiceSettings: Record<string, unknown>
): {
  isValid: boolean;
  warnings: string[];
  recommendations: string[];
  optimizations: Record<string, unknown>;
} {
  const warnings: string[] = [];
  const recommendations: string[] = [];
  const optimizations: Record<string, unknown> = {};
  
  if (!isV3Model(modelId)) {
    return { 
      isValid: true, 
      warnings: ['Not a v3 model - v3 validations skipped'], 
      recommendations: [], 
      optimizations: {} 
    };
  }

  // Validate stability setting for v3 - must be discrete values
  const stability = voiceSettings.stability as number;
  if (stability !== undefined) {
    const validValues = [0.0, 0.5, 1.0];
    if (!validValues.includes(stability)) {
      warnings.push(`Invalid v3 stability value: ${stability}. Must be one of: 0.0, 0.5, 1.0`);
      recommendations.push('Use discrete values: 0.0 (Creative), 0.5 (Natural), 1.0 (Robust)');
      optimizations.stability = 0.0; // Default to Creative mode
    } else {
      const modeNames = { 0.0: 'Creative', 0.5: 'Natural', 1.0: 'Robust' };
      recommendations.push(`Stability ${stability} (${modeNames[stability]} mode) is valid for v3`);
    }
  }

  // Validate similarity_boost for v3
  const similarityBoost = voiceSettings.similarity_boost as number;
  if (similarityBoost !== undefined && similarityBoost < 0.8) {
    warnings.push('Low similarity_boost (<0.8) may affect voice consistency in v3');
    recommendations.push('Use similarity_boost 0.85+ for better voice fidelity');
    optimizations.similarity_boost = 0.85;
  }

  // Check style setting (should be 0.0 for v3)
  const style = voiceSettings.style as number;
  if (style !== undefined && style !== 0.0) {
    warnings.push('Style parameter is not used in v3 - stability controls behavior instead');
    recommendations.push('Set style to 0.0 and use stability for voice control');
    optimizations.style = 0.0;
  }

  const isValid = warnings.length === 0;
  return { isValid, warnings, recommendations, optimizations };
}

/**
 * Gets optimal v3 settings based on use case
 * @param {'emotional' | 'stable' | 'balanced'} useCase - Intended use case
 * @returns {object} Optimized settings for v3
 */
export function getV3OptimalSettings(useCase: 'emotional' | 'stable' | 'balanced'): {
  stability: number;
  similarity_boost: number;
  style: number;
  speaker_boost: boolean;
  mode_description: string;
} {
  const settingsMap = {
    emotional: {
      stability: 0.0, // Creative mode - ElevenLabs v3 discrete value
      similarity_boost: 0.85,
      style: 0.0,
      speaker_boost: true,
      mode_description: 'Creative mode (0.0) - maximum emotional expressiveness'
    },
    balanced: {
      stability: 0.5, // Natural mode - ElevenLabs v3 discrete value
      similarity_boost: 0.85,
      style: 0.0,
      speaker_boost: true,
      mode_description: 'Natural mode (0.5) - balanced expressiveness and consistency'
    },
    stable: {
      stability: 1.0, // Robust mode - ElevenLabs v3 discrete value
      similarity_boost: 0.9,
      style: 0.0,
      speaker_boost: true,
      mode_description: 'Robust mode (1.0) - maximum consistency and stability'
    }
  };

  return settingsMap[useCase];
}
