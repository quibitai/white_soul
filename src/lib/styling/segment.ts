/**
 * Enhanced text segmentation for dev_plan_02 architecture
 * Implements semantic chunking with overlap and context for optimal synthesis
 */

import { TuningSettings } from '@/lib/types/tuning';
import { generateChunkHash } from '@/lib/utils/hash';

/**
 * Chunk definition for synthesis pipeline
 */
export interface SemanticChunk {
  /** Chunk index in sequence */
  ix: number;
  /** Plain text content */
  text: string;
  /** SSML content for synthesis */
  ssml: string;
  /** Content hash for caching */
  hash: string;
  /** Blob storage path */
  blob: string;
  /** Estimated duration in seconds */
  estSeconds: number;
  /** Character count (SSML content) */
  charCount: number;
  /** Context information for continuity */
  context: {
    /** Previous chunk text for continuity */
    previousText?: string;
    /** Next chunk text for continuity */
    nextText?: string;
    /** Sentence boundaries within chunk */
    sentences: Array<{
      start: number;
      end: number;
      text: string;
    }>;
  };
}

/**
 * Chunking result with metadata
 */
export interface ChunkingResult {
  /** Generated chunks */
  chunks: SemanticChunk[];
  /** Chunking statistics */
  stats: {
    totalChunks: number;
    avgChunkSize: number;
    totalDuration: number;
    overlapRatio: number;
  };
  /** Warnings about chunking quality */
  warnings: string[];
}

/**
 * Create semantic chunks with overlap and context
 * @param ssmlContent - SSML content to chunk
 * @param settings - Tuning settings for chunking
 * @returns Chunking result with enhanced chunks
 */
export function makeChunks(
  ssmlContent: string,
  settings: TuningSettings
): ChunkingResult {
  // Extract plain text for analysis
  const plainText = extractTextFromSSML(ssmlContent);
  
  // Segment into sentences for boundary detection
  const sentences = segmentIntoSentences(ssmlContent);
  
  if (sentences.length === 0) {
    return {
      chunks: [],
      stats: { totalChunks: 0, avgChunkSize: 0, totalDuration: 0, overlapRatio: 0 },
      warnings: ['No sentences found in content'],
    };
  }
  
  // Create chunks with semantic boundaries
  const chunks = createSemanticChunks(sentences, settings);
  
  // Add overlap and context
  const enhancedChunks = addOverlapAndContext(chunks, settings);
  
  // Generate final chunk objects with hashes
  const finalChunks = enhancedChunks.map((chunk, ix) => {
    const hash = generateChunkHash(chunk.ssml, settings.eleven);
    return {
      ...chunk,
      ix,
      hash,
      blob: `chunks/${ix}-${hash}.wav`,
    };
  });
  
  // Calculate statistics
  const stats = calculateChunkingStats(finalChunks);
  
  // Validate and generate warnings
  const warnings = validateChunking(finalChunks, settings);
  
  return {
    chunks: finalChunks,
    stats,
    warnings,
  };
}

/**
 * Extract plain text from SSML content
 */
function extractTextFromSSML(ssmlContent: string): string {
  return ssmlContent
    .replace(/<[^>]+>/g, '') // Remove SSML tags
    .replace(/\s+/g, ' ') // Normalize whitespace
    .trim();
}

/**
 * Segment SSML content into sentences while preserving tags
 */
function segmentIntoSentences(ssmlContent: string): Array<{
  ssml: string;
  text: string;
  start: number;
  end: number;
}> {
  const sentences: Array<{
    ssml: string;
    text: string;
    start: number;
    end: number;
  }> = [];
  
  // Use regex to find sentence boundaries while preserving SSML
  const sentencePattern = /([^.!?]*[.!?]+(?:\s*<[^>]+>\s*)*)/g;
  let match;
  let lastIndex = 0;
  
  while ((match = sentencePattern.exec(ssmlContent)) !== null) {
    const ssmlSentence = match[1].trim();
    if (ssmlSentence) {
      const textSentence = extractTextFromSSML(ssmlSentence);
      sentences.push({
        ssml: ssmlSentence,
        text: textSentence,
        start: match.index,
        end: match.index + match[1].length,
      });
      lastIndex = match.index + match[1].length;
    }
  }
  
  // Handle any remaining content
  if (lastIndex < ssmlContent.length) {
    const remaining = ssmlContent.slice(lastIndex).trim();
    if (remaining) {
      sentences.push({
        ssml: remaining,
        text: extractTextFromSSML(remaining),
        start: lastIndex,
        end: ssmlContent.length,
      });
    }
  }
  
  return sentences;
}

