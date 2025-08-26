/**
 * ElevenLabs Sound Effects Integration
 * Handles sound effect generation and integration with TTS
 */

import { VoiceConfig } from '../styling/config';

/**
 * Interface for sound effect generation options
 */
export interface SoundEffectOptions {
  text: string;
  duration?: number;
  promptInfluence?: number;
}

/**
 * Interface for sound effect result
 */
export interface SoundEffectResult {
  audioBuffer: Buffer;
  duration: number;
  description: string;
}

/**
 * Generates a sound effect using ElevenLabs API
 * @param {SoundEffectOptions} options - Sound effect generation options
 * @returns {Promise<SoundEffectResult>} Generated sound effect
 */
export async function generateSoundEffect(options: SoundEffectOptions): Promise<SoundEffectResult> {
  const { text, duration, promptInfluence = 0.3 } = options;

  try {
    // This would integrate with ElevenLabs sound effects API
    // For now, we'll simulate the structure
    const response = await fetch('/api/elevenlabs/sound-effects', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        text,
        duration_seconds: duration,
        prompt_influence: promptInfluence,
      }),
    });

    if (!response.ok) {
      throw new Error(`Sound effect generation failed: ${response.statusText}`);
    }

    const audioBuffer = Buffer.from(await response.arrayBuffer());
    
    return {
      audioBuffer,
      duration: duration || 3, // Default duration
      description: text,
    };
  } catch (error) {
    console.error('Sound effect generation error:', error);
    throw error;
  }
}

/**
 * Extracts sound effect requests from audio tags in text
 * @param {string} text - Text containing audio tags
 * @returns {string[]} Array of sound effect descriptions
 */
export function extractSoundEffectRequests(text: string): string[] {
  const soundEffectPattern = /\[(soft wind|gentle chimes|rustling cards|flowing water|distant thunder|night sounds|bell rings softly|candle flickers|crystal resonance)\]/gi;
  const matches = text.match(soundEffectPattern) || [];
  
  return matches.map(match => match.slice(1, -1)); // Remove brackets
}

/**
 * Processes text to identify and prepare sound effects
 * @param {string} text - Input text with potential sound effect tags
 * @param {VoiceConfig} config - Voice configuration
 * @returns {Promise<ProcessedSoundEffects>} Processed sound effects data
 */
export async function processSoundEffects(
  text: string, 
  config: VoiceConfig
): Promise<ProcessedSoundEffects> {
  const soundEffectRequests = extractSoundEffectRequests(text);
  const processedEffects: SoundEffectResult[] = [];
  const cleanedText = text;

  if (!config.sound_effects || soundEffectRequests.length === 0) {
    return {
      cleanedText,
      soundEffects: [],
      metadata: {
        totalEffects: 0,
        totalDuration: 0,
        effectTypes: [],
      },
    };
  }

  // Generate sound effects
  for (const effectDescription of soundEffectRequests) {
    try {
      const soundEffect = await generateSoundEffect({
        text: effectDescription,
        duration: config.sound_effects.default_duration,
        promptInfluence: config.sound_effects.prompt_influence,
      });
      
      processedEffects.push(soundEffect);
    } catch (error) {
      console.warn(`Failed to generate sound effect for "${effectDescription}":`, error);
    }
  }

  // Calculate metadata
  const totalDuration = processedEffects.reduce((sum, effect) => sum + effect.duration, 0);
  const effectTypes = [...new Set(processedEffects.map(effect => effect.description))];

  return {
    cleanedText,
    soundEffects: processedEffects,
    metadata: {
      totalEffects: processedEffects.length,
      totalDuration,
      effectTypes,
    },
  };
}

/**
 * Interface for processed sound effects result
 */
export interface ProcessedSoundEffects {
  cleanedText: string;
  soundEffects: SoundEffectResult[];
  metadata: {
    totalEffects: number;
    totalDuration: number;
    effectTypes: string[];
  };
}

/**
 * Mixes sound effects with TTS audio (placeholder for future implementation)
 * @param {Buffer} ttsAudio - Main TTS audio buffer
 * @param {SoundEffectResult[]} soundEffects - Sound effects to mix
 * @returns {Promise<Buffer>} Mixed audio buffer
 */
