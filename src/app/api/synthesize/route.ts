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
  getModelOptimizedSettings,
} from '@/lib/tts';
import { loadConfig, type VoiceConfig } from '@/lib/styling';

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

    // Extract full chunk objects (needed for analysis) and text strings (needed for synthesis)  
    const fullChunks = manifest.chunks;
    const textChunks = fullChunks.map(chunk => chunk.body);
    
    if (textChunks.length === 0) {
      return NextResponse.json(
        { error: 'No text chunks found in manifest' },
        { status: 400 }
      );
    }

    // Intelligent model selection based on content characteristics
    const finalVoiceId = voiceId || process.env.ELEVEN_VOICE_ID || config.voice.voice_id;
    const baseModelId = modelId || process.env.ELEVEN_MODEL_ID || config.voice.model_id;
    
    // Analyze content to determine optimal model (using full chunk objects)
    const contentStats = analyzeContentForModelSelection(fullChunks);
    const smartModelId = selectModelForContent(contentStats, config, baseModelId);
    const finalModelId = modelId || smartModelId; // Use provided model or smart selection
    
    console.log('🎯 Model Selection Debug:', {
      providedModelId: modelId,
      envModelId: process.env.ELEVEN_MODEL_ID,
      configModelId: config.voice.model_id,
      baseModelId,
      smartModelId,
      finalModelId
    });

    // Get model-optimized voice settings with v3 enhancements
    const optimizedSettings = getModelOptimizedSettings(finalModelId, 'full');
    const finalVoiceSettings = {
      ...optimizedSettings,
      ...config.voice.settings, // Override with config settings
    };

    // v2 voice settings are already configured in angela-voice.yaml
    console.log('🎙️ v2 Synthesis Settings:', {
      model: finalModelId,
      stability: finalVoiceSettings.stability,
      similarity_boost: finalVoiceSettings.similarity_boost,
      style: finalVoiceSettings.style,
      speaker_boost: finalVoiceSettings.speaker_boost
    });

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
 * Analyzes content characteristics to determine optimal model selection
 */
function analyzeContentForModelSelection(textChunks: { id: number; body: string; charCount: number; estSeconds: number }[]) {
  console.log('📊 Content Analysis Debug:', {
    chunkCount: textChunks.length,
    sampleChunk: textChunks[0] ? {
      hasCharCount: 'charCount' in textChunks[0],
      hasEstSeconds: 'estSeconds' in textChunks[0],
      charCountValue: textChunks[0].charCount,
      estSecondsValue: textChunks[0].estSeconds,
      bodyPreview: textChunks[0].body?.substring(0, 100) + '...'
    } : 'No chunks'
  });

  const totalChars = textChunks.reduce((sum, chunk) => sum + (chunk.charCount || 0), 0);
  const totalEstSeconds = textChunks.reduce((sum, chunk) => sum + (chunk.estSeconds || 0), 0);
  const avgChunkSize = textChunks.length > 0 ? totalChars / textChunks.length : 0;
  
  // Count audio tags in content - improved regex to catch all variations
  const allText = textChunks.map(chunk => chunk.body || '').join(' ');
  const audioTagMatches = allText.match(/\[[\w\s]+\]/g) || [];
  const audioTagDensity = textChunks.length > 0 ? audioTagMatches.length / textChunks.length : 0;
  
  console.log('🏷️ Audio Tag Detection:', {
    textSample: allText.substring(0, 200) + '...',
    tagsFound: audioTagMatches,
    tagCount: audioTagMatches.length
  });
  
  // Analyze content complexity
  const hasComplexEmotions = audioTagMatches.some(tag => 
    ['[mysterious]', '[mystical]', '[knowing]', '[curious]', '[intrigued]'].includes(tag)
  );
  
  const isLongForm = totalEstSeconds > 180; // 3+ minutes
  const hasHighTagDensity = audioTagDensity > 1.0; // More than 1 tag per chunk on average
  
  return {
    totalChars,
    totalEstSeconds,
    chunkCount: textChunks.length,
    avgChunkSize,
    audioTagCount: audioTagMatches.length,
    audioTagDensity,
    hasComplexEmotions,
    isLongForm,
    hasHighTagDensity,
    audioTags: audioTagMatches
  };
}

/**
 * Selects the best model based on content analysis
 */
function selectModelForContent(stats: { totalEstSeconds: number; chunkCount: number; avgChunkSize: number }, config: VoiceConfig, fallbackModel: string) {
  console.log('🎯 v2 Model Selection:', {
    duration: `${Math.round(stats.totalEstSeconds / 60)}m ${Math.round(stats.totalEstSeconds % 60)}s`,
    chunks: stats.chunkCount,
    avgChunkSize: Math.round(stats.avgChunkSize),
  });

  // Use model selection from config based on content type
  const modelSelection = config.model_selection as any || {};
  
  // Long-form content (>3 minutes) - use efficient model
  if (stats.totalEstSeconds > 180) {
    const longFormModel = modelSelection.long_form || 'eleven_multilingual_v2';
    console.log(`📚 Long-form content detected (${Math.round(stats.totalEstSeconds / 60)}+ minutes): using ${longFormModel}`);
    return longFormModel;
  }
  
  // Standard content - use configured full model (always v2 for cloned voice)
  const standardModel = modelSelection.full || fallbackModel;
  console.log(`📝 Standard content: using ${standardModel}`);
  return standardModel;
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
