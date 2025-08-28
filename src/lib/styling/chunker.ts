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

  console.log('✂️ Chunking with config:', {
    target_seconds: config.chunking.target_seconds,
    max_chars: config.chunking.max_chars,
    min_chars: config.chunking.min_chars
  });

  const chunks: TextChunk[] = [];
  
  // NEW: Use paragraph-based chunking for more natural segments
  const naturalSegments = segmentNaturally(processedText);
  console.log(`📝 Created ${naturalSegments.length} natural segments (avg: ${Math.round(naturalSegments.reduce((sum, s) => sum + s.length, 0) / naturalSegments.length)} chars each)`);
  
  if (naturalSegments.length === 0) {
    return [];
  }

  let currentChunk = '';
  let chunkId = 0;

  for (let i = 0; i < naturalSegments.length; i++) {
    const segment = naturalSegments[i];
    const testChunk = currentChunk + (currentChunk ? '\n\n' : '') + segment;
    
    const testDuration = estimateDuration(testChunk, config);
    const testCharCount = config.emphasis.use_ssml ? 
      getSSMLContentLength(testChunk) : 
      testChunk.replace(/<[^>]+>/g, '').length;

    // Check if adding this segment would exceed limits
    const exceedsTime = testDuration > config.chunking.target_seconds;
    const exceedsChars = testCharCount > config.chunking.max_chars;
    
    // Only create chunk if we exceed limits AND current chunk meets minimum
    const meetsMinimum = !config.chunking.min_chars || 
      (config.emphasis.use_ssml ? 
        getSSMLContentLength(currentChunk) : 
        currentChunk.replace(/<[^>]+>/g, '').length) >= config.chunking.min_chars;
    
    if ((exceedsTime || exceedsChars) && currentChunk && meetsMinimum) {
      // Finalize current chunk
      const finalChunk = finalizeChunk(currentChunk, config);
      const finalCharCount = config.emphasis.use_ssml ? 
        getSSMLContentLength(finalChunk) : 
        finalChunk.replace(/<[^>]+>/g, '').length;
      
      console.log(`📦 Chunk ${chunkId}: ${finalCharCount} chars, ~${estimateDuration(finalChunk, config)}s`);
      
      chunks.push({
        id: chunkId++,
        body: finalChunk,
        estSeconds: estimateDuration(finalChunk, config),
        charCount: finalCharCount,
      });
      
      currentChunk = segment;
    } else {
      currentChunk = testChunk;
    }
  }

  // Add the final chunk if there's remaining content
  if (currentChunk.trim()) {
    const finalChunk = finalizeChunk(currentChunk, config);
    const finalCharCount = config.emphasis.use_ssml ? 
      getSSMLContentLength(finalChunk) : 
      finalChunk.replace(/<[^>]+>/g, '').length;
    
    console.log(`📦 Final chunk ${chunkId}: ${finalCharCount} chars, ~${estimateDuration(finalChunk, config)}s`);
    
    chunks.push({
      id: chunkId,
      body: finalChunk,
      estSeconds: estimateDuration(finalChunk, config),
      charCount: finalCharCount,
    });
  }

  return chunks;
}

/**
 * Segments text into natural speaking segments (groups of related sentences)
 * @param {string} text - Text to segment
 * @returns {string[]} Array of natural speaking segments
 */
function segmentNaturally(text: string): string[] {
  // First, get individual sentences
  const sentences = segmentSentences(text);
  
  if (sentences.length === 0) return [];
  
  const naturalSegments: string[] = [];
  let currentSegment: string[] = [];
  
  for (let i = 0; i < sentences.length; i++) {
    const sentence = sentences[i].trim();
    if (!sentence) continue;
    
    currentSegment.push(sentence);
    
    // Determine if this is a natural break point
    const shouldBreak = isNaturalBreakPoint(sentence, sentences[i + 1], i, sentences.length);
    
    if (shouldBreak && currentSegment.length > 0) {
      // Join sentences with natural spacing
      naturalSegments.push(currentSegment.join(' '));
      currentSegment = [];
    }
  }
  
  // Add any remaining sentences
  if (currentSegment.length > 0) {
    naturalSegments.push(currentSegment.join(' '));
  }
  
  return naturalSegments.filter(segment => segment.trim().length > 0);
}

/**
 * Determines if there should be a natural break after a sentence
 */
function isNaturalBreakPoint(currentSentence: string, nextSentence?: string, index?: number, totalSentences?: number): boolean {
  const current = currentSentence.toLowerCase();
  const next = nextSentence?.toLowerCase() || '';
  
  // Always break at paragraph boundaries
  if (currentSentence.includes('\n') || nextSentence?.includes('\n')) {
    return true;
  }
  
  // Break after transitional phrases that signal topic shifts (tarot-specific)
  const topicTransitions = [
    'now your second card',
    'your next card', 
    'and here\'s the thing',
    'but here\'s what',
    'now here\'s where',
    'here\'s the part',
    'here\'s what\'s happening', 
    'and this is where',
    'but this is the moment',
    'so august',
    'in mid-august',
    'and that feeling'
  ];
  
  for (const transition of topicTransitions) {
    if (current.includes(transition) || next.includes(transition)) {
      return true;
    }
  }
  
  // Break after emphatic conclusions
  if (current.endsWith('...') && 
      (current.includes('that\'s') || current.includes('this is') || current.includes('you see'))) {
    return true;
  }
  
  // Break before direct address or questions
  if (next.match(/^(and\s+)?(you|your|taurus|listen|here)/i)) {
    return true;
  }
  
  // Don't break short related sentences (under 100 chars each)
  if (currentSentence.length < 100 && nextSentence && nextSentence.length < 100) {
    return false;
  }
  
  // Very conservative breaking - only for clear topic shifts
  // Default: keep sentences together for larger, more natural chunks
  return false; // Removed randomness - rely only on explicit transition detection
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
      const nextNonSpace = remaining.match(/^\s*(.)/)?.[1];
      
      // End sentence if:
      // - Next character is uppercase letter or end of text
      // - Next character starts a new paragraph
      // - We're at the end of the text
      if (!nextNonSpace || 
          /[A-Z]/.test(nextNonSpace) || 
          remaining.startsWith('\n') ||
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
    const shortPause = `<pause:${config.pacing.pauses.beat}>`; // WST2: micro-beat for rhythmic control
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
