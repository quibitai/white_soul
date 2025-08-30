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

export {
  generateSoundEffect,
  processSoundEffects,
  extractSoundEffectRequests,
  mixAudioWithEffects,
  analyzeSoundEffectOpportunities,
  validateSoundEffectConfig,
  type SoundEffectOptions,
  type SoundEffectResult,
  type ProcessedSoundEffects,
  type SoundEffectAnalysis,
} from './sound-effects';

export {
  selectOptimalModel,
  getModelCharacteristics,
  validateModelFeatures,
  getModelOptimizedSettings,
  analyzeAndRecommendModel,
  type UseCase,
  type ModelCharacteristics,
  type ModelRecommendation,
  ELEVENLABS_MODELS,
} from './model-selection';

export {
  createStreamingTTS,
  splitTextForStreaming,
  type StreamingOptions,
  type StreamingResponse,
} from './websocket';
