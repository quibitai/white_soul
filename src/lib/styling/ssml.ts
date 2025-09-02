/**
 * SSML (Speech Synthesis Markup Language) converter for Angela voice styling
 * Converts macro-enhanced text to valid SSML when use_ssml is enabled
 * in the voice configuration.
 */

import { VoiceConfig } from './config';

/**
 * Converts text with macros to SSML format
 * @param {string} textWithMacros - Text containing pause and emphasis macros
 * @param {VoiceConfig} config - Voice configuration settings
 * @returns {string} Valid SSML markup or plain text if SSML disabled
 */
export function toSSML(textWithMacros: string, config: VoiceConfig): string {
  if (!config.emphasis.use_ssml) {
    // If SSML is disabled, return clean text without macros
    return cleanMacros(textWithMacros);
  }

  if (!textWithMacros?.trim()) {
    return '<speak></speak>';
  }

  let ssml = textWithMacros;

  // Convert pause macros to SSML breaks with clamping and minimum validation
  ssml = ssml.replace(/<pause:(\d+)>/g, (_, ms) => {
    const parsedMs = parseInt(ms);
    // Ensure minimum 100ms to prevent abrupt cutoffs
    const minMs = Math.max(parsedMs, 100);
    const clampedMs = Math.min(minMs, config.pronunciation.break_clamp_ms);
    const seconds = (clampedMs / 1000).toFixed(clampedMs % 1000 === 0 ? 0 : 1);
    return `<break time="${seconds}s"/>`;
  });

  // Only add prosody tags if explicitly enabled
  if (config.emphasis.use_prosody) {
    ssml = ssml.replace(/<emphasis:strong>([^<]+)<\/emphasis>/g, '<prosody volume="loud" rate="95%">$1</prosody>');
    ssml = ssml.replace(/<emphasis:moderate>([^<]+)<\/emphasis>/g, '<prosody volume="medium" rate="98%">$1</prosody>');
    ssml = ssml.replace(/<emphasis:reduced>([^<]+)<\/emphasis>/g, '<prosody volume="soft" rate="102%">$1</prosody>');
    
    // Convert rate macros to SSML prosody
    ssml = ssml.replace(/<rate:(\d+)%>([^<]+)<\/rate>/g, '<prosody rate="$1%">$2</prosody>');
  } else {
    // Remove emphasis macros if prosody is disabled
    ssml = ssml.replace(/<emphasis:[^>]+>([^<]+)<\/emphasis>/g, '$1');
    ssml = ssml.replace(/<rate:[^>]+>([^<]+)<\/rate>/g, '$1');
  }

  // Only add emphasis tags if explicitly enabled
  if (!config.emphasis.use_emphasis_tags) {
    ssml = ssml.replace(/<emphasis[^>]*>([^<]+)<\/emphasis>/g, '$1');
  }

  // Clamp existing break times
  ssml = ssml.replace(/<break\s+time="(\d+(?:\.\d+)?)s?"[^>]*\/>/g, (match, timeStr) => {
    const timeMs = parseFloat(timeStr) * (timeStr.includes('.') ? 1000 : 1);
    const clampedMs = Math.min(timeMs, config.pronunciation.break_clamp_ms);
    const clampedSeconds = (clampedMs / 1000).toFixed(clampedMs % 1000 === 0 ? 0 : 1);
    return `<break time="${clampedSeconds}s"/>`;
  });

  // Apply two-space rule before breaks at line ends
  ssml = ssml.replace(/\s*<break[^>]*\/>\s*$/gm, '  <break time="0.4s"/>');

  // Escape any remaining angle brackets that aren't SSML
  ssml = ssml.replace(/<(?!\/?(speak|break|prosody|emphasis|phoneme|say-as|voice|audio|mark|s|p)\b[^>]*>)/g, '&lt;');
  ssml = ssml.replace(/(?<!<\/?(speak|break|prosody|emphasis|phoneme|say-as|voice|audio|mark|s|p)\b[^>]*)>/g, '&gt;');

  // Wrap in speak tags
  ssml = `<speak>${ssml}</speak>`;

  // Validate and clean up the SSML
  return validateAndCleanSSML(ssml, config);
}