/**
 * Create semantic chunks respecting sentence boundaries
 */
function createSemanticChunks(
  sentences: Array<{ ssml: string; text: string; start: number; end: number }>,
  settings: TuningSettings
): Array<{
  ssml: string;
  text: string;
  estSeconds: number;
  charCount: number;
  context: {
    sentences: Array<{
      start: number;
      end: number;
      text: string;
    }>;
  };
}> {
  const chunks: Array<{
    ssml: string;
    text: string;
    estSeconds: number;
    charCount: number;
    context: {
      sentences: Array<{
        start: number;
        end: number;
        text: string;
      }>;
    };
  }> = [];
  
  let currentChunk = {
    ssmlParts: [] as string[],
    textParts: [] as string[],
    sentences: [] as Array<{ start: number; end: number; text: string }>,
    duration: 0,
    charCount: 0,
  };
  
  const targetSeconds = settings.chunking.maxSec;
  const baseWPM = 145; // Angela's base WPM
  const adjustedWPM = baseWPM * (settings.ssml.defaultRate || 1.0);
  
  for (let i = 0; i < sentences.length; i++) {
    const sentence = sentences[i];
    const sentenceDuration = estimateSentenceDuration(sentence.text, adjustedWPM);
    const sentenceCharCount = sentence.text.length;
    
    // Check if adding this sentence would exceed limits
    const wouldExceedTime = currentChunk.duration + sentenceDuration > targetSeconds;
    const wouldExceedChars = currentChunk.charCount + sentenceCharCount > 1800; // Max chars per chunk
    
    // If we would exceed limits and have content, finalize current chunk
    if ((wouldExceedTime || wouldExceedChars) && currentChunk.ssmlParts.length > 0) {
      chunks.push({
        ssml: currentChunk.ssmlParts.join(' '),
        text: currentChunk.textParts.join(' '),
        estSeconds: Math.round(currentChunk.duration * 10) / 10,
        charCount: currentChunk.charCount,
        context: {
          sentences: [...currentChunk.sentences],
        },
      });
      
      // Reset for next chunk
      currentChunk = {
        ssmlParts: [],
        textParts: [],
        sentences: [],
        duration: 0,
        charCount: 0,
      };
    }
    
    // Add sentence to current chunk
    currentChunk.ssmlParts.push(sentence.ssml);
    currentChunk.textParts.push(sentence.text);
    currentChunk.sentences.push({
      start: sentence.start,
      end: sentence.end,
      text: sentence.text,
    });
    currentChunk.duration += sentenceDuration;
    currentChunk.charCount += sentenceCharCount;
  }
  
  // Add final chunk if there's remaining content
  if (currentChunk.ssmlParts.length > 0) {
    chunks.push({
      ssml: currentChunk.ssmlParts.join(' '),
      text: currentChunk.textParts.join(' '),
      estSeconds: Math.round(currentChunk.duration * 10) / 10,
      charCount: currentChunk.charCount,
      context: {
        sentences: [...currentChunk.sentences],
      },
    });
  }
  
  return chunks;
}

/**
 * Add overlap and context between chunks for seamless synthesis
 */
