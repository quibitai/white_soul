/**
 * WST2 Studio Speech Rules processor
 * Implements the specific formatting logic from WST2_Studio_Speech_Rules.txt
 * for ElevenLabs Studio audio generation
 */

import { VoiceConfig } from './config';

/**
 * Applies WST2 Studio Speech Rules to text
 * @param {string} text - Input text to process
 * @param {VoiceConfig} config - Voice configuration
 * @returns {string} Text formatted according to WST2 rules
 */
export function applyWST2Rules(text: string, config: VoiceConfig): string {
  if (!text?.trim()) return text;

  let processed = text;

  // Apply WST2 rules in order
  processed = applyBreakTagSystem(processed, config);
  processed = applyAllCapsEmphasis(processed, config);
  processed = applyPunctuationSpaceLogic(processed, config);

  return processed;
}

/**
 * Applies WST2 Break Tag System
 * Controls pacing and breath logic in generated speech
 */
function applyBreakTagSystem(text: string, _config: VoiceConfig): string {
  let processed = text;

  // Convert pause macros to WST2 break system
  const pauseMap = {
    '<pause:300>': '<break time="0.3s" />',  // very slight hesitation or hard emphasis cutoff
    '<pause:500>': '<break time="0.5s" />',  // micro-beat for rhythmic control or emphasis
    '<pause:1000>': '<break time="1s" />',   // minor beat; after punchlines, pivots, or slight reflection
    '<pause:1500>': '<break time="1.5s" />', // emotional shift, impact line landing, paragraph break
    '<pause:2000>': '<break time="2s" />',   // emotional shift, impact line landing, paragraph break
    '<pause:3000>': '<break time="3s" />',   // major mood shift, breath reset, scene change, or emotional floor drop
  };

  for (const [oldPause, newBreak] of Object.entries(pauseMap)) {
    processed = processed.replace(new RegExp(oldPause.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g'), newBreak);
  }

  // Apply WST2 positioning rules
  processed = applyBreakPositioning(processed);

  return processed;
}

/**
 * Applies WST2 break positioning rules
 * - Always placed after the line it follows
 * - Never floats alone (except for spirals)
 * - No space before punctuation or break tag unless intentional
 */
function applyBreakPositioning(text: string): string {
  let processed = text;

  // Ensure breaks come after punctuation, not before
  processed = processed.replace(/\s*<break[^>]*\/>\s*([.!?])/g, '$1 <break time="0.5s" />');

  // Remove extra spaces before breaks unless intentionally rhythmic
  processed = processed.replace(/\s{2,}<break/g, ' <break');

  // Ensure one space before inline breaks
  processed = processed.replace(/([^\s])<break/g, '$1 <break');

  return processed;
}

/**
 * Applies WST2 ALL CAPS Emphasis rules
 * Simulates emphasis without triggering ElevenLabs SSML bugs
 */
function applyAllCapsEmphasis(text: string, config: VoiceConfig): string {
  const emphasisWords = config.speech_patterns.emphasis_words;
  let processed = text;

  // WST2 Rule: Used sparingly on emotionally loaded or rhythmically sharp words
  // For: internal voice surges, sarcastic emphasis, moments of exasperation, spiraling, reactivity
  for (const word of emphasisWords) {
    const pattern = new RegExp(`\\b${word}\\b`, 'gi');
    const matches = processed.match(pattern) || [];
    
    if (matches.length === 0) continue;

    // WST2 Rule: Always contrast-driven, paired with soft moments before/after
    // Often placed near or just before a <break>
    processed = processed.replace(pattern, (match, offset) => {
      const context = processed.slice(Math.max(0, offset - 30), offset + match.length + 30);
      
      // Higher chance for emphasis near breaks or in emotional contexts
      const nearBreak = /<break/.test(context);
      const emotionalContext = /\b(feel|felt|need|want|truth|deep|strong|exasperation|spiraling)\b/i.test(context);
      
      // WST2 Rule: Never full sentences, always contrast-driven
      const shouldEmphasize = (nearBreak || emotionalContext) && Math.random() < 0.4;
      
      if (shouldEmphasize) {
        return match.toUpperCase();
      }
      
      return match;
    });
  }

  return processed;
}

/**
 * Applies WST2 Punctuation + Space Logic
 * Ensures correct flow in synthesized voice
 */
function applyPunctuationSpaceLogic(text: string, _config: VoiceConfig): string {
  let processed = text;

  // WST2 Ellipses rules
  processed = applyEllipsesRules(processed);
  
  // WST2 Em-dash rules
  processed = applyEmDashRules(processed);
  
  // WST2 Spacing rules
  processed = applySpacingRules(processed);

  return processed;
}

/**
 * Applies WST2 ellipses rules
 * Used to signal fading, spiraling, or a trailing thought
 * Nearly always paired with <break time="1s" /> or longer
 */
function applyEllipsesRules(text: string): string {
  let processed = text;

  // Find ellipses not followed by breaks and add appropriate breaks
  processed = processed.replace(/\.{3}(?!\s*<break)/g, (match, offset) => {
    const afterContext = text.slice(offset + match.length, offset + match.length + 20);
    
    // If there's more text after, add a break for fading/spiraling effect
    if (afterContext.trim()) {
      return '... <break time="1s" />';
    }
    
    return match;
  });

  return processed;
}

/**
 * Applies WST2 em-dash rules
 * Used for sudden shifts, interrupted thoughts, or rhetorical emphasis
 */
function applyEmDashRules(text: string): string {
  let processed = text;

  // Ensure proper spacing around em-dashes for sudden shifts
  // Mid-line: "but — they still accepted it."
  processed = processed.replace(/\s*—\s*/g, ' — ');
  
  // Standalone em-dashes: "Yeah they —"
  processed = processed.replace(/(\w+)\s+—\s*$/gm, '$1 —');

  return processed;
}

/**
 * Applies WST2 spacing rules
 * - No extra space before punctuation
 * - One space before <break> tag when used inline
 * - <break> tags go directly after punctuation unless rhythmically intentional
 */
function applySpacingRules(text: string): string {
  let processed = text;

  // No extra space before punctuation
  processed = processed.replace(/\s+([.!?,:;])/g, '$1');
  
  // One space before inline breaks
  processed = processed.replace(/([^\s])<break/g, '$1 <break');
  
  // Breaks go directly after punctuation
  processed = processed.replace(/([.!?])\s+<break/g, '$1<break');
  
  // But ensure one space before inline breaks that aren't after punctuation
  processed = processed.replace(/([^.!?\s])<break/g, '$1 <break');

  return processed;
}

/**
 * Validates text against WST2 rules
 * @param {string} text - Text to validate
 * @returns {string[]} Array of validation warnings
 */
export function validateWST2Rules(text: string): string[] {
  const warnings: string[] = [];

  // Check for floating breaks (WST2 rule: never floats alone)
  const floatingBreaks = text.match(/^\s*<break[^>]*\/>\s*$/gm);
  if (floatingBreaks) {
    warnings.push(`Found ${floatingBreaks.length} floating break(s) - breaks should follow content`);
  }

  // Check for ALL CAPS sentences (WST2 rule: never full sentences)
  const capsLines = text.match(/^[A-Z\s]{10,}[.!?]$/gm);
  if (capsLines) {
    warnings.push(`Found ${capsLines.length} all-caps sentence(s) - use caps sparingly on individual words`);
  }

  // Check for ellipses without breaks
  const ellipsesWithoutBreaks = text.match(/\.{3}(?!\s*<break)/g);
  if (ellipsesWithoutBreaks) {
    warnings.push(`Found ${ellipsesWithoutBreaks.length} ellipses without breaks - ellipses should be paired with breaks`);
  }

  // Check for improper spacing before punctuation
  const spacesBeforePunctuation = text.match(/\s+[.!?,:;]/g);
  if (spacesBeforePunctuation) {
    warnings.push(`Found ${spacesBeforePunctuation.length} space(s) before punctuation - remove extra spaces`);
  }

  return warnings;
}

/**
 * Analyzes text for WST2 compliance metrics
 * @param {string} text - Text to analyze
 * @returns {object} WST2 compliance metrics
 */
export function analyzeWST2Compliance(text: string): {
  breakTags: number;
  allCapsWords: number;
  ellipsesWithBreaks: number;
  emDashes: number;
  floatingBreaks: number;
  complianceScore: number;
} {
  const breakTags = (text.match(/<break[^>]*\/>/g) || []).length;
  const allCapsWords = (text.match(/\b[A-Z]{2,}\b/g) || []).length;
  const ellipsesWithBreaks = (text.match(/\.{3}\s*<break/g) || []).length;
  const emDashes = (text.match(/—/g) || []).length;
  const floatingBreaks = (text.match(/^\s*<break[^>]*\/>\s*$/gm) || []).length;
  
  // Calculate compliance score (0-100)
  const totalEllipses = (text.match(/\.{3}/g) || []).length;
  const ellipsesCompliance = totalEllipses > 0 ? ellipsesWithBreaks / totalEllipses : 1;
  const floatingBreaksPenalty = floatingBreaks * 0.1;
  
  const complianceScore = Math.max(0, Math.min(100, 
    (ellipsesCompliance * 100) - floatingBreaksPenalty
  ));

  return {
    breakTags,
    allCapsWords,
    ellipsesWithBreaks,
    emDashes,
    floatingBreaks,
    complianceScore,
  };
}