export async function mixAudioWithEffects(
  ttsAudio: Buffer,
  soundEffects: SoundEffectResult[]
): Promise<Buffer> {
  // This would implement audio mixing logic
  // For now, return the original TTS audio
  console.log(`Would mix ${soundEffects.length} sound effects with TTS audio`);
  return ttsAudio;
}

/**
 * Analyzes text for sound effect opportunities
 * @param {string} text - Text to analyze
 * @param {VoiceConfig} config - Voice configuration
 * @returns {SoundEffectAnalysis} Analysis results
 */
export function analyzeSoundEffectOpportunities(
  text: string,
  config: VoiceConfig
): SoundEffectAnalysis {
  const opportunities: SoundEffectOpportunity[] = [];
  const recommendations: string[] = [];

  if (!config.audio_tags?.enable_sound_effects) {
    recommendations.push('Enable sound effects in audio_tags configuration');
    return { opportunities, recommendations, score: 0 };
  }

  // Analyze content for sound effect opportunities
  const contextPatterns = {
    mystical: {
      patterns: ['energy', 'spiritual', 'universe', 'cosmic', 'divine', 'sacred'],
      effects: ['soft wind', 'gentle chimes', 'crystal resonance'],
    },
    nature: {
      patterns: ['earth', 'water', 'wind', 'fire', 'nature', 'flowing'],
      effects: ['flowing water', 'distant thunder', 'night sounds'],
    },
    spiritual: {
      patterns: ['meditation', 'prayer', 'blessing', 'ritual', 'ceremony'],
      effects: ['bell rings softly', 'candle flickers'],
    },
    tarot: {
      patterns: ['cards', 'reading', 'spread', 'shuffle', 'draw'],
      effects: ['rustling cards'],
    },
  };

  let totalScore = 0;

  for (const [context, data] of Object.entries(contextPatterns)) {
    for (const pattern of data.patterns) {
      const regex = new RegExp(`\\b${pattern}\\b`, 'gi');
      const matches = text.match(regex);
      
      if (matches) {
        const opportunity: SoundEffectOpportunity = {
          context,
          trigger: pattern,
          matchCount: matches.length,
          suggestedEffects: data.effects,
          confidence: Math.min(matches.length * 0.2, 1.0),
        };
        
        opportunities.push(opportunity);
        totalScore += opportunity.confidence;
      }
    }
  }

  // Generate recommendations
  if (opportunities.length === 0) {
    recommendations.push('No clear sound effect opportunities detected');
    recommendations.push('Consider adding more descriptive environmental language');
  } else {
    recommendations.push(`Found ${opportunities.length} sound effect opportunities`);
    
    const topOpportunities = opportunities
      .sort((a, b) => b.confidence - a.confidence)
      .slice(0, 3);
    
    for (const opp of topOpportunities) {
      recommendations.push(
        `High confidence for ${opp.context} effects (${opp.matchCount} matches)`
      );
    }
  }

  return {
    opportunities,
    recommendations,
    score: Math.min(totalScore, 1.0),
  };
}

/**
 * Interface for sound effect opportunity
 */
export interface SoundEffectOpportunity {
  context: string;
  trigger: string;
  matchCount: number;
  suggestedEffects: string[];
  confidence: number;
}

/**
 * Interface for sound effect analysis
 */
export interface SoundEffectAnalysis {
  opportunities: SoundEffectOpportunity[];
  recommendations: string[];
  score: number; // 0-1, overall sound effect potential
}

/**
 * Validates sound effect configuration
 * @param {VoiceConfig} config - Voice configuration to validate
 * @returns {string[]} Array of validation warnings
 */
export function validateSoundEffectConfig(config: VoiceConfig): string[] {
  const warnings: string[] = [];

  if (!config.sound_effects) {
    warnings.push('Sound effects configuration missing');
    return warnings;
  }

  const { default_duration, prompt_influence, max_effects_per_chunk } = config.sound_effects;

  if (default_duration < 0.1 || default_duration > 22) {
    warnings.push('Default duration should be between 0.1 and 22 seconds');
  }

  if (prompt_influence < 0 || prompt_influence > 1) {
    warnings.push('Prompt influence should be between 0.0 and 1.0');
  }

  if (max_effects_per_chunk < 1 || max_effects_per_chunk > 5) {
    warnings.push('Max effects per chunk should be between 1 and 5');
  }

  return warnings;
}