/**
 * Removes all macro tags from text, leaving clean readable text
 * @param {string} textWithMacros - Text containing macro tags
 * @returns {string} Clean text without any macro tags
 */
export function cleanMacros(textWithMacros: string): string {
  if (!textWithMacros) {
    return '';
  }

  return textWithMacros
    .replace(/<pause:\d+>/g, '') // Remove pause macros
    .replace(/<emphasis:[^>]+>([^<]+)<\/emphasis>/g, '$1') // Remove emphasis, keep content
    .replace(/<rate:[^>]+>([^<]+)<\/rate>/g, '$1') // Remove rate, keep content
    .replace(/\s+/g, ' ') // Normalize whitespace
    .trim();
}

/**
 * Validates SSML markup and fixes common issues
 * @param {string} ssml - SSML markup to validate
 * @param {VoiceConfig} config - Voice configuration for validation rules
 * @returns {string} Validated and cleaned SSML
 */
function validateAndCleanSSML(ssml: string, config: VoiceConfig): string {
  let cleaned = ssml;

  // Ensure proper speak tag wrapping
  if (!cleaned.startsWith('<speak>')) {
    cleaned = '<speak>' + cleaned;
  }
  if (!cleaned.endsWith('</speak>')) {
    cleaned = cleaned + '</speak>';
  }

  // Fix nested speak tags
  cleaned = cleaned.replace(/<speak>\s*<speak>/g, '<speak>');
  cleaned = cleaned.replace(/<\/speak>\s*<\/speak>/g, '</speak>');

  // Fix unclosed prosody tags
  const prosodyOpens = (cleaned.match(/<prosody[^>]*>/g) || []).length;
  const prosodyCloses = (cleaned.match(/<\/prosody>/g) || []).length;
  
  if (prosodyOpens > prosodyCloses) {
    const missing = prosodyOpens - prosodyCloses;
    for (let i = 0; i < missing; i++) {
      cleaned = cleaned.replace(/<\/speak>$/, '</prosody></speak>');
    }
  }

  // Remove empty prosody tags
  cleaned = cleaned.replace(/<prosody[^>]*>\s*<\/prosody>/g, '');

  // Fix malformed break tags (remove invalid // syntax and other malformations)
  cleaned = cleaned.replace(/<break([^>]*?)\/\/>/g, '<break$1/>');
  cleaned = cleaned.replace(/<break([^>]*?)\/\/\s*>/g, '<break$1/>');
  cleaned = cleaned.replace(/<break([^>]*?)\/\/\s*\/>/g, '<break$1/>');
  
  // Fix break tags (ensure self-closing)
  cleaned = cleaned.replace(/<break([^>]*)>(?!\s*<\/break>)/g, '<break$1/>');
  cleaned = cleaned.replace(/<break([^>]*)><\/break>/g, '<break$1/>');
  
  // Additional cleanup for any remaining malformed break syntax
  cleaned = cleaned.replace(/<break\s+time="([^"]+)"\s*\/\/\s*>/g, '<break time="$1"/>');
  cleaned = cleaned.replace(/<break\s+time="([^"]+)"\s*\/\/>/g, '<break time="$1"/>');

  // Ensure break time values are valid using config limits and minimum duration
  cleaned = cleaned.replace(/time="(\d+(?:\.\d+)?)s?"/g, (match, value) => {
    const timeSeconds = parseFloat(value);
    const maxSeconds = config.pronunciation.break_clamp_ms / 1000;
    
    // Enforce minimum 0.1s to prevent abrupt cutoffs
    const minSeconds = 0.1;
    const clampedSeconds = Math.max(minSeconds, Math.min(timeSeconds, maxSeconds));
    
    return `time="${clampedSeconds.toFixed(1)}s"`;
  });

  // Remove consecutive break tags (merge into single longer break)
  cleaned = cleaned.replace(/(<break[^>]*\/>)\s*(<break[^>]*\/>)/g, (match, break1, break2) => {
    // Extract time values and combine them
    const time1Match = break1.match(/time="([\d.]+)s"/);
    const time2Match = break2.match(/time="([\d.]+)s"/);
    
    if (time1Match && time2Match) {
      const combinedTime = Math.min(
        parseFloat(time1Match[1]) + parseFloat(time2Match[1]),
        config.pronunciation.break_clamp_ms / 1000
      );
      return `<break time="${combinedTime.toFixed(1)}s"/>`;
    }
    
    return break1; // Keep first break if parsing fails
  });

  // Remove excessive whitespace within SSML
  cleaned = cleaned.replace(/>\s+</g, '><');
  cleaned = cleaned.replace(/\s+/g, ' ');

  return cleaned.trim();
}

