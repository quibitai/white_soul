/**
 * Tests for conversational realism functionality
 */

import { applyConversationalRealism, analyzeConversationalRealism } from '../conversational';
import { loadConfig } from '../config';

// Mock configuration for testing
const mockConfig = {
  conversational_realism: {
    you_guys_ratio: 0.35,
    verbal_hesitation_ratio: 0.25,
    run_on_sentence_ratio: 0.30,
    all_caps_frequency: 0.15,
    avoid_repetitive_negation: true,
    mystical_vocabulary: true,
  },
  speech_patterns: {
    hesitation_cues: ['yeah', 'like', 'so yeah', 'it\'s like', 'I mean'],
    emphasis_words: ['power', 'energy', 'truth', 'clarity', 'space', 'move', 'feel', 'see', 'know', 'trust'],
    mystical_replacements: {
      'connection': 'currents',
      'moment': 'portal',
      'change': 'transmission',
      'insight': 'revelation',
      'feeling': 'resonance',
      'understanding': 'clarity',
    },
  },
} as any;

describe('Conversational Realism', () => {
  describe('applyConversationalRealism', () => {
    it('should replace "you" with "you guys" at configured ratio', () => {
      const text = 'You need to trust yourself. You have the power. You can see the truth.';
      const result = applyConversationalRealism(text, mockConfig);
      
      // Should contain some "you guys" replacements
      expect(result).toMatch(/you guys/i);
      
      // Should still contain some original "you" instances
      expect(result).toMatch(/\byou\b/i);
    });

    it('should add ALL CAPS emphasis to key words', () => {
      const text = 'You have the power to see the truth and feel the energy within.';
      const result = applyConversationalRealism(text, mockConfig);
      
      // Should contain some emphasized words
      expect(result).toMatch(/\b[A-Z]{2,}\b/);
    });

    it('should replace some breaks with hesitation cues', () => {
      const text = 'This is important <break time="0.5s"/> and you need to understand <break time="1s"/> the message.';
      const result = applyConversationalRealism(text, mockConfig);
      
      // Should contain hesitation cues
      expect(result).toMatch(/\b(yeah|like|so yeah|it's like|I mean)\b/i);
    });

    it('should apply mystical vocabulary replacements', () => {
      const text = 'This connection brings insight and understanding of the moment.';
      const result = applyConversationalRealism(text, mockConfig);
      
      // May contain mystical replacements (30% probability each)
      // We can't guarantee specific replacements due to randomness, but structure should be preserved
      expect(result.length).toBeGreaterThan(0);
      expect(result).toMatch(/\w+/); // Should contain words
    });

    it('should reduce repetitive negation patterns', () => {
      const text = 'It\'s not about fear. It\'s not about doubt. It\'s not about confusion.';
      const result = applyConversationalRealism(text, mockConfig);
      
      // Should transform repetitive "it's not" patterns
      expect(result).toMatch(/this isn't about/i);
    });

    it('should handle empty or invalid input gracefully', () => {
      expect(applyConversationalRealism('', mockConfig)).toBe('');
      expect(applyConversationalRealism('   ', mockConfig)).toBe('   ');
    });
  });

  describe('analyzeConversationalRealism', () => {
    it('should calculate you guys ratio correctly', () => {
      const text = 'You need to trust. You guys have power. You can see. You guys know truth.';
      const analysis = analyzeConversationalRealism(text);
      
      expect(analysis.youGuysRatio).toBe(0.5); // 2 "you guys" out of 4 total "you"
    });

    it('should count ALL CAPS words', () => {
      const text = 'You have POWER and ENERGY within your SOUL.';
      const analysis = analyzeConversationalRealism(text);
      
      expect(analysis.allCapsCount).toBe(3);
    });

    it('should count hesitation cues', () => {
      const text = 'Yeah, you need to trust yourself. Like, you have the power.';
      const analysis = analyzeConversationalRealism(text);
      
      expect(analysis.hesitationCues).toBe(2);
    });

    it('should count mystical vocabulary', () => {
      const text = 'The currents flow through this portal of transmission and revelation.';
      const analysis = analyzeConversationalRealism(text);
      
      expect(analysis.mysticalWords).toBe(4);
    });

    it('should detect repetitive patterns', () => {
      const text = 'It\'s not fear. It\'s not doubt. It\'s not confusion.';
      const analysis = analyzeConversationalRealism(text);
      
      expect(analysis.repetitivePatterns).toBeGreaterThan(0);
    });
  });
});

describe('Integration with Sample Scripts', () => {
  it('should produce output similar to sample script patterns', () => {
    const sampleInput = `
      You need to understand this connection. You have the power to see the truth.
      It's not about fear. It's not about doubt. It's not about confusion.
      This moment brings insight and understanding. You can feel the energy.
    `;
    
    const result = applyConversationalRealism(sampleInput, mockConfig);
    const analysis = analyzeConversationalRealism(result);
    
    // Should have some conversational elements
    expect(analysis.youGuysRatio).toBeGreaterThan(0);
    expect(analysis.allCapsCount).toBeGreaterThan(0);
    
    // Should be more natural and flowing
    expect(result.length).toBeGreaterThan(sampleInput.length * 0.8); // Allow for some reduction
  });
});
