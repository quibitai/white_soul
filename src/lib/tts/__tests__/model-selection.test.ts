/**
 * Tests for ElevenLabs model selection utility
 */

import {
  selectOptimalModel,
  getModelCharacteristics,
  validateModelFeatures,
  getModelOptimizedSettings,
  analyzeAndRecommendModel,
  ELEVENLABS_MODELS,
} from '../model-selection';
import { VoiceConfig } from '../../styling/config';

// Mock configuration for testing
const mockConfig = {
  model_selection: {
    proof: 'eleven_flash_v2_5',
    streaming: 'eleven_turbo_v2_5',
    full: 'eleven_multilingual_v2',
  },
} satisfies Partial<VoiceConfig>;

describe('selectOptimalModel', () => {
  it('should use configured model when available', () => {
    const result = selectOptimalModel('proof', mockConfig as VoiceConfig);
    expect(result).toBe('eleven_flash_v2_5');
  });

  it('should fall back to optimal selection when no config', () => {
    const emptyConfig = {} as VoiceConfig;
    const result = selectOptimalModel('proof', emptyConfig);
    expect(result).toBeDefined();
    expect(ELEVENLABS_MODELS[result]).toBeDefined();
  });

  it('should prioritize latency for proof use case', () => {
    const emptyConfig = {} as VoiceConfig;
    const result = selectOptimalModel('proof', emptyConfig);
    const characteristics = getModelCharacteristics(result);
    expect(characteristics?.latency).toBe('low');
  });

  it('should prioritize quality for full use case', () => {
    const emptyConfig = {} as VoiceConfig;
    const result = selectOptimalModel('full', emptyConfig);
    const characteristics = getModelCharacteristics(result);
    expect(characteristics?.quality).toBe('high');
  });

  it('should respect required features', () => {
    const emptyConfig = {} as VoiceConfig;
    const result = selectOptimalModel('full', emptyConfig, ['audio_tags']);
    const characteristics = getModelCharacteristics(result);
    expect(characteristics?.supportedFeatures).toContain('audio_tags');
  });
});

describe('getModelCharacteristics', () => {
  it('should return characteristics for valid model', () => {
    const characteristics = getModelCharacteristics('eleven_multilingual_v2');
    expect(characteristics).toBeDefined();
    expect(characteristics?.quality).toBe('high');
    expect(characteristics?.multilingual).toBe(true);
  });

  it('should return null for invalid model', () => {
    const characteristics = getModelCharacteristics('invalid_model');
    expect(characteristics).toBeNull();
  });
});

describe('validateModelFeatures', () => {
  it('should validate supported features', () => {
    const isValid = validateModelFeatures('eleven_v3', ['audio_tags']);
    expect(isValid).toBe(true);
  });

  it('should reject unsupported features', () => {
    const isValid = validateModelFeatures('eleven_english_v1', ['audio_tags']);
    expect(isValid).toBe(false);
  });

  it('should handle invalid model', () => {
    const isValid = validateModelFeatures('invalid_model', ['ssml']);
    expect(isValid).toBe(false);
  });
});

describe('getModelOptimizedSettings', () => {
  it('should return optimized settings for eleven_v3', () => {
    const settings = getModelOptimizedSettings('eleven_v3', 'conversational');
    expect(settings).toHaveProperty('stability');
    expect((settings as Record<string, unknown>).stability).toBe('Natural');
  });

  it('should return optimized settings for flash model', () => {
    const settings = getModelOptimizedSettings('eleven_flash_v2_5', 'proof');
    expect(settings).toHaveProperty('stability');
    expect((settings as Record<string, unknown>).stability).toBe(0.6);
  });

  it('should return base settings for unknown model', () => {
    const settings = getModelOptimizedSettings('unknown_model', 'full');
    expect(settings).toHaveProperty('stability');
    expect((settings as Record<string, unknown>).stability).toBe(0.5);
  });
});

describe('analyzeAndRecommendModel', () => {
  it('should recommend model based on text analysis', () => {
    const text = 'Hello [laughs] this is amazing!';
    const recommendation = analyzeAndRecommendModel(text, 'full', mockConfig as VoiceConfig);
    
    expect(recommendation.modelId).toBeDefined();
    expect(recommendation.characteristics).toBeDefined();
    expect(recommendation.reasoning.length).toBeGreaterThan(0);
    expect(recommendation.confidence).toBeGreaterThan(0);
  });

  it('should detect audio tags requirement', () => {
    const text = 'Hello [laughs] this is [excited] amazing!';
    const recommendation = analyzeAndRecommendModel(text, 'full', mockConfig as VoiceConfig);
    
    expect(recommendation.requiredFeatures).toContain('audio_tags');
    expect(recommendation.reasoning.some(r => r.includes('Audio tags'))).toBe(true);
  });

  it('should detect SSML requirement', () => {
    const text = 'Hello <break time="1s" /> this is great!';
    const recommendation = analyzeAndRecommendModel(text, 'full', mockConfig as VoiceConfig);
    
    expect(recommendation.requiredFeatures).toContain('ssml');
  });

  it('should detect multilingual requirement', () => {
    const text = 'Hello 世界 こんにちは!';
    const recommendation = analyzeAndRecommendModel(text, 'full', mockConfig as VoiceConfig);
    
    expect(recommendation.requiredFeatures).toContain('multilingual');
  });

  it('should handle empty text', () => {
    const recommendation = analyzeAndRecommendModel('', 'full', mockConfig as VoiceConfig);
    
    expect(recommendation.modelId).toBeDefined();
    expect(recommendation.confidence).toBeLessThan(1.0);
  });

  it('should adjust confidence based on text length', () => {
    const shortText = 'Hi';
    const longText = 'This is a much longer text that provides more context for analysis and optimization decisions.';
    
    const shortRecommendation = analyzeAndRecommendModel(shortText, 'full', mockConfig as VoiceConfig);
    const longRecommendation = analyzeAndRecommendModel(longText, 'full', mockConfig as VoiceConfig);
    
    expect(longRecommendation.confidence).toBeGreaterThan(shortRecommendation.confidence);
  });
});