/**
 * Extracts plain text content from SSML markup
 * @param {string} ssml - SSML markup
 * @returns {string} Plain text content
 */
export function extractTextFromSSML(ssml: string): string {
  if (!ssml) {
    return '';
  }

  return ssml
    .replace(/<[^>]+>/g, '') // Remove all XML tags
    .replace(/&lt;/g, '<')   // Decode escaped characters
    .replace(/&gt;/g, '>')
    .replace(/&amp;/g, '&')
    .replace(/\s+/g, ' ')   // Normalize whitespace
    .trim();
}

/**
 * Estimates the character count for SSML content (excluding markup)
 * @param {string} ssml - SSML markup
 * @returns {number} Character count of actual spoken content
 */
export function getSSMLContentLength(ssml: string): number {
  return extractTextFromSSML(ssml).length;
}

/**
 * Aggressively cleans SSML to fix common malformations before TTS synthesis
 * Optimized for ElevenLabs multilingual v2 model compatibility
 * @param {string} ssml - SSML markup to clean
 * @returns {string} Cleaned SSML safe for TTS synthesis
 */
export function cleanSSMLForSynthesis(ssml: string): string {
  if (!ssml) return ssml;
  
  let cleaned = ssml;
  
  console.log('🧹 Cleaning SSML for multilingual v2 model:', {
    originalLength: ssml.length,
    hasDoubleSlash: ssml.includes('//'),
    hasPhoneme: ssml.includes('<phoneme'),
    preview: ssml.slice(0, 100) + (ssml.length > 100 ? '...' : '')
  });
  
  // CRITICAL: Remove phoneme tags - NOT supported by multilingual v2 model
  // According to ElevenLabs docs, phoneme tags only work with Flash v2, Turbo v2, and English v1
  cleaned = cleaned.replace(/<phoneme[^>]*>([^<]+)<\/phoneme>/g, '$1');
  console.log('🚫 Removed phoneme tags (not supported by multilingual v2)');
  
  // Fix all variations of malformed break tags
  cleaned = cleaned.replace(/<break([^>]*?)\/\/>/g, '<break$1/>');
  cleaned = cleaned.replace(/<break([^>]*?)\/\/\s*>/g, '<break$1/>');
  cleaned = cleaned.replace(/<break([^>]*?)\/\/\s*\/>/g, '<break$1/>');
  cleaned = cleaned.replace(/<break\s+time="([^"]+)"\s*\/\/\s*>/g, '<break time="$1"/>');
  cleaned = cleaned.replace(/<break\s+time="([^"]+)"\s*\/\/>/g, '<break time="$1"/>');
  
  // Fix any remaining malformed self-closing tags
  cleaned = cleaned.replace(/\/\/>/g, '/>');
  
  // Remove any text that might be read as "slash slash"
  cleaned = cleaned.replace(/\s*\/\/\s*/g, ' ');
  
  // Validate and fix break tag time values according to ElevenLabs format
  cleaned = cleaned.replace(/<break\s+time="([^"]+)"\s*\/>/g, (match, timeValue) => {
    // Ensure time value is valid (number followed by 's' or 'ms')
    if (!/^\d+(\.\d+)?(s|ms)$/.test(timeValue)) {
      console.warn(`⚠️ Invalid break time value: ${timeValue}, defaulting to 0.5s`);
      return '<break time="0.5s"/>';
    }
    // Convert milliseconds to seconds if needed (ElevenLabs prefers seconds)
    if (timeValue.endsWith('ms')) {
      const ms = parseFloat(timeValue.replace('ms', ''));
      const seconds = (ms / 1000).toFixed(1);
      console.log(`🔄 Converting ${timeValue} to ${seconds}s`);
      return `<break time="${seconds}s"/>`;
    }
    return match;
  });
  
  // Ensure proper SSML structure
  if (!cleaned.startsWith('<speak>') && !cleaned.includes('<speak>')) {
    cleaned = `<speak>${cleaned}</speak>`;
  }
  
  // Final validation - check for any remaining malformed tags
  const malformedTags = cleaned.match(/<[^>]*\/\/[^>]*>/g);
  if (malformedTags) {
    console.warn('⚠️ Still found malformed tags after cleaning:', malformedTags);
  }
  
  console.log('✅ SSML cleaning completed for multilingual v2:', {
    cleanedLength: cleaned.length,
    hasDoubleSlash: cleaned.includes('//'),
    hasPhoneme: cleaned.includes('<phoneme'),
    breakTagCount: (cleaned.match(/<break[^>]*\/>/g) || []).length,
    lexemeTagCount: (cleaned.match(/<lexeme[^>]*>/g) || []).length,
    preview: cleaned.slice(0, 100) + (cleaned.length > 100 ? '...' : '')
  });
  
  return cleaned.trim();
}

