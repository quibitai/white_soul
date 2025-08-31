/**
 * Enhanced ElevenLabs synthesis for dev_plan_02 architecture
 * Provides single chunk synthesis with proper error handling and retry logic
 */

import { TuningSettings } from '@/lib/types/tuning';

/**
 * Options for ElevenLabs synthesis
 */
export interface SynthesisOptions {
  voiceId: string;
  modelId: string;
  voiceSettings: TuningSettings['eleven'];
  format: 'wav' | 'mp3';
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

  // Use WAV format for processing (44.1kHz mono)
  const outputFormat = format === 'wav' ? 'wav' : 'mp3_44100_128';
  const url = `https://api.elevenlabs.io/v1/text-to-speech/${voiceId}?output_format=${outputFormat}`;

  const requestBody: Record<string, unknown> = {
    text: ssmlContent.trim(),
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

  console.log('🎙️ ElevenLabs synthesis:', {
    model: modelId,
    textLength: ssmlContent.length,
    hasSSML: /<[^>]+>/.test(ssmlContent),
    hasContext: !!(previousText || nextText),
    stability: voiceSettings.stability,
    style: voiceSettings.style,
  });

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'xi-api-key': process.env.ELEVENLABS_API_KEY,
        'Content-Type': 'application/json',
        'Accept': format === 'wav' ? 'audio/wav' : 'audio/mpeg',
      },
      body: JSON.stringify(requestBody),
    });

    if (!response.ok) {
      let errorMessage = `HTTP ${response.status}`;
      try {
        const errorData = await response.json();
        errorMessage = errorData.detail?.message || errorData.message || errorMessage;
      } catch {
        errorMessage = await response.text() || errorMessage;
      }
      throw new Error(`ElevenLabs API error: ${errorMessage}`);
    }

    const arrayBuffer = await response.arrayBuffer();
    const audioBuffer = Buffer.from(arrayBuffer);

    if (audioBuffer.length === 0) {
      throw new Error('Received empty audio buffer from ElevenLabs');
    }

    console.log('✅ Synthesis successful:', {
      audioSize: audioBuffer.length,
      estimatedDuration: `${Math.round(audioBuffer.length / (44100 * 2))}s`,
    });

    return audioBuffer;

  } catch (error) {
    console.error('❌ ElevenLabs synthesis failed:', error);
    
    if (error instanceof Error) {
      // Add context to error message
      throw new Error(`TTS synthesis failed for ${ssmlContent.slice(0, 50)}...: ${error.message}`);
    }
    
    throw new Error('TTS synthesis failed: Unknown error');
  }
}

/**
 * Synthesize with automatic retry and jitter
 * @param ssmlContent - SSML content to synthesize
 * @param options - Synthesis options
 * @param maxRetries - Maximum number of retries (default: 1)
 * @returns Audio buffer
 */
export async function synthesizeWithRetry(
  ssmlContent: string,
  options: SynthesisOptions,
  maxRetries: number = 1
): Promise<Buffer> {
  let lastError: Error | null = null;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      // Add jitter to voice settings on retry
      const jitteredOptions = attempt > 0 ? addVoiceJitter(options) : options;
      
      if (attempt > 0) {
        console.log(`🔄 Retry attempt ${attempt}/${maxRetries} with jitter`);
        // Add delay with exponential backoff
        const delay = Math.min(1000 * Math.pow(2, attempt - 1), 5000);
        await new Promise(resolve => setTimeout(resolve, delay));
      }

      return await synthesizeElevenLabs(ssmlContent, jitteredOptions);

    } catch (error) {
      lastError = error instanceof Error ? error : new Error('Unknown error');
      console.warn(`⚠️ Synthesis attempt ${attempt + 1} failed:`, lastError.message);
      
      if (attempt === maxRetries) {
        break; // Don't continue if this was the last attempt
      }
    }
  }

  throw lastError || new Error('All synthesis attempts failed');
}

/**
 * Add small random jitter to voice settings for retry attempts
 * @param options - Original synthesis options
 * @returns Options with jittered voice settings
 */
function addVoiceJitter(options: SynthesisOptions): SynthesisOptions {
  const jitterAmount = 0.05; // ±5% jitter
  
  return {
    ...options,
    voiceSettings: {
      ...options.voiceSettings,
      stability: Math.max(0, Math.min(1, 
        options.voiceSettings.stability + (Math.random() - 0.5) * jitterAmount
      )),
      style: Math.max(0, Math.min(1, 
        options.voiceSettings.style + (Math.random() - 0.5) * jitterAmount
      )),
      // Keep similarityBoost and speakerBoost unchanged for consistency
    },
  };
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
