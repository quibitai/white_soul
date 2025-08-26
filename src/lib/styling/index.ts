/**
 * Main styling library for White Soul Tarot TTS application
 * Exports all text processing functions for Angela voice styling
 */

// Configuration
export { loadConfig, clearConfigCache, type VoiceConfig } from './config';

// Text processing pipeline
export { normalize, isValidNormalizedText } from './normalizer';
export { lint, autoFix, type LintReport } from './linter';
export { applyMacros, estimateDuration } from './macros';
export { toSSML, cleanMacros, extractTextFromSSML, getSSMLContentLength } from './ssml';
export { 
  chunk, 
  validateChunks, 
  getTotalDuration, 
  getChunkingStats, 
  type TextChunk 
} from './chunker';

// Conversational realism
export { applyConversationalRealism, analyzeConversationalRealism } from './conversational';

// WST2 Studio Speech Rules
export { applyWST2Rules, validateWST2Rules, analyzeWST2Compliance } from './wst2-rules';

// TTS Sanitization
export { sanitizeForTTS, analyzeTTSArtifacts } from './sanitizer';

// Audio Tags & Emotional Delivery
export { applyAudioTags, analyzeAudioTagOpportunities, validateAudioTags } from './audio-tags';

// Natural Processing for ElevenLabs v3
export { 
  processForNaturalTTS, 
  convertPausesToNatural, 
  validateNaturalText,
  type NaturalProcessingResult 
} from './natural-processor';
