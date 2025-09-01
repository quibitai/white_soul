/**
 * SSML annotation and diagnostics for TTS processing
 * Handles text normalization, SSML generation, and quality analysis
 */

import { TuningSettings } from '@/lib/types/tuning';
import { normalize } from './normalizer';
import { applyMacros } from './macros';
import { toSSML } from './ssml';
import { applyConversationalRealism } from './conversational';
import { loadConfig } from './config';

/**
 * Diagnostic information about SSML processing
 */
export interface SSMLDiagnostics {
  /** Words per minute estimate */
  wpm: number;
  /** SSML tag density per 10 words */
  tagDensityPer10Words: number;
  /** Break timing analysis */
  breaksHistogramMs: {
    comma: number;
    clause: number;
    sentence: number;
    paragraph: number;
  };
  /** Estimated duration in seconds */
  estimatedDurationSec: number;
  /** Text statistics */
  textStats: {
    words: number;
    sentences: number;
    paragraphs: number;
    characters: number;
  };
  /** SSML tag analysis */
  tagStats: {
    totalTags: number;
    prosodyTags: number;
    breakTags: number;
    emphasisTags: number;
  };
}

/**
 * Result of SSML annotation process
 */
export interface AnnotationResult {
  /** Final SSML content */
  ssml: string;
  /** Processing diagnostics */
  diagnostics: SSMLDiagnostics;
  /** Intermediate processing steps for debugging */
  steps: {
    normalized: string;
    conversational: string;
    withMacros: string;
    finalSSML: string;
  };
}

/**
 * Annotate text to SSML with comprehensive diagnostics
 * @param rawText - Input text to process
 * @param settings - Tuning settings for processing
 * @returns Annotated SSML with diagnostics
 */
export async function annotateTextToSSML(
  rawText: string,
  settings: TuningSettings
): Promise<AnnotationResult> {
  // Load the proper voice configuration
  const config = await loadConfig();

  // Step 1: Normalize text
  const normalized = normalize(rawText, config);
  
  // Step 2: Apply conversational realism
  const conversational = applyConversationalRealism(normalized, config);
  
  // Step 3: Apply macros for pauses and emphasis
  const withMacros = applyMacros(conversational, config);
  
  // Step 4: Convert to SSML
  const finalSSML = toSSML(withMacros, config);
  
  // Step 5: Generate diagnostics
  const diagnostics = generateSSMLDiagnostics(finalSSML, settings);
  
  return {
    ssml: finalSSML,
    diagnostics,
    steps: {
      normalized,
      conversational,
      withMacros,
      finalSSML,
    },
  };
}

/**
 * Generate comprehensive diagnostics for SSML content
 * @param ssmlContent - SSML content to analyze
 * @param settings - Tuning settings used for processing
 * @returns Diagnostic information
 */
export function generateSSMLDiagnostics(
  ssmlContent: string,
  settings: TuningSettings
): SSMLDiagnostics {
  // Extract text content from SSML for analysis
  const textContent = extractTextFromSSML(ssmlContent);
  
  // Basic text statistics
  const words = textContent.split(/\s+/).filter(word => word.length > 0);
  const sentences = textContent.split(/[.!?]+/).filter(s => s.trim().length > 0);
  const paragraphs = textContent.split(/\n\s*\n/).filter(p => p.trim().length > 0);
  
  // SSML tag analysis
  const allTags = ssmlContent.match(/<[^>]+>/g) || [];
  const prosodyTags = allTags.filter(tag => tag.includes('prosody')).length;
  const breakTags = allTags.filter(tag => tag.includes('break')).length;
  const emphasisTags = allTags.filter(tag => tag.includes('emphasis')).length;
  
  // Calculate tag density
  const tagDensityPer10Words = words.length > 0 
    ? (allTags.length / words.length) * 10 
    : 0;
  
  // Estimate WPM and duration
  const baseWPM = 145; // Angela's target WPM
  const adjustedWPM = baseWPM * settings.ssml.defaultRate;
  const estimatedDurationSec = words.length / (adjustedWPM / 60);
  
  // Analyze break timing (extract from SSML break tags)
  const breakTiming = analyzeBreakTiming(ssmlContent, settings);
  
  return {
    wpm: Math.round(adjustedWPM),
    tagDensityPer10Words: Math.round(tagDensityPer10Words * 100) / 100,
    breaksHistogramMs: breakTiming,
    estimatedDurationSec: Math.round(estimatedDurationSec * 10) / 10,
    textStats: {
      words: words.length,
      sentences: sentences.length,
      paragraphs: paragraphs.length,
      characters: textContent.length,
    },
    tagStats: {
      totalTags: allTags.length,
      prosodyTags,
      breakTags,
      emphasisTags,
    },
  };
}

