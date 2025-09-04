/**
 * Enhanced ElevenLabs synthesis for dev_plan_02 architecture
 * Provides single chunk synthesis with proper error handling and retry logic
 * Uses undici for robust HTTP client with serverless optimization
 */

import { TuningSettings } from '@/lib/types/tuning';
import { cleanSSMLForSynthesis, validateSSMLForSynthesis } from '@/lib/styling/ssml';
import { elevenLabsFetch, elevenLabsAgent, createElevenLabsTimeout, logNetworkConfig } from './http';
import { Readable } from 'node:stream';
import type { Response } from 'undici';

/**
 * Options for ElevenLabs synthesis
 */
export interface SynthesisOptions {
  voiceId: string;
  modelId: string;
  voiceSettings: TuningSettings['eleven'];
  format: 'wav' | 'mp3' | 'pcm';
  seed?: number;
  previousText?: string;
  nextText?: string;
}

/**
 * Synthesize a single SSML chunk using ElevenLabs
 * @param ssmlContent - SSML content to synthesize
 * @param options - Synthesis options
 * @returns Audio buffer (WAV format for processing)
 */
export async function synthesizeElevenLabs(
  ssmlContent: string,
  options: SynthesisOptions
): Promise<Buffer> {
  if (!ssmlContent?.trim()) {
    throw new Error('SSML content is required');
  }

  // Clean SSML to fix malformed tags before synthesis
  const cleanedSSML = cleanSSMLForSynthesis(ssmlContent);

  if (!process.env.ELEVENLABS_API_KEY) {
    throw new Error('ELEVENLABS_API_KEY environment variable is required');
  }

  const {
    voiceId,
    modelId,
    voiceSettings,
    format = 'wav',
    seed,
    previousText,
    nextText,
  } = options;

  // Use PCM format for processing (44.1kHz) - ElevenLabs doesn't support 'wav'
  const outputFormat = format === 'wav' || format === 'pcm' ? 'pcm_44100' : 'mp3_44100_128';
  const url = `https://api.elevenlabs.io/v1/text-to-speech/${voiceId}?output_format=${outputFormat}`;

  const requestBody: Record<string, unknown> = {
    text: cleanedSSML.trim(),
    model_id: modelId,
    voice_settings: {
      stability: voiceSettings.stability,
      similarity_boost: voiceSettings.similarityBoost,
      style: voiceSettings.style,
      use_speaker_boost: voiceSettings.speakerBoost,
    },
    enable_ssml_parsing: true, // Always enable SSML parsing
  };

  // Add optional parameters
  if (seed !== undefined) {
    requestBody.seed = seed;
  }

  if (previousText) {
    requestBody.previous_text = previousText.slice(-300); // Last 300 chars for context
  }

  if (nextText) {
    requestBody.next_text = nextText.slice(0, 300); // First 300 chars for context
  }

  // Validate SSML before sending to ElevenLabs
  const validation = validateSSMLForSynthesis(cleanedSSML);
  if (!validation.isValid) {
    console.error('❌ SSML validation failed:', validation.issues);
    throw new Error(`Invalid SSML: ${validation.issues.join(', ')}`);
  }
  
  if (validation.warnings.length > 0) {
    console.warn('⚠️ SSML validation warnings:', validation.warnings);
  }

  console.log('🎙️ ElevenLabs synthesis:', {
    model: modelId,
    textLength: cleanedSSML.length,
    hasSSML: /<[^>]+>/.test(cleanedSSML),
    hasBreaks: /<break\s+time="[^"]+"\s*\/?>/.test(cleanedSSML),
    hasContext: !!(previousText || nextText),
    stability: voiceSettings.stability,
    style: voiceSettings.style,
    validationPassed: validation.isValid,
    warnings: validation.warnings.length,
    ssmlPreview: cleanedSSML.slice(0, 200) + (cleanedSSML.length > 200 ? '...' : ''),
  });

  try {
    console.log('🌐 Making ElevenLabs API request...');
    console.log('🔑 API Key present:', !!process.env.ELEVENLABS_API_KEY);
    console.log('🎤 Voice ID:', voiceId);
    console.log('🤖 Model ID:', modelId);
    
    // Log network configuration for debugging
    logNetworkConfig();
    
    // Create timeout signal optimized for environment
    const timeoutSignal = createElevenLabsTimeout();
    
    console.log('📤 Sending request to:', url);
    console.log('📦 Request body size:', JSON.stringify(requestBody).length, 'bytes');
    console.log('🌐 Using undici with custom dispatcher for robust networking');
    
    let response: Response;
    try {
      console.log('🚀 Starting undici request with custom agent...');
      response = await elevenLabsFetch(url, {
        method: 'POST',
        headers: {
          'xi-api-key': process.env.ELEVENLABS_API_KEY!,
          'Content-Type': 'application/json',
          'Accept': format === 'wav' ? 'audio/wav' : 'audio/mpeg',
        },
        body: JSON.stringify(requestBody),
        dispatcher: elevenLabsAgent,
        signal: timeoutSignal,
      });
      console.log('📨 Undici request completed, processing response...');
    } catch (fetchError) {
      console.error('💥 Undici request failed:', fetchError);
      if (fetchError instanceof Error && fetchError.name === 'AbortError') {
        throw new Error(`ElevenLabs API request timed out - check network connectivity`);
      }
      throw fetchError;
    }
    console.log(`📡 ElevenLabs API response: ${response.status} ${response.statusText}`);

    if (!response.ok) {
      let errorMessage = `HTTP ${response.status}`;
      try {
        const errorData = await response.json() as unknown;
        console.error('❌ ElevenLabs API error details:', errorData);
        
        // Safely extract error message from unknown response
        if (typeof errorData === 'object' && errorData !== null) {
          const data = errorData as Record<string, unknown>;
          const detailMessage = typeof data.detail === 'object' && data.detail !== null 
            ? (data.detail as Record<string, unknown>).message 
            : undefined;
          const directMessage = data.message;
          
          errorMessage = (typeof detailMessage === 'string' ? detailMessage : 
                        typeof directMessage === 'string' ? directMessage : 
                        errorMessage);
        }
      } catch {
        errorMessage = await response.text() || errorMessage;
        console.error('❌ Could not parse error response from ElevenLabs API');
      }
      throw new Error(`ElevenLabs API error: ${errorMessage}`);
    }

    console.log('📥 Streaming audio response directly to buffer...');
    
    if (!response.body) {
      throw new Error('Received empty response body from ElevenLabs');
    }

    // Stream response directly to buffer for memory efficiency
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const nodeStream = Readable.fromWeb(response.body as any);
    const chunks: Buffer[] = [];
    
    for await (const chunk of nodeStream) {
      chunks.push(Buffer.from(chunk));
    }
    
    const audioBuffer = Buffer.concat(chunks);
    console.log(`🎵 Audio buffer streamed: ${audioBuffer.length} bytes`);

    if (audioBuffer.length === 0) {
      throw new Error('Received empty audio buffer from ElevenLabs');
    }

    console.log('✅ Synthesis successful:', {
      audioSize: audioBuffer.length,
      estimatedDuration: `${Math.round(audioBuffer.length / (44100 * 2))}s`,
    });

    return audioBuffer;

  } catch (error) {
    if (error instanceof Error && error.name === 'AbortError') {
      console.error('❌ ElevenLabs synthesis timeout after 30 seconds');
      throw new Error('Synthesis timeout - ElevenLabs API took too long to respond');
    }
    
    console.error('❌ ElevenLabs synthesis failed:', error);
    
    if (error instanceof Error) {
      // Add context to error message
      throw new Error(`TTS synthesis failed for ${cleanedSSML.slice(0, 50)}...: ${error.message}`);
    }
    
    throw new Error('TTS synthesis failed: Unknown error');
  }
}

