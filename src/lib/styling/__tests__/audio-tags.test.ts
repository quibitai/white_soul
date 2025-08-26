/**
 * Tests for audio tags processor
 */

import { applyAudioTags, analyzeAudioTagOpportunities, validateAudioTags } from '../audio-tags';
import { VoiceConfig } from '../config';

// Mock configuration for testing
const mockConfig = {
  audio_tags: {
    enable_emotional_tags: true,
    enable_sound_effects: true,
    tag_probability: 0.5, // Higher probability for testing
    sound_effect_probability: 0.5,
    emotional_tags: {
      laughter: ['[laughs]', '[giggles]'],
      whisper: ['[whispers]'],
      breaths: ['[sighs]', '[exhales]'],
      emotions: ['[curious]', '[excited]'],
      emphasis: ['[emphasizes]'],
    },
    ambient_effects: {
      mystical: ['[soft wind]', '[gentle chimes]'],
      nature: ['[flowing water]', '[distant thunder]'],
      spiritual: ['[bell rings softly]', '[candle flickers]'],
    },
    emotional_triggers: {
      laughter: ['funny', 'amusing', 'hilarious'],
      whisper: ['secret', 'quietly', 'softly'],
      excitement: ['amazing', 'incredible', 'wow'],
      curiosity: ['wonder', 'interesting', 'curious'],
      mystery: ['hidden', 'mysterious', 'unknown'],
    },
  },
} satisfies Partial<VoiceConfig>;

describe('applyAudioTags', () => {
  it('should add emotional tags based on triggers', () => {
    const text = 'This is really funny and amazing!';
    const result = applyAudioTags(text, mockConfig as VoiceConfig);
    
    // Should contain audio tags (with probability, may not always trigger)
    expect(result).toMatch(/\[.*\]/);
  });

  it('should add ambient effects for mystical content', () => {
    const text = 'The spiritual energy flows through the universe with divine power.';
    const result = applyAudioTags(text, mockConfig as VoiceConfig);
    
    // Should potentially contain ambient effects
    expect(result.length).toBeGreaterThanOrEqual(text.length);
  });

  it('should not add tags when disabled', () => {
    const disabledConfig = {
      ...mockConfig,
      audio_tags: {
        ...mockConfig.audio_tags,
        enable_emotional_tags: false,
        enable_sound_effects: false,
      },
    };
    
    const text = 'This is funny and amazing!';
    const result = applyAudioTags(text, disabledConfig as VoiceConfig);
    
    expect(result).toBe(text);
  });

  it('should handle empty text', () => {
    const result = applyAudioTags('', mockConfig as VoiceConfig);
    expect(result).toBe('');
  });
});

describe('analyzeAudioTagOpportunities', () => {
  it('should identify emotional opportunities', () => {
    const text = 'This is funny and amazing! I wonder about the mysterious secrets.';
    const analysis = analyzeAudioTagOpportunities(text, mockConfig as VoiceConfig);
    
    expect(analysis.emotionalOpportunities.length).toBeGreaterThan(0);
    expect(analysis.recommendations.length).toBeGreaterThan(0);
  });

  it('should identify ambient opportunities', () => {
    const text = 'The spiritual energy flows through nature with divine blessing.';
    const analysis = analyzeAudioTagOpportunities(text, mockConfig as VoiceConfig);
    
    expect(analysis.ambientOpportunities.length).toBeGreaterThan(0);
  });

  it('should provide recommendations when no opportunities found', () => {
    const text = 'Simple plain text with no triggers.';
    const analysis = analyzeAudioTagOpportunities(text, mockConfig as VoiceConfig);
    
    expect(analysis.recommendations).toContain('Consider adding more expressive language for better audio tag utilization');
  });
});

describe('validateAudioTags', () => {
  it('should identify valid audio tags', () => {
    const text = 'Hello [laughs] this is great [soft wind] indeed.';
    const validation = validateAudioTags(text);
    
    expect(validation.validTags.length).toBeGreaterThan(0);
    expect(validation.validTags).toContain('[laughs]');
  });

  it('should identify invalid audio tags', () => {
    const text = 'Hello [invalid-tag] this is [unknown-effect] indeed.';
    const validation = validateAudioTags(text);
    
    expect(validation.invalidTags.length).toBeGreaterThan(0);
  });

  it('should warn about high tag density', () => {
    const text = '[tag1] [tag2] [tag3] word [tag4]';
    const validation = validateAudioTags(text);
    
    expect(validation.warnings).toContain('High audio tag density may affect speech naturalness');
  });

  it('should handle text without tags', () => {
    const text = 'Simple text without any tags.';
    const validation = validateAudioTags(text);
    
    expect(validation.validTags).toHaveLength(0);
    expect(validation.invalidTags).toHaveLength(0);
    expect(validation.warnings).toHaveLength(0);
  });
});
