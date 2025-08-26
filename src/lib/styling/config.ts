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
    }),
    seed: z.number().optional(),
  }),
  pacing: z.object({
    wpm: z.number(),
    pauses: z.object({
      micro: z.number(),
      short: z.number(),
      med: z.number(),
      long: z.number(),
      break: z.number(),
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
