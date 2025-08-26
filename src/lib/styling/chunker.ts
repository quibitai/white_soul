/**
 * Text chunker for Angela voice styling
 * Splits processed text into optimal chunks for TTS synthesis,
 * ensuring proper sentence boundaries and target duration limits.
 */

import { VoiceConfig } from './config';
import { estimateDuration } from './macros';
import { getSSMLContentLength } from './ssml';

export interface TextChunk {
  id: number;
  body: string;
  estSeconds: number;
  charCount: number;
}

/**
 * Splits text into chunks optimized for TTS synthesis
 * @param {string} processedText - Text with macros applied
 * @param {VoiceConfig} config - Voice configuration with chunking rules
 * @returns {TextChunk[]} Array of text chunks ready for synthesis
 */
export function chunk(processedText: string, config: VoiceConfig): TextChunk[] {
  if (!processedText?.trim()) {
    return [];
  }

  const chunks: TextChunk[] = [];
  const sentences = segmentSentences(processedText);
  
  if (sentences.length === 0) {
    return [];
  }

  let currentChunk = '';
  let chunkId = 0;

  for (let i = 0; i < sentences.length; i++) {
    const sentence = sentences[i];
    const testChunk = currentChunk + (currentChunk ? ' ' : '') + sentence;
    
    const testDuration = estimateDuration(testChunk, config);
    const testCharCount = config.emphasis.use_ssml ? 
      getSSMLContentLength(testChunk) : 
      testChunk.replace(/<[^>]+>/g, '').length;

    // Check if adding this sentence would exceed limits
    const exceedsTime = testDuration > config.chunking.target_seconds;
    const exceedsChars = testCharCount > config.chunking.max_chars;
    
    if ((exceedsTime || exceedsChars) && currentChunk) {
      // Finalize current chunk
      const finalChunk = finalizeChunk(currentChunk, config);
      chunks.push({
        id: chunkId++,
        body: finalChunk,
        estSeconds: estimateDuration(finalChunk, config),
        charCount: config.emphasis.use_ssml ? 
          getSSMLContentLength(finalChunk) : 
          finalChunk.replace(/<[^>]+>/g, '').length,
      });
      
      currentChunk = sentence;
    } else {
      currentChunk = testChunk;
    }
  }

  // Add the final chunk if there's remaining content
  if (currentChunk.trim()) {
    const finalChunk = finalizeChunk(currentChunk, config);
    chunks.push({
      id: chunkId,
      body: finalChunk,
      estSeconds: estimateDuration(finalChunk, config),
      charCount: config.emphasis.use_ssml ? 
        getSSMLContentLength(finalChunk) : 
        finalChunk.replace(/<[^>]+>/g, '').length,
    });
  }

  return chunks;
}

/**
 * Segments text into sentences while preserving macro boundaries
 * @param {string} text - Text to segment
 * @returns {string[]} Array of sentences
 */
function segmentSentences(text: string): string[] {
  // Split on sentence-ending punctuation, but preserve the punctuation
  const sentences: string[] = [];
  let current = '';
  let inMacro = false;
  
  for (let i = 0; i < text.length; i++) {
    const char = text[i];
    const nextChar = text[i + 1];
    
    // Track if we're inside a macro tag
    if (char === '<') {
      inMacro = true;
    } else if (char === '>') {
      inMacro = false;
    }
    
    current += char;
    
    // Check for sentence endings (but not inside macros)
    if (!inMacro && /[.!?]/.test(char)) {
      // Look ahead to see if this is really a sentence end
      const remaining = text.slice(i + 1);
      const nextNonSpace = remaining.match(/^\\s*(.)/)?.[1];
      
      // End sentence if:
      // - Next character is uppercase letter or end of text
      // - Next character starts a new paragraph
      // - We're at the end of the text
      if (!nextNonSpace || 
          /[A-Z]/.test(nextNonSpace) || 
          remaining.startsWith('\\n') ||
          i === text.length - 1) {
        
        sentences.push(current.trim());
        current = '';
      }
    }
  }
  
  // Add any remaining content as the final sentence
  if (current.trim()) {
    sentences.push(current.trim());
  }
  
  return sentences.filter(s => s.length > 0);
}

