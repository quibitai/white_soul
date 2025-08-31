/**
 * Type definitions for the TTS tuning system
 * Based on dev_plan_02 architecture with blob-only storage
 */

import { z } from 'zod';

/**
 * Core tuning settings schema for voice synthesis
 */
export const TuningSettingsSchema = z.object({
  eleven: z.object({
    stability: z.number().min(0).max(1),
    similarityBoost: z.number().min(0).max(1),
    style: z.number().min(0).max(1),
    speakerBoost: z.boolean(),
  }),
  ssml: z.object({
    tagDensityMaxPer10Words: z.number().min(0).max(5),
    breakMs: z.object({
      comma: z.number().min(0).max(2000),
      clause: z.number().min(0).max(2000),
      sentence: z.number().min(0).max(2000),
      paragraph: z.number().min(0).max(3000),
    }),
    defaultRate: z.number().min(0.5).max(2.0),
    defaultPitchSt: z.number().min(-12).max(12),
    enableIntimateBlock: z.boolean(),
  }),
  chunking: z.object({
    maxSec: z.number().min(10).max(60),
    overlapMs: z.number().min(0).max(1000),
    contextSentences: z.number().min(0).max(5),
  }),
  stitching: z.object({
    crossfadeMs: z.number().min(0).max(500),
    sampleRate: z.enum([44100, 22050]),
    mono: z.boolean(),
  }),
  mastering: z.object({
    enable: z.boolean(),
    highpassHz: z.number().min(20).max(200),
    deesserHz: z.number().min(3000).max(10000),
    deesserAmount: z.number().min(0).max(1),
    compressor: z.object({
      ratio: z.number().min(1).max(10),
      attackMs: z.number().min(1).max(100),
      releaseMs: z.number().min(10).max(1000),
      gainDb: z.number().min(-10).max(10),
    }),
    loudness: z.object({
      targetLUFS: z.number().min(-30).max(-6),
      truePeakDb: z.number().min(-3).max(0),
    }),
  }),
  export: z.object({
    format: z.enum(['wav', 'mp3', 'aac']),
    bitrateKbps: z.number().min(64).max(320).optional(),
  }),
  experiment: z.object({
    grid: z.object({
      stability: z.array(z.number().min(0).max(1)),
      style: z.array(z.number().min(0).max(1)),
    }).optional(),
  }).optional(),
});

export type TuningSettings = z.infer<typeof TuningSettingsSchema>;

/**
 * Request schema for render jobs
 */
export const RenderRequestSchema = z.object({
  version: z.literal(1),
  rawScript: z.string().min(1).max(50000),
  settings: TuningSettingsSchema,
  derived: z.object({
    scriptHash: z.string(),
    settingsHash: z.string(),
  }),
});

export type RenderRequest = z.infer<typeof RenderRequestSchema>;

/**
 * Status tracking for render jobs
 */
export const RenderStatusSchema = z.object({
  state: z.enum(['queued', 'running', 'failed', 'done']),
  progress: z.object({
    total: z.number().min(0),
    done: z.number().min(0),
  }),
  steps: z.array(z.object({
    name: z.string(),
    ok: z.boolean(),
    done: z.number().optional(),
    total: z.number().optional(),
  })),
  startedAt: z.string(),
  updatedAt: z.string(),
  error: z.string().nullable(),
});

export type RenderStatus = z.infer<typeof RenderStatusSchema>;

/**
 * Chunk definition for synthesis
 */
export const ChunkSchema = z.object({
  ix: z.number().min(0),
  text: z.string(),
  ssml: z.string(),
  hash: z.string(),
  blob: z.string(),
});

export type Chunk = z.infer<typeof ChunkSchema>;

/**
 * Manifest for render jobs
 */
export const ManifestSchema = z.object({
  scriptHash: z.string(),
  settingsHash: z.string(),
  chunking: z.object({
    maxSec: z.number(),
    overlapMs: z.number(),
    contextSentences: z.number(),
  }),
  chunks: z.array(ChunkSchema),
});

export type Manifest = z.infer<typeof ManifestSchema>;

/**
 * Diagnostics data for completed renders
 */
export const DiagnosticsSchema = z.object({
  wpm: z.number(),
  tagDensityPer10Words: z.number(),
  breaksHistogramMs: z.object({
    comma: z.number(),
    clause: z.number(),
    sentence: z.number(),
    paragraph: z.number(),
  }),
  durationSec: z.number(),
  joinEnergySpikes: z.array(z.object({
    posMs: z.number(),
    db: z.number(),
  })),
  lufsIntegrated: z.number(),
  truePeakDb: z.number(),
});

export type Diagnostics = z.infer<typeof DiagnosticsSchema>;

/**
 * Default preset configuration
 */
export const DEFAULT_TUNING_SETTINGS: TuningSettings = {
  eleven: {
    stability: 0.58,
    similarityBoost: 0.85,
    style: 0.22,
    speakerBoost: true,
  },
  ssml: {
    tagDensityMaxPer10Words: 1,
    breakMs: {
      comma: 140,
      clause: 240,
      sentence: 420,
      paragraph: 800,
    },
    defaultRate: 0.98,
    defaultPitchSt: -0.5,
    enableIntimateBlock: false,
  },
  chunking: {
    maxSec: 35,
    overlapMs: 300,
    contextSentences: 2,
  },
  stitching: {
    crossfadeMs: 120,
    sampleRate: 44100,
    mono: true,
  },
  mastering: {
    enable: true,
    highpassHz: 85,
    deesserHz: 6500,
    deesserAmount: 0.5,
    compressor: {
      ratio: 2,
      attackMs: 25,
      releaseMs: 120,
      gainDb: 1.5,
    },
    loudness: {
      targetLUFS: -14,
      truePeakDb: -1.0,
    },
  },
  export: {
    format: 'mp3',
    bitrateKbps: 224,
  },
};
