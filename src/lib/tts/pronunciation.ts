/**
 * Pronunciation dictionary management for ElevenLabs TTS
 * Handles loading and applying pronunciation dictionaries for better speech quality
 */

export interface PronunciationRule {
  word: string;
  pronunciation: string;
  type: 'phonetic' | 'spelling' | 'ipa';
}

export interface PronunciationDictionary {
  id: string;
  name: string;
  description: string;
  rules: PronunciationRule[];
  priority: number; // Higher priority dictionaries override lower ones
}

/**
 * Built-in pronunciation dictionaries
 */
const BUILT_IN_DICTIONARIES: Record<string, PronunciationDictionary> = {
  // Note: Pronunciation dictionaries must be created in ElevenLabs dashboard first
  // Example configuration when dictionaries are available:
  // 'tarot-terms': {
  //   id: 'tarot-terms',
  //   name: 'Tarot Terms',
  //   description: 'Common tarot card and reading terminology',
  //   priority: 100,
  //   rules: [
  //     { word: 'Arcana', pronunciation: 'ar-KAY-nah', type: 'phonetic' },
  //   ]
  // }
};

/**
 * Gets available pronunciation dictionaries
 * @returns {PronunciationDictionary[]} Array of available dictionaries
 */
export function getAvailableDictionaries(): PronunciationDictionary[] {
  return Object.values(BUILT_IN_DICTIONARIES).sort((a, b) => b.priority - a.priority);
}

/**
 * Gets a specific pronunciation dictionary by ID
 * @param {string} id - Dictionary ID
 * @returns {PronunciationDictionary | null} Dictionary or null if not found
 */
export function getDictionary(id: string): PronunciationDictionary | null {
  return BUILT_IN_DICTIONARIES[id] || null;
}

/**
 * Selects up to N dictionaries based on configuration
 * @param {string[]} requestedIds - Requested dictionary IDs
 * @param {number} maxDictionaries - Maximum number of dictionaries to return
 * @returns {PronunciationDictionary[]} Selected dictionaries
 */
export function selectDictionaries(
  requestedIds: string[], 
  maxDictionaries: number = 3
): PronunciationDictionary[] {
  const selected: PronunciationDictionary[] = [];
  
  // Add requested dictionaries in order of priority
  for (const id of requestedIds) {
    const dict = getDictionary(id);
    if (dict && selected.length < maxDictionaries) {
      selected.push(dict);
    }
  }
  
  // Sort by priority (highest first)
  return selected.sort((a, b) => b.priority - a.priority);
}

/**
 * Converts pronunciation dictionaries to ElevenLabs format
 * @param {PronunciationDictionary[]} dictionaries - Dictionaries to convert
 * @returns {object[]} ElevenLabs pronunciation dictionary format
 */
export function toElevenLabsFormat(dictionaries: PronunciationDictionary[]): object[] {
  return dictionaries.map(dict => ({
    pronunciation_dictionary_id: dict.id,
    version_id: 'latest',
  }));
}

/**
 * Applies pronunciation rules to text for preview purposes
 * @param {string} text - Input text
 * @param {PronunciationDictionary[]} dictionaries - Dictionaries to apply
 * @returns {string} Text with pronunciation hints applied
 */
export function applyPronunciationHints(
  text: string, 
  dictionaries: PronunciationDictionary[]
): string {
  let processed = text;
  
  // Sort dictionaries by priority (highest first)
  const sortedDicts = dictionaries.sort((a, b) => b.priority - a.priority);
  
  for (const dict of sortedDicts) {
    for (const rule of dict.rules) {
      // Create case-insensitive regex for whole words
      const regex = new RegExp(`\\b${rule.word.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'gi');
      processed = processed.replace(regex, `${rule.word} [${rule.pronunciation}]`);
    }
  }
  
  return processed;
}

/**
 * Validates pronunciation dictionary format
 * @param {unknown} dict - Dictionary object to validate
 * @returns {boolean} True if valid
 */
export function validateDictionary(dict: unknown): dict is PronunciationDictionary {
  if (!dict || typeof dict !== 'object') return false;
  
  const d = dict as Record<string, unknown>;
  return (
    typeof d.id === 'string' &&
    typeof d.name === 'string' &&
    typeof d.description === 'string' &&
    typeof d.priority === 'number' &&
    Array.isArray(d.rules) &&
    d.rules.every((rule: unknown) => {
      const r = rule as Record<string, unknown>;
      return (
        typeof r.word === 'string' &&
        typeof r.pronunciation === 'string' &&
        typeof r.type === 'string' &&
        ['phonetic', 'spelling', 'ipa'].includes(r.type)
      );
    })
  );
}

/**
 * Creates a custom pronunciation dictionary
 * @param {object} options - Dictionary options
 * @returns {PronunciationDictionary} New dictionary
 */
export function createCustomDictionary(options: {
  id: string;
  name: string;
  description: string;
  rules: PronunciationRule[];
  priority?: number;
}): PronunciationDictionary {
  return {
    id: options.id,
    name: options.name,
    description: options.description,
    rules: options.rules,
    priority: options.priority || 50,
  };
}

/**
 * Gets pronunciation statistics for text
 * @param {string} text - Input text
 * @param {PronunciationDictionary[]} dictionaries - Applied dictionaries
 * @returns {object} Statistics about pronunciation coverage
 */
export function getPronunciationStats(
  text: string,
  dictionaries: PronunciationDictionary[]
): {
  totalWords: number;
  coveredWords: number;
  coveragePercentage: number;
  appliedRules: Array<{ word: string; pronunciation: string; dictionary: string }>;
} {
  const words = text.toLowerCase().match(/\b\w+\b/g) || [];
  const totalWords = words.length;
  const appliedRules: Array<{ word: string; pronunciation: string; dictionary: string }> = [];
  const coveredWords = new Set<string>();
  
  for (const dict of dictionaries) {
    for (const rule of dict.rules) {
      const regex = new RegExp(`\\b${rule.word.toLowerCase()}\\b`, 'g');
      const matches = text.toLowerCase().match(regex);
      if (matches) {
        matches.forEach(() => {
          appliedRules.push({
            word: rule.word,
            pronunciation: rule.pronunciation,
            dictionary: dict.name,
          });
          coveredWords.add(rule.word.toLowerCase());
        });
      }
    }
  }
  
  return {
    totalWords,
    coveredWords: coveredWords.size,
    coveragePercentage: totalWords > 0 ? (coveredWords.size / totalWords) * 100 : 0,
    appliedRules,
  };
}