/**
 * Finalizes a chunk by adding guardrail pauses if configured
 * @param {string} chunk - Raw chunk text
 * @param {VoiceConfig} config - Configuration with guardrail settings
 * @returns {string} Finalized chunk with guardrails applied
 */
function finalizeChunk(chunk: string, config: VoiceConfig): string {
  let finalized = chunk.trim();
  
  if (!finalized) {
    return '';
  }

  // Add micro pause at start if configured
  if (config.chunking.guardrails.start_with_micro_pause) {
    const microPause = `<pause:${config.pacing.pauses.micro}>`;
    if (!finalized.startsWith('<pause:')) {
      finalized = microPause + ' ' + finalized;
    }
  }

  // Add short pause at end if configured
  if (config.chunking.guardrails.end_with_short_pause) {
    const shortPause = `<pause:${config.pacing.pauses.short}>`;
    if (!finalized.endsWith('>')) {
      finalized = finalized + ' ' + shortPause;
    }
  }

  return finalized;
}

/**
 * Validates that chunks meet the specified constraints
 * @param {TextChunk[]} chunks - Chunks to validate
 * @param {VoiceConfig} config - Configuration with limits
 * @returns {string[]} Array of validation warnings
 */
export function validateChunks(chunks: TextChunk[], config: VoiceConfig): string[] {
  const warnings: string[] = [];
  
  for (const chunk of chunks) {
    // Check duration limits
    if (chunk.estSeconds > config.chunking.target_seconds * 1.5) {
      warnings.push(`Chunk ${chunk.id} exceeds target duration: ${chunk.estSeconds}s (target: ${config.chunking.target_seconds}s)`);
    }
    
    // Check character limits
    if (chunk.charCount > config.chunking.max_chars) {
      warnings.push(`Chunk ${chunk.id} exceeds character limit: ${chunk.charCount} chars (max: ${config.chunking.max_chars})`);
    }
    
    // Check for empty chunks
    if (chunk.charCount === 0) {
      warnings.push(`Chunk ${chunk.id} is empty`);
    }
    
    // Check for extremely short chunks (might indicate segmentation issues)
    if (chunk.charCount < 10 && chunks.length > 1) {
      warnings.push(`Chunk ${chunk.id} is very short: ${chunk.charCount} chars`);
    }
  }
  
  return warnings;
}

/**
 * Calculates total estimated duration for all chunks
 * @param {TextChunk[]} chunks - Chunks to calculate duration for
 * @returns {number} Total estimated duration in seconds
 */
export function getTotalDuration(chunks: TextChunk[]): number {
  return chunks.reduce((total, chunk) => total + chunk.estSeconds, 0);
}

/**
 * Gets statistics about the chunking results
 * @param {TextChunk[]} chunks - Chunks to analyze
 * @returns {object} Statistics object
 */
export function getChunkingStats(chunks: TextChunk[]) {
  if (chunks.length === 0) {
    return {
      totalChunks: 0,
      totalDuration: 0,
      totalChars: 0,
      avgDuration: 0,
      avgChars: 0,
      maxDuration: 0,
      maxChars: 0,
    };
  }

  const durations = chunks.map(c => c.estSeconds);
  const charCounts = chunks.map(c => c.charCount);

  return {
    totalChunks: chunks.length,
    totalDuration: getTotalDuration(chunks),
    totalChars: charCounts.reduce((sum, count) => sum + count, 0),
    avgDuration: durations.reduce((sum, dur) => sum + dur, 0) / chunks.length,
    avgChars: charCounts.reduce((sum, count) => sum + count, 0) / chunks.length,
    maxDuration: Math.max(...durations),
    maxChars: Math.max(...charCounts),
  };
}