/**
 * Extract plain text from SSML content
 * @param ssmlContent - SSML content
 * @returns Plain text without SSML tags
 */
function extractTextFromSSML(ssmlContent: string): string {
  return ssmlContent
    .replace(/<[^>]+>/g, '') // Remove all XML tags
    .replace(/\s+/g, ' ') // Normalize whitespace
    .trim();
}

/**
 * Analyze break timing patterns in SSML
 * @param ssmlContent - SSML content to analyze
 * @param settings - Tuning settings for break timing
 * @returns Break timing histogram
 */
function analyzeBreakTiming(
  ssmlContent: string,
  settings: TuningSettings
): SSMLDiagnostics['breaksHistogramMs'] {
  // Extract break tags and their timing
  const breakMatches = ssmlContent.match(/<break\s+time="([^"]+)"/g) || [];
  
  const timing = {
    comma: 0,
    clause: 0,
    sentence: 0,
    paragraph: 0,
  };
  
  // Count breaks by duration ranges
  breakMatches.forEach(breakTag => {
    const timeMatch = breakTag.match(/time="([^"]+)"/);
    if (timeMatch) {
      const timeStr = timeMatch[1];
      const timeMs = parseTimeToMs(timeStr);
      
      // Categorize breaks by duration
      if (timeMs <= settings.ssml.breakMs.comma + 50) {
        timing.comma++;
      } else if (timeMs <= settings.ssml.breakMs.clause + 50) {
        timing.clause++;
      } else if (timeMs <= settings.ssml.breakMs.sentence + 50) {
        timing.sentence++;
      } else {
        timing.paragraph++;
      }
    }
  });
  
  return timing;
}

/**
 * Parse SSML time string to milliseconds
 * @param timeStr - Time string (e.g., "300ms", "0.5s")
 * @returns Time in milliseconds
 */
function parseTimeToMs(timeStr: string): number {
  if (timeStr.endsWith('ms')) {
    return parseInt(timeStr.replace('ms', ''), 10);
  } else if (timeStr.endsWith('s')) {
    return parseFloat(timeStr.replace('s', '')) * 1000;
  }
  return 0;
}

/**
 * Validate SSML content for common issues
 * @param ssmlContent - SSML content to validate
 * @returns Array of validation warnings
 */
export function validateSSML(ssmlContent: string): string[] {
  const warnings: string[] = [];
  
  // Check for unclosed tags
  const openTags = ssmlContent.match(/<(?!\/)[^>]+>/g) || [];
  const closeTags = ssmlContent.match(/<\/[^>]+>/g) || [];
  
  if (openTags.length !== closeTags.length) {
    warnings.push('Mismatched SSML tags detected');
  }
  
  // Check for nested prosody tags (not recommended)
  const prosodyNesting = ssmlContent.match(/<prosody[^>]*>.*<prosody/g);
  if (prosodyNesting) {
    warnings.push('Nested prosody tags detected - may cause issues');
  }
  
  // Check for excessive tag density
  const textContent = extractTextFromSSML(ssmlContent);
  const words = textContent.split(/\s+/).length;
  const tags = (ssmlContent.match(/<[^>]+>/g) || []).length;
  const tagDensity = words > 0 ? (tags / words) * 10 : 0;
  
  if (tagDensity > 2) {
    warnings.push(`High tag density (${tagDensity.toFixed(1)} tags per 10 words) - may affect naturalness`);
  }
  
  return warnings;
}