/**
 * Validates SSML for common issues that could cause synthesis to fail
 * @param {string} ssml - SSML markup to validate
 * @returns {object} Validation result with issues found
 */
export function validateSSMLForSynthesis(ssml: string): {
  isValid: boolean;
  issues: string[];
  warnings: string[];
} {
  const issues: string[] = [];
  const warnings: string[] = [];
  
  if (!ssml || !ssml.trim()) {
    issues.push('SSML content is empty');
    return { isValid: false, issues, warnings };
  }
  
  // Check for basic SSML structure
  if (!ssml.includes('<speak>') || !ssml.includes('</speak>')) {
    issues.push('Missing <speak> tags');
  }
  
  // Check for malformed break tags
  const malformedBreaks = ssml.match(/<break[^>]*\/\/[^>]*>/g);
  if (malformedBreaks) {
    issues.push(`Found ${malformedBreaks.length} malformed break tags with //`);
  }
  
  // Check for phoneme tags (not supported by multilingual v2)
  const phonemeTags = ssml.match(/<phoneme[^>]*>/g);
  if (phonemeTags) {
    warnings.push(`Found ${phonemeTags.length} phoneme tags - not supported by multilingual v2 model`);
  }
  
  // Check for invalid break time values
  const breakTags = ssml.match(/<break\s+time="([^"]+)"\s*\/>/g) || [];
  breakTags.forEach(tag => {
    const timeMatch = tag.match(/time="([^"]+)"/);
    if (timeMatch && !/^\d+(\.\d+)?(s|ms)$/.test(timeMatch[1])) {
      issues.push(`Invalid break time value: ${timeMatch[1]}`);
    }
  });
  
  // Check for unclosed tags
  const openTags = (ssml.match(/<(?!\/)[^>]+>/g) || []).filter(tag => !tag.endsWith('/>'));
  const closeTags = ssml.match(/<\/[^>]+>/g) || [];
  if (openTags.length !== closeTags.length) {
    warnings.push('Possible unclosed tags detected');
  }
  
  // Check for extremely long content that might timeout
  if (ssml.length > 5000) {
    warnings.push(`SSML content is very long (${ssml.length} chars) - may cause timeout`);
  }
  
  return {
    isValid: issues.length === 0,
    issues,
    warnings
  };
}
