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
    name: 'Eleven V3 (Alpha)',
    supportsSSML: true,
    supportsProsody: false, // Use audio tags instead
    supportsBreaks: true,
    maxBreakTime: 2200,
    supportsEmphasis: false, // Use audio tags instead
    supportsPronunciationDictionaries: true,
    maxDictionaries: 3,
    supportsWebSocket: false, // v3 is not for real-time applications
    recommendedSettings: {
      stability: 0.5,
      similarity_boost: 0.8,
      style: 0.0, // v3 uses different stability modes
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
