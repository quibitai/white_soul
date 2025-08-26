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

  // Convert pause macros to SSML breaks
  ssml = ssml.replace(/<pause:(\\d+)>/g, (_, ms) => {
    const seconds = parseInt(ms) / 1000;
    return `<break time="${seconds}s"/>`;
  });

  // Convert emphasis macros to SSML prosody
  ssml = ssml.replace(/<emphasis:strong>([^<]+)<\\/emphasis>/g, '<prosody volume="loud" rate="95%">$1</prosody>');
  ssml = ssml.replace(/<emphasis:moderate>([^<]+)<\\/emphasis>/g, '<prosody volume="medium" rate="98%">$1</prosody>');
  ssml = ssml.replace(/<emphasis:reduced>([^<]+)<\\/emphasis>/g, '<prosody volume="soft" rate="102%">$1</prosody>');

  // Convert rate macros to SSML prosody
  ssml = ssml.replace(/<rate:(\\d+)%>([^<]+)<\\/rate>/g, '<prosody rate="$1%">$2</prosody>');

  // Escape any remaining angle brackets that aren't SSML
  ssml = ssml.replace(/<(?!\\/?(speak|break|prosody|emphasis|phoneme|say-as|voice|audio|mark|s|p)\\b[^>]*>)/g, '&lt;');
  ssml = ssml.replace(/(?<!<\\/?(speak|break|prosody|emphasis|phoneme|say-as|voice|audio|mark|s|p)\\b[^>]*)>/g, '&gt;');

  // Wrap in speak tags
  ssml = `<speak>${ssml}</speak>`;

  // Validate and clean up the SSML
  return validateAndCleanSSML(ssml);
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
    .replace(/<pause:\\d+>/g, '') // Remove pause macros
    .replace(/<emphasis:[^>]+>([^<]+)<\\/emphasis>/g, '$1') // Remove emphasis, keep content
    .replace(/<rate:[^>]+>([^<]+)<\\/rate>/g, '$1') // Remove rate, keep content
    .replace(/\\s+/g, ' ') // Normalize whitespace
    .trim();
}

/**
 * Validates SSML markup and fixes common issues
 * @param {string} ssml - SSML markup to validate
 * @returns {string} Validated and cleaned SSML
 */
function validateAndCleanSSML(ssml: string): string {
  let cleaned = ssml;

  // Ensure proper speak tag wrapping
  if (!cleaned.startsWith('<speak>')) {
    cleaned = '<speak>' + cleaned;
  }
  if (!cleaned.endsWith('</speak>')) {
    cleaned = cleaned + '</speak>';
  }

  // Fix nested speak tags
  cleaned = cleaned.replace(/<speak>\\s*<speak>/g, '<speak>');
  cleaned = cleaned.replace(/<\\/speak>\\s*<\\/speak>/g, '</speak>');

  // Fix unclosed prosody tags
  const prosodyOpens = (cleaned.match(/<prosody[^>]*>/g) || []).length;
  const prosodyCloses = (cleaned.match(/<\\/prosody>/g) || []).length;
  
  if (prosodyOpens > prosodyCloses) {
    const missing = prosodyOpens - prosodyCloses;
    for (let i = 0; i < missing; i++) {
      cleaned = cleaned.replace(/<\\/speak>$/, '</prosody></speak>');
    }
  }

  // Remove empty prosody tags
  cleaned = cleaned.replace(/<prosody[^>]*>\\s*<\\/prosody>/g, '');

  // Fix break tags (ensure self-closing)
  cleaned = cleaned.replace(/<break([^>]*)>(?!\\s*<\\/break>)/g, '<break$1/>');
  cleaned = cleaned.replace(/<break([^>]*)><\\/break>/g, '<break$1/>');

  // Ensure break time values are valid
  cleaned = cleaned.replace(/time="(\\d+(?:\\.\\d+)?)"/g, (match, value) => {
    const num = parseFloat(value);
    if (num > 10) return 'time="10s"'; // Cap at 10 seconds
    if (num < 0) return 'time="0s"';
    return match;
  });

  // Remove excessive whitespace within SSML
  cleaned = cleaned.replace(/>\\s+</g, '><');
  cleaned = cleaned.replace(/\\s+/g, ' ');

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
    .replace(/\\s+/g, ' ')   // Normalize whitespace
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
