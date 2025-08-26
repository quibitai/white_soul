/**
 * Tests for WST2 Studio Speech Rules implementation
 */

import { applyWST2Rules, validateWST2Rules, analyzeWST2Compliance } from '../wst2-rules';
import { VoiceConfig } from '../config';

// Mock configuration matching WST2 rules
const mockConfig = {
  speech_patterns: {
    emphasis_words: ['much', 'fully', 'disappear', 'yikes', 'everything', 'really', 'totally'],
    hesitation_cues: ['yeah', 'like', 'so yeah'],
    mystical_replacements: {},
  },
  punctuation: {
    ellipses_with_breaks: true,
    em_dash_for_shifts: true,
    no_space_before_punctuation: true,
    break_after_punctuation: true,
    one_space_before_inline_break: true,
  },
} satisfies Partial<VoiceConfig>;

describe('WST2 Studio Speech Rules', () => {
  describe('applyWST2Rules', () => {
    test('converts pause macros to WST2 break tags', () => {
      const input = 'Hello <pause:300> world <pause:1000> test.';
      const result = applyWST2Rules(input, mockConfig as VoiceConfig);
      
      expect(result).toContain('<break time="0.3s" />');
      expect(result).toContain('<break time="1s" />');
    });

    test('applies ALL CAPS emphasis to target words', () => {
      const input = 'This is really important and everything matters much more.';
      const result = applyWST2Rules(input, mockConfig as VoiceConfig);
      
      // Should have some caps (probabilistic, so we test structure)
      expect(result).toMatch(/\b[A-Z]{2,}\b/); // At least one all-caps word
    });

    test('handles ellipses with breaks', () => {
      const input = 'Well... I guess that works.';
      const result = applyWST2Rules(input, mockConfig as VoiceConfig);
      
      expect(result).toContain('... <break time="1s" />');
    });

    test('formats em-dashes correctly', () => {
      const input = 'But—they still accepted it.';
      const result = applyWST2Rules(input, mockConfig as VoiceConfig);
      
      expect(result).toContain(' — ');
    });

    test('applies proper spacing rules', () => {
      const input = 'Hello , world !';
      const result = applyWST2Rules(input, mockConfig as VoiceConfig);
      
      // Should remove spaces before punctuation
      expect(result).toContain('Hello,');
      expect(result).toContain('world!');
    });
  });

  describe('validateWST2Rules', () => {
    test('detects floating breaks', () => {
      const input = 'Hello world.\n<break time="1s" />\nNext line.';
      const warnings = validateWST2Rules(input);
      
      expect(warnings).toContain(expect.stringMatching(/floating break/i));
    });

    test('detects all-caps sentences', () => {
      const input = 'THIS IS A COMPLETE SENTENCE IN ALL CAPS.';
      const warnings = validateWST2Rules(input);
      
      expect(warnings).toContain(expect.stringMatching(/all-caps sentence/i));
    });

    test('detects ellipses without breaks', () => {
      const input = 'Well... that was unexpected.';
      const warnings = validateWST2Rules(input);
      
      expect(warnings).toContain(expect.stringMatching(/ellipses without breaks/i));
    });

    test('detects improper spacing before punctuation', () => {
      const input = 'Hello , world !';
      const warnings = validateWST2Rules(input);
      
      expect(warnings).toContain(expect.stringMatching(/space.*before punctuation/i));
    });

    test('passes validation for properly formatted text', () => {
      const input = 'Hello, world. This is REALLY important... <break time="1s" /> Next thought.';
      const warnings = validateWST2Rules(input);
      
      expect(warnings).toHaveLength(0);
    });
  });

  describe('analyzeWST2Compliance', () => {
    test('counts WST2 elements correctly', () => {
      const input = `
        Hello, world! This is REALLY important... <break time="1s" />
        But — they still accepted it. <break time="0.5s" />
        EVERYTHING matters MUCH more.
      `;
      
      const analysis = analyzeWST2Compliance(input);
      
      expect(analysis.breakTags).toBe(2);
      expect(analysis.allCapsWords).toBe(3); // REALLY, EVERYTHING, MUCH
      expect(analysis.ellipsesWithBreaks).toBe(1);
      expect(analysis.emDashes).toBe(1);
      expect(analysis.floatingBreaks).toBe(0);
      expect(analysis.complianceScore).toBeGreaterThan(90);
    });

    test('calculates compliance score correctly', () => {
      const goodInput = 'Hello... <break time="1s" /> This is GOOD.';
      const badInput = 'Hello... This has no breaks.\n<break time="1s" />\n';
      
      const goodAnalysis = analyzeWST2Compliance(goodInput);
      const badAnalysis = analyzeWST2Compliance(badInput);
      
      expect(goodAnalysis.complianceScore).toBeGreaterThan(badAnalysis.complianceScore);
    });
  });

  describe('WST2 Break Tag System', () => {
    test('uses correct timing values', () => {
      const input = '<pause:300> <pause:500> <pause:1000> <pause:1500> <pause:2000> <pause:3000>';
      const result = applyWST2Rules(input, mockConfig as VoiceConfig);
      
      expect(result).toContain('<break time="0.3s" />'); // very slight hesitation
      expect(result).toContain('<break time="0.5s" />'); // micro-beat
      expect(result).toContain('<break time="1s" />');   // minor beat
      expect(result).toContain('<break time="1.5s" />'); // emotional shift
      expect(result).toContain('<break time="2s" />');   // impact line landing
      expect(result).toContain('<break time="3s" />');   // major mood shift
    });

    test('maintains break positioning rules', () => {
      const input = 'Hello. <pause:1000> World!';
      const result = applyWST2Rules(input, mockConfig as VoiceConfig);
      
      // Breaks should come after punctuation
      expect(result).toMatch(/\.\s*<break/);
    });
  });

  describe('WST2 ALL CAPS Emphasis', () => {
    test('applies caps sparingly and contextually', () => {
      const input = 'This is really really really important and everything everything matters.';
      const result = applyWST2Rules(input, mockConfig as VoiceConfig);
      
      // Should not capitalize every instance
      const capsCount = (result.match(/\bREALLY\b/g) || []).length;
      const totalReally = (input.match(/\breally\b/gi) || []).length;
      
      expect(capsCount).toBeLessThan(totalReally);
    });

    test('never creates all-caps sentences', () => {
      const input = 'really important everything matters fully disappear much yikes totally';
      const result = applyWST2Rules(input, mockConfig as VoiceConfig);
      
      // Should not be entirely capitalized
      expect(result).not.toMatch(/^[A-Z\s]+$/);
    });
  });

  describe('WST2 Punctuation + Space Logic', () => {
    test('handles quotes correctly', () => {
      const input = 'She said "this feels different" to me.';
      const result = applyWST2Rules(input, mockConfig as VoiceConfig);
      
      // Should maintain standard quote placement
      expect(result).toContain('"this feels different"');
    });

    test('processes standalone em-dashes', () => {
      const input = 'Yeah they—';
      const result = applyWST2Rules(input, mockConfig as VoiceConfig);
      
      expect(result).toContain('they —');
    });

    test('ensures proper inline break spacing', () => {
      const input = 'Hello<break time="1s" />world';
      const result = applyWST2Rules(input, mockConfig as VoiceConfig);
      
      expect(result).toContain('Hello <break time="1s" />');
    });
  });
});
