/**
 * Configuration loader for Angela voice styling rules
 * Loads and validates the YAML configuration file containing voice settings,
 * pacing rules, tone guidelines, and text processing parameters.
 */

import { readFileSync } from 'fs';
import { join } from 'path';
import yaml from 'js-yaml';
import { z } from 'zod';

/**
 * Zod schema for voice configuration validation
 */
const VoiceConfigSchema = z.object({
  voice: z.object({
    voice_id: z.string(),
    model_id: z.string(),
    settings: z.object({
      stability: z.number(),
      similarity_boost: z.number(),
      style: z.number(),
      speaker_boost: z.boolean(),
      speed: z.number().optional(),
      quality: z.string().optional(),
    }),
    seed: z.number().optional(),
    stability_mode: z.enum(['creative', 'natural', 'robust']).optional(),
  }),
  pacing: z.object({
    wpm: z.number(),
    pauses: z.object({
      micro: z.number(),
      beat: z.number(),
      minor: z.number(),
      shift: z.number(),
      impact: z.number(),
      major: z.number(),
    }),
    reflective_rate_delta_pct: z.number(),
  }),
  tone: z.object({
    allow: z.array(z.string()),
    ban: z.array(z.string()),
    patterns: z.array(z.object({
      pattern: z.string(),
      suggest: z.string(),
    })),
  }),
  group_address: z.object({
    min_ratio: z.number(),
    max_ratio: z.number(),
    max_consecutive: z.number(),
  }),
  emphasis: z.object({
    use_ssml: z.boolean(),
    use_prosody: z.boolean(),
    use_emphasis_tags: z.boolean(),
    caps_max_per_clause: z.number(),
    caps_max_per_sentence: z.number(),
  }),
  chunking: z.object({
    target_seconds: z.number(),
    max_chars: z.number(),
    guardrails: z.object({
      start_with_micro_pause: z.boolean(),
      end_with_short_pause: z.boolean(),
    }),
  }),
  punctuation: z.object({
    avoid_trailing_em_dash: z.boolean(),
    avoid_ellipsis_line_start: z.boolean(),
    drop_final_period_when_pause_follows: z.boolean(),
    ellipses_with_breaks: z.boolean().optional(),
    em_dash_for_shifts: z.boolean().optional(),
    no_space_before_punctuation: z.boolean().optional(),
    break_after_punctuation: z.boolean().optional(),
    one_space_before_inline_break: z.boolean().optional(),
  }),
  pronunciation: z.object({
    max_dictionaries: z.number(),
    default_dictionaries: z.array(z.string()),
    break_clamp_ms: z.number(),
  }),
  websocket: z.object({
    enable_ssml_parsing: z.boolean(),
    avoid_tag_splitting: z.boolean(),
    chunk_length_schedule: z.array(z.number()).optional(),
    auto_mode: z.boolean().optional(),
    optimize_streaming_latency: z.boolean().optional(),
  }),
  model_selection: z.object({
    proof: z.string(),
    streaming: z.string(),
    full: z.string(),
  }).optional(),
  sound_effects: z.object({
    default_duration: z.number(),
    prompt_influence: z.number(),
    max_effects_per_chunk: z.number(),
  }).optional(),
  audio_tags: z.object({
    enable_emotional_tags: z.boolean(),
    enable_sound_effects: z.boolean(),
    tag_strategy: z.enum(['contextual', 'probability', 'manual']).optional(),
    max_tags_per_chunk: z.number().optional(),
    emotional_tags: z.object({
      laughter: z.array(z.string()),
      whispers: z.array(z.string()),
      breaths: z.array(z.string()),
      curiosity: z.array(z.string()),
      excitement: z.array(z.string()),
      mystery: z.array(z.string()),
      emphasis: z.array(z.string()),
    }),
    ambient_effects: z.object({
      mystical: z.array(z.string()),
    }),
    placement_triggers: z.object({
      whispers: z.array(z.string()),
      curiosity: z.array(z.string()),
      excitement: z.array(z.string()),
      mystery: z.array(z.string()),
    }),
  }).optional(),
  conversational_realism: z.object({
    you_guys_ratio: z.number(),
    verbal_hesitation_ratio: z.number(),
    run_on_sentence_ratio: z.number(),
    all_caps_frequency: z.number(),
    avoid_repetitive_negation: z.boolean(),
    mystical_vocabulary: z.boolean(),
  }),
  speech_patterns: z.object({
    hesitation_cues: z.array(z.string()),
    emphasis_words: z.array(z.string()),
    mystical_replacements: z.record(z.string(), z.string()),
  }),
});

export type VoiceConfig = z.infer<typeof VoiceConfigSchema>;

let cachedConfig: VoiceConfig | null = null;

/**
 * Loads and validates the Angela voice configuration from YAML file
 * @returns {Promise<VoiceConfig>} Validated configuration object
 * @throws {Error} If configuration file is invalid or missing
 */
export async function loadConfig(): Promise<VoiceConfig> {
  if (cachedConfig) {
    return cachedConfig;
  }

  try {
    const configPath = join(process.cwd(), 'rules', 'angela-voice.yaml');
    const fileContents = readFileSync(configPath, 'utf8');
    const rawConfig = yaml.load(fileContents);
    
    cachedConfig = VoiceConfigSchema.parse(rawConfig);
    return cachedConfig;
  } catch (error) {
    throw new Error(`Failed to load voice configuration: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

/**
 * Clears the cached configuration (useful for testing)
 */
export function clearConfigCache(): void {
  cachedConfig = null;
}