function addOverlapAndContext(
  chunks: Array<{
    ssml: string;
    text: string;
    estSeconds: number;
    charCount: number;
    context: {
      sentences: Array<{
        start: number;
        end: number;
        text: string;
      }>;
    };
  }>,
  settings: TuningSettings
): Array<{
  ssml: string;
  text: string;
  estSeconds: number;
  charCount: number;
  context: {
    previousText?: string;
    nextText?: string;
    sentences: Array<{
      start: number;
      end: number;
      text: string;
    }>;
  };
}> {
  const overlapMs = settings.chunking.overlapMs;
  const contextSentences = settings.chunking.contextSentences;
  
  return chunks.map((chunk, index) => {
    // Calculate context text for continuity
    let previousText: string | undefined;
    let nextText: string | undefined;
    
    // Add previous context
    if (index > 0 && contextSentences > 0) {
      const prevChunk = chunks[index - 1];
      const prevSentences = prevChunk.context.sentences.slice(-contextSentences);
      previousText = prevSentences.map(s => s.text).join(' ');
    }
    
    // Add next context
    if (index < chunks.length - 1 && contextSentences > 0) {
      const nextChunk = chunks[index + 1];
      const nextSentences = nextChunk.context.sentences.slice(0, contextSentences);
      nextText = nextSentences.map(s => s.text).join(' ');
    }
    
    // Add crossfade padding if overlap is configured
    let enhancedSSML = chunk.ssml;
    if (overlapMs > 0) {
      // Add slight pause at beginning (except first chunk)
      if (index > 0) {
        enhancedSSML = `<break time="${overlapMs / 2}ms"/> ${enhancedSSML}`;
      }
      
      // Add slight pause at end (except last chunk)
      if (index < chunks.length - 1) {
        enhancedSSML = `${enhancedSSML} <break time="${overlapMs / 2}ms"/>`;
      }
    }
    
    return {
      ...chunk,
      ssml: enhancedSSML,
      context: {
        ...chunk.context,
        previousText,
        nextText,
      },
    };
  });
}

/**
 * Estimate duration of a sentence in seconds
 */
function estimateSentenceDuration(text: string, wpm: number): number {
  const words = text.split(/\s+/).filter(word => word.length > 0).length;
  return words / (wpm / 60);
}

/**
 * Calculate statistics about the chunking result
 */
function calculateChunkingStats(chunks: SemanticChunk[]): {
  totalChunks: number;
  avgChunkSize: number;
  totalDuration: number;
  overlapRatio: number;
} {
  if (chunks.length === 0) {
    return {
      totalChunks: 0,
      avgChunkSize: 0,
      totalDuration: 0,
      overlapRatio: 0,
    };
  }
  
  const totalChars = chunks.reduce((sum, chunk) => sum + chunk.charCount, 0);
  const totalDuration = chunks.reduce((sum, chunk) => sum + chunk.estSeconds, 0);
  
  // Calculate overlap ratio (how much context is shared between chunks)
  let overlapChars = 0;
  for (let i = 1; i < chunks.length; i++) {
    const prevText = chunks[i].context.previousText || '';
    const nextText = chunks[i - 1].context.nextText || '';
    overlapChars += Math.min(prevText.length, nextText.length);
  }
  
  const overlapRatio = totalChars > 0 ? overlapChars / totalChars : 0;
  
  return {
    totalChunks: chunks.length,
    avgChunkSize: Math.round(totalChars / chunks.length),
    totalDuration: Math.round(totalDuration * 10) / 10,
    overlapRatio: Math.round(overlapRatio * 100) / 100,
  };
}

/**
 * Validate chunking quality and generate warnings
 */
function validateChunking(
  chunks: SemanticChunk[],
  settings: TuningSettings
): string[] {
  const warnings: string[] = [];
  
  for (const chunk of chunks) {
    // Check duration limits
    if (chunk.estSeconds > settings.chunking.maxSec * 1.2) {
      warnings.push(`Chunk ${chunk.ix} exceeds target duration: ${chunk.estSeconds}s`);
    }
    
    // Check for very short chunks (might indicate segmentation issues)
    if (chunk.estSeconds < 5 && chunks.length > 1) {
      warnings.push(`Chunk ${chunk.ix} is very short: ${chunk.estSeconds}s`);
    }
    
    // Check for empty chunks
    if (chunk.charCount === 0) {
      warnings.push(`Chunk ${chunk.ix} is empty`);
    }
    
    // Check sentence boundaries
    if (chunk.context.sentences.length === 0) {
      warnings.push(`Chunk ${chunk.ix} has no sentence boundaries`);
    }
  }
  
  // Check overall chunking quality
  if (chunks.length > 20) {
    warnings.push(`High chunk count (${chunks.length}) - consider longer target duration`);
  }
  
  return warnings;
}
