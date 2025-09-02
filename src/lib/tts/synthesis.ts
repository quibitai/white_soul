/**
 * Enhanced ElevenLabs synthesis for dev_plan_02 architecture
 * Provides single chunk synthesis with proper error handling and retry logic
 */

import { TuningSettings } from '@/lib/types/tuning';
import { cleanSSMLForSynthesis, validateSSMLForSynthesis } from '@/lib/styling/ssml';

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
  // TEMPORARY: Add emergency bypass for debugging
  const BYPASS_ELEVENLABS = process.env.BYPASS_ELEVENLABS === 'true';
  
  if (BYPASS_ELEVENLABS) {
    console.log('🚨 BYPASS MODE: Returning dummy audio buffer instead of calling ElevenLabs');
    // Return a small dummy audio buffer (1 second of silence)
    const dummyBuffer = Buffer.alloc(44100 * 2); // 1 second of 16-bit stereo silence
    return dummyBuffer;
  }
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
    
    // Add aggressive timeout to prevent hanging - reduced to 10s
    const controller = new AbortController();
    const timeoutId = setTimeout(() => {
      console.error('⏰ ElevenLabs API request timeout (10s) - aborting request');
      controller.abort();
    }, 10000); // 10 second timeout to prevent serverless function timeout
    
    console.log('📤 Sending request to:', url);
    console.log('📦 Request body size:', JSON.stringify(requestBody).length, 'bytes');
    
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'xi-api-key': process.env.ELEVENLABS_API_KEY,
        'Content-Type': 'application/json',
        'Accept': format === 'wav' ? 'audio/wav' : 'audio/mpeg',
      },
      body: JSON.stringify(requestBody),
      signal: controller.signal,
    });
    
    console.log('📨 Fetch completed, processing response...');
    
    clearTimeout(timeoutId);
    console.log(`📡 ElevenLabs API response: ${response.status} ${response.statusText}`);

    if (!response.ok) {
      let errorMessage = `HTTP ${response.status}`;
      try {
        const errorData = await response.json();
        console.error('❌ ElevenLabs API error details:', errorData);
        errorMessage = errorData.detail?.message || errorData.message || errorMessage;
      } catch {
        errorMessage = await response.text() || errorMessage;
        console.error('❌ Could not parse error response from ElevenLabs API');
      }
      throw new Error(`ElevenLabs API error: ${errorMessage}`);
    }

    console.log('📥 Processing audio response...');
    const arrayBuffer = await response.arrayBuffer();
    const audioBuffer = Buffer.from(arrayBuffer);
    console.log(`🎵 Audio buffer received: ${audioBuffer.length} bytes`);

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
