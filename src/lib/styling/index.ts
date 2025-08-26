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
