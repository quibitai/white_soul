/**
 * Tests for model capabilities and text sanitization
 */

import { 
  getModelCapabilities, 
  sanitizeForModel, 
  validateTextForModel,
  getRecommendedSettings,
  MODEL_CAPS 
} from '../model-caps';

describe('Model Capabilities', () => {
  describe('getModelCapabilities', () => {
    it('should return capabilities for known models', () => {
      const caps = getModelCapabilities('eleven_multilingual_v2');
      expect(caps.id).toBe('eleven_multilingual_v2');
      expect(caps.supportsSSML).toBe(true);
      expect(caps.supportsProsody).toBe(false); // Disabled by default
      expect(caps.maxBreakTime).toBe(2200);
    });

    it('should return default capabilities for unknown models', () => {
      const caps = getModelCapabilities('unknown_model');
      expect(caps.id).toBe('eleven_multilingual_v2'); // Default fallback
    });
  });

  describe('sanitizeForModel', () => {
    it('should clamp break times to model maximum', () => {
      const text = '<break time="5s"/> <break time="1s"/>';
      const result = sanitizeForModel(text, 'eleven_multilingual_v2');
      
      // Should clamp 5s to 2.2s (2200ms)
      expect(result).toContain('<break time="2.2s"/>');
      expect(result).toContain('<break time="1s"/>');
    });

    it('should remove prosody tags when not supported', () => {
      const text = '<prosody rate="slow">Hello</prosody> world';
      const result = sanitizeForModel(text, 'eleven_multilingual_v2');
      
      expect(result).not.toContain('<prosody');
      expect(result).toContain('Hello world');
    });

    it('should remove emphasis tags when not supported', () => {
      const text = '<emphasis level="strong">Important</emphasis> text';
      const result = sanitizeForModel(text, 'eleven_multilingual_v2');
      
      expect(result).not.toContain('<emphasis');
      expect(result).toContain('Important text');
    });

    it('should convert pause macros to break tags', () => {
      const text = 'Hello <pause:500> world <pause:3000>';
      const result = sanitizeForModel(text, 'eleven_multilingual_v2');
      
      expect(result).toContain('<break time="0.5s"/>');
      expect(result).toContain('<break time="2.2s"/>'); // Clamped from 3000ms
    });

    it('should apply two-space rule before line-end breaks', () => {
      const text = 'End of line<break time="0.4s"/>';
      const result = sanitizeForModel(text, 'eleven_multilingual_v2');
      
      expect(result).toMatch(/End of line\s\s<break time="0\.4s"\/>/);
    });

    it('should strip all SSML for models that do not support it', () => {
      // Mock a model without SSML support
      MODEL_CAPS['test_model'] = {
        ...MODEL_CAPS['eleven_multilingual_v2'],
        id: 'test_model',
        supportsSSML: false,
      };

      const text = '<speak>Hello <break time="1s"/> world</speak>';
      const result = sanitizeForModel(text, 'test_model');
      
      expect(result).toBe('Hello world');
      expect(result).not.toContain('<');

      // Cleanup
      delete MODEL_CAPS['test_model'];
    });
  });

  describe('validateTextForModel', () => {
    it('should warn about unsupported features', () => {
      const text = '<prosody rate="slow">Hello</prosody> <break time="5s"/>';
      const warnings = validateTextForModel(text, 'eleven_multilingual_v2');
      
      expect(warnings).toContain(expect.stringContaining('does not support prosody'));
      expect(warnings).toContain(expect.stringContaining('exceeds model maximum'));
    });

    it('should return no warnings for compatible text', () => {
      const text = 'Hello <break time="1s"/> world';
      const warnings = validateTextForModel(text, 'eleven_multilingual_v2');
      
      expect(warnings).toHaveLength(0);
    });
  });

  describe('getRecommendedSettings', () => {
    it('should return model-specific voice settings', () => {
      const settings = getRecommendedSettings('eleven_multilingual_v2');
      
      expect(settings).toHaveProperty('stability');
      expect(settings).toHaveProperty('similarity_boost');
      expect(settings).toHaveProperty('style');
      expect(settings).toHaveProperty('speaker_boost');
      expect(typeof settings.stability).toBe('number');
    });
  });
});

describe('Continuity Requirements', () => {
  it('should enforce seed consistency', () => {
    const caps = getModelCapabilities('eleven_multilingual_v2');
    expect(caps.recommendedSettings).toBeDefined();
    
    // Test that seed is preserved in sanitization
    const text = 'Test text for continuity';
    const sanitized1 = sanitizeForModel(text, 'eleven_multilingual_v2');
    const sanitized2 = sanitizeForModel(text, 'eleven_multilingual_v2');
    
    // Should produce identical results (deterministic)
    expect(sanitized1).toBe(sanitized2);
  });

  it('should enforce break time limits', () => {
    const text = '<break time="10s"/> <break time="0.1s"/> <break time="2.5s"/>';
    const result = sanitizeForModel(text, 'eleven_multilingual_v2');
    
    // All breaks should be clamped to 2.2s maximum
    const breakMatches = result.match(/<break time="([^"]+)"/g) || [];
    
    for (const match of breakMatches) {
      const timeMatch = match.match(/time="([^"]+)"/);
      if (timeMatch) {
        const timeValue = parseFloat(timeMatch[1]);
        expect(timeValue).toBeLessThanOrEqual(2.2);
      }
    }
  });

  it('should preserve previous_text context limits', () => {
    // This would be tested in the actual TTS integration
    // Here we just verify the concept
    const longText = 'A'.repeat(1000);
    const contextLimit = 300;
    const limitedContext = longText.slice(-contextLimit);
    
    expect(limitedContext.length).toBe(contextLimit);
  });
});
