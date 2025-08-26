/**
 * TTS library exports for White Soul Tarot
 */

export {
  ttsChunk,
  synthesizeChunks,
  concatAudioBuffers,
  validateElevenLabsConfig,
  getAvailableVoices,
  type TTSOptions,
  type TTSResponse,
} from './elevenlabs';

export {
  getModelCapabilities,
  sanitizeForModel,
  validateTextForModel,
  getRecommendedSettings,
  supportsWebSocket,
  type ModelCapabilities,
  MODEL_CAPS,
} from './model-caps';

export {
  getAvailableDictionaries,
  getDictionary,
  selectDictionaries,
  toElevenLabsFormat,
  applyPronunciationHints,
  validateDictionary,
  createCustomDictionary,
  getPronunciationStats,
  type PronunciationDictionary,
  type PronunciationRule,
} from './pronunciation';
