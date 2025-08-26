/**
 * Text linter for Angela voice styling
 * Checks for banned phrases, patterns, group address frequency,
 * and other voice-specific style violations.
 */

import { VoiceConfig } from './config';

export interface LintReport {
  warnings: string[];
  bans: string[];
  stats: {
    words: number;
    sentences: number;
    groupAddressRatio: number;
    consecutiveGroupAddress: number;
  };
}

/**
 * Performs comprehensive linting of text according to Angela voice guidelines
 * @param {string} text - Normalized text to lint
 * @param {VoiceConfig} config - Voice configuration with linting rules
 * @returns {LintReport} Detailed report of issues and statistics
 */
export function lint(text: string, config: VoiceConfig): LintReport {
  const report: LintReport = {
    warnings: [],
    bans: [],
    stats: {
      words: 0,
      sentences: 0,
      groupAddressRatio: 0,
      consecutiveGroupAddress: 0,
    },
  };

  if (!text?.trim()) {
    return report;
  }

  // Calculate basic statistics
  const words = text.split(/\s+/).filter(word => word.length > 0);
  const sentences = text.split(/[.!?]+/).filter(s => s.trim().length > 0);
  
  report.stats.words = words.length;
  report.stats.sentences = sentences.length;

  // Check for banned phrases
  for (const bannedPhrase of config.tone.ban) {
    const regex = new RegExp(bannedPhrase.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'gi');
    const matches = text.match(regex);
    if (matches) {
      report.bans.push(`Found banned phrase "${bannedPhrase}" (${matches.length} occurrence${matches.length > 1 ? 's' : ''})`);
    }
  }

  // Check pattern violations
  for (const pattern of config.tone.patterns) {
    const regex = new RegExp(pattern.pattern, 'g');
    const matches = text.match(regex);
    if (matches) {
      report.warnings.push(`Pattern "${pattern.pattern}" found ${matches.length} time${matches.length > 1 ? 's' : ''}. Consider: "${pattern.suggest}"`);
    }
  }

  // Check group address frequency and consecutive usage
  const groupAddressTerms = ['you guys', 'you all', 'everyone', 'folks', 'people'];
  let groupAddressCount = 0;
  let consecutiveCount = 0;
  let maxConsecutive = 0;

  const sentenceArray = sentences.map(s => s.trim().toLowerCase());
  
  for (let i = 0; i < sentenceArray.length; i++) {
    const sentence = sentenceArray[i];
    const hasGroupAddress = groupAddressTerms.some(term => sentence.includes(term));
    
    if (hasGroupAddress) {
      groupAddressCount++;
      consecutiveCount++;
      maxConsecutive = Math.max(maxConsecutive, consecutiveCount);
    } else {
      consecutiveCount = 0;
    }
  }

  report.stats.groupAddressRatio = sentences.length > 0 ? groupAddressCount / sentences.length : 0;
  report.stats.consecutiveGroupAddress = maxConsecutive;

  // Check group address ratio bounds
  if (report.stats.groupAddressRatio < config.group_address.min_ratio) {
    report.warnings.push(`Group address ratio too low: ${(report.stats.groupAddressRatio * 100).toFixed(1)}% (target: ${config.group_address.min_ratio * 100}%-${config.group_address.max_ratio * 100}%)`);
  } else if (report.stats.groupAddressRatio > config.group_address.max_ratio) {
    report.warnings.push(`Group address ratio too high: ${(report.stats.groupAddressRatio * 100).toFixed(1)}% (target: ${config.group_address.min_ratio * 100}%-${config.group_address.max_ratio * 100}%)`);
  }

  // Check consecutive group address usage
  if (maxConsecutive > config.group_address.max_consecutive) {
    report.warnings.push(`Too many consecutive sentences with group address: ${maxConsecutive} (max: ${config.group_address.max_consecutive})`);
  }

  // Check for staccato patterns (repeated short declarative sentences)
  const staccatoPattern = /^(It's not|This isn't|That's not|You're not|I'm not|We're not)\s+\w+\.\s*(It's not|This isn't|That's not|You're not|I'm not|We're not)/gm;
  const staccatoMatches = text.match(staccatoPattern);
  if (staccatoMatches && staccatoMatches.length > 2) {
    report.warnings.push(`Excessive staccato patterns detected (${staccatoMatches.length} instances). Consider varying sentence structure.`);
  }

  // Check opening word variety
  const openingWords = sentences.map(s => {
    const trimmed = s.trim();
    const firstWord = trimmed.split(/\s+/)[0]?.toLowerCase().replace(/[^\w]/g, '');
    return firstWord;
  }).filter(word => word && word.length > 0);

  const wordCounts = openingWords.reduce((acc, word) => {
    acc[word] = (acc[word] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  const overusedWords = Object.entries(wordCounts)
    .filter(([, count]) => count > Math.max(2, Math.floor(sentences.length * 0.2)))
    .map(([word, count]) => `"${word}" (${count} times)`);

  if (overusedWords.length > 0) {
    report.warnings.push(`Overused opening words: ${overusedWords.join(', ')}`);
  }

  // Check for standalone "No." which can be read as "Number"
  const standaloneNo = /\bNo\.\s/g;
  const noMatches = text.match(standaloneNo);
  if (noMatches) {
    report.warnings.push(`Found ${noMatches.length} instance${noMatches.length > 1 ? 's' : ''} of standalone "No." - consider "Nope." to avoid "Number" pronunciation`);
  }

  return report;
}

/**
 * Applies automatic fixes for common linting issues
 * @param {string} text - Text to fix
 * @param {VoiceConfig} config - Configuration with fix rules
 * @returns {string} Text with automatic fixes applied
 */
export function autoFix(text: string, config: VoiceConfig): string {
  let fixed = text;

  // Apply pattern fixes
  for (const pattern of config.tone.patterns) {
    const regex = new RegExp(pattern.pattern, 'g');
    fixed = fixed.replace(regex, pattern.suggest);
  }

  // Fix standalone "No." to "Nope."
  fixed = fixed.replace(/\bNo\.\s/g, 'Nope. ');

  return fixed;
}
