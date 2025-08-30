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
  supportsAudioTags?: boolean; // Legacy v3 feature (not used in v2)
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
    supportsProsody: true, // Enable for Angela's emotional delivery
    supportsBreaks: true,
    maxBreakTime: 2200, // 2.2 seconds max
    supportsEmphasis: true, // Enable for key insights
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

  // Remove hashtag/meta artifacts first (critical fix)
  sanitized = sanitized.replace(/\bhashtag\s+\w+\b/gi, '');
  sanitized = sanitized.replace(/\#\w+/g, '');
  sanitized = sanitized.replace(/\bmeta\b(?!\s+\w)/gi, '');

  // Remove prosody tags if not supported
  if (!caps.supportsProsody) {
    sanitized = sanitized.replace(/<prosody[^>]*>(.*?)<\/prosody>/g, '$1');
  }

  // Remove emphasis tags if not supported (all variants)
  if (!caps.supportsEmphasis) {
    sanitized = sanitized.replace(/<emphasis[^>]*>(.*?)<\/emphasis>/g, '$1');
    sanitized = sanitized.replace(/<emphasis:[^>]*>([^<]*)<\/emphasis>/g, '$1');
  }
  
  // Remove rate tags (not needed for v2 SSML)
  sanitized = sanitized.replace(/<rate:[^>]*>([^<]*)<\/rate>/g, '$1');

  // Handle break tags
  if (caps.supportsBreaks) {
    // Clamp break times to model maximum
    sanitized = sanitized.replace(/<break\s+time="(\d+(?:\.\d+)?)s?"[^>]*\/>/g, (match, timeStr) => {
      const timeMs = parseFloat(timeStr) * (timeStr.includes('.') ? 1000 : 1);
      const clampedMs = Math.min(timeMs, caps.maxBreakTime);
      const clampedSeconds = (clampedMs / 1000).toFixed(clampedMs % 1000 === 0 ? 0 : 1);
      return `<break time="${clampedSeconds}s"/>`;
    });

    // Handle legacy pause macros and convert to breaks (multiple formats)
    sanitized = sanitized.replace(/<pause:(\d+)>/g, (match, ms) => {
      const clampedMs = Math.min(parseInt(ms), caps.maxBreakTime);
      const seconds = (clampedMs / 1000).toFixed(clampedMs % 1000 === 0 ? 0 : 1);
      return `<break time="${seconds}s"/>`;
    });
    
    // Handle comma-separated pause format <pause,1200>
    sanitized = sanitized.replace(/<pause,(\d+)>/g, (match, ms) => {
      const clampedMs = Math.min(parseInt(ms), caps.maxBreakTime);
      const seconds = (clampedMs / 1000).toFixed(clampedMs % 1000 === 0 ? 0 : 1);
      return `<break time="${seconds}s"/>`;
    });
  } else {
    // Remove all break tags if not supported
    sanitized = sanitized.replace(/<break[^>]*\/?>/g, '');
    sanitized = sanitized.replace(/<pause:\d+>/g, '');
    sanitized = sanitized.replace(/<pause,\d+>/g, ''); // Remove comma format too
  }

  // Apply two-space rule before breaks at line ends
  sanitized = sanitized.replace(/\s*<break[^>]*\/>\s*$/gm, '  <break time="0.4s"/>');

  // Clean up extra whitespace
  sanitized = sanitized.replace(/\s+/g, ' ').trim();
  
  // Final cleanup: remove any remaining unrecognized tags (except audio tags)
  sanitized = sanitized.replace(/<(?!\/?(speak|break|prosody)\b)[^>]*>/g, '');
  sanitized = sanitized.replace(/<\/(?!speak|prosody)\w+>/g, ''); // Remove closing tags
  
  // Remove any lingering artifacts
  sanitized = sanitized.replace(/\bhashtag\s+\w+\b/gi, '');
  sanitized = sanitized.replace(/\bmeta\b(?!\s+\w)/gi, '');

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


