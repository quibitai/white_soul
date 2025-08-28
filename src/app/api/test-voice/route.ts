/**
 * Simple TTS test endpoint for Angela's voice
 * Bypasses all text processing and sends raw text directly to ElevenLabs
 * with voice settings from angela-voice.yaml configuration
 */

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { ttsChunk, validateElevenLabsConfig } from '@/lib/tts';
import { loadConfig } from '@/lib/styling';

/**
 * Request schema for simple TTS testing
 */
const TestVoiceRequestSchema = z.object({
  text: z.string().min(1, 'Text is required').max(2000, 'Text too long for test'),
  format: z.enum(['mp3_44100_128', 'mp3_44100_192', 'wav']).default('mp3_44100_128'),
});

/**
 * POST /api/test-voice
 * Simple TTS test - sends raw text directly to ElevenLabs with Angela's voice settings
 */
export async function POST(req: NextRequest): Promise<NextResponse> {
  try {
    // Validate ElevenLabs configuration
    const isConfigValid = await validateElevenLabsConfig();
    if (!isConfigValid) {
      return NextResponse.json(
        { error: 'ElevenLabs API configuration is invalid or missing' },
        { status: 500 }
      );
    }

    // Parse and validate request body
    const body = await req.json();
    const { text, format } = TestVoiceRequestSchema.parse(body);

    // Load Angela voice configuration
    const config = await loadConfig();

    console.log('🧪 Simple Voice Test - Raw Settings:', {
      text: text.substring(0, 100) + '...',
      voiceId: process.env.ELEVEN_VOICE_ID || config.voice.voice_id,
      modelId: process.env.ELEVEN_MODEL_ID || config.voice.model_id,
      voiceSettings: config.voice.settings,
      seed: config.voice.seed,
      format
    });

    // Send raw text directly to ElevenLabs with Angela's settings
    const result = await ttsChunk({
      text: text, // Raw text - no processing, no audio tags, no SSML
      voiceId: process.env.ELEVEN_VOICE_ID || config.voice.voice_id,
      modelId: process.env.ELEVEN_MODEL_ID || config.voice.model_id,
      format,
      seed: config.voice.seed,
      speed: config.voice.settings.speed,
      quality: config.voice.settings.quality,
      voiceSettings: config.voice.settings, // Direct settings from YAML
      enableSSMLParsing: false, // Explicitly disable SSML processing
    });

    // Return the audio as a direct response
    const audioFormat = format.startsWith('mp3') ? 'mp3' : 'wav';
    const contentType = format.startsWith('mp3') ? 'audio/mpeg' : 'audio/wav';

    return new NextResponse(result.audio, {
      status: 200,
      headers: {
        'Content-Type': contentType,
        'Content-Length': result.audio.length.toString(),
        'Content-Disposition': `attachment; filename="angela-voice-test.${audioFormat}"`,
        'X-Request-Id': result.requestId || 'unknown',
        'X-Voice-Settings': JSON.stringify({
          stability: config.voice.settings.stability,
          similarity_boost: config.voice.settings.similarity_boost,
          style: config.voice.settings.style,
          speaker_boost: config.voice.settings.speaker_boost,
        }),
      },
    });

  } catch (error) {
    console.error('Error in /api/test-voice:', error);

    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Invalid request data', details: error.issues },
        { status: 400 }
      );
    }

    if (error instanceof Error) {
      // Check for specific ElevenLabs errors
      if (error.message.includes('ElevenLabs API error')) {
        return NextResponse.json(
          { error: 'TTS service error', details: error.message },
          { status: 502 }
        );
      }

      return NextResponse.json(
        { error: error.message },
        { status: 500 }
      );
    }

    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

/**
 * GET /api/test-voice
 * Returns API documentation for the simple voice test endpoint
 */
export async function GET(): Promise<NextResponse> {
  const documentation = {
    endpoint: '/api/test-voice',
    method: 'POST',
    description: 'Simple TTS test endpoint that sends raw text directly to ElevenLabs with Angela\'s voice settings',
    purpose: 'Test Angela\'s base voice without any processing, audio tags, or SSML enhancements',
    parameters: {
      text: {
        type: 'string',
        required: true,
        min: 1,
        max: 2000,
        description: 'Raw text to synthesize (no processing applied)',
      },
      format: {
        type: 'string',
        required: false,
        default: 'mp3_44100_128',
        enum: ['mp3_44100_128', 'mp3_44100_192', 'wav'],
        description: 'Audio output format',
      },
    },
    response: 'Direct audio file download with Angela\'s voice',
    voiceSettings: 'Uses settings directly from angela-voice.yaml without modification',
    processing: 'NONE - Raw text sent directly to ElevenLabs API',
    example: {
      request: {
        text: "Hello, this is a simple test of Angela's voice without any processing or audio tags.",
        format: 'mp3_44100_128',
      },
      response: 'Direct audio file download',
    },
    testSuggestions: [
      'Simple sentence: "Hello, this is Angela speaking."',
      'Mystical content: "The cards reveal hidden truths in your journey."',
      'Emotional content: "Trust your intuition, it knows the way."',
      'Technical test: "Testing stability, similarity boost, and speaker enhancement."',
    ],
  };

  return NextResponse.json(documentation);
}
