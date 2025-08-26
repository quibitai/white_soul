/**
 * Tests for pronunciation dictionary functionality
 */

import {
  getAvailableDictionaries,
  getDictionary,
  selectDictionaries,
  toElevenLabsFormat,
  applyPronunciationHints,
  validateDictionary,
  createCustomDictionary,
  getPronunciationStats,
} from '../pronunciation';

describe('Pronunciation Dictionaries', () => {
  describe('getAvailableDictionaries', () => {
    it('should return built-in dictionaries sorted by priority', () => {
      const dictionaries = getAvailableDictionaries();
      
      expect(dictionaries.length).toBeGreaterThan(0);
      expect(dictionaries[0].priority).toBeGreaterThanOrEqual(dictionaries[1]?.priority || 0);
      
      // Should include tarot-terms and angela-custom
      const ids = dictionaries.map(d => d.id);
      expect(ids).toContain('tarot-terms');
      expect(ids).toContain('angela-custom');
    });
  });

  describe('selectDictionaries', () => {
    it('should limit to maximum number of dictionaries', () => {
      const requested = ['tarot-terms', 'angela-custom', 'nonexistent'];
      const selected = selectDictionaries(requested, 2);
      
      expect(selected.length).toBeLessThanOrEqual(2);
      expect(selected.every(d => requested.includes(d.id))).toBe(true);
    });

    it('should sort by priority', () => {
      const requested = ['tarot-terms', 'angela-custom'];
      const selected = selectDictionaries(requested, 3);
      
      for (let i = 0; i < selected.length - 1; i++) {
        expect(selected[i].priority).toBeGreaterThanOrEqual(selected[i + 1].priority);
      }
    });
  });

  describe('toElevenLabsFormat', () => {
    it('should convert dictionaries to ElevenLabs API format', () => {
      const dict = getDictionary('tarot-terms');
      expect(dict).toBeTruthy();
      
      if (dict) {
        const formatted = toElevenLabsFormat([dict]);
        
        expect(formatted).toHaveLength(1);
        expect(formatted[0]).toHaveProperty('dictionary_id', 'tarot-terms');
        expect(formatted[0]).toHaveProperty('version_id', 'latest');
        expect(formatted[0]).toHaveProperty('rules');
        expect(Array.isArray(formatted[0].rules)).toBe(true);
      }
    });
  });

  describe('applyPronunciationHints', () => {
    it('should add pronunciation hints to text', () => {
      const text = 'The Hierophant and Pentacles are important Arcana';
      const dict = getDictionary('tarot-terms');
      
      if (dict) {
        const result = applyPronunciationHints(text, [dict]);
        
        expect(result).toContain('[HIGH-er-oh-fant]');
        expect(result).toContain('[PEN-tah-kuls]');
        expect(result).toContain('[ar-KAY-nah]');
      }
    });

    it('should respect dictionary priority', () => {
      const text = 'literally weird';
      const angelaDict = getDictionary('angela-custom');
      
      if (angelaDict) {
        const result = applyPronunciationHints(text, [angelaDict]);
        
        expect(result).toContain('[LIT-er-al-ly]');
        expect(result).toContain('[WEIRD]');
      }
    });
  });

  describe('validateDictionary', () => {
    it('should validate correct dictionary format', () => {
      const validDict = {
        id: 'test',
        name: 'Test Dictionary',
        description: 'Test description',
        priority: 100,
        rules: [
          { word: 'test', pronunciation: 'TEST', type: 'phonetic' as const }
        ]
      };
      
      expect(validateDictionary(validDict)).toBe(true);
    });

    it('should reject invalid dictionary format', () => {
      const invalidDict = {
        id: 'test',
        // missing required fields
      };
      
      expect(validateDictionary(invalidDict)).toBe(false);
    });
  });

  describe('createCustomDictionary', () => {
    it('should create a valid custom dictionary', () => {
      const customDict = createCustomDictionary({
        id: 'custom-test',
        name: 'Custom Test',
        description: 'Test custom dictionary',
        rules: [
          { word: 'custom', pronunciation: 'CUST-om', type: 'phonetic' }
        ],
        priority: 150,
      });
      
      expect(validateDictionary(customDict)).toBe(true);
      expect(customDict.id).toBe('custom-test');
      expect(customDict.priority).toBe(150);
    });
  });

  describe('getPronunciationStats', () => {
    it('should calculate pronunciation coverage statistics', () => {
      const text = 'The Hierophant reads the Arcana with Pentacles and Wands';
      const dict = getDictionary('tarot-terms');
      
      if (dict) {
        const stats = getPronunciationStats(text, [dict]);
        
        expect(stats.totalWords).toBeGreaterThan(0);
        expect(stats.coveredWords).toBeGreaterThan(0);
        expect(stats.coveragePercentage).toBeGreaterThan(0);
        expect(stats.appliedRules.length).toBeGreaterThan(0);
        
        // Should find Hierophant, Arcana, Pentacles, Wands
        expect(stats.appliedRules.some(rule => rule.word === 'Hierophant')).toBe(true);
        expect(stats.appliedRules.some(rule => rule.word === 'Arcana')).toBe(true);
      }
    });

    it('should handle text with no pronunciation matches', () => {
      const text = 'This text has no special words';
      const dict = getDictionary('tarot-terms');
      
      if (dict) {
        const stats = getPronunciationStats(text, [dict]);
        
        expect(stats.totalWords).toBeGreaterThan(0);
        expect(stats.coveredWords).toBe(0);
        expect(stats.coveragePercentage).toBe(0);
        expect(stats.appliedRules).toHaveLength(0);
      }
    });
  });
});

describe('Dictionary Integration Requirements', () => {
  it('should enforce maximum dictionary limit', () => {
    const allDictionaries = getAvailableDictionaries();
    const maxDictionaries = 3;
    
    const selected = selectDictionaries(
      allDictionaries.map(d => d.id), 
      maxDictionaries
    );
    
    expect(selected.length).toBeLessThanOrEqual(maxDictionaries);
  });

  it('should always include default dictionaries when available', () => {
    const defaultIds = ['tarot-terms', 'angela-custom'];
    const selected = selectDictionaries(defaultIds, 3);
    
    // Should include both default dictionaries
    const selectedIds = selected.map(d => d.id);
    expect(selectedIds).toContain('tarot-terms');
    expect(selectedIds).toContain('angela-custom');
  });

  it('should maintain consistent pronunciation application', () => {
    const text = 'The Hierophant card represents spiritual wisdom';
    const dict = getDictionary('tarot-terms');
    
    if (dict) {
      const result1 = applyPronunciationHints(text, [dict]);
      const result2 = applyPronunciationHints(text, [dict]);
      
      // Should be deterministic
      expect(result1).toBe(result2);
    }
  });
});
