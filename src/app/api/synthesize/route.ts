/**
 * API route for TTS synthesis
 * Handles ElevenLabs API calls to synthesize processed text chunks
 * and stores the resulting audio files.
 */

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import {
  getManifest,
  saveAudioMetadata,
  putAudio,
  generateAudioFilename,
} from '@/lib/store';
import {
  synthesizeChunks,
  concatAudioBuffers,
  validateElevenLabsConfig,
  selectOptimalModel,
  getModelOptimizedSettings,
} from '@/lib/tts';
import { loadConfig } from '@/lib/styling';

/**
 * Request schema validation
 */
const SynthesizeRequestSchema = z.object({
  manifestId: z.string().uuid('Invalid manifest ID'),
  voiceId: z.string().optional(),
  modelId: z.string().optional(),
  format: z.enum(['mp3_44100_128', 'mp3_44100_192', 'wav']).default('mp3_44100_128'),
});



/**
 * Response interface
 */
interface SynthesizeResponse {
  jobId: string;
  url: string;
  downloadUrl?: string;
  metadata: {
    format: string;
    sizeBytes: number;
    duration: number;
    chunks: number;
  };
}

/**
 * POST /api/synthesize
 * Synthesizes processed text chunks into audio using ElevenLabs
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
    const { manifestId, voiceId, modelId, format } = SynthesizeRequestSchema.parse(body);

    // Retrieve the processing manifest
    const manifest = await getManifest(manifestId);
    if (!manifest) {
      return NextResponse.json(
        { error: 'Manifest not found' },
        { status: 404 }
      );
    }

    // Load voice configuration
    const config = await loadConfig();

    // Extract text chunks for synthesis
    const textChunks = manifest.chunks.map(chunk => chunk.body);
    
    if (textChunks.length === 0) {
      return NextResponse.json(
        { error: 'No text chunks found in manifest' },
        { status: 400 }
      );
    }

    // Select optimal model for full synthesis (high quality)
    const finalVoiceId = voiceId || process.env.ELEVEN_VOICE_ID || config.voice.voice_id;
    const baseModelId = modelId || process.env.ELEVEN_MODEL_ID || config.voice.model_id;
    const optimalModelId = selectOptimalModel('full', config, ['audio_tags', 'emotional_delivery']);
    const finalModelId = modelId || optimalModelId; // Use provided model or optimal selection
    
    console.log('🎯 Model Selection Debug:', {
      providedModelId: modelId,
      envModelId: process.env.ELEVEN_MODEL_ID,
      configModelId: config.voice.model_id,
      baseModelId,
      optimalModelId,
      finalModelId
    });

    // Get model-optimized voice settings
    const optimizedSettings = getModelOptimizedSettings(finalModelId, 'full');
    const finalVoiceSettings = {
      ...optimizedSettings,
      ...config.voice.settings, // Override with config settings
    };

    // Synthesize all chunks with enhanced settings
    const audioBuffers = await synthesizeChunks(textChunks, config, {
      voiceId: finalVoiceId,
      modelId: finalModelId,
      format,
      seed: config.voice.seed,
      speed: config.voice.settings.speed,
      quality: config.voice.settings.quality,
      voiceSettings: finalVoiceSettings,
    });

    // Concatenate audio buffers
    const finalAudioBuffer = concatAudioBuffers(audioBuffers);

    if (finalAudioBuffer.length === 0) {
      return NextResponse.json(
        { error: 'Failed to generate audio' },
        { status: 500 }
      );
    }

    // Generate filename and store audio
    const audioFormat = format.startsWith('mp3') ? 'mp3' : 'wav';
    const filename = generateAudioFilename(manifestId, audioFormat);
    
    const storageResult = await putAudio(filename, finalAudioBuffer, {
      access: 'public',
      contentType: format.startsWith('mp3') ? 'audio/mpeg' : 'audio/wav',
    });

    // Save audio metadata
    await saveAudioMetadata(manifestId, {
      audioUrl: storageResult.url,
      downloadUrl: storageResult.downloadUrl,
      publicUrl: storageResult.publicUrl,
      format: audioFormat,
      sizeBytes: storageResult.size,
    });

    // Prepare response
    const response: SynthesizeResponse = {
      jobId: manifestId,
      url: storageResult.publicUrl,
      downloadUrl: storageResult.downloadUrl,
      metadata: {
        format: audioFormat,
        sizeBytes: storageResult.size,
        duration: manifest.metadata.totalDuration,
        chunks: textChunks.length,
      },
    };

    return NextResponse.json(response);

  } catch (error) {
    console.error('Error in /api/synthesize:', error);

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
 * GET /api/synthesize
 * Returns API documentation and usage information
 */
export async function GET(): Promise<NextResponse> {
  const documentation = {
    endpoint: '/api/synthesize',
    method: 'POST',
    description: 'Synthesizes processed text chunks into audio using ElevenLabs TTS',
    parameters: {
      manifestId: {
        type: 'string',
        required: true,
        description: 'UUID of the processing manifest from /api/prepare',
      },
      voiceId: {
        type: 'string',
        required: false,
        description: 'ElevenLabs voice ID (defaults to ELEVEN_VOICE_ID env var)',
      },
      modelId: {
        type: 'string',
        required: false,
        description: 'ElevenLabs model ID (defaults to ELEVEN_MODEL_ID env var)',
      },
      format: {
        type: 'string',
        required: false,
        default: 'mp3_44100_128',
        enum: ['mp3_44100_128', 'mp3_44100_192', 'wav'],
        description: 'Audio output format',
      },
    },
    response: {
      jobId: 'string - Job identifier (same as manifestId)',
      url: 'string - Public URL for the generated audio',
      downloadUrl: 'string - Download URL for the audio file',
      metadata: 'object - Audio file metadata and statistics',
    },
    requirements: {
      environment: [
        'ELEVENLABS_API_KEY - Your ElevenLabs API key',
        'ELEVEN_VOICE_ID - Angela voice ID from ElevenLabs',
        'ELEVEN_MODEL_ID - ElevenLabs model ID (optional)',
      ],
      storage: 'Vercel Blob storage (configured automatically)',
    },
    example: {
      request: {
        manifestId: 'uuid-from-prepare-endpoint',
        format: 'mp3_44100_128',
      },
      response: {
        jobId: 'uuid-string',
        url: 'https://blob.vercel-storage.com/audio-file.mp3',
        downloadUrl: 'https://blob.vercel-storage.com/audio-file.mp3?download=1',
        metadata: {
          format: 'mp3',
          sizeBytes: 245760,
          duration: 15.3,
          chunks: 2,
        },
      },
    },
  };

  return NextResponse.json(documentation);
}