/**
 * Synthesize with automatic retry and jitter
 * @param ssmlContent - SSML content to synthesize
 * @param options - Synthesis options
 * @returns Audio buffer
 */
export async function synthesizeWithRetry(
  ssmlContent: string,
  options: SynthesisOptions
): Promise<Buffer> {
  console.log(`🔄 Starting synthesis with undici built-in retry logic`);
  
  // Undici agent handles retries automatically, so we just need simple error handling
  try {
    return await synthesizeElevenLabs(ssmlContent, options);
  } catch (error) {
    console.error('❌ Synthesis failed:', error);
    
    // Don't retry on authentication errors
    if (error instanceof Error && (error.message.includes('401') || error.message.includes('403'))) {
      console.error('🚫 Authentication error - check API key and voice ID');
      throw error;
    }
    
    throw error;
  }
}


/**
 * Validate ElevenLabs configuration
 * @returns True if configuration is valid
 */
export async function validateElevenLabsConfig(): Promise<boolean> {
  try {
    if (!process.env.ELEVENLABS_API_KEY) {
      console.error('ELEVENLABS_API_KEY not configured');
      return false;
    }

    if (!process.env.ELEVEN_VOICE_ID) {
      console.error('ELEVEN_VOICE_ID not configured');
      return false;
    }

    // Test API key with a simple request
    const response = await fetch('https://api.elevenlabs.io/v1/voices', {
      headers: {
        'xi-api-key': process.env.ELEVENLABS_API_KEY,
      },
    });

    if (!response.ok) {
      console.error('ElevenLabs API key validation failed:', response.status);
      return false;
    }

    console.log('✅ ElevenLabs configuration validated');
    return true;

  } catch (error) {
    console.error('ElevenLabs configuration validation error:', error);
    return false;
  }
}

/**
 * Get voice information from ElevenLabs
 * @param voiceId - Voice ID to query
 * @returns Voice information
 */
export async function getVoiceInfo(voiceId: string): Promise<{
  name: string;
  category: string;
  description: string;
  settings?: {
    stability: number;
    similarity_boost: number;
    style: number;
    use_speaker_boost: boolean;
  };
} | null> {
  try {
    if (!process.env.ELEVENLABS_API_KEY) {
      throw new Error('ELEVENLABS_API_KEY not configured');
    }

    const response = await fetch(`https://api.elevenlabs.io/v1/voices/${voiceId}`, {
      headers: {
        'xi-api-key': process.env.ELEVENLABS_API_KEY,
      },
    });

    if (!response.ok) {
      return null;
    }

    const voiceData = await response.json();
    return {
      name: voiceData.name,
      category: voiceData.category,
      description: voiceData.description,
      settings: voiceData.settings,
    };

  } catch (error) {
    console.error('Failed to get voice info:', error);
    return null;
  }
}
