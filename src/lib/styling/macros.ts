/**
 * Macro processor for Angela voice styling
 * Inserts pause macros and emphasis markers according to voice configuration
 * to enhance natural speech rhythm and pacing.
 */

import { VoiceConfig } from './config';

/**
 * Applies pause and emphasis macros to text based on punctuation and context
 * @param {string} text - Normalized and linted text
 * @param {VoiceConfig} config - Voice configuration with macro rules
 * @returns {string} Text with macros inserted
 */
export function applyMacros(text: string, config: VoiceConfig): string {
  if (!text?.trim()) {
    return '';
  }

  let processed = text;

  // Apply punctuation-based pause macros
  processed = applyPauseMacros(processed, config);

  // Apply emphasis macros if not using SSML
  if (!config.emphasis.use_ssml) {
    processed = applyEmphasisMacros(processed, config);
  }

  // Apply end-of-line tweaks
  processed = applyEndLineTweaks(processed, config);

  return processed;
}

/**
 * Inserts pause macros based on punctuation and context
 * @param {string} text - Text to process
 * @param {VoiceConfig} config - Configuration with pause settings
 * @returns {string} Text with pause macros inserted
 */
function applyPauseMacros(text: string, config: VoiceConfig): string {
  let processed = text;

  // Map punctuation to pause types (WST2 Studio Speech Rules)
  const pauseMap = {
    ',': `<pause:${config.pacing.pauses.micro}>`, // WST2: very slight hesitation
    ';': `<pause:${config.pacing.pauses.beat}>`,  // WST2: micro-beat for rhythmic control
    ':': `<pause:${config.pacing.pauses.beat}>`,  // WST2: micro-beat for rhythmic control
    '.': `<pause:${config.pacing.pauses.pause}>`, // Natural pause after statements
    '!': `<pause:${config.pacing.pauses.shift}>`, // WST2: emotional shift for exclamations
    '?': `<pause:${config.pacing.pauses.pause}>`, // Natural pause after questions
  };

  // Apply basic punctuation pauses
  for (const [punct, macro] of Object.entries(pauseMap)) {
    const regex = new RegExp(`\\${punct}(\\s+)`, 'g');
    processed = processed.replace(regex, `${punct}${macro}$1`);
  }

  // Handle ellipsis with longer pause
  processed = processed.replace(
    /\.\.\.(\s+)/g, 
    `<pause:${config.pacing.pauses.shift}>$1` // WST2: emotional shift
  );

  // Handle em-dash with medium pause
  processed = processed.replace(
    /\s*--\s*/g, 
    ` <pause:${config.pacing.pauses.pause}> ` // Natural pause for em-dash
  );

  // Add pauses after paragraph breaks
  processed = processed.replace(
    /\n\n+/g, 
    `\n<pause:${config.pacing.pauses.shift}>\n` // Topic shift for paragraph breaks
  );

  // Handle reflective/contemplative phrases with slight rate adjustment
  const reflectivePatterns = [
    /\b(you know|I mean|like|actually|honestly|really)\b/gi,
    /\b(hmm|well|so|now|then)\b(?=\s*[,.;])/gi,
  ];

  for (const pattern of reflectivePatterns) {
    processed = processed.replace(pattern, (match) => {
      return `<rate:${100 + config.pacing.reflective_rate_delta_pct}%>${match}</rate>`;
    });
  }

  return processed;
}

/**
 * Applies emphasis macros for capitalized words and phrases
 * @param {string} text - Text to process
 * @param {VoiceConfig} config - Configuration with emphasis settings
 * @returns {string} Text with emphasis macros
 */
function applyEmphasisMacros(text: string, config: VoiceConfig): string {
  let processed = text;

  // Find ALL CAPS words and apply emphasis
  const capsPattern = /\b[A-Z]{2,}\b/g;
  const sentences = processed.split(/([.!?]+)/);
  
  for (let i = 0; i < sentences.length; i += 2) {
    const sentence = sentences[i];
    if (!sentence) continue;

    const clauses = sentence.split(/[,;:]/);
    
    for (let j = 0; j < clauses.length; j++) {
      const clause = clauses[j];
      const capsWords = clause.match(capsPattern) || [];
      
      // Limit caps per clause
      if (capsWords.length > config.emphasis.caps_max_per_clause) {
        // Keep only the first allowed number of caps words emphasized
        let capsCount = 0;
        clauses[j] = clause.replace(capsPattern, (match) => {
          capsCount++;
          if (capsCount <= config.emphasis.caps_max_per_clause) {
            return `<emphasis:strong>${match.toLowerCase()}</emphasis>`;
          }
          return match.toLowerCase();
        });
      } else if (capsWords.length > 0) {
        // Apply emphasis to all caps words within limit
        clauses[j] = clause.replace(capsPattern, (match) => {
          return `<emphasis:strong>${match.toLowerCase()}</emphasis>`;
        });
      }
    }
    
    sentences[i] = clauses.join(',');
  }

  processed = sentences.join('');

  // Handle **bold** markdown-style emphasis
  processed = processed.replace(
    /\*\*([^*]+)\*\*/g, 
    '<emphasis:moderate>$1</emphasis>'
  );

  // Handle *italic* markdown-style emphasis (lighter)
  processed = processed.replace(
    /\*([^*]+)\*/g, 
    '<emphasis:reduced>$1</emphasis>'
  );

  return processed;
}

/**
 * Applies end-of-line tweaks to improve natural speech flow
 * @param {string} text - Text to process
 * @param {VoiceConfig} config - Configuration with punctuation rules
 * @returns {string} Text with end-line tweaks applied
 */
function applyEndLineTweaks(text: string, config: VoiceConfig): string {
  let processed = text;

  // Avoid trailing em-dash if configured
  if (config.punctuation.avoid_trailing_em_dash) {
    processed = processed.replace(/--\s*$/gm, '');
  }

  // Avoid ellipsis at line start if configured
  if (config.punctuation.avoid_ellipsis_line_start) {
    processed = processed.replace(/^\s*\.\.\.\s*/gm, '');
  }

  // Drop final period when pause follows if configured
  if (config.punctuation.drop_final_period_when_pause_follows) {
    processed = processed.replace(
      /\.(<pause:[^>]+>)\s*$/gm, 
      '$1  ' // Replace with pause and double space for flat fall
    );
  }

  return processed;
}

/**
 * Estimates the duration of text with macros in seconds
 * @param {string} textWithMacros - Text containing pause and rate macros
 * @param {VoiceConfig} config - Configuration with timing settings
 * @returns {number} Estimated duration in seconds
 */
export function estimateDuration(textWithMacros: string, config: VoiceConfig): number {
  // Remove macros to get clean text for word count
  const cleanText = textWithMacros
    .replace(/<[^>]+>/g, '') // Remove all macro tags
    .replace(/\s+/g, ' ')   // Normalize whitespace
    .trim();

  const words = cleanText.split(/\s+/).length;
  const baseSeconds = (words / config.pacing.wpm) * 60;

  // Add pause durations
  let pauseSeconds = 0;
  const pauseMatches = textWithMacros.match(/<pause:(\d+)>/g) || [];
  for (const match of pauseMatches) {
    const ms = parseInt(match.match(/\d+/)?.[0] || '0');
    pauseSeconds += ms / 1000;
  }

  return Math.round((baseSeconds + pauseSeconds) * 10) / 10; // Round to 1 decimal
}
